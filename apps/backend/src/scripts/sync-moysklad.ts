import type { ExecArgs } from "@medusajs/framework/types"
import { syncMoyskladCatalogWorkflow } from "../workflows/sync-moysklad-catalog"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import type MoySkladModuleService from "../modules/moysklad/service"
import {
  canStartSync,
  markSyncError,
  markSyncOk,
  markSyncRunning,
} from "../modules/moysklad/sync-state"

/**
 * Ручной запуск полной синхронизации каталога/остатков из МойСклад.
 * npm run sync:moysklad --workspace=apps/backend
 */
export default async function syncMoysklad({ container }: ExecArgs) {
  const moysklad: MoySkladModuleService = container.resolve(MOYSKLAD_MODULE)

  const ping = await moysklad.ping()
  console.log("МойСклад ping:", ping)

  const defaults = await moysklad.resolveDefaults()
  console.log("Defaults:", defaults)

  if (!canStartSync()) {
    console.log("Синхронизация уже выполняется — выход")
    return
  }

  const started = markSyncRunning("cli")
  try {
    const { result } = await syncMoyskladCatalogWorkflow(container).run({})
    markSyncOk("cli", started.startedAt, (result || {}) as never)
    console.log("Sync result:", result)
  } catch (e) {
    markSyncError("cli", started.startedAt, (e as Error).message)
    throw e
  }
}
