import type { ExecArgs } from "@medusajs/framework/types"
import { upsertVariantPricesWorkflow } from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Разовая простановка цен Medusa из metadata.moysklad_price_kopecks.
 * Без этого Store cart отвечает «Variants … do not have a price».
 */
export default async function backfillVariantPrices({ container }: ExecArgs) {
  const productModule = container.resolve(Modules.PRODUCT)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const linkService = link.getLinkModule(
    Modules.PRODUCT,
    "variant_id",
    Modules.PRICING,
    "price_set_id"
  )
  if (!linkService) throw new Error("Product-pricing link module is not available")

  const pageSize = 50
  let updated = 0
  let skipped = 0
  let errors = 0

  for (let skip = 0; ; skip += pageSize) {
    const page = await productModule.listProductVariants(
      {},
      { take: pageSize, skip, relations: ["product"] }
    )
    if (!page.length) break

    for (const v of page) {
      const meta = (v.metadata || {}) as Record<string, string>
      const kopecks = Number(meta.moysklad_price_kopecks || 0)
      if (!kopecks || kopecks <= 0) {
        skipped += 1
        continue
      }

      const productId =
        (v as { product_id?: string }).product_id ||
        (v as { product?: { id?: string } }).product?.id
      if (!productId) {
        skipped += 1
        continue
      }

      try {
        const existing = (await linkService.list(
          { variant_id: [v.id] },
          { select: ["variant_id", "price_set_id"] }
        )) as Array<{ variant_id: string }>

        // Уже есть price set и флаг совпадает — пропускаем
        if (
          existing.length &&
          meta.moysklad_medusa_priced === String(Math.round(kopecks))
        ) {
          skipped += 1
          continue
        }

        await upsertVariantPricesWorkflow(container).run({
          input: {
            variantPrices: [
              {
                variant_id: v.id,
                product_id: productId,
                prices: [
                  {
                    amount: Math.round(kopecks) / 100,
                    currency_code: "rub",
                  },
                ],
              },
            ],
            previousVariantIds: existing.length ? [v.id] : [],
          },
        })

        await productModule.updateProductVariants(v.id, {
          metadata: {
            ...meta,
            moysklad_medusa_priced: String(Math.round(kopecks)),
          },
        })

        updated += 1
        if (updated % 100 === 0) {
          console.log(`Цены: ${updated}…`)
        }
      } catch (e) {
        errors += 1
        console.error(`${v.id}:`, (e as Error).message)
      }
    }

    if (page.length < pageSize) break
  }

  console.log({ updated, skipped, errors })
}
