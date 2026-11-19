import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import type MoySkladModuleService from "../modules/moysklad/service"

/**
 * Разовая простановка metadata.moysklad_uom из МойСклад (шт/м/упак…).
 */
export default async function backfillUom({ container }: ExecArgs) {
  const moysklad: MoySkladModuleService = container.resolve(MOYSKLAD_MODULE)
  const productModule = container.resolve(Modules.PRODUCT)

  console.log("Читаю товары МойСклад с expand=uom…")
  const msProducts = await moysklad.getClient().listProducts(false)
  const uomById = new Map<string, string>()
  for (const ms of msProducts) {
    uomById.set(ms.id, moysklad.pickUomName(ms))
  }
  console.log(`МС: ${uomById.size} товаров`)

  let updated = 0
  let skipped = 0
  let missing = 0

  for (let skip = 0; ; skip += 100) {
    const page = await productModule.listProducts(
      {},
      { take: 100, skip, relations: ["variants"] }
    )
    if (!page.length) break

    for (const p of page) {
      const meta = (p.metadata || {}) as Record<string, string>
      const msId = meta.moysklad_id
      if (!msId) {
        missing += 1
        continue
      }
      const uom = uomById.get(msId) || "шт"
      if (meta.moysklad_uom === uom) {
        skipped += 1
        continue
      }

      await productModule.updateProducts(p.id, {
        metadata: { ...meta, moysklad_uom: uom },
      })

      for (const v of p.variants || []) {
        const vMeta = (v.metadata || {}) as Record<string, string>
        await productModule.updateProductVariants(v.id, {
          metadata: { ...vMeta, moysklad_uom: uom },
        })
      }

      updated += 1
      if (updated % 500 === 0) console.log(`uom: ${updated}…`)
    }

    if (page.length < 100) break
  }

  console.log({ updated, skipped, missing })
}
