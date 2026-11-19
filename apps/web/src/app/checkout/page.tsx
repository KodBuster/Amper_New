"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { useCart } from "@/components/CartProvider"
import { formatRub } from "@/lib/medusa"

export default function CheckoutPage() {
  const { items, total, completeCheckout } = useCart()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup")

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError("")
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get("name") || "").trim()
    const [first_name, ...rest] = name.split(/\s+/)
    const last_name = rest.join(" ") || first_name
    try {
      const result = await completeCheckout({
        email: String(fd.get("email") || ""),
        first_name: first_name || "Покупатель",
        last_name,
        phone: String(fd.get("phone") || ""),
        address_1:
          fulfillment === "pickup"
            ? "Самовывоз"
            : String(fd.get("address_1") || "Доставка"),
        city: String(fd.get("city") || "Москва"),
      })
      setDone(result.orderId || "ok")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (!items.length && !done) {
    return (
      <div className="frame interior">
        <Breadcrumbs items={[{ label: "Корзина", href: "/cart" }, { label: "Оформление" }]} />
        <div className="blank-state">
          <h1>Корзина пока пуста</h1>
          <Link href="/catalog" className="btn btn-primary">
            Перейти в каталог
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="frame interior">
        <div className="form-success checkout-done">
          <div className="success-icon">
            <Icon name="check" />
          </div>
          <h1>Заказ принят</h1>
          <p>
            Спасибо! Заказ отправлен в обработку
            {done !== "ok" ? ` (ID: ${done})` : ""}.
          </p>
          <Link href="/catalog" className="btn btn-primary">
            Продолжить выбор
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="frame interior">
      <Breadcrumbs
        items={[
          { label: "Корзина", href: "/cart" },
          { label: "Оформление заказа" },
        ]}
      />
      <PageIntro
        eyebrow="Оформление"
        title="Проверим заказ"
        lead="Укажите контакты и способ получения. Онлайн-оплата подключится отдельно."
      />

      <div className="checkout-grid">
        <form className="request-form" onSubmit={onSubmit} noValidate>
          <h2>Данные покупателя</h2>
          <label>
            <span className="field-label">
              Имя <b className="required-mark">*</b>
            </span>
            <input name="name" autoComplete="name" required placeholder="Ваше имя" />
          </label>
          <label>
            <span className="field-label">
              Телефон <b className="required-mark">*</b>
            </span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+7 999 123-45-67"
            />
          </label>
          <label>
            <span className="field-label">
              Email <b className="required-mark">*</b>
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>

          <fieldset className="choice">
            <legend>Получение заказа</legend>
            <label>
              <input
                type="radio"
                name="fulfillment"
                value="pickup"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
              />{" "}
              Самовывоз
            </label>
            <label>
              <input
                type="radio"
                name="fulfillment"
                value="delivery"
                checked={fulfillment === "delivery"}
                onChange={() => setFulfillment("delivery")}
              />{" "}
              Доставка
            </label>
          </fieldset>

          {fulfillment === "delivery" ? (
            <>
              <label>
                <span className="field-label">Город</span>
                <input name="city" placeholder="Город" defaultValue="Москва" />
              </label>
              <label>
                <span className="field-label">Адрес</span>
                <input name="address_1" placeholder="Улица, дом, квартира" />
              </label>
            </>
          ) : null}

          <div className="legal-notice">
            Данные нужны для оформления заказа. Подробнее —{" "}
            <Link href="/privacy">политика обработки данных</Link>.
          </div>

          <label className="law-extra-check">
            <input type="checkbox" name="offerAccepted" required />
            <span>
              Ознакомлен(а) с{" "}
              <Link href="/offer">условиями продажи (оферта)</Link> и подтверждаю
              оформление.
            </span>
          </label>

          <p className="legal-info-small">
            <Link href="/seller">Сведения о продавце</Link> ·{" "}
            <Link href="/returns">Возврат и гарантия</Link> ·{" "}
            <Link href="/claims">Порядок претензий</Link>
          </p>

          {error ? (
            <div className="form-error" role="alert">
              {error}
            </div>
          ) : null}

          <button className="btn btn-primary full-btn" type="submit" disabled={pending}>
            {pending ? "Отправляем…" : "Подтвердить заказ"} <Icon name="arrow" />
          </button>
        </form>

        <aside className="checkout-summary">
          <h2>Ваши товары</h2>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.title} × {item.quantity}
                </span>
                <b>{formatRub((item.unit_price || 0) * item.quantity)}</b>
              </li>
            ))}
          </ul>
          <div className="summary-total">
            <span>К оплате</span>
            <strong>{formatRub(total)}</strong>
          </div>
          <Link href="/cart" className="cart-action-link">
            ← Вернуться в корзину
          </Link>
        </aside>
      </div>
    </div>
  )
}
