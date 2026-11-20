import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, CloudArrowDown } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { sdk } from "../../lib/sdk"

type SyncState = {
  status: "idle" | "running" | "ok" | "error"
  intervalMinutes: number
  trigger?: "manual" | "schedule" | "cli" | "webhook"
  startedAt?: string
  finishedAt?: string
  nextDueAt?: string
  result?: {
    created?: number
    updated?: number
    unchanged?: number
    skipped?: number
    imagesSynced?: number
    stockUpdated?: number
    stockUnchanged?: number
    reservationsCleared?: number
    errors?: string[]
  }
  error?: string
}

type SyncResponse = {
  message?: string
  sync: SyncState
}

const TRIGGER_LABEL: Record<string, string> = {
  manual: "вручную",
  schedule: "по расписанию",
  cli: "из консоли",
  webhook: "webhook",
}

const STATUS_LABEL: Record<string, string> = {
  idle: "ожидание",
  running: "идёт сейчас",
  ok: "успешно",
  error: "ошибка",
}

const MoyskladPage = () => {
  const queryClient = useQueryClient()
  const [intervalDraft, setIntervalDraft] = useState("15")

  const { data, isLoading } = useQuery({
    queryKey: ["moysklad-sync-status"],
    queryFn: () => sdk.client.fetch<SyncResponse>("/admin/moysklad/sync"),
    refetchInterval: (query) =>
      query.state.data?.sync?.status === "running" ? 3000 : 15000,
  })

  const sync = data?.sync

  useEffect(() => {
    if (sync?.intervalMinutes) {
      setIntervalDraft(String(sync.intervalMinutes))
    }
  }, [sync?.intervalMinutes])

  const runMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<SyncResponse>("/admin/moysklad/sync", {
        method: "POST",
        body: { action: "sync" },
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Синхронизация запущена")
      queryClient.invalidateQueries({ queryKey: ["moysklad-sync-status"] })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Не удалось запустить синхронизацию")
    },
  })

  /** Крайний случай: сброс локальных резервов + остатки строго как в МС */
  const forceAlignMutation = useMutation({
    mutationFn: () =>
      sdk.client.fetch<SyncResponse>("/admin/moysklad/sync", {
        method: "POST",
        body: { action: "force-align" },
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Выравнивание запущено")
      queryClient.invalidateQueries({ queryKey: ["moysklad-sync-status"] })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Не удалось запустить выравнивание")
    },
  })

  const settingsMutation = useMutation({
    mutationFn: (intervalMinutes: number) =>
      sdk.client.fetch<SyncResponse>("/admin/moysklad/sync", {
        method: "POST",
        body: { action: "settings", intervalMinutes },
      }),
    onSuccess: (res) => {
      toast.success(res.message || "Интервал сохранён")
      queryClient.invalidateQueries({ queryKey: ["moysklad-sync-status"] })
    },
    onError: (err: Error) => {
      toast.error(err.message || "Не удалось сохранить интервал")
    },
  })

  const running =
    sync?.status === "running" ||
    runMutation.isPending ||
    forceAlignMutation.isPending
  const result = sync?.result

  function confirmForceAlign() {
    const ok = window.confirm(
      "Выровнять остатки Medusa по МойСклад?\n\n" +
        "• снимет локальные резервы на складе Medusa\n" +
        "• перепишет количества строго как в МойСклад\n\n" +
        "В МойСклад ничего не пишет. Только для крайних случаев после тестов."
    )
    if (ok) forceAlignMutation.mutate()
  }

  function saveInterval() {
    const n = Number(intervalDraft)
    if (!Number.isFinite(n) || n < 1 || n > 1440) {
      toast.error("Интервал: от 1 до 1440 минут")
      return
    }
    settingsMutation.mutate(n)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4 gap-4 flex-wrap">
        <div>
          <Heading level="h1">МойСклад</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Умный синк каталога, цен, фото и остатков. Автопрогон по интервалу
            ниже. «Выровнять» — редкий сброс резервов и остатков строго как в
            МойСклад (в МС не пишет).
          </Text>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            isLoading={running}
            disabled={running}
            onClick={() => runMutation.mutate()}
          >
            <CloudArrowDown />
            Синхронизировать сейчас
          </Button>
          <Button
            variant="danger"
            isLoading={forceAlignMutation.isPending}
            disabled={running}
            onClick={confirmForceAlign}
          >
            <ArrowPath />
            Выровнять по МойСклад
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Text weight="plus">Статус</Text>
          {isLoading ? (
            <Badge>загрузка…</Badge>
          ) : (
            <Badge
              color={
                sync?.status === "ok"
                  ? "green"
                  : sync?.status === "error"
                    ? "red"
                    : sync?.status === "running"
                      ? "orange"
                      : "grey"
              }
            >
              {STATUS_LABEL[sync?.status || "idle"]}
            </Badge>
          )}
          {sync?.trigger ? (
            <Badge color="blue">
              последний запуск: {TRIGGER_LABEL[sync.trigger] || sync.trigger}
            </Badge>
          ) : null}
          {running ? (
            <Text
              size="small"
              className="text-ui-fg-subtle flex items-center gap-1"
            >
              <ArrowPath className="animate-spin" /> выполняется…
            </Text>
          ) : null}
        </div>

        <div className="grid gap-1">
          {sync?.startedAt ? (
            <Text size="small" className="text-ui-fg-subtle">
              Начало: {fmt(sync.startedAt)}
              {sync.finishedAt ? ` · конец: ${fmt(sync.finishedAt)}` : ""}
            </Text>
          ) : (
            <Text size="small" className="text-ui-fg-subtle">
              Ещё не было завершённых прогонов (или только что подняли backend).
            </Text>
          )}
          {sync?.nextDueAt && sync.status !== "running" ? (
            <Text size="small" className="text-ui-fg-subtle">
              Следующий автозапуск примерно: {fmt(sync.nextDueAt)}
            </Text>
          ) : null}
        </div>

        {sync?.error ? (
          <Text size="small" className="text-ui-fg-error">
            Ошибка: {sync.error}
          </Text>
        ) : null}

        <div className="rounded-md border border-ui-border-base p-4 flex flex-col gap-3 max-w-md">
          <Text weight="plus">Интервал автосинка</Text>
          <Text size="small" className="text-ui-fg-subtle">
            Проверка каждую минуту; сам прогон — если прошло столько минут с
            последнего успешного/ошибочного завершения.
          </Text>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="ms-interval">Минут</Label>
              <Input
                id="ms-interval"
                type="number"
                min={1}
                max={1440}
                value={intervalDraft}
                onChange={(e) => setIntervalDraft(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              isLoading={settingsMutation.isPending}
              onClick={saveInterval}
            >
              Сохранить
            </Button>
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            Сейчас: каждые {sync?.intervalMinutes ?? 15} мин.
          </Text>
        </div>

        {result ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Создано" value={result.created} />
            <Stat label="Обновлено" value={result.updated} />
            <Stat label="Без изменений" value={result.unchanged} />
            <Stat label="Ошибки товаров" value={result.skipped} />
            <Stat label="Фото загружено" value={result.imagesSynced} />
            <Stat label="Остатки обновлены" value={result.stockUpdated} />
            <Stat label="Остатки без изменений" value={result.stockUnchanged} />
            {typeof result.reservationsCleared === "number" ? (
              <Stat label="Снято резервов" value={result.reservationsCleared} />
            ) : null}
            <Stat
              label="Сообщений об ошибках"
              value={result.errors?.length || 0}
            />
          </div>
        ) : null}

        {result?.errors?.length ? (
          <div className="max-h-48 overflow-auto rounded-md border border-ui-border-base p-3">
            <Text size="small" weight="plus">
              Первые ошибки
            </Text>
            <ul className="mt-2 list-disc pl-4">
              {result.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  <Text size="small">{e}</Text>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Container>
  )
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU")
  } catch {
    return iso
  }
}

const Stat = ({ label, value }: { label: string; value?: number }) => (
  <div className="rounded-md border border-ui-border-base px-3 py-2">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text weight="plus">{value ?? "—"}</Text>
  </div>
)

export const config = defineRouteConfig({
  label: "МойСклад",
  icon: CloudArrowDown,
})

export default MoyskladPage
