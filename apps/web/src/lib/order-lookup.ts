import { medusa } from "@/lib/medusa"

export type LookupOrderItem = {
  id: string
  title?: string
  quantity?: number
  unit_price?: number
  thumbnail?: string | null
  sku?: string | null
}

export type LookupOrder = {
  id: string
  display_id?: number
  status?: string
  created_at?: string
  total?: number
  currency_code?: string
  items: LookupOrderItem[]
}

/** Гостевой поиск заказа через наш store route */
export async function lookupOrder(input: {
  display_id: string
  email?: string
  phone?: string
}): Promise<LookupOrder> {
  const base =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  const res = await fetch(`${base.replace(/\/$/, "")}/store/order-lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-publishable-api-key": key } : {}),
    },
    body: JSON.stringify({
      display_id: input.display_id,
      email: input.email || undefined,
      phone: input.phone || undefined,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    order?: LookupOrder
  }

  if (!res.ok || !data.order) {
    throw new Error(data.message || "Не удалось найти заказ")
  }
  return data.order
}

export async function listMyOrders() {
  const { orders } = await medusa.store.order.list({
    limit: 50,
    // variant_id нужен для «Повторить заказ»
    fields:
      "+display_id,+status,+created_at,+total,+currency_code,*items,*items.variant,+items.variant_id,+items.variant_sku,+items.product_title",
  })
  return orders || []
}
