import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { syncMoyskladCatalogWorkflow } from "../../../workflows/sync-moysklad-catalog"
import { Modules } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../../../modules/moysklad"
import type MoySkladModuleService from "../../../modules/moysklad/service"

/**
 * Webhook / ручной триггер от МойСклад.
 * POST /hooks/moysklad
 * Заголовок X-Amper-Webhook-Secret (опционально, если задан MOYSKLAD_WEBHOOK_SECRET).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const moysklad: MoySkladModuleService = req.scope.resolve(MOYSKLAD_MODULE)
  const secret = moysklad.getOptions().webhookSecret
  if (secret) {
    const header = req.headers["x-amper-webhook-secret"]
    if (header !== secret) {
      res.status(401).json({ message: "Unauthorized" })
      return
    }
  }

  const body = (req.body || {}) as {
    events?: Array<{ meta?: { type?: string }; action?: string }>
    type?: string
  }

  const types = (body.events || [])
    .map((e) => e.meta?.type || e.action || "")
    .concat(body.type || "")
    .filter(Boolean)

  const orderRelated = types.some((t) =>
    /customerorder|demand|status/i.test(String(t))
  )

  if (orderRelated) {
    // Точечное обновление статусов через job-логику: полная сверка недавних заказов
    try {
      const orderModule = req.scope.resolve(Modules.ORDER)
      const client = moysklad.getClient()
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, ".000")
      const updated = await client.listCustomerOrdersUpdatedSince(since)
      for (const msOrder of updated) {
        if (!msOrder.externalCode) continue
        try {
          const order = await orderModule.retrieveOrder(msOrder.externalCode)
          const meta = (order.metadata || {}) as Record<string, string>
          await orderModule.updateOrders(order.id, {
            metadata: {
              ...meta,
              moysklad_order_id: msOrder.id,
              moysklad_state: msOrder.state?.name || meta.moysklad_state || "",
              moysklad_synced_at: new Date().toISOString(),
            },
          })
        } catch {
          // заказ не из нашей витрины
        }
      }
    } catch (e) {
      res.status(500).json({ message: (e as Error).message })
      return
    }
    res.status(200).json({ ok: true, mode: "orders" })
    return
  }

  const { result } = await syncMoyskladCatalogWorkflow(req.scope).run({})
  res.status(200).json({ ok: true, mode: "catalog", result })
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const moysklad: MoySkladModuleService = req.scope.resolve(MOYSKLAD_MODULE)
  try {
    const ping = await moysklad.ping()
    const defaults = await moysklad.resolveDefaults()
    res.status(200).json({ ok: true, ping, defaults })
  } catch (e) {
    res.status(500).json({ ok: false, message: (e as Error).message })
  }
}
