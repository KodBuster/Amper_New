import Medusa from "@medusajs/js-sdk"

const backendUrl =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export const medusa = new Medusa({
  baseUrl: backendUrl,
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  debug: process.env.NODE_ENV === "development",
})

export type StoreProduct = {
  id: string
  title: string
  handle: string
  description?: string | null
  thumbnail?: string | null
  images?: Array<{ id?: string; url: string }> | null
  metadata?: Record<string, unknown> | null
  variants?: Array<{
    id: string
    title?: string
    sku?: string | null
    calculated_price?: {
      calculated_amount?: number
      currency_code?: string
    } | null
    metadata?: Record<string, unknown> | null
  }>
}

/** URL картинок для галереи: images[], иначе thumbnail */
export function productImageUrls(product: StoreProduct): string[] {
  const fromImages = (product.images || [])
    .map((img) => img?.url)
    .filter((url): url is string => Boolean(url))
  if (fromImages.length) return fromImages
  if (product.thumbnail) return [product.thumbnail]
  return []
}

/** Цена в рублях: calculated_price в Medusa 2 — уже рубли; metadata — копейки МойСклад */
export function productPriceRub(product: StoreProduct): number {
  const variant = product.variants?.[0]
  const calculated = variant?.calculated_price?.calculated_amount
  if (typeof calculated === "number") return calculated
  const metaPrice = Number(variant?.metadata?.moysklad_price_kopecks || 0)
  if (metaPrice > 0) return metaPrice / 100
  return 0
}

export function formatRub(amount: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Единица измерения из МойСклад (шт / м / упак…), иначе шт */
export function productUom(
  product: {
    metadata?: Record<string, unknown> | null
    variants?: Array<{ metadata?: Record<string, unknown> | null }>
  } | null | undefined
): string {
  const fromProduct = String(product?.metadata?.moysklad_uom || "").trim()
  if (fromProduct) return fromProduct
  const fromVariant = String(
    product?.variants?.[0]?.metadata?.moysklad_uom || ""
  ).trim()
  if (fromVariant) return fromVariant
  return "шт"
}

/** Подпись цены: «за шт», «за м» */
export function pricePerUomLabel(uom: string): string {
  const unit = (uom || "шт").trim() || "шт"
  return `за ${unit}`
}

export type StoreCategoryRow = {
  id: string
  name: string
  handle: string
  is_active?: boolean
}

/** Активные категории витрины (из папок МойСклад) */
export async function listStoreCategories(): Promise<StoreCategoryRow[]> {
  const { product_categories } = await medusa.store.category.list({
    limit: 100,
    fields: "id,name,handle,is_active",
  })
  return ((product_categories || []) as StoreCategoryRow[])
    .filter((c) => c.is_active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
}
