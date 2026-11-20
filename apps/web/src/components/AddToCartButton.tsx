"use client"

import { useState } from "react"
import { useCart } from "@/components/CartProvider"
import { translateInventoryError } from "@/lib/medusa"

type Props = {
  variantId: string
  /** Остаток; null — не ограничиваем */
  availableQty?: number | null
}

export function AddToCartButton({ variantId, availableQty = null }: Props) {
  const { addItem } = useCart()
  const [pending, setPending] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState("")

  const outOfStock = typeof availableQty === "number" && availableQty <= 0

  async function onClick() {
    if (outOfStock) {
      setError("Нет в наличии")
      return
    }
    setPending(true)
    setError("")
    setOk(false)
    try {
      await addItem(variantId, 1)
      setOk(true)
    } catch (e) {
      setError(translateInventoryError(e, availableQty))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="add-to-cart">
      <button
        className={`btn btn-yellow${outOfStock ? " is-oos" : ""}`}
        type="button"
        disabled={pending || outOfStock || !variantId}
        onClick={onClick}
      >
        {outOfStock ? "Нет в наличии" : pending ? "Добавляем…" : "В корзину"}
      </button>
      {ok && !outOfStock ? <p className="add-to-cart-ok">Добавлено в корзину</p> : null}
      {error ? (
        <p className="add-to-cart-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
