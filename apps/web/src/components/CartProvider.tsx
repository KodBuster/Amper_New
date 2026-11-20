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
import { clearCartId, getCartId, setCartId } from "@/lib/cart"

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
  const fromVariant = String(item.variant?.metadata?.moysklad_uom || "").trim()
  if (fromVariant) return fromVariant
  const fromProduct = String(
    item.variant?.product?.metadata?.moysklad_uom ||
      item.product?.metadata?.moysklad_uom ||
      ""
  ).trim()
  if (fromProduct) return fromProduct
  return "шт"
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

/** Единица измерения, артикул, handle и остаток для корзины V10.1 */
const CART_FIELDS =
  "+items,+items.variant,+items.variant.sku,+items.variant.metadata,+items.variant.inventory_quantity,+items.variant.manage_inventory,+items.variant.allow_backorder,+items.product,+items.product.handle,+items.product.metadata,*items.thumbnail"

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | undefined>()
  const [items, setItems] = useState<CartLine[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const applyCart = useCallback((cart: MedusaCart | null | undefined) => {
    if (!cart?.id) {
      setId(undefined)
      setItems([])
      setTotal(0)
      return
    }
    setId(cart.id)
    setCartId(cart.id)
    setItems(
      (cart.items || []).map((item) => ({
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
        sku:
          item.variant_sku ||
          item.variant?.sku ||
          String(item.variant?.metadata?.moysklad_article || "").trim() ||
          undefined,
        uom: lineUom(item),
        availableQty: lineAvailableQty(item),
      }))
    )
    // Medusa 2: суммы корзины в основных единицах валюты (рубли)
    setTotal(Number(cart.total || 0))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const existing = getCartId()
      if (!existing) {
        applyCart(null)
        return
      }
      const { cart } = await medusa.store.cart.retrieve(existing, {
        fields: CART_FIELDS,
      })
      applyCart(cart)
    } catch {
      clearCartId()
      applyCart(null)
    } finally {
      setLoading(false)
    }
  }, [applyCart])

  useEffect(() => {
    refresh()
  }, [refresh])

  const ensureCart = useCallback(async () => {
    const existing = getCartId()
    if (existing) {
      try {
        const { cart } = await medusa.store.cart.retrieve(existing, {
          fields: CART_FIELDS,
        })
        applyCart(cart)
        return cart
      } catch {
        clearCartId()
      }
    }
    // Регион нужен, чтобы Pricing отдал цену варианта
    const { regions } = await medusa.store.region.list({ limit: 1 })
    const regionId = regions?.[0]?.id
    const { cart } = await medusa.store.cart.create(
      regionId ? { region_id: regionId } : {}
    )
    applyCart(cart)
    return cart
  }, [applyCart])

  const retrieveCart = useCallback(async (cartId: string) => {
    const { cart } = await medusa.store.cart.retrieve(cartId, {
      fields: CART_FIELDS,
    })
    applyCart(cart)
    return cart
  }, [applyCart])

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      const cart = await ensureCart()
      await medusa.store.cart.createLineItem(cart.id, {
        variant_id: variantId,
        quantity,
      })
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
      const { cart: updated } = await medusa.store.cart.update(cart.id, {
        email: payload.email,
        shipping_address: {
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone,
          address_1: payload.address_1 || "Самовывоз",
          city: payload.city || "Москва",
          country_code: "ru",
        },
        billing_address: {
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone,
          address_1: payload.address_1 || "Самовывоз",
          city: payload.city || "Москва",
          country_code: "ru",
        },
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
