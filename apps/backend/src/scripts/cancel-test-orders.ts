import type { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Тестовые заказы → canceled (насколько Medusa позволит).
 * Если отмена заблокирована после отгрузки — ставим status напрямую.
 */
export default async function cancelTestOrders({ container }: ExecArgs) {
  const orderModule = container.resolve(Modules.ORDER)
  const orders = await orderModule.listOrders(
    {},
    { take: 50, order: { created_at: "DESC" } }
  )

  for (const order of orders) {
    const display = order.display_id
    if (order.status === "canceled") {
      console.log(`№${display}: уже canceled`)
      continue
    }

    try {
      await cancelOrderWorkflow(container).run({
        input: { order_id: order.id },
      })
      console.log(`№${display}: отменён через workflow`)
    } catch (e) {
      const msg = (e as Error).message
      console.warn(`№${display}: workflow не смог (${msg}) — ставлю status=canceled`)
      await orderModule.updateOrders(order.id, {
        status: "canceled",
      })
      console.log(`№${display}: status=canceled вручную`)
    }
  }
}
