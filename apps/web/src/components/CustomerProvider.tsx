"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { medusa } from "@/lib/medusa"
import { getCartId } from "@/lib/cart"
import {
  newListId,
  parseCabinetMeta,
  type CustomerCabinetMeta,
  type SavedList,
  type SavedListItem,
} from "@/lib/customer-meta"

export type StoreCustomer = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  metadata?: Record<string, unknown> | null
}

type CustomerState = {
  customer: StoreCustomer | null
  loading: boolean
  cabinet: CustomerCabinetMeta
  refresh: () => Promise<StoreCustomer | null>
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    first_name?: string
    last_name?: string
    phone?: string
  }) => Promise<void>
  logout: () => Promise<void>
  toggleFavorite: (productId: string) => Promise<void>
  saveList: (name: string, items: SavedListItem[]) => Promise<SavedList>
  deleteList: (listId: string) => Promise<void>
}

const CustomerContext = createContext<CustomerState | null>(null)

function errMessage(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : ""
  // Safari на телефоне: «Load failed», когда API недоступен (часто localhost с мобилки)
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(raw)) {
    return "Нет связи с сервером. С телефона нужен адрес API по сети, не localhost."
  }
  if (raw) return raw
  return "Не удалось выполнить запрос"
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<StoreCustomer | null>(null)
  const [loading, setLoading] = useState(true)

  const cabinet = useMemo(
    () => parseCabinetMeta(customer?.metadata),
    [customer?.metadata]
  )

  const applyCustomer = useCallback((c: StoreCustomer | null) => {
    setCustomer(c)
  }, [])

  const refresh = useCallback(async (): Promise<StoreCustomer | null> => {
    setLoading(true)
    try {
      const { customer: c } = await medusa.store.customer.retrieve()
      const next = c as StoreCustomer
      applyCustomer(next)
      return next
    } catch {
      applyCustomer(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [applyCustomer])

  useEffect(() => {
    refresh()
  }, [refresh])

  const transferGuestCart = useCallback(async () => {
    const cartId = getCartId()
    if (!cartId) return
    try {
      await medusa.store.cart.transferCart(cartId)
    } catch {
      // корзина могла быть уже привязана или гостевая — не блокируем вход
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const token = await medusa.auth.login("customer", "emailpass", {
        email: email.trim().toLowerCase(),
        password,
      })
      if (typeof token !== "string") {
        throw new Error("Нужен дополнительный шаг входа — этот способ не поддерживается")
      }
      await transferGuestCart()
      const me = await refresh()
      if (!me?.id) {
        throw new Error("Вход выполнен, но профиль не загрузился. Обновите страницу.")
      }
    },
    [refresh, transferGuestCart]
  )

  const register = useCallback(
    async (input: {
      email: string
      password: string
      first_name?: string
      last_name?: string
      phone?: string
    }) => {
      const email = input.email.trim().toLowerCase()
      const password = input.password

      // Medusa 2: сначала registration JWT, им создаём customer, потом login.
      // Login до create сбивает registration-токен — кабинет «создаётся», но сессии нет.
      try {
        await medusa.auth.register("customer", "emailpass", {
          email,
          password,
        })
      } catch (err) {
        const msg = errMessage(err)
        if (!/already|exist|identity/i.test(msg)) {
          throw err
        }
        // Identity уже есть — берём обычный login-токен (как в доке storefront)
        const loginToken = await medusa.auth.login("customer", "emailpass", {
          email,
          password,
        })
        if (typeof loginToken !== "string") {
          throw new Error(
            "Этот email уже занят, но войти не удалось. Проверьте пароль."
          )
        }
      }

      try {
        await medusa.store.customer.create({
          email,
          first_name: input.first_name || undefined,
          last_name: input.last_name || undefined,
          phone: input.phone || undefined,
          metadata: { favorites: [], saved_lists: [] },
        })
      } catch (err) {
        if (!/already|exist/i.test(errMessage(err))) {
          throw err
        }
      }

      // Полноценная сессия покупателя после create
      const token = await medusa.auth.login("customer", "emailpass", {
        email,
        password,
      })
      if (typeof token !== "string") {
        throw new Error("Аккаунт создан, но автоматический вход не удался. Войдите вручную.")
      }

      await transferGuestCart()
      const me = await refresh()
      if (!me?.id) {
        throw new Error(
          "Регистрация прошла, но сессия не открылась. Войдите вручную."
        )
      }
    },
    [refresh, transferGuestCart]
  )

  const logout = useCallback(async () => {
    try {
      await medusa.auth.logout()
    } catch {
      // ignore
    }
    applyCustomer(null)
  }, [applyCustomer])

  const persistMeta = useCallback(
    async (next: CustomerCabinetMeta) => {
      if (!customer) throw new Error("Войдите в кабинет")
      const { customer: updated } = await medusa.store.customer.update({
        metadata: {
          ...(customer.metadata || {}),
          favorites: next.favorites,
          saved_lists: next.saved_lists,
        },
      })
      applyCustomer(updated as StoreCustomer)
    },
    [applyCustomer, customer]
  )

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (!customer) throw new Error("Войдите, чтобы сохранить в избранное")
      const set = new Set(cabinet.favorites)
      if (set.has(productId)) set.delete(productId)
      else set.add(productId)
      await persistMeta({
        favorites: [...set],
        saved_lists: cabinet.saved_lists,
      })
    },
    [cabinet.favorites, cabinet.saved_lists, customer, persistMeta]
  )

  const saveList = useCallback(
    async (name: string, items: SavedListItem[]) => {
      if (!customer) throw new Error("Войдите, чтобы сохранить список")
      const list: SavedList = {
        id: newListId(),
        name: name.trim() || "Мой список",
        created_at: new Date().toISOString(),
        items,
      }
      await persistMeta({
        favorites: cabinet.favorites,
        saved_lists: [list, ...cabinet.saved_lists],
      })
      return list
    },
    [cabinet.favorites, cabinet.saved_lists, customer, persistMeta]
  )

  const deleteList = useCallback(
    async (listId: string) => {
      if (!customer) throw new Error("Войдите в кабинет")
      await persistMeta({
        favorites: cabinet.favorites,
        saved_lists: cabinet.saved_lists.filter((l) => l.id !== listId),
      })
    },
    [cabinet.favorites, cabinet.saved_lists, customer, persistMeta]
  )

  const value = useMemo<CustomerState>(
    () => ({
      customer,
      loading,
      cabinet,
      refresh,
      login,
      register,
      logout,
      toggleFavorite,
      saveList,
      deleteList,
    }),
    [
      customer,
      loading,
      cabinet,
      refresh,
      login,
      register,
      logout,
      toggleFavorite,
      saveList,
      deleteList,
    ]
  )

  return (
    <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>
  )
}

export function useCustomer() {
  const ctx = useContext(CustomerContext)
  if (!ctx) {
    throw new Error("useCustomer нужно вызывать внутри CustomerProvider")
  }
  return ctx
}
