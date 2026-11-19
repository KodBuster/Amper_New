import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { syncMoyskladCatalogWorkflow } from "../../../../workflows/sync-moysklad-catalog"
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
    action?: "sync" | "settings"
  }

  // Сохранение только интервала
  if (body.action === "settings" || (body.intervalMinutes && body.action !== "sync")) {
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

  const scope = req.scope
  const started = markSyncRunning("manual")

  res.status(202).json({
    message: "Синхронизация с МойСклад запущена в фоне",
    sync: started,
  })

  void (async () => {
    try {
      const { result } = await syncMoyskladCatalogWorkflow(scope).run({})
      markSyncOk("manual", started.startedAt, (result || {}) as never)
      console.log("[admin] moysklad sync ok:", result)
    } catch (e) {
      markSyncError("manual", started.startedAt, (e as Error).message)
      console.error("[admin] moysklad sync failed:", (e as Error).message)
    }
  })()
}
