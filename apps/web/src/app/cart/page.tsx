"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { CartUpsell } from "@/components/CartUpsell"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { useCart } from "@/components/CartProvider"
import { useCustomer } from "@/components/CustomerProvider"
import { formatRub, translateInventoryError } from "@/lib/medusa"
import { useRouter } from "next/navigation"

export default function CartPage() {
  const { items, total, loading, removeItem, updateQuantity } = useCart()
  const { customer, saveList } = useCustomer()
  const router = useRouter()
  const [lineError, setLineError] = useState<Record<string, string>>({})
  const [saveMsg, setSaveMsg] = useState("")
  const [saveBusy, setSaveBusy] = useState(false)
  const units = items.reduce((s, i) => s + i.quantity, 0)
  const excludeProductIds = items
    .map((i) => i.product_id)
    .filter((id): id is string => Boolean(id))

  async function onSaveList() {
    if (!customer) {
      router.push("/account")
      return
    }
    setSaveBusy(true)
    setSaveMsg("")
    try {
      const name = `Корзина ${new Date().toLocaleDateString("ru-RU")}`
      await saveList(
        name,
        items
          .filter((i) => i.variant_id)
          .map((i) => ({
            variant_id: i.variant_id as string,
            quantity: i.quantity,
            title: i.title,
            sku: i.sku,
            product_id: i.product_id,
            handle: i.handle,
          }))
      )
      setSaveMsg("Список сохранён в кабинете.")
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Не удалось сохранить")
    } finally {
      setSaveBusy(false)
    }
  }

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

      {/* Три зоны и пустая, и полная — иначе пустая съезжает в узкую левую колонку */}
      <div className="cart-page">
        <CartUpsell excludeProductIds={excludeProductIds} />

        <div className="cart-page-list">
          {items.length ? (
            <>
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
            </>
          ) : (
            <div className="blank-state">
              <h2>Ваша корзина пуста</h2>
              <p>Добавьте товар из каталога или из предложенного.</p>
              <Link className="cart-action-link" href="/catalog">
                Вернуться к товарам
              </Link>
            </div>
          )}
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
          {items.length ? (
            <>
              <Link href="/checkout" className="btn btn-primary full-btn">
                Перейти к оформлению
              </Link>
              <button
                type="button"
                className="account-btn"
                style={{ width: "100%", marginTop: 10 }}
                disabled={saveBusy}
                onClick={onSaveList}
              >
                <Icon name="file" />{" "}
                {saveBusy
                  ? "Сохраняем…"
                  : customer
                    ? "Сохранить как список"
                    : "Войти и сохранить список"}
              </button>
              {saveMsg ? <p className="add-to-cart-ok">{saveMsg}</p> : null}
            </>
          ) : (
            <Link href="/catalog" className="btn btn-primary full-btn">
              В каталог
            </Link>
          )}
          <p>
            Наличие и условия получения уточняются при оформлении заказа.
          </p>
        </aside>
      </div>
    </div>
  )
}
