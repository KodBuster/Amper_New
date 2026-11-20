import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  syncMoyskladCatalogWorkflow,
  syncMoyskladStockWorkflow,
} from "../../../../workflows/sync-moysklad-catalog"
import {
  canStartSync,
  getSyncState,
  markSyncError,
  markSyncOk,
  markSyncRunning,
  saveSyncState,
  computeNextDueAt,
} from "../../../../modules/moysklad/sync-state"

function publicState() {
  const sync = getSyncState()
  // Если nextDueAt ещё не посчитан — оценим от последнего финиша
  if (!sync.nextDueAt && sync.finishedAt) {
    sync.nextDueAt = computeNextDueAt(sync.finishedAt, sync.intervalMinutes)
  } else if (!sync.nextDueAt && sync.status !== "running") {
    sync.nextDueAt = computeNextDueAt(undefined, sync.intervalMinutes)
  }
  return sync
}

/**
 * GET /admin/moysklad/sync — статус + настройки интервала.
 */
export const GET = async (
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.json({ sync: publicState() })
}

/**
 * POST /admin/moysklad/sync — ручной запуск умного синка (фон).
 * Body (опционально): { intervalMinutes?: number } — только сохранить интервал.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const body = (req.body || {}) as {
    intervalMinutes?: number
    action?: "sync" | "settings" | "force-align"
  }

  // Сохранение только интервала
  if (body.action === "settings" || (body.intervalMinutes && body.action !== "sync" && body.action !== "force-align")) {
    if (body.intervalMinutes == null) {
      res.status(400).json({ message: "Укажите intervalMinutes" })
      return
    }
    const sync = saveSyncState({
      intervalMinutes: body.intervalMinutes,
      nextDueAt: computeNextDueAt(
        getSyncState().finishedAt || new Date().toISOString(),
        body.intervalMinutes
      ),
    })
    res.json({
      message: `Интервал автосинка: каждые ${sync.intervalMinutes} мин.`,
      sync: publicState(),
    })
    return
  }

  if (!canStartSync()) {
    res.status(409).json({
      message: "Синхронизация уже выполняется",
      sync: publicState(),
    })
    return
  }

  const forceAlign = body.action === "force-align"
  const scope = req.scope
  const started = markSyncRunning("manual")

  res.status(202).json({
    message: forceAlign
      ? "Принудительное выравнивание по МойСклад запущено (резервы + остатки)"
      : "Синхронизация с МойСклад запущена в фоне",
    sync: started,
  })

  void (async () => {
    try {
      let reservationsCleared = 0
      if (forceAlign) {
        // Крайний случай: сбрасываем локальные резервы Medusa, остатки берём из МС
        const { Modules } = await import("@medusajs/framework/utils")
        const inventoryModule = scope.resolve(Modules.INVENTORY) as {
          listReservationItems?: (
            filters: Record<string, unknown>,
            config?: { take?: number; skip?: number }
          ) => Promise<Array<{ id: string }>>
          deleteReservationItems?: (ids: string[]) => Promise<unknown>
        }
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
        console.log(
          `[admin] moysklad force-align: снято резервов ${reservationsCleared}`
        )
      }

      const { result } = forceAlign
        ? await syncMoyskladStockWorkflow(scope).run({})
        : await syncMoyskladCatalogWorkflow(scope).run({})
      const merged = {
        ...(result || {}),
        reservationsCleared: forceAlign ? reservationsCleared : undefined,
      }
      markSyncOk("manual", started.startedAt, merged as never)
      console.log(
        forceAlign
          ? "[admin] moysklad force-align ok:"
          : "[admin] moysklad sync ok:",
        merged
      )
    } catch (e) {
      markSyncError("manual", started.startedAt, (e as Error).message)
      console.error("[admin] moysklad sync failed:", (e as Error).message)
    }
  })()
}
