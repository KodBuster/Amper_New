import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { syncMoyskladStockWorkflow } from "../workflows/sync-moysklad-catalog"

/**
 * Крайний случай: снять локальные резервы Medusa и выровнять остатки по МойСклад.
 * В МойСклад ничего не пишет.
 */
export default async function forceAlignStock({ container }: ExecArgs) {
  const inventoryModule = container.resolve(Modules.INVENTORY) as {
    listReservationItems?: (
      filters: Record<string, unknown>,
      config?: { take?: number; skip?: number }
    ) => Promise<Array<{ id: string }>>
    deleteReservationItems?: (ids: string[]) => Promise<unknown>
  }

  let reservationsCleared = 0
  if (
    typeof inventoryModule.listReservationItems === "function" &&
    typeof inventoryModule.deleteReservationItems === "function"
  ) {
    for (let skip = 0; ; skip += 200) {
      const page = await inventoryModule.listReservationItems(
        {},
        { take: 200, skip }
      )
      if (!page.length) break
      await inventoryModule.deleteReservationItems(page.map((r) => r.id))
      reservationsCleared += page.length
      if (page.length < 200) break
    }
  }

  console.log(`Снято резервов: ${reservationsCleared}`)
  const { result } = await syncMoyskladStockWorkflow(container).run({})
  console.log("Выравнивание готово:", { reservationsCleared, ...result })
}
