"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { medusa, resolveMoyskladUom } from "@/lib/medusa"
import {
  clearCartId,
  getCartId,
  isCartGoneError,
  isTransientCartError,
  setCartId,
  withCartRetries,
} from "@/lib/cart"

type CartLine = {
  id: string
  title?: string
  quantity: number
  unit_price?: number
  thumbnail?: string | null
  variant_id?: string
  product_id?: string
  handle?: string
  sku?: string
  /** Единица измерения МойСклад: шт, м… */
  uom?: string
  /** Остаток на складе; null — без ограничения */
  availableQty?: number | null
}

type MedusaCart = {
  id: string
  total?: number
  items?: Array<{
    id: string
    title?: string
    product_title?: string
    quantity: number
    unit_price?: number
    thumbnail?: string | null
    variant_id?: string
    product_id?: string
    product_handle?: string
    variant_sku?: string
    metadata?: Record<string, unknown> | null
    variant?: {
      sku?: string | null
      manage_inventory?: boolean
      allow_backorder?: boolean
      inventory_quantity?: number | null
      metadata?: Record<string, unknown> | null
      product?: {
        handle?: string
        metadata?: Record<string, unknown> | null
      }
    }
    product?: {
      handle?: string
      metadata?: Record<string, unknown> | null
    }
  }>
}

function lineAvailableQty(
  item: NonNullable<MedusaCart["items"]>[number]
): number | null {
  const v = item.variant
  if (!v) return null
  if (v.manage_inventory === false || v.allow_backorder) return null
  if (typeof v.inventory_quantity === "number") {
    return Math.max(0, Math.floor(v.inventory_quantity))
  }
  return null
}

function lineUom(item: NonNullable<MedusaCart["items"]>[number]): string {
  // Тот же порядок, что productUom: товар → вариант (иначе «шт» вместо «м»)
  return resolveMoyskladUom(
    item.product?.metadata,
    item.variant?.product?.metadata,
    item.variant?.metadata,
    item.metadata
  )
}

type CartState = {
  id?: string
  items: CartLine[]
  total: number
  loading: boolean
  refresh: () => Promise<void>
  addItem: (variantId: string, quantity?: number) => Promise<void>
  removeItem: (lineId: string) => Promise<void>
  updateQuantity: (lineId: string, quantity: number) => Promise<void>
  completeCheckout: (payload: {
    email: string
    first_name: string
    last_name: string
    phone?: string
    address_1?: string
    city?: string
    fulfillment?: "pickup" | "delivery"
  }) => Promise<{ orderId?: string; displayId?: number | string }>
}

const CartContext = createContext<CartState | null>(null)

/** Нужны product/variant.metadata — иначе uom падает в «шт» */
const CART_FIELDS =
  "*items,*items.metadata,*items.variant,*items.variant.metadata,*items.product,*items.product.metadata,+items.variant.sku,+items.variant.inventory_quantity,+items.variant.manage_inventory,+items.variant.allow_backorder,*items.thumbnail"

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | undefined>()
  const [items, setItems] = useState<CartLine[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  type ProductMetaPatch = { uom: string; article?: string }

  const mapLines = useCallback(
    (
      cartItems: NonNullable<MedusaCart["items"]>,
      metaByProductId?: Record<string, ProductMetaPatch>
    ): CartLine[] =>
      cartItems.map((item) => {
        const patch = item.product_id
          ? metaByProductId?.[item.product_id]
          : undefined
        let uom = lineUom(item)
        // Если в ответе корзины нет metadata — берём из догрузки товаров
        if (patch?.uom && (uom === "шт" || !item.product?.metadata?.moysklad_uom)) {
          uom = patch.uom
        }
        const sku =
          item.variant_sku ||
          item.variant?.sku ||
          String(item.variant?.metadata?.moysklad_article || "").trim() ||
          patch?.article ||
          undefined
        return {
          id: item.id,
          title: item.title || item.product_title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          thumbnail: item.thumbnail,
          variant_id: item.variant_id,
          product_id: item.product_id,
          handle:
            item.product_handle ||
            item.variant?.product?.handle ||
            item.product?.handle ||
            undefined,
          sku,
          uom,
          availableQty: lineAvailableQty(item),
        }
      }),
    []
  )

  /**
   * Cart API часто не отдаёт product.metadata → «шт» вместо «м», пустой артикул.
   * Догружаем uom и артикул одним запросом по product_id.
   */
  const loadProductMetaByIds = useCallback(
    async (cartItems: NonNullable<MedusaCart["items"]>) => {
      const needIds = [
        ...new Set(
          cartItems
            .filter((item) => {
              if (!item.product_id) return false
              const hasUom = Boolean(
                item.product?.metadata?.moysklad_uom ||
                  item.variant?.product?.metadata?.moysklad_uom ||
                  item.variant?.metadata?.moysklad_uom ||
                  item.metadata?.moysklad_uom
              )
              const hasArticle = Boolean(
                item.variant_sku ||
                  item.variant?.sku ||
                  item.variant?.metadata?.moysklad_article ||
                  item.product?.metadata?.moysklad_article
              )
              return !hasUom || !hasArticle
            })
            .map((item) => item.product_id as string)
        ),
      ]
      if (!needIds.length) return {} as Record<string, ProductMetaPatch>

      try {
        const { products } = await medusa.store.product.list({
          id: needIds,
          limit: needIds.length,
          fields: "+metadata,*variants,*variants.metadata,+variants.sku",
        })
        const map: Record<string, ProductMetaPatch> = {}
        for (const p of products || []) {
          const meta = (p as { metadata?: Record<string, unknown> }).metadata
          const variant = (
            p as {
              variants?: Array<{
                sku?: string | null
                metadata?: Record<string, unknown> | null
              }>
            }
          ).variants?.[0]
          const article =
            String(meta?.moysklad_article || meta?.moysklad_code || "").trim() ||
            String(variant?.sku || "").trim() ||
            String(variant?.metadata?.moysklad_article || "").trim() ||
            undefined
          map[p.id] = {
            uom: resolveMoyskladUom(meta, variant?.metadata),
            article: article || undefined,
          }
        }
        return map
      } catch {
        return {}
      }
    },
    []
  )

  const applyCart = useCallback(
    async (cart: MedusaCart | null | undefined) => {
      if (!cart?.id) {
        setId(undefined)
        setItems([])
        setTotal(0)
        return
      }
      setId(cart.id)
      setCartId(cart.id)
      const raw = cart.items || []
      const metaMap = await loadProductMetaByIds(raw)
      setItems(mapLines(raw, metaMap))
      // Medusa 2: суммы корзины в основных единицах валюты (рубли)
      setTotal(Number(cart.total || 0))
    },
    [loadProductMetaByIds, mapLines]
  )

  const fetchCartById = useCallback(async (cartId: string) => {
    const { cart } = await withCartRetries(() =>
      medusa.store.cart.retrieve(cartId, { fields: CART_FIELDS })
    )
    await applyCart(cart)
    return cart
  }, [applyCart])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const existing = getCartId()
      if (!existing) {
        await applyCart(null)
        return
      }
      await fetchCartById(existing)
    } catch (err) {
      // Только «корзины нет» — сбрасываем ID. Сеть/рестарт — оставляем.
      if (isCartGoneError(err)) {
        clearCartId()
        await applyCart(null)
      } else if (!isTransientCartError(err)) {
        clearCartId()
        await applyCart(null)
      }
      // При transient: ID в localStorage остаётся, UI не трогаем жёстко
    } finally {
      setLoading(false)
    }
  }, [applyCart, fetchCartById])

  useEffect(() => {
    refresh()
  }, [refresh])

  const ensureCart = useCallback(async () => {
    const existing = getCartId()
    if (existing) {
      try {
        return await fetchCartById(existing)
      } catch (err) {
        if (isCartGoneError(err)) {
          clearCartId()
        } else if (isTransientCartError(err)) {
          // Не создаём новую корзину поверх живой — иначе на мобилке «съест» старую
          throw new Error(
            "Не удалось связаться с корзиной. Проверьте сеть и попробуйте ещё раз."
          )
        } else {
          clearCartId()
        }
      }
    }
    // Регион нужен, чтобы Pricing отдал цену варианта
    const { regions } = await medusa.store.region.list({ limit: 1 })
    const regionId = regions?.[0]?.id
    const { cart } = await medusa.store.cart.create(
      regionId ? { region_id: regionId } : {}
    )
    await applyCart(cart)
    return cart
  }, [applyCart, fetchCartById])

  const retrieveCart = useCallback(
    async (cartId: string) => fetchCartById(cartId),
    [fetchCartById]
  )

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      const cart = await ensureCart()
      const existing = (cart.items || []).find(
        (line) =>
          line.variant_id === variantId || line.variant?.id === variantId
      )
      // Уже в корзине — увеличиваем количество (createLineItem на том же варианте часто падает)
      if (existing?.id) {
        await medusa.store.cart.updateLineItem(cart.id, existing.id, {
          quantity: (existing.quantity || 0) + quantity,
        })
      } else {
        await medusa.store.cart.createLineItem(cart.id, {
          variant_id: variantId,
          quantity,
        })
      }
      await retrieveCart(cart.id)
    },
    [ensureCart, retrieveCart]
  )

  const removeItem = useCallback(
    async (lineId: string) => {
      if (!id) return
      await medusa.store.cart.deleteLineItem(id, lineId)
      await retrieveCart(id)
    },
    [id, retrieveCart]
  )

  const updateQuantity = useCallback(
    async (lineId: string, quantity: number) => {
      if (!id) return
      if (quantity <= 0) {
        await removeItem(lineId)
        return
      }
      await medusa.store.cart.updateLineItem(id, lineId, {
        quantity,
      })
      await retrieveCart(id)
    },
    [id, removeItem, retrieveCart]
  )

  const completeCheckout = useCallback(
    async (payload: {
      email: string
      first_name: string
      last_name: string
      phone?: string
      address_1?: string
      city?: string
      fulfillment?: "pickup" | "delivery"
    }) => {
      const cart = await ensureCart()
      // Если покупатель вошёл — привязываем корзину к customer
      try {
        await medusa.store.cart.transferCart(cart.id)
      } catch {
        // гость или уже привязана
      }
      const address = {
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone,
        email: payload.email,
        address_1: payload.address_1 || "Самовывоз",
        city: payload.city || "Москва",
        country_code: "ru",
      }
      const { cart: updated } = await medusa.store.cart.update(cart.id, {
        email: payload.email,
        // email дублируем в адрес — надёжнее для гостевого поиска заказа
        shipping_address: address as never,
        billing_address: address as never,
      })

      const { shipping_options } =
        await medusa.store.fulfillment.listCartOptions({
          cart_id: updated.id,
        })
      const options = shipping_options || []
      if (!options.length) {
        throw new Error(
          "Не настроен способ получения заказа. В Admin: Настройки → Locations & Shipping — включите доставку/самовывоз для склада и создайте опцию, либо выполните скрипт ensure-fulfillment."
        )
      }

      const wantPickup = payload.fulfillment !== "delivery"
      const preferred =
        options.find((o) =>
          wantPickup
            ? /самовывоз|pickup/i.test(o.name || "")
            : /доставк|delivery|shipping/i.test(o.name || "")
        ) || options[0]

      await medusa.store.cart.addShippingMethod(updated.id, {
        option_id: preferred.id,
      })

      // Пока нет эквайринга: системный провайдер «оплата вручную»
      const fresh = await medusa.store.cart.retrieve(updated.id)
      await medusa.store.payment.initiatePaymentSession(fresh.cart, {
        provider_id: "pp_system_default",
      })

      const result = await medusa.store.cart.complete(updated.id)
      if ((result as { type?: string }).type === "cart") {
        const err = (result as { error?: { message?: string } }).error?.message
        throw new Error(err || "Не удалось оформить заказ.")
      }

      clearCartId()
      applyCart(null)
      const order = (result as {
        order?: { id?: string; display_id?: number | string }
      })?.order
      return {
        orderId: order?.id,
        // Читаемый номер для покупателя (1, 2, 3…)
        displayId: order?.display_id,
      }
    },
    [applyCart, ensureCart]
  )

  const value = useMemo(
    () => ({
      id,
      items,
      total,
      loading,
      refresh,
      addItem,
      removeItem,
      updateQuantity,
      completeCheckout,
    }),
    [
      id,
      items,
      total,
      loading,
      refresh,
      addItem,
      removeItem,
      updateQuantity,
      completeCheckout,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart вне CartProvider")
  return ctx
}
