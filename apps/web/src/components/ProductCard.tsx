"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, type MouseEvent } from "react"
import { useCart } from "@/components/CartProvider"
import {
  formatRub,
  pricePerUomLabel,
  productImageUrls,
  productPriceRub,
  productUom,
  type StoreProduct,
} from "@/lib/medusa"

/** Иконка корзины как в AMPER A v14.2 */
function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 8h14l-1 13H6L5 8Z" />
      <path d="M9 9V6a3 3 0 0 1 6 0v3" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 8c0 4-8 11-8 11S4 12 4 8a4.5 4.5 0 0 1 8-2 4.5 4.5 0 0 1 8 2Z" />
    </svg>
  )
}

function categoryShort(product: StoreProduct): string {
  const path = String(product.metadata?.moysklad_path || "")
  if (!path) return "каталог"
  const parts = path.split("/").map((p) => p.trim()).filter(Boolean)
  return parts[parts.length - 1] || "каталог"
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart()
  const [pending, setPending] = useState(false)
  const price = productPriceRub(product)
  const uom = productUom(product)
  const variantId = product.variants?.[0]?.id
  const sku =
    (product.variants?.[0]?.sku as string) ||
    String(product.metadata?.moysklad_article || product.metadata?.moysklad_code || "")
  const img = productImageUrls(product)[0] || "/assets/photo-product-101.webp"
  const isPlaceholder = !productImageUrls(product).length
  const href = `/product/${product.handle}`

  async function onAdd(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (!variantId || pending) return
    setPending(true)
    try {
      await addItem(variantId, 1)
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="product-card">
      <Link className="product-image" href={href} aria-label={`Открыть ${product.title}`}>
        <Image
          src={img}
          alt={`Иллюстрация товара: ${product.title}`}
          width={480}
          height={600}
          sizes="(max-width:700px) 50vw, 240px"
        />
        {isPlaceholder ? <span>нет фото</span> : null}
      </Link>

      <Link
        className="fav"
        href="/favorites"
        aria-label={`В избранное: ${product.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <HeartIcon />
      </Link>

      <div className="product-body">
        <small className="product-code">
          {sku || "—"} · {categoryShort(product)}
        </small>
        <Link href={href} className="product-title">
          {product.title}
        </Link>
        <div className="product-meta">
          {String(product.metadata?.moysklad_article || "позиция")}{" "}
          <span>·</span> {uom}
        </div>
        <div className="product-purchase">
          <div>
            <strong>{price > 0 ? formatRub(price) : "по запросу"}</strong>
            <small>{pricePerUomLabel(uom)}</small>
          </div>
          <button
            className="purchase-btn"
            type="button"
            disabled={!variantId || pending}
            onClick={onAdd}
            aria-label={`Добавить в корзину: ${product.title}`}
          >
            <BagIcon />
            <span>{pending ? "…" : "В корзину"}</span>
          </button>
        </div>
      </div>
    </article>
  )
}
