"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { CartUpsell } from "@/components/CartUpsell"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { useCart } from "@/components/CartProvider"
import { formatRub, translateInventoryError } from "@/lib/medusa"

export default function CartPage() {
  const { items, total, loading, removeItem, updateQuantity } = useCart()
  const [lineError, setLineError] = useState<Record<string, string>>({})
  const units = items.reduce((s, i) => s + i.quantity, 0)
  const excludeProductIds = items
    .map((i) => i.product_id)
    .filter((id): id is string => Boolean(id))

  async function changeQty(lineId: string, next: number) {
    setLineError((prev) => {
      const copy = { ...prev }
      delete copy[lineId]
      return copy
    })
    try {
      await updateQuantity(lineId, next)
    } catch (err) {
      const line = items.find((i) => i.id === lineId)
      setLineError((prev) => ({
        ...prev,
        [lineId]: translateInventoryError(err, line?.availableQty ?? null),
      }))
    }
  }

  if (loading) {
    return (
      <div className="frame interior">
        <Breadcrumbs items={[{ label: "Корзина" }]} />
        <PageIntro eyebrow="Покупка" title="Корзина" lead="Загрузка…" />
      </div>
    )
  }

  return (
    <div className="frame interior">
      <Breadcrumbs items={[{ label: "Корзина" }]} />
      <PageIntro
        eyebrow="Покупка"
        title="Корзина"
        lead={
          items.length
            ? "Проверьте количество и состав покупки перед оформлением."
            : "Вы ещё не добавили товары."
        }
      />

      {items.length ? (
        <div className="cart-page">
          <CartUpsell excludeProductIds={excludeProductIds} />

          <div className="cart-page-list">
            {items.map((item) => {
              const href = item.handle
                ? `/product/${encodeURIComponent(item.handle)}`
                : undefined
              return (
                <article className="cart-page-item" key={item.id}>
                  {href ? (
                    <Link href={href} aria-label={item.title || "Товар"}>
                      <Image
                        src={item.thumbnail || "/assets/photo-product-101.webp"}
                        alt=""
                        width={96}
                        height={96}
                      />
                    </Link>
                  ) : (
                    <Image
                      src={item.thumbnail || "/assets/photo-product-101.webp"}
                      alt=""
                      width={96}
                      height={96}
                    />
                  )}
                  <div>
                    <h2>
                      {href ? (
                        <Link href={href}>{item.title || "Товар"}</Link>
                      ) : (
                        item.title || "Товар"
                      )}
                    </h2>
                    <p>
                      {item.sku ? <>Артикул {item.sku} · </> : null}
                      {formatRub(item.unit_price || 0)} / {item.uom || "шт"}
                    </p>
                    <div className="cart-qty">
                      <button
                        type="button"
                        aria-label={`Уменьшить: ${item.title || "товар"}`}
                        onClick={() => changeQty(item.id, item.quantity - 1)}
                      >
                        <Icon name="minus" />
                      </button>
                      <b>{item.quantity}</b>
                      <button
                        type="button"
                        aria-label={`Увеличить: ${item.title || "товар"}`}
                        onClick={() => changeQty(item.id, item.quantity + 1)}
                      >
                        <Icon name="plus" />
                      </button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() => removeItem(item.id)}
                      >
                        Удалить
                      </button>
                    </div>
                    {lineError[item.id] ? (
                      <p className="stock-out" role="alert">
                        {lineError[item.id]}
                      </p>
                    ) : null}
                  </div>
                  <strong>
                    {formatRub((item.unit_price || 0) * item.quantity)}
                  </strong>
                </article>
              )
            })}
            <Link className="cart-action-link" href="/catalog">
              Вернуться к товарам
            </Link>
          </div>

          <aside className="cart-page-summary">
            <h2>Ваш заказ</h2>
            <div className="summary-row">
              <span>Позиций</span>
              <b>{items.length}</b>
            </div>
            <div className="summary-row">
              <span>Единиц товара</span>
              <b>{units}</b>
            </div>
            <div className="summary-total">
              <span>Итого</span>
              <strong>{formatRub(total)}</strong>
            </div>
            <Link href="/checkout" className="btn btn-primary full-btn">
              Перейти к оформлению
            </Link>
            <Link
              href="/by-list"
              className="account-btn"
              style={{ width: "100%", marginTop: 10 }}
            >
              <Icon name="file" /> Сохранить как список
            </Link>
            <p>
              Наличие и условия получения уточняются при оформлении заказа.
            </p>
          </aside>
        </div>
      ) : (
        <div className="cart-page">
          <div className="cart-page-list">
            <div className="blank-state">
              <h2>Корзина пока пуста</h2>
              <p>Начните с каталога или воспользуйтесь поиском.</p>
              <Link className="btn btn-primary" href="/catalog">
                В каталог
              </Link>
            </div>
          </div>
          <CartUpsell />
        </div>
      )}
    </div>
  )
}
