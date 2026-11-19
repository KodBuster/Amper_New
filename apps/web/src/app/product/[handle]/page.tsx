import Link from "next/link"
import { notFound } from "next/navigation"
import { AddToCartButton } from "@/components/AddToCartButton"
import { ProductGallery } from "@/components/ProductGallery"
import {
  formatRub,
  medusa,
  pricePerUomLabel,
  productImageUrls,
  productPriceRub,
  productUom,
  type StoreProduct,
} from "@/lib/medusa"

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  // Next может отдать уже декодированный или %-encoded handle
  const handle = decodeURIComponent((await params).handle)
  let product: StoreProduct | undefined

  try {
    // Не просим calculated_price без region_id — Store API отвечает 400, а страница
    // выглядела как «404». Цену берём из metadata.moysklad_price_kopecks.
    const { products } = await medusa.store.product.list({
      handle,
      limit: 1,
      fields: "+metadata,*variants,*variants.metadata,*images,*thumbnail",
    })
    product = products?.[0] as StoreProduct | undefined
  } catch {
    product = undefined
  }

  if (!product) notFound()

  const price = productPriceRub(product)
  const uom = productUom(product)
  const variantId = product.variants?.[0]?.id
  const sku =
    product.variants?.[0]?.sku ||
    String(product.metadata?.moysklad_article || product.metadata?.moysklad_code || "")
  const path = String(product.metadata?.moysklad_path || "")
  const images = productImageUrls(product)

  return (
    <div className="frame interior">
      <nav className="breadcrumbs" aria-label="Навигация по разделам">
        <Link href="/">Главная</Link>
        <span>/</span>
        <Link href="/catalog">Каталог</Link>
        {path ? (
          <>
            <span>/</span>
            <span>{path.split("/").filter(Boolean).slice(-1)[0]}</span>
          </>
        ) : null}
        <span>/</span>
        <span>{product.title}</span>
      </nav>

      <div className="detail-grid">
        <ProductGallery title={product.title} images={images} />

        <div className="detail-copy">
          {sku ? <p className="sku">Артикул / код: {sku}</p> : null}
          <h1>{product.title}</h1>
          {path ? <p className="detail-chips">{path}</p> : null}

          <div className="detail-box">
            <div>
              <strong style={{ fontSize: 28 }}>
                {price > 0 ? formatRub(price) : "Цена по запросу"}
              </strong>
              {price > 0 ? (
                <p className="detail-uom">{pricePerUomLabel(uom)}</p>
              ) : null}
            </div>
            {variantId ? <AddToCartButton variantId={variantId} /> : null}
          </div>

          <div className="detail-description">
            <h2 className="detail-section-title">Описание</h2>
            {product.description?.trim() ? (
              <p>{product.description}</p>
            ) : (
              <p className="detail-description-empty">Нет описания</p>
            )}
          </div>

          <p className="detail-help">
            Нужна комплектация под объект? Смотрите раздел{" "}
            <Link href="/pro">Для объекта</Link> или{" "}
            <Link href="/by-list">Купить по списку</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
