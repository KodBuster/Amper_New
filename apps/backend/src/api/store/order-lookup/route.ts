import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Body = {
  display_id?: string | number
  email?: string
  phone?: string
}

function digits(value: string): string {
  return value.replace(/\D+/g, "")
}

function normEmail(value: string): string {
  return value.trim().toLowerCase()
}

type OrderRow = {
  id: string
  display_id?: number
  email?: string | null
  status?: string
  created_at?: string
  total?: number
  currency_code?: string
  items?: Array<{
    id: string
    title?: string
    quantity?: number
    unit_price?: number
    thumbnail?: string | null
    variant_sku?: string | null
  }>
  shipping_address?: { phone?: string | null } | null
  billing_address?: { phone?: string | null } | null
  customer?: { email?: string | null; phone?: string | null } | null
}

/**
 * Гостевой просмотр заказа: номер + email или телефон из оформления.
 * POST /store/order-lookup
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Body
  const displayRaw = String(body.display_id ?? "").trim()
  const email = normEmail(String(body.email || ""))
  const phone = digits(String(body.phone || ""))

  if (!displayRaw) {
    res.status(400).json({ message: "Укажите номер заказа" })
    return
  }
  if (!email && !phone) {
    res.status(400).json({ message: "Укажите email или телефон из оформления" })
    return
  }

  const displayId = Number(displayRaw.replace(/\D+/g, ""))
  if (!Number.isFinite(displayId) || displayId <= 0) {
    res.status(400).json({ message: "Некорректный номер заказа" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // Query graph надёжнее отдаёт email заказа, чем listOrders без fields
  const { data } = await query.graph({
    entity: "order",
    filters: { display_id: displayId },
    fields: [
      "id",
      "display_id",
      "email",
      "status",
      "created_at",
      "total",
      "currency_code",
      "items.id",
      "items.title",
      "items.quantity",
      "items.unit_price",
      "items.thumbnail",
      "items.variant_sku",
      "shipping_address.phone",
      "billing_address.phone",
      "customer.email",
      "customer.phone",
    ],
  })

  const order = ((data || []) as OrderRow[])[0]

  if (!order) {
    res.status(404).json({ message: "Заказ не найден" })
    return
  }

  // В order_address поля email нет — смотрим order.email и customer.email
  const emails = [order.email, order.customer?.email]
    .map((v) => normEmail(String(v || "")))
    .filter(Boolean)

  const phones = [
    order.shipping_address?.phone,
    order.billing_address?.phone,
    order.customer?.phone,
  ]
    .map((v) => digits(String(v || "")))
    .filter(Boolean)

  // Если в поле email прислали телефон — тоже принимаем
  const contactAsPhone = email && !email.includes("@") ? digits(email) : ""
  const emailOk = email && email.includes("@") ? emails.some((e) => e === email) : false
  const phoneOk =
    phone || contactAsPhone
      ? phones.some(
          (p) =>
            p.endsWith(phone || contactAsPhone) ||
            (phone || contactAsPhone).endsWith(p)
        )
      : false

  if (!emailOk && !phoneOk) {
    // Не светим, какие данные есть у заказа — только подсказка
    res.status(403).json({
      message:
        "Email или телефон не совпадают с данными заказа. Укажите те же, что при оформлении (или телефон).",
    })
    return
  }

  res.json({
    order: {
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      created_at: order.created_at,
      total: order.total,
      currency_code: order.currency_code || "rub",
      items: (order.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        thumbnail: item.thumbnail,
        sku: item.variant_sku,
      })),
    },
  })
}
