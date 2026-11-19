import type { ExecArgs } from "@medusajs/framework/types"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { rootFolderFromPath } from "../modules/moysklad/category-utils"
import { ensureMoyskladCategories } from "../modules/moysklad/ensure-categories"

/**
 * Разовая привязка товаров к категориям по metadata.moysklad_path.
 */
export default async function backfillCategories({ container }: ExecArgs) {
  const productModule = container.resolve(Modules.PRODUCT)

  const roots: string[] = []
  const productRoots: Array<{ id: string; root: string; meta: Record<string, string> }> =
    []

  for (let skip = 0; ; skip += 200) {
    const page = await productModule.listProducts(
      {},
      { take: 200, skip, relations: ["categories"] }
    )
    if (!page.length) break
    for (const p of page) {
      const meta = (p.metadata || {}) as Record<string, string>
      const root = rootFolderFromPath(meta.moysklad_path)
      if (!root) continue
      roots.push(root)
      productRoots.push({ id: p.id, root, meta })
    }
    if (page.length < 200) break
  }

  const { byRootName, created, reactivated, deactivated, deleted } =
    await ensureMoyskladCategories(container, roots)

  console.log("categories", { created, reactivated, deactivated, deleted })

  let linked = 0
  let skipped = 0
  let errors = 0

  // Пачками по 50
  const batchSize = 50
  for (let i = 0; i < productRoots.length; i += batchSize) {
    const slice = productRoots.slice(i, i + batchSize)
    const products: Array<{ id: string; categories: Array<{ id: string }> }> =
      []

    for (const row of slice) {
      const catId = byRootName.get(row.root)
      if (!catId) {
        skipped += 1
        continue
      }
      products.push({ id: row.id, categories: [{ id: catId }] })
    }

    if (!products.length) continue

    try {
      await updateProductsWorkflow(container).run({
        input: { products },
      })
      linked += products.length

      for (const row of slice) {
        const catId = byRootName.get(row.root)
        if (!catId) continue
        try {
          await productModule.updateProducts(row.id, {
            metadata: {
              ...row.meta,
              moysklad_folder: row.root,
            },
          })
        } catch {
          // категория уже привязана
        }
      }

      if (linked % 500 === 0 || i + batchSize >= productRoots.length) {
        console.log(`linked ${linked}…`)
      }
    } catch (e) {
      errors += products.length
      console.error("batch failed:", (e as Error).message)
    }
  }

  console.log({ linked, skipped, errors, categories: byRootName.size })
}
