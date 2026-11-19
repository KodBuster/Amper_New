import Link from "next/link"
import { Suspense } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { CatalogFilters } from "@/components/CatalogFilters"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { ProductCard } from "@/components/ProductCard"
import { categoryShortName } from "@/lib/catalog-nav"
import {
  listStoreCategories,
  medusa,
  productPriceRub,
  type StoreProduct,
} from "@/lib/medusa"

const PRODUCT_FIELDS = "+metadata,*variants,*variants.metadata,*images,*thumbnail"
const SHOW_LIMIT = 96

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; max?: string; sort?: string }>
}) {
  const sp = await searchParams
  let products: StoreProduct[] = []
  let error = ""
  let categories: Awaited<ReturnType<typeof listStoreCategories>> = []

  try {
    categories = await listStoreCategories()
  } catch {
    categories = []
  }

  const activeCat =
    categories.find((c) => c.handle === sp.cat) ||
    categories.find((c) => c.id === sp.cat)

  try {
    const { products: list } = await medusa.store.product.list({
      limit: SHOW_LIMIT,
      q: sp.q || undefined,
      category_id: activeCat ? [activeCat.id] : undefined,
      order:
        sp.sort === "low"
          ? "variants.prices.amount"
          : sp.sort === "high"
            ? "-variants.prices.amount"
            : undefined,
      fields: PRODUCT_FIELDS,
    })
    products = (list || []) as StoreProduct[]

    // Цена «до» — на клиентской выборке (Store не всегда умеет max price filter)
    if (sp.max && sp.max !== "any") {
      const maxRub = Number(sp.max)
      if (Number.isFinite(maxRub)) {
        products = products.filter((p) => {
          const price = productPriceRub(p)
          return price > 0 && price <= maxRub
        })
      }
    }

    // Fallback сортировки по цене из metadata, если order не сработал
    if (sp.sort === "low") {
      products = [...products].sort(
        (a, b) => productPriceRub(a) - productPriceRub(b)
      )
    } else if (sp.sort === "high") {
      products = [...products].sort(
        (a, b) => productPriceRub(b) - productPriceRub(a)
      )
    }
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
          {/* Заголовок статичный; список в отдельном окне со скроллом (мобилка — позже) */}
          <nav className="catalog-aside-nav" aria-label="Категории каталога">
            <Link
              className={!sp.cat ? "active" : ""}
              href="/catalog"
              scroll={false}
            >
              Все товары
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                className={
                  activeCat?.id === c.id || sp.cat === c.handle ? "active" : ""
                }
                href={`/catalog?cat=${encodeURIComponent(c.handle)}`}
                title={c.name}
                scroll={false}
              >
                {categoryShortName(c.name)}
              </Link>
            ))}
          </nav>
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
