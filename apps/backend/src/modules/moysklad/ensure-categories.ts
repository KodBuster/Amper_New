import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createProductCategoriesWorkflow,
  deleteProductCategoriesWorkflow,
  updateProductCategoriesWorkflow,
} from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { toCategoryHandle } from "./category-utils"

export type CategoryEnsureResult = {
  /** Имя корневой папки МС → id категории Medusa */
  byRootName: Map<string, string>
  created: number
  reactivated: number
  deactivated: number
  deleted: number
}

/**
 * Синхронизировать корневые папки МойСклад с product categories Medusa.
 * Новые — создать; пропавшие — деактивировать (и удалить пустые).
 */
export async function ensureMoyskladCategories(
  container: MedusaContainer,
  rootNames: string[]
): Promise<CategoryEnsureResult> {
  const productModule = container.resolve(Modules.PRODUCT)
  const wanted = [
    ...new Set(rootNames.map((n) => n.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ru"))

  const existing = await productModule.listProductCategories(
    {},
    { take: 500 }
  )

  const byRoot = new Map<
    string,
    Awaited<ReturnType<typeof productModule.listProductCategories>>[0]
  >()
  for (const cat of existing) {
    const root = String(
      (cat.metadata as Record<string, string> | null)?.moysklad_root || ""
    ).trim()
    if (root) byRoot.set(root, cat)
  }

  const byRootName = new Map<string, string>()
  let created = 0
  let reactivated = 0
  let deactivated = 0
  let deleted = 0

  const toCreate: Array<{
    name: string
    handle: string
    is_active: boolean
    is_internal: boolean
    metadata: Record<string, string>
  }> = []

  for (const name of wanted) {
    const found = byRoot.get(name)
    if (found) {
      byRootName.set(name, found.id)
      if (!found.is_active) {
        await updateProductCategoriesWorkflow(container).run({
          input: {
            selector: { id: found.id },
            update: { is_active: true, name },
          },
        })
        reactivated += 1
      }
      continue
    }
    toCreate.push({
      name,
      handle: toCategoryHandle(name),
      is_active: true,
      is_internal: false,
      metadata: { moysklad_root: name },
    })
  }

  if (toCreate.length) {
    // handle может совпасть — добавим суффикс при ошибке по одному
    for (const payload of toCreate) {
      try {
        const { result } = await createProductCategoriesWorkflow(container).run({
          input: { product_categories: [payload] },
        })
        const cat = result[0]
        if (cat?.id) {
          byRootName.set(payload.name, cat.id)
          created += 1
        }
      } catch {
        const { result } = await createProductCategoriesWorkflow(container).run({
          input: {
            product_categories: [
              {
                ...payload,
                handle: `${payload.handle}-${Date.now().toString(36).slice(-4)}`,
              },
            ],
          },
        })
        const cat = result[0]
        if (cat?.id) {
          byRootName.set(payload.name, cat.id)
          created += 1
        }
      }
    }
  }

  const wantedSet = new Set(wanted)
  for (const [root, cat] of byRoot) {
    if (wantedSet.has(root)) continue

    // Папка пропала из МС — гасим на витрине
    if (cat.is_active) {
      await updateProductCategoriesWorkflow(container).run({
        input: {
          selector: { id: cat.id },
          update: { is_active: false },
        },
      })
      deactivated += 1
    }

    // Если товаров не осталось — удаляем категорию
    try {
      const linked = await productModule.listProducts(
        { category_id: [cat.id] } as never,
        { take: 1 }
      )
      if (!linked.length) {
        await deleteProductCategoriesWorkflow(container).run({
          input: [cat.id],
        })
        deleted += 1
      }
    } catch {
      // фильтр category_id может отличаться — оставляем деактивированной
    }
  }

  return { byRootName, created, reactivated, deactivated, deleted }
}
