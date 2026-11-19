import Link from "next/link"
import { Suspense } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { CatalogFilters } from "@/components/CatalogFilters"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { ProductCard } from "@/components/ProductCard"
import { CATS, productMatchesCat } from "@/lib/catalog-nav"
import { medusa, productPriceRub, type StoreProduct } from "@/lib/medusa"

/** +metadata обязателен: иначе Store не отдаёт moysklad_path и категории пустые */
const PRODUCT_FIELDS = "+metadata,*variants,*variants.metadata,*images,*thumbnail"

const PAGE_SIZE = 100
const SHOW_LIMIT = 96
/** Сколько товаров просмотреть при фильтре категории (Store не умеет filter по path) */
const CAT_SCAN_LIMIT = 4000

async function loadProducts(opts: {
  q?: string
  catSlug?: string
  max?: string
  sort?: string
}): Promise<StoreProduct[]> {
  const activeCat = CATS.find((c) => c.slug === opts.catSlug)
  const needScan = Boolean(activeCat || (opts.max && opts.max !== "any"))
  const scanCap = needScan ? CAT_SCAN_LIMIT : SHOW_LIMIT

  const collected: StoreProduct[] = []

  for (let offset = 0; offset < scanCap; offset += PAGE_SIZE) {
    const { products: list } = await medusa.store.product.list({
      limit: Math.min(PAGE_SIZE, scanCap - offset),
      offset,
      q: opts.q || undefined,
      fields: PRODUCT_FIELDS,
    })
    const batch = (list || []) as StoreProduct[]
    if (!batch.length) break

    for (const p of batch) {
      if (activeCat && !productMatchesCat(p, activeCat)) continue

      if (opts.max && opts.max !== "any") {
        const maxRub = Number(opts.max)
        if (Number.isFinite(maxRub)) {
          const price = productPriceRub(p)
          if (!(price > 0 && price <= maxRub)) continue
        }
      }

      collected.push(p)
      if (collected.length >= SHOW_LIMIT && opts.sort !== "low" && opts.sort !== "high") {
        // для сортировки по цене лучше набрать SHOW_LIMIT уже отфильтрованных
        break
      }
    }

    if (collected.length >= SHOW_LIMIT && opts.sort !== "low" && opts.sort !== "high") {
      break
    }
    if (batch.length < PAGE_SIZE) break
  }

  let products = collected

  if (opts.sort === "low") {
    products = [...products].sort((a, b) => productPriceRub(a) - productPriceRub(b))
  } else if (opts.sort === "high") {
    products = [...products].sort((a, b) => productPriceRub(b) - productPriceRub(a))
  }

  return products.slice(0, SHOW_LIMIT)
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; max?: string; sort?: string }>
}) {
  const sp = await searchParams
  let products: StoreProduct[] = []
  let error = ""

  const activeCat = CATS.find((c) => c.slug === sp.cat)

  try {
    products = await loadProducts({
      q: sp.q,
      catSlug: sp.cat,
      max: sp.max,
      sort: sp.sort,
    })
  } catch (e) {
    error = (e as Error).message
  }

  const title = sp.q
    ? "Результаты поиска"
    : activeCat?.name || "Каталог товаров"
  const lead = sp.q
    ? `По запросу «${sp.q}»`
    : "Выберите категорию и уточните параметры."

  return (
    <div className="frame interior">
      <Breadcrumbs
        items={[
          { label: "Каталог", href: activeCat || sp.q ? "/catalog" : undefined },
          ...(activeCat ? [{ label: activeCat.name }] : []),
          ...(sp.q && !activeCat ? [{ label: "Поиск" }] : []),
        ]}
      />
      <PageIntro eyebrow="Каталог" title={title} lead={lead} />

      <div className="catalog-layout">
        <aside className="catalog-aside">
          <h2>Категории</h2>
          <Link className={!sp.cat ? "active" : ""} href="/catalog">
            Все товары
          </Link>
          {CATS.map((c) => (
            <Link
              key={c.slug}
              className={sp.cat === c.slug ? "active" : ""}
              href={`/catalog?cat=${c.slug}`}
            >
              {c.name}
            </Link>
          ))}
          <div className="aside-hint">
            <Icon name="info" /> Наличие и стоимость уточняются при оформлении.
          </div>
        </aside>

        <div className="catalog-content">
          <Suspense fallback={null}>
            <CatalogFilters count={products.length} />
          </Suspense>

          {error ? (
            <div className="empty-state">Не удалось загрузить каталог: {error}</div>
          ) : products.length ? (
            <div className="product-grid catalog-products">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="blank-state">
              <h2>Ничего не найдено</h2>
              <p>Попробуйте другую категорию или сбросьте фильтры.</p>
              <Link className="btn btn-primary" href="/catalog">
                Все товары <Icon name="arrow" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
