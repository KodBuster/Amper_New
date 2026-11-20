import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import type MoySkladModuleService from "../modules/moysklad/service"

/**
 * При оформлении заказа создаём customerorder в МойСклад.
 * Защита от дублей: metadata.moysklad_order_id.
 *
 * Запись в МС только при MOYSKLAD_ALLOW_WRITES=true (барьер на время тестов).
 */
export default async function orderPlacedMoyskladHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderModule = container.resolve(Modules.ORDER)

  // Барьер: без явного разрешения не трогаем МС (и контрагентов тоже)
  if (process.env.MOYSKLAD_ALLOW_WRITES !== "true") {
    console.log(
      `Заказ ${data.id}: выгрузка в МойСклад пропущена (MOYSKLAD_ALLOW_WRITES≠true)`
    )
    return
  }

  const moysklad: MoySkladModuleService = container.resolve(MOYSKLAD_MODULE)
  const client = moysklad.getClient()
  const { organizationId, storeId } = await moysklad.resolveDefaults()

  const order = await orderModule.retrieveOrder(data.id, {
    relations: ["items", "shipping_address", "billing_address"],
  })

  const meta = (order.metadata || {}) as Record<string, string>
  if (meta.moysklad_order_id) {
    console.log(`Заказ ${order.id} уже в МойСклад: ${meta.moysklad_order_id}`)
    return
  }

  const email =
    order.email ||
    (order.shipping_address as { email?: string } | undefined)?.email ||
    `guest-${order.id}@amper.local`
  const name =
    [order.shipping_address?.first_name, order.shipping_address?.last_name]
      .filter(Boolean)
      .join(" ") || email

  let agent = await client.findCounterpartyByEmail(email)
  if (!agent) {
    agent = await client.createCounterparty({
      name,
      email,
      phone: order.shipping_address?.phone || undefined,
    })
  }

  const positions = {
    rows: (order.items || []).map((item) => {
      const msId = (item.metadata as Record<string, string> | null)?.moysklad_id
      const assortmentHref = msId
        ? client.entityHref("product", msId)
        : undefined
      return {
        quantity: item.quantity,
        price: Math.round(Number(item.unit_price || 0)),
        discount: 0,
        vat: 0,
        assortment: assortmentHref
          ? {
              meta: {
                href: assortmentHref,
                type: "product",
                mediaType: "application/json",
              },
            }
          : undefined,
        reserve: item.quantity,
      }
    }),
  }

  const payload: Record<string, unknown> = {
    name: `AMPER-${order.display_id || order.id}`,
    externalCode: order.id,
    organization: {
      meta: {
        href: client.entityHref("organization", organizationId),
        type: "organization",
        mediaType: "application/json",
      },
    },
    agent: {
      meta: {
        href: client.entityHref("counterparty", agent.id),
        type: "counterparty",
        mediaType: "application/json",
      },
    },
    store: {
      meta: {
        href: client.entityHref("store", storeId),
        type: "store",
        mediaType: "application/json",
      },
    },
    positions,
    description: `Заказ с сайта АМПЕР. Medusa ID: ${order.id}`,
  }

  const created = await client.createCustomerOrder(payload)

  await orderModule.updateOrders(order.id, {
    metadata: {
      ...meta,
      moysklad_order_id: created.id,
      moysklad_order_name: created.name,
    },
  })

  console.log(`Заказ ${order.id} → МойСклад ${created.name} (${created.id})`)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
