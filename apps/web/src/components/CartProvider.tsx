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
  /** Единица измерения МойСклад: шт, м… */
  uom?: string
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
    variant?: {
      metadata?: Record<string, unknown> | null
      product?: { metadata?: Record<string, unknown> | null }
    }
    product?: { metadata?: Record<string, unknown> | null }
  }>
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
  }) => Promise<{ orderId?: string }>
}

const CartContext = createContext<CartState | null>(null)

/** Чтобы в корзине была единица измерения из metadata варианта/товара */
const CART_FIELDS =
  "+items,+items.variant,+items.variant.metadata,+items.product,+items.product.metadata,*items.thumbnail"

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
        uom: lineUom(item),
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
    }) => {
      const cart = await ensureCart()
      await medusa.store.cart.update(cart.id, {
        email: payload.email,
        shipping_address: {
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone,
          address_1: payload.address_1 || "Самовывоз",
          city: payload.city || "Москва",
          country_code: "ru",
        },
      })

      // На MVP: завершение через store API complete (manual payment/shipping должны быть настроены в регионе)
      const result = await medusa.store.cart.complete(cart.id)
      clearCartId()
      applyCart(null)
      const orderId = (result as { order?: { id?: string } })?.order?.id
      return { orderId }
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
