"use client"

import Image from "next/image"
import Link from "next/link"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { useCart } from "@/components/CartProvider"
import { formatRub } from "@/lib/medusa"

export default function CartPage() {
  const { items, total, loading, removeItem, updateQuantity } = useCart()
  const units = items.reduce((s, i) => s + i.quantity, 0)

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
          <div className="cart-page-list">
            {items.map((item) => (
              <article className="cart-page-item" key={item.id}>
                <Image
                  src={item.thumbnail || "/assets/photo-product-101.webp"}
                  alt=""
                  width={96}
                  height={96}
                />
                <div>
                  <h2>{item.title || "Товар"}</h2>
                  <p>
                    {formatRub(item.unit_price || 0)} / {item.uom || "шт"}
                  </p>
                  <div className="cart-qty">
                    <button
                      type="button"
                      aria-label={`Уменьшить: ${item.title || "товар"}`}
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Icon name="minus" />
                    </button>
                    <b>{item.quantity}</b>
                    <button
                      type="button"
                      aria-label={`Увеличить: ${item.title || "товар"}`}
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
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
                </div>
                <strong>
                  {formatRub((item.unit_price || 0) * item.quantity)}
                </strong>
              </article>
            ))}
            <Link className="cart-action-link" href="/catalog">
              ← Вернуться к товарам
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
              Перейти к оформлению <Icon name="arrow" />
            </Link>
          </aside>
        </div>
      ) : (
        <div className="blank-state">
          <h2>Корзина пока пуста</h2>
          <p>Начните с каталога или воспользуйтесь поиском.</p>
          <Link className="btn btn-primary" href="/catalog">
            В каталог <Icon name="arrow" />
          </Link>
        </div>
      )}
    </div>
  )
}
