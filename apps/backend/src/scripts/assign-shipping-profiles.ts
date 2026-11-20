import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Привязывает все товары без профиля доставки к Default Shipping Profile.
 * Без этого Store не отдаёт shipping options для корзины.
 */
export default async function assignShippingProfiles({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT)

  const profiles = await fulfillmentModule.listShippingProfiles({}, { take: 20 })
  const profile =
    profiles.find((p) => /default/i.test(p.name) || p.type === "default") ||
    profiles[0]
  if (!profile) {
    throw new Error("Нет shipping profile. Сначала ensure:fulfillment / seed.")
  }

  const take = 200
  let skip = 0
  let linked = 0
  let skipped = 0

  for (;;) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "shipping_profile.id"],
      pagination: { take, skip },
    })
    const batch = data || []
    if (!batch.length) break

    for (const row of batch) {
      const id = (row as { id: string }).id
      const has = (row as { shipping_profile?: { id?: string } }).shipping_profile
        ?.id
      if (has) {
        skipped++
        continue
      }
      try {
        await link.create({
          [Modules.PRODUCT]: { product_id: id },
          [Modules.FULFILLMENT]: { shipping_profile_id: profile.id },
        })
        linked++
      } catch (e) {
        logger.warn(
          `Не удалось привязать ${id}: ${(e as Error).message?.slice(0, 120)}`
        )
      }
    }

    if (batch.length < take) break
    skip += take
    logger.info(`Прогресс: linked=${linked}, skip=${skipped}, offset=${skip}`)
  }

  logger.info(
    `Готово: привязано ${linked}, уже были ${skipped}. Профиль: ${profile.name} (${profile.id})`
  )
}
