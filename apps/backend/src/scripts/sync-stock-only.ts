import type { ExecArgs } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import type MoySkladModuleService from "../modules/moysklad/service"

/** Быстро подтянуть остатки МойСклад → inventory levels */
export default async function syncStockOnly({ container }: ExecArgs) {
  const moysklad: MoySkladModuleService = container.resolve(MOYSKLAD_MODULE)
  const inventoryModule = container.resolve(Modules.INVENTORY)
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION)
  const productModule = container.resolve(Modules.PRODUCT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { storeId } = await moysklad.resolveDefaults()
  const client = moysklad.getClient()
  let stockRows
  try { stockRows = await client.listStockByStore(storeId) } catch { stockRows = await client.listStockAll() }

  const locations = await stockLocationModule.listStockLocations({}, { take: 1 })
  const location = locations[0]
  if (!location) { console.error("no location"); return }

  const invByVariant = new Map<string, string>()
  const { data } = await query.graph({
    entity: "product_variant_inventory_item",
    fields: ["variant_id", "inventory_item_id"],
    filters: {},
  })
  for (const row of data as Array<{ variant_id: string; inventory_item_id: string }>) {
    invByVariant.set(row.variant_id, row.inventory_item_id)
  }

  const variantByMsId = new Map<string, string>()
  for (let skip = 0; ; skip += 500) {
    const page = await productModule.listProductVariants({}, { take: 500, skip })
    for (const v of page) {
      const msId = (v.metadata as Record<string, string> | null)?.moysklad_id
      if (msId) variantByMsId.set(msId, v.id)
    }
    if (page.length < 500) break
  }

  let updated = 0, skipped = 0, missing = 0
  for (const row of stockRows) {
    const assortmentId = row.assortmentId || client.extractIdFromHref(row.meta?.href)
    if (!assortmentId) continue
    const variantId = variantByMsId.get(assortmentId)
    if (!variantId) { missing++; continue }
    const inventoryItemId = invByVariant.get(variantId)
    if (!inventoryItemId) { missing++; continue }
    const qty = Math.max(0, Math.floor(row.stock ?? row.quantity ?? 0))
    const levels = await inventoryModule.listInventoryLevels(
      { inventory_item_id: inventoryItemId, location_id: location.id },
      { take: 1 }
    )
    if (levels[0] && Number(levels[0].stocked_quantity) === qty) { skipped++; continue }
    if (levels[0]) {
      await inventoryModule.updateInventoryLevels({
        inventory_item_id: inventoryItemId,
        location_id: location.id,
        stocked_quantity: qty,
      })
    } else {
      await inventoryModule.createInventoryLevels({
        inventory_item_id: inventoryItemId,
        location_id: location.id,
        stocked_quantity: qty,
      })
    }
    updated++
    if (updated % 500 === 0) console.log(`остатки: ${updated}`)
  }
  console.log({ updated, skipped, missing, stockRows: stockRows.length })
}
