"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react"
import { useCart } from "@/components/CartProvider"
import { useCustomer } from "@/components/CustomerProvider"
import { Icon } from "@/components/icons"
import {
  formatRub,
  medusa,
  productImageUrls,
  translateInventoryError,
  type StoreProduct,
} from "@/lib/medusa"
import { listMyOrders, lookupOrder, type LookupOrder } from "@/lib/order-lookup"
import type { SavedList } from "@/lib/customer-meta"

type Tab =
  | "orders"
  | "favorites"
  | "lists"
  | "lookup"
  | "login"
  | "register"

const TABS_USER: Tab[] = ["orders", "favorites", "lists", "lookup"]
const TABS_GUEST: Tab[] = ["login", "register", "lookup"]
const TABS_ALL: Tab[] = ["orders", "favorites", "lists", "lookup", "login", "register"]

function tabFromUrl(raw: string | null): Tab | null {
  if (raw && (TABS_ALL as string[]).includes(raw)) return raw as Tab
  return null
}

/** Какой раздел показать с учётом сессии и ?tab= */
function resolveTab(
  raw: string | null,
  loggedIn: boolean,
  sessionLoading: boolean
): Tab {
  const wanted = tabFromUrl(raw)
  if (sessionLoading && wanted) return wanted
  if (loggedIn) {
    if (wanted && (TABS_USER as string[]).includes(wanted)) return wanted
    return "orders"
  }
  if (wanted && (TABS_GUEST as string[]).includes(wanted)) return wanted
  return "login"
}

type MyOrder = {
  id: string
  display_id?: number
  status?: string
  created_at?: string
  total?: number
  items?: Array<{
    id: string
    title?: string
    quantity?: number
    unit_price?: number
    variant_id?: string
    variant_sku?: string
    variant?: { id?: string }
  }>
}

type OrderBucket = "active" | "completed" | "canceled"
type OrderFilter = "all" | OrderBucket

function statusLabel(status?: string): string {
  const s = String(status || "").toLowerCase()
  if (s.includes("pending")) return "В обработке"
  if (s.includes("complet")) return "Завершён"
  if (s.includes("cancel")) return "Отменён"
  if (s.includes("fulfill")) return "Собирается"
  if (s.includes("archiv")) return "Архив"
  return status || "—"
}

/** Группа для истории: активные → завершённые → отменённые */
function orderBucket(status?: string): OrderBucket {
  const s = String(status || "").toLowerCase()
  if (s.includes("cancel")) return "canceled"
  if (s.includes("complet") || s.includes("archiv")) return "completed"
  return "active"
}

const BUCKET_ORDER: Record<OrderBucket, number> = {
  active: 0,
  completed: 1,
  canceled: 2,
}

function formatDate(iso?: string): string {
  if (!iso) return "—"
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function AccountPageInner() {
  const {
    customer,
    loading,
    cabinet,
    login,
    register,
    logout,
    toggleFavorite,
    deleteList,
  } = useCustomer()
  const { addItem } = useCart()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Раздел хранится в ?tab=… — после «назад» с карточки возвращаемся в нужный
  const [tab, setTab] = useState<Tab>(() =>
    resolveTab(
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("tab")
        : null,
      false,
      true
    )
  )
  const [authError, setAuthError] = useState("")
  const [authPending, setAuthPending] = useState(false)
  const [authPrefill, setAuthPrefill] = useState({ email: "", password: "" })
  const [suggestRegister, setSuggestRegister] = useState(false)

  const [orders, setOrders] = useState<MyOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState("")
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all")

  const [lookupForm, setLookupForm] = useState({
    display_id: "",
    contact: "",
  })
  const [lookupResult, setLookupResult] = useState<LookupOrder | null>(null)
  const [lookupError, setLookupError] = useState("")
  const [lookupPending, setLookupPending] = useState(false)

  const [favProducts, setFavProducts] = useState<
    Array<{ id: string; title: string; handle: string; image: string }>
  >([])
  const [listBusy, setListBusy] = useState("")
  const [repeatError, setRepeatError] = useState("")

  function goTab(next: Tab) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", next)
    router.replace(`/account?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    setTab(
      resolveTab(searchParams.get("tab"), Boolean(customer), loading)
    )
  }, [customer, loading, searchParams])

  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem("amper-lookup-order")
      if (prefill) {
        sessionStorage.removeItem("amper-lookup-order")
        setLookupForm((f) => ({ ...f, display_id: prefill }))
        goTab("lookup")
      }
    } catch {
      // ignore
    }
    // Только при первом открытии кабинета
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!customer) {
      setOrders([])
      return
    }
    let cancelled = false
    ;(async () => {
      setOrdersLoading(true)
      setOrdersError("")
      try {
        const list = (await listMyOrders()) as MyOrder[]
        if (!cancelled) setOrders(list)
      } catch (e) {
        if (!cancelled) {
          setOrdersError(
            e instanceof Error ? e.message : "Не удалось загрузить заказы"
          )
        }
      } finally {
        if (!cancelled) setOrdersLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customer])

  useEffect(() => {
    if (!customer || !cabinet.favorites.length) {
      setFavProducts([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { products } = await medusa.store.product.list({
          id: cabinet.favorites,
          limit: cabinet.favorites.length,
          fields: "id,title,handle,*images,*thumbnail",
        })
        if (!cancelled) {
          // next/image тянет файл через сервер Next — с телефона localhost в src ломается
          setFavProducts(
            ((products || []) as StoreProduct[]).map((p) => ({
              id: p.id,
              title: p.title,
              handle: p.handle,
              image:
                productImageUrls(p)[0] || "/assets/photo-product-101.webp",
            }))
          )
        }
      } catch {
        if (!cancelled) setFavProducts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customer, cabinet.favorites])

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const bucketDiff =
        BUCKET_ORDER[orderBucket(a.status)] - BUCKET_ORDER[orderBucket(b.status)]
      if (bucketDiff !== 0) return bucketDiff
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      return tb - ta
    })
  }, [orders])

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return sortedOrders
    return sortedOrders.filter((o) => orderBucket(o.status) === orderFilter)
  }, [sortedOrders, orderFilter])

  const orderCounts = useMemo(() => {
    const counts = { all: orders.length, active: 0, completed: 0, canceled: 0 }
    for (const o of orders) counts[orderBucket(o.status)] += 1
    return counts
  }, [orders])

  const orderFilters: Array<{ id: OrderFilter; label: string }> = [
    { id: "all", label: "Все" },
    { id: "active", label: "Активные" },
    { id: "completed", label: "Завершённые" },
    { id: "canceled", label: "Отменённые" },
  ]

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAuthError("")
    setSuggestRegister(false)
    setAuthPending(true)
    const email = authPrefill.email.trim()
    const password = authPrefill.password
    try {
      await login(email, password)
      setAuthPrefill({ email: "", password: "" })
      // вкладку «Заказы» поставит эффект, когда появится customer
    } catch {
      // Medusa не отличает «нет аккаунта» и «неверный пароль» — предлагаем регистрацию
      setAuthPrefill({ email, password })
      setSuggestRegister(true)
      setAuthError("Не удалось войти с этими данными.")
    } finally {
      setAuthPending(false)
    }
  }

  function goToRegisterFromLogin() {
    setSuggestRegister(false)
    setAuthError("")
    // email/пароль уже в authPrefill — форма регистрации читает их как value
    goTab("register")
  }

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAuthError("")
    setSuggestRegister(false)
    setAuthPending(true)
    const fd = new FormData(e.currentTarget)
    try {
      await register({
        email: authPrefill.email,
        password: authPrefill.password,
        first_name: String(fd.get("first_name") || "") || undefined,
        last_name: String(fd.get("last_name") || "") || undefined,
        phone: String(fd.get("phone") || "") || undefined,
      })
      // чистим поля только после реального входа
      setAuthPrefill({ email: "", password: "" })
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Ошибка регистрации")
    } finally {
      setAuthPending(false)
    }
  }

  async function onLookup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLookupError("")
    setLookupResult(null)
    setLookupPending(true)
    try {
      const contact = lookupForm.contact.trim()
      const looksEmail = contact.includes("@")
      const order = await lookupOrder({
        display_id: lookupForm.display_id,
        email: looksEmail ? contact : undefined,
        phone: looksEmail ? undefined : contact || undefined,
      })
      setLookupResult(order)
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Заказ не найден")
    } finally {
      setLookupPending(false)
    }
  }

  async function repeatOrder(order: MyOrder) {
    const items = order.items || []
    setRepeatError("")
    setListBusy(order.id)
    let added = 0
    let skippedNoVariant = 0
    const failMsgs: string[] = []
    try {
      for (const item of items) {
        const variantId = item.variant_id || item.variant?.id
        if (!variantId) {
          skippedNoVariant += 1
          continue
        }
        try {
          await addItem(variantId, item.quantity || 1)
          added += 1
        } catch (err) {
          failMsgs.push(translateInventoryError(err))
        }
      }
      if (!added) {
        const detail = failMsgs[0] || (skippedNoVariant
          ? "В заказе нет ссылок на товары для повторного добавления."
          : "Не удалось добавить товары.")
        setRepeatError(
          `Заказ №${order.display_id ?? "—"}: ${detail}`
        )
      } else if (failMsgs.length || skippedNoVariant) {
        setRepeatError(
          `Заказ №${order.display_id ?? "—"}: добавлено позиций ${added} из ${items.length}. ${failMsgs[0] || ""}`.trim()
        )
      }
    } finally {
      setListBusy("")
    }
  }

  async function addListToCart(list: SavedList) {
    setListBusy(list.id)
    try {
      for (const item of list.items) {
        await addItem(item.variant_id, item.quantity)
      }
    } finally {
      setListBusy("")
    }
  }

  const navGuest: Array<{ id: Tab; label: string }> = [
    { id: "login", label: "Вход" },
    { id: "register", label: "Регистрация" },
    { id: "lookup", label: "Найти свой заказ" },
  ]

  const navUser: Array<{ id: Tab; label: string }> = [
    { id: "orders", label: "История заказов" },
    { id: "favorites", label: "Избранное" },
    { id: "lists", label: "Списки" },
    { id: "lookup", label: "Найти свой заказ" },
  ]

  const nav = customer ? navUser : navGuest

  return (
    <div className="frame account-shell">
      <div className="account-breadcrumb">
        <Link href="/">Главная</Link>
        <span>/</span>
        <span>Личный кабинет</span>
      </div>

      <section className="account-banner">
        <div className="account-hero-content">
          <span className="account-overline">Кабинет</span>
          <h1>
            {customer
              ? `С возвращением${
                  customer.first_name?.trim()
                    ? `, ${customer.first_name.trim()}`
                    : ""
                }`
              : "Ваш кабинет АМПЕР"}
          </h1>
          <p>
            {customer
              ? `${customer.email} — заказы, избранное и сохранённые списки.`
              : "Зарегистрируйтесь, чтобы помнить покупки и избранное. Или найдите заказ по номеру без входа."}
          </p>
        </div>
        <div className="account-banner-symbol" aria-hidden>
          <Icon name="user" />
        </div>
      </section>

      {!customer ? (
        <div className="account-demo-note">
          <Icon name="info" />
          <span>
            Гостю доступен быстрый просмотр заказа по номеру и email/телефону из
            оформления. Избранное и списки — после регистрации.
          </span>
        </div>
      ) : null}

      <div className="account-layout">
        <aside className="account-sidebar">
          <nav className="account-nav" aria-label="Кабинет">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                className="account-nav-btn"
                aria-current={tab === item.id ? "page" : undefined}
                onClick={() => goTab(item.id)}
              >
                {item.label}
              </button>
            ))}
            {customer ? (
              <button
                type="button"
                className="account-nav-btn account-logout-btn"
                onClick={() => logout()}
              >
                Выйти
              </button>
            ) : null}
          </nav>
          <div className="account-sidebar-bottom">
            {loading ? (
              "Проверяем сессию…"
            ) : customer ? (
              <p className="account-signed-line">
                <span className="account-signed-as">Вы вошли как</span>{" "}
                <span className="account-signed-name">
                  {customer.first_name?.trim() || customer.email}
                </span>
              </p>
            ) : null}
          </div>
        </aside>

        <div className="account-content">
          {tab === "login" ? (
            <>
              <div className="account-view-title">
                <div>
                  <h2>Вход</h2>
                  <p>Email и пароль, которые указали при регистрации.</p>
                </div>
              </div>
              <form className="account-auth-form" onSubmit={onLogin}>
                <label>
                  <span className="field-label">
                    Email <b className="required-mark">*</b>
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={authPrefill.email}
                    onChange={(e) =>
                      setAuthPrefill((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="field-label">
                    Пароль <b className="required-mark">*</b>
                  </span>
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    minLength={6}
                    value={authPrefill.password}
                    onChange={(e) =>
                      setAuthPrefill((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </label>
                {authError ? <p className="form-error">{authError}</p> : null}
                {suggestRegister ? (
                  <div className="account-auth-suggest">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={goToRegisterFromLogin}
                    >
                      Зарегистрироваться с этим email
                    </button>
                  </div>
                ) : null}
                <button className="btn btn-primary" type="submit" disabled={authPending}>
                  {authPending ? "Входим…" : "Войти"}
                </button>
              </form>
            </>
          ) : null}

          {tab === "register" ? (
            <>
              <div className="account-view-title">
                <div>
                  <h2>Регистрация</h2>
                  <p>Создайте кабинет, чтобы сохранять заказы и избранное.</p>
                </div>
              </div>
              <form className="account-auth-form" onSubmit={onRegister}>
                <label>
                  <span className="field-label">
                    Имя <b className="required-mark">*</b>
                  </span>
                  <input name="first_name" required autoComplete="given-name" />
                </label>
                <label>
                  <span className="field-label">Фамилия</span>
                  <input name="last_name" autoComplete="family-name" />
                </label>
                <label>
                  <span className="field-label">Телефон</span>
                  <input name="phone" type="tel" autoComplete="tel" />
                </label>
                <label>
                  <span className="field-label">
                    Email <b className="required-mark">*</b>
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={authPrefill.email}
                    onChange={(e) =>
                      setAuthPrefill((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </label>
                <label>
                  <span className="field-label">
                    Пароль <b className="required-mark">*</b>
                  </span>
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={6}
                    value={authPrefill.password}
                    onChange={(e) =>
                      setAuthPrefill((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </label>
                {authError ? <p className="form-error">{authError}</p> : null}
                <button className="btn btn-primary" type="submit" disabled={authPending}>
                  {authPending ? "Создаём…" : "Зарегистрироваться"}
                </button>
              </form>
            </>
          ) : null}

          {tab === "lookup" ? (
            <>
              <div className="account-view-title">
                <div>
                  <h2>Найти свой заказ</h2>
                  <p>
                    Номер заказа и тот же email или телефон, что указали при
                    оформлении.
                  </p>
                </div>
              </div>
              <form className="account-auth-form" onSubmit={onLookup}>
                <label>
                  <span className="field-label">
                    Номер заказа <b className="required-mark">*</b>
                  </span>
                  <input
                    value={lookupForm.display_id}
                    onChange={(e) =>
                      setLookupForm((f) => ({ ...f, display_id: e.target.value }))
                    }
                    required
                    placeholder="Например, 12"
                    inputMode="numeric"
                  />
                </label>
                <label>
                  <span className="field-label">
                    Email или телефон <b className="required-mark">*</b>
                  </span>
                  <input
                    type="text"
                    value={lookupForm.contact}
                    onChange={(e) =>
                      setLookupForm((f) => ({ ...f, contact: e.target.value }))
                    }
                    required
                    placeholder="Как при оформлении"
                    autoComplete="email"
                  />
                </label>
                {lookupError ? <p className="form-error">{lookupError}</p> : null}
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={lookupPending}
                >
                  {lookupPending ? "Ищем…" : "Показать заказ"}
                </button>
              </form>
              {lookupResult ? (
                <div className="account-order-card">
                  <header>
                    <strong>№{lookupResult.display_id}</strong>
                    <span>{statusLabel(lookupResult.status)}</span>
                  </header>
                  <p className="account-order-meta">
                    {formatDate(lookupResult.created_at)} ·{" "}
                    {formatRub(Number(lookupResult.total || 0))}
                  </p>
                  <ul>
                    {(lookupResult.items || []).map((item) => (
                      <li key={item.id}>
                        <span>
                          {item.title} × {item.quantity}
                          {item.sku ? ` · арт. ${item.sku}` : ""}
                        </span>
                        <b>
                          {formatRub(
                            Number(item.unit_price || 0) * Number(item.quantity || 0)
                          )}
                        </b>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {tab === "orders" && customer ? (
            <>
              <div className="account-view-title">
                <div>
                  <h2>История заказов</h2>
                </div>
              </div>
              {orders.length ? (
                <div
                  className="account-order-filters"
                  role="tablist"
                  aria-label="Фильтр заказов"
                >
                  {orderFilters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      className="account-order-filter"
                      aria-selected={orderFilter === f.id}
                      onClick={() => setOrderFilter(f.id)}
                    >
                      {f.label}
                      <span className="account-order-filter-count">
                        {orderCounts[f.id]}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {ordersLoading ? <p>Загружаем заказы…</p> : null}
              {ordersError ? <p className="form-error">{ordersError}</p> : null}
              {!ordersLoading && !orders.length ? (
                <div className="empty-state">
                  Пока нет заказов.{" "}
                  <Link href="/catalog">Перейти в каталог</Link>
                </div>
              ) : null}
              {!ordersLoading && orders.length && !filteredOrders.length ? (
                <div className="empty-state">
                  В этой группе заказов нет. Выберите другой фильтр.
                </div>
              ) : null}
              {repeatError ? (
                <p className="form-error" role="alert">
                  {repeatError}
                </p>
              ) : null}
              <div className="account-order-list">
                {filteredOrders.map((order) => (
                  <article key={order.id} className="account-order-card">
                    <header>
                      <button
                        type="button"
                        className="account-order-open"
                        onClick={() =>
                          setActiveOrderId((id) =>
                            id === order.id ? null : order.id
                          )
                        }
                      >
                        <strong>
                          Заказ №{order.display_id ?? "—"}
                        </strong>
                      </button>
                      <span>{statusLabel(order.status)}</span>
                    </header>
                    <p className="account-order-meta">
                      {formatDate(order.created_at)} ·{" "}
                      {formatRub(Number(order.total || 0))}
                    </p>
                    {activeOrderId === order.id ? (
                      <ul>
                        {(order.items || []).map((item) => (
                          <li key={item.id}>
                            <span>
                              {item.title} × {item.quantity}
                              {item.variant_sku
                                ? ` · арт. ${item.variant_sku}`
                                : ""}
                            </span>
                            <b>
                              {formatRub(
                                Number(item.unit_price || 0) *
                                  Number(item.quantity || 0)
                              )}
                            </b>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="account-order-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={Boolean(listBusy)}
                        onClick={() => repeatOrder(order)}
                      >
                        {listBusy === order.id
                          ? "Добавляем…"
                          : "Повторить заказ"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {tab === "favorites" && customer ? (
            <>
              <div className="account-view-title">
                <div>
                  <h2>Избранное</h2>
                  <p>Товары, отмеченные сердечком в каталоге.</p>
                </div>
              </div>
              {!cabinet.favorites.length ? (
                <div className="empty-state">
                  Список пуст. Отметьте товары в{" "}
                  <Link href="/catalog">каталоге</Link>.
                </div>
              ) : (
                <ul className="account-fav-list">
                  {favProducts.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/product/${p.handle}`}
                        className="account-fav-link"
                      >
                        <span className="account-fav-thumb" aria-hidden>
                          <Image
                            src={p.image}
                            alt=""
                            width={96}
                            height={96}
                          />
                        </span>
                        <span className="account-fav-title">{p.title}</span>
                      </Link>
                      <button
                        type="button"
                        className="reset-filters reset-filters-inline"
                        onClick={() => toggleFavorite(p.id)}
                      >
                        Убрать
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {tab === "lists" && customer ? (
            <>
              <div className="account-view-title">
                <div>
                  <h2>Списки</h2>
                  <p>
                    Сохранённые наборы. Сохранить текущую корзину можно на странице{" "}
                    <Link href="/cart">корзины</Link>.
                  </p>
                </div>
              </div>
              {!cabinet.saved_lists.length ? (
                <div className="empty-state">Пока нет сохранённых списков.</div>
              ) : (
                <div className="account-order-list">
                  {cabinet.saved_lists.map((list) => (
                    <article key={list.id} className="account-order-card">
                      <header>
                        <strong>{list.name}</strong>
                        <span>{formatDate(list.created_at)}</span>
                      </header>
                      <ul>
                        {list.items.map((item, idx) => (
                          <li key={`${item.variant_id}-${idx}`}>
                            <span>
                              {item.title || item.variant_id} × {item.quantity}
                              {item.sku ? ` · арт. ${item.sku}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="account-order-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={listBusy === list.id}
                          onClick={() => addListToCart(list)}
                        >
                          {listBusy === list.id ? "В корзину…" : "В корзину"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => deleteList(list.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="frame account-shell">Загрузка кабинета…</div>}>
      <AccountPageInner />
    </Suspense>
  )
}
