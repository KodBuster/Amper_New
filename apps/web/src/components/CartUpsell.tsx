"use client"

import { useEffect, useMemo, useState } from "react"
import { ProductCard } from "@/components/ProductCard"
import {
  STORE_PRODUCT_FIELDS,
  medusa,
  type StoreProduct,
} from "@/lib/medusa"

type Props = {
  /** id товаров уже в корзине — их не показываем первыми */
  excludeProductIds?: string[]
}

/** Левая колонка корзины V10.1: «Добавить к заказу» */
export function CartUpsell({ excludeProductIds = [] }: Props) {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const excludeKey = useMemo(
    () => excludeProductIds.filter(Boolean).sort().join("|"),
    [excludeProductIds]
  )

  useEffect(() => {
    let cancelled = false
    const exclude = new Set(excludeKey ? excludeKey.split("|") : [])
    ;(async () => {
      try {
        const { products: list } = await medusa.store.product.list({
          limit: 24,
          fields: STORE_PRODUCT_FIELDS,
        })
        if (cancelled) return
        const all = (list || []) as StoreProduct[]
        const notInCart = all.filter((p) => !exclude.has(p.id))
        const inCart = all.filter((p) => exclude.has(p.id))
        setProducts([...notInCart, ...inCart].slice(0, 10))
      } catch {
        if (!cancelled) setProducts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [excludeKey])

  if (!products.length) return null

  return (
    <aside className="cart-upsell" aria-label="Дополнительные товары">
      <h2>Добавить к заказу</h2>
      <p>Часто берут вместе</p>
      <div className="cart-upsell-scroll">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </aside>
  )
}
