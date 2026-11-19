"use client"

import { useState } from "react"
import { useCart } from "@/components/CartProvider"

export function AddToCartButton({ variantId }: { variantId: string }) {
  const { addItem } = useCart()
  const [pending, setPending] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState("")

  async function onClick() {
    setPending(true)
    setError("")
    setOk(false)
    try {
      await addItem(variantId, 1)
      setOk(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button className="btn btn-yellow" type="button" disabled={pending} onClick={onClick}>
        {pending ? "Добавляем…" : "В корзину"}
      </button>
      {ok ? <p>Добавлено в корзину</p> : null}
      {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}
    </div>
  )
}
