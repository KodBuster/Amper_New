import fs from "node:fs"
import path from "node:path"

export type SyncTrigger = "manual" | "schedule" | "cli" | "webhook"

export type SyncRunResult = {
  created?: number
  updated?: number
  unchanged?: number
  skipped?: number
  imagesSynced?: number
  stockUpdated?: number
  stockUnchanged?: number
  errors?: string[]
}

export type MoySkladSyncState = {
  /** Интервал автосинка в минутах (1–1440) */
  intervalMinutes: number
  status: "idle" | "running" | "ok" | "error"
  trigger?: SyncTrigger
  startedAt?: string
  finishedAt?: string
  nextDueAt?: string
  result?: SyncRunResult
  error?: string
}

const DEFAULT_INTERVAL = 15
/** Если «running» дольше — считаем прогон зависшим и разрешаем новый */
const STALE_RUNNING_MS = 10 * 60 * 1000
const STATE_FILE = path.join(process.cwd(), "data", "moysklad-sync-state.json")

let memory: MoySkladSyncState | null = null

function clampInterval(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL
  return Math.min(1440, Math.max(1, Math.round(n)))
}

/** Зависший running (падение процесса / долгий прогон) не должен блокировать синк */
function clearStaleRunningIfNeeded(state: MoySkladSyncState): MoySkladSyncState {
  if (state.status !== "running" || !state.startedAt) return state
  const started = new Date(state.startedAt).getTime()
  if (!Number.isFinite(started)) return state
  if (Date.now() - started < STALE_RUNNING_MS) return state

  const finishedAt = new Date().toISOString()
  const next: MoySkladSyncState = {
    ...state,
    status: "error",
    finishedAt,
    error:
      "Предыдущая синхронизация зависла (дольше 10 мин) и была сброшена. Запустите снова или дождитесь автосинка.",
    nextDueAt: computeNextDueAt(finishedAt, state.intervalMinutes),
  }
  memory = next
  writeDisk(next)
  console.warn("[moysklad-sync] сброшен зависший status=running с", state.startedAt)
  return next
}

function ensureDir() {
  const dir = path.dirname(STATE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function readDisk(): MoySkladSyncState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as Partial<MoySkladSyncState>
      return {
        intervalMinutes: clampInterval(Number(raw.intervalMinutes ?? DEFAULT_INTERVAL)),
        status: raw.status === "running" ? "idle" : raw.status || "idle",
        trigger: raw.trigger,
        startedAt: raw.startedAt,
        finishedAt: raw.finishedAt,
        nextDueAt: raw.nextDueAt,
        result: raw.result,
        error: raw.error,
      }
    }
  } catch {
    // битый файл — начнём с дефолта
  }
  return { intervalMinutes: DEFAULT_INTERVAL, status: "idle" }
}

function writeDisk(state: MoySkladSyncState) {
  ensureDir()
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8")
}

/** Текущее состояние синка (файл + память процесса) */
export function getSyncState(): MoySkladSyncState {
  if (!memory) memory = readDisk()
  memory = clearStaleRunningIfNeeded(memory)
  return { ...memory }
}

export function saveSyncState(patch: Partial<MoySkladSyncState>): MoySkladSyncState {
  const prev = getSyncState()
  memory = {
    ...prev,
    ...patch,
    intervalMinutes: clampInterval(
      Number(patch.intervalMinutes ?? prev.intervalMinutes ?? DEFAULT_INTERVAL)
    ),
  }
  writeDisk(memory)
  return { ...memory }
}

export function computeNextDueAt(
  fromIso: string | undefined,
  intervalMinutes: number
): string {
  const base = fromIso ? new Date(fromIso).getTime() : Date.now()
  const t = (Number.isFinite(base) ? base : Date.now()) + intervalMinutes * 60_000
  return new Date(t).toISOString()
}

/** Можно ли стартовать новый прогон (не занят) */
export function canStartSync(): boolean {
  return getSyncState().status !== "running"
}

/**
 * Нужен ли автопрогон по интервалу.
 * Job дергается каждую минуту и сам решает.
 */
export function shouldRunScheduledSync(now = Date.now()): boolean {
  const s = getSyncState()
  if (s.status === "running") return false
  if (!s.finishedAt && !s.startedAt) return true
  const last = new Date(s.finishedAt || s.startedAt || 0).getTime()
  if (!Number.isFinite(last)) return true
  return now - last >= s.intervalMinutes * 60_000
}

export function markSyncRunning(trigger: SyncTrigger): MoySkladSyncState {
  const startedAt = new Date().toISOString()
  return saveSyncState({
    status: "running",
    trigger,
    startedAt,
    finishedAt: undefined,
    error: undefined,
    nextDueAt: undefined,
  })
}

export function markSyncOk(
  trigger: SyncTrigger,
  startedAt: string | undefined,
  result: SyncRunResult
): MoySkladSyncState {
  const finishedAt = new Date().toISOString()
  const intervalMinutes = getSyncState().intervalMinutes
  return saveSyncState({
    status: "ok",
    trigger,
    startedAt,
    finishedAt,
    result,
    error: undefined,
    nextDueAt: computeNextDueAt(finishedAt, intervalMinutes),
  })
}

export function markSyncError(
  trigger: SyncTrigger,
  startedAt: string | undefined,
  error: string
): MoySkladSyncState {
  const finishedAt = new Date().toISOString()
  const intervalMinutes = getSyncState().intervalMinutes
  return saveSyncState({
    status: "error",
    trigger,
    startedAt,
    finishedAt,
    error,
    nextDueAt: computeNextDueAt(finishedAt, intervalMinutes),
  })
}
