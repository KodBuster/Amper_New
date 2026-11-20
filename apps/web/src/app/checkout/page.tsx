"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { useCart } from "@/components/CartProvider"
import { formatRub } from "@/lib/medusa"

type FieldKey = "name" | "phone" | "email" | "offerAccepted"

const EMPTY_FIELDS: Record<FieldKey, string> = {
  name: "",
  phone: "",
  email: "",
  offerAccepted: "",
}

export default function CheckoutPage() {
  const { items, total, completeCheckout } = useCart()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<{
    orderId?: string
    displayId?: number | string
  } | null>(null)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] =
    useState<Record<FieldKey, string>>(EMPTY_FIELDS)
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup")

  function clearField(key: FieldKey) {
    setFieldErrors((prev) =>
      prev[key] ? { ...prev, [key]: "" } : prev
    )
  }

  function validate(fd: FormData): {
    ok: boolean
    name: string
    phone: string
    email: string
  } {
    const next = { ...EMPTY_FIELDS }
    const name = String(fd.get("name") || "").trim()
    const phone = String(fd.get("phone") || "").trim()
    const email = String(fd.get("email") || "").trim()

    if (!name) next.name = "Укажите имя"
    if (!phone) next.phone = "Укажите телефон"
    if (!email) next.email = "Укажите email"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "Проверьте формат email"
    }
    if (!fd.get("offerAccepted")) {
      next.offerAccepted = "Отметьте, что ознакомлены с условиями продажи"
    }

    setFieldErrors(next)
    const ok = !Object.values(next).some(Boolean)
    if (!ok) {
      setError("Заполните обязательные поля — они отмечены красной рамкой.")
    }
    return { ok, name, phone, email }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const fd = new FormData(e.currentTarget)
    const { ok, name, phone, email } = validate(fd)
    if (!ok) return

    const [first_name, ...rest] = name.split(/\s+/)
    const last_name = rest.join(" ") || first_name
    setPending(true)
    try {
      const result = await completeCheckout({
        email,
        first_name: first_name || "Покупатель",
        last_name,
        phone,
        fulfillment,
        address_1:
          fulfillment === "pickup"
            ? "Самовывоз"
            : String(fd.get("address_1") || "Доставка"),
        city: String(fd.get("city") || "Москва"),
      })
      setDone({
        orderId: result.orderId,
        displayId: result.displayId,
      })
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      if (/payment collection|payment session|pp_system/i.test(raw)) {
        setError(
          "Оплата ещё не настроена в регионе. В Admin: регион → Платежные провайдеры → System Default."
        )
      } else if (/shipping method|shipping option|require shipping/i.test(raw)) {
        setError(
          "Не выбран способ получения. В Admin: Настройки → Locations & Shipping — создайте Самовывоз/Доставку для склада, либо выполните ensure-fulfillment."
        )
      } else {
        setError(raw)
      }
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
            Спасибо! Заказ отправлен в обработку.
            {done.displayId != null && done.displayId !== "" ? (
              <>
                {" "}
                Ваш номер заказа: <strong>№{done.displayId}</strong>.
                Сохраните его — по нему можно уточнить статус у менеджера.
              </>
            ) : done.orderId ? (
              <> Внутренний код: {done.orderId}.</>
            ) : null}
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
          <label className={fieldErrors.name ? "field-invalid" : undefined}>
            <span className="field-label">
              Имя <b className="required-mark">*</b>
            </span>
            <input
              name="name"
              autoComplete="name"
              required
              placeholder="Ваше имя"
              aria-invalid={Boolean(fieldErrors.name)}
              onChange={() => clearField("name")}
            />
            {fieldErrors.name ? (
              <span className="field-hint">{fieldErrors.name}</span>
            ) : null}
          </label>
          <label className={fieldErrors.phone ? "field-invalid" : undefined}>
            <span className="field-label">
              Телефон <b className="required-mark">*</b>
            </span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+7 999 123-45-67"
              aria-invalid={Boolean(fieldErrors.phone)}
              onChange={() => clearField("phone")}
            />
            {fieldErrors.phone ? (
              <span className="field-hint">{fieldErrors.phone}</span>
            ) : null}
          </label>
          <label className={fieldErrors.email ? "field-invalid" : undefined}>
            <span className="field-label">
              Email <b className="required-mark">*</b>
            </span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              onChange={() => clearField("email")}
            />
            {fieldErrors.email ? (
              <span className="field-hint">{fieldErrors.email}</span>
            ) : null}
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

          <label
            className={`law-extra-check${
              fieldErrors.offerAccepted ? " field-invalid" : ""
            }`}
          >
            <input
              type="checkbox"
              name="offerAccepted"
              required
              aria-invalid={Boolean(fieldErrors.offerAccepted)}
              onChange={() => clearField("offerAccepted")}
            />
            <span>
              Ознакомлен(а) с{" "}
              <Link href="/offer">условиями продажи (оферта)</Link> и подтверждаю
              оформление.
            </span>
            {fieldErrors.offerAccepted ? (
              <span className="field-hint">{fieldErrors.offerAccepted}</span>
            ) : null}
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
            {pending ? "Отправляем…" : "Подтвердить заказ"}
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
            Вернуться в корзину
          </Link>
        </aside>
      </div>
    </div>
  )
}
