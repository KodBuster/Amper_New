import type { ExecArgs } from "@medusajs/framework/types"
import { linkSalesChannelsToStockLocationWorkflow } from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

/**
 * Связать sales channel ↔ склад и варианты ↔ inventory items.
 * Без этого Store cart: «Sales channel … is not associated with any stock location».
 */
export default async function fixInventoryLinks({ container }: ExecArgs) {
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve(Modules.PRODUCT)
  const inventoryModule = container.resolve(Modules.INVENTORY)
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)

  const channels = await salesChannelModule.listSalesChannels({}, { take: 5 })
  const locations = await stockLocationModule.listStockLocations({}, { take: 5 })
  const channel = channels[0]
  let location = locations[0]

  if (!channel) {
    console.error("Нет sales channel")
    return
  }
  if (!location) {
    location = await stockLocationModule.createStockLocations({
      name: "Основной склад",
    })
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: location.id,
      add: [channel.id],
      remove: [],
    },
  })
  console.log(`SC ${channel.id} ↔ SL ${location.id}`)

  // Уже связанные варианты
  const linked = new Set<string>()
  {
    const { data } = await query.graph({
      entity: "product_variant_inventory_item",
      fields: ["variant_id"],
      filters: {},
    })
    for (const row of data as Array<{ variant_id: string }>) {
      linked.add(row.variant_id)
    }
  }
  console.log(`Уже с inventory: ${linked.size}`)

  // Inventory по SKU — чтобы не плодить дубли из синка остатков
  const invBySku = new Map<string, string>()
  {
    const pageSize = 500
    for (let skip = 0; ; skip += pageSize) {
      const page = await inventoryModule.listInventoryItems(
        {},
        { take: pageSize, skip }
      )
      for (const item of page) {
        if (item.sku) invBySku.set(item.sku, item.id)
      }
      if (page.length < pageSize) break
    }
  }

  let createdLinks = 0
  let createdItems = 0
  let levels = 0
  let errors = 0
  const pageSize = 100

  for (let skip = 0; ; skip += pageSize) {
    const page = await productModule.listProductVariants(
      {},
      { take: pageSize, skip }
    )
    if (!page.length) break

    const toLink: Parameters<typeof link.create>[0] = []
    const needLevels: string[] = []

    for (const v of page) {
      try {
        let inventoryItemId = linked.has(v.id)
          ? undefined
          : invBySku.get(v.sku || "")

        if (!linked.has(v.id)) {
          if (!inventoryItemId) {
            const item = await inventoryModule.createInventoryItems({
              sku: v.sku || v.id,
              title: v.title,
            })
            inventoryItemId = item.id
            if (v.sku) invBySku.set(v.sku, item.id)
            createdItems += 1
          }
          toLink.push({
            [Modules.PRODUCT]: { variant_id: v.id },
            [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
            data: { required_quantity: 1 },
          })
          linked.add(v.id)
          needLevels.push(inventoryItemId!)
        } else {
          // Уже есть link — всё равно проверим level
          const { data } = await query.graph({
            entity: "product_variant_inventory_item",
            fields: ["inventory_item_id"],
            filters: { variant_id: v.id },
          })
          const iid = (data as Array<{ inventory_item_id: string }>)[0]
            ?.inventory_item_id
          if (iid) needLevels.push(iid)
        }
      } catch (e) {
        errors += 1
        console.error(v.id, (e as Error).message)
      }
    }

    if (toLink.length) {
      await link.create(toLink)
      createdLinks += toLink.length
    }

    for (const inventoryItemId of needLevels) {
      try {
        const existing = await inventoryModule.listInventoryLevels(
          { inventory_item_id: inventoryItemId, location_id: location.id },
          { take: 1 }
        )
        if (!existing.length) {
          await inventoryModule.createInventoryLevels({
            inventory_item_id: inventoryItemId,
            location_id: location.id,
            stocked_quantity: 0,
          })
          levels += 1
        }
      } catch {
        // level мог уже появиться
      }
    }

    if ((skip + page.length) % 500 === 0 || page.length < pageSize) {
      console.log(
        `… skip=${skip + page.length} links=${createdLinks} items=${createdItems} levels=${levels}`
      )
    }

    if (page.length < pageSize) break
  }

  console.log({ createdLinks, createdItems, levels, errors })
}
