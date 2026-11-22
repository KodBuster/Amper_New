import Link from "next/link"
import { Suspense } from "react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { CatalogCategoryNav } from "@/components/CatalogCategoryNav"
import { CatalogFilters } from "@/components/CatalogFilters"
import { CatalogMobileCategories } from "@/components/CatalogMobileCategories"
import { Icon } from "@/components/icons"
import { PageIntro } from "@/components/PageIntro"
import { ProductCard } from "@/components/ProductCard"
import { categoryAncestors } from "@/lib/catalog-nav"
import {
  STORE_PRODUCT_FIELDS,
  listStoreCategories,
  medusa,
  productInStock,
  productPriceRub,
  type StoreProduct,
} from "@/lib/medusa"

const SHOW_LIMIT = 96

function sortCatalogProducts(
  list: StoreProduct[],
  sort: string | undefined
): StoreProduct[] {
  if (sort === "low") {
    return [...list].sort((a, b) => productPriceRub(a) - productPriceRub(b))
  }
  if (sort === "high") {
    return [...list].sort((a, b) => productPriceRub(b) - productPriceRub(a))
  }
  return list
}

/** Ссылка на категорию с сохранением фильтров (наличие, цена, сортировка) */
function catalogHref(
  filters: { max?: string; sort?: string; stock?: string },
  catHandle?: string | null
): string {
  const params = new URLSearchParams()
  if (catHandle) params.set("cat", catHandle)
  if (filters.max && filters.max !== "any") params.set("max", filters.max)
  if (filters.sort && filters.sort !== "popular") params.set("sort", filters.sort)
  if (filters.stock === "in") params.set("stock", "in")
  const qs = params.toString()
  return qs ? `/catalog?${qs}` : "/catalog"
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    cat?: string
    max?: string
    sort?: string
    stock?: string
  }>
}) {
  const sp = await searchParams
  const filterState = { max: sp.max, sort: sp.sort, stock: sp.stock }
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
  const unavailableCategory = Boolean(sp.cat && !activeCat)
  const ancestors = categoryAncestors(categories, activeCat?.id)
  const childCategories = categories.filter((category) => (category.parent_category_id || null) === (activeCat?.id || null))

  try {
    if (unavailableCategory) throw new Error("Этот раздел недоступен. Выберите другую категорию.")
    // order по цене через Store API здесь невалиден — сортируем ниже по productPriceRub
    const { products: list } = await medusa.store.product.list({
      limit: SHOW_LIMIT,
      q: sp.q || undefined,
      category_id: activeCat ? [activeCat.id] : undefined,
      fields: STORE_PRODUCT_FIELDS,
    })
    products = (list || []) as StoreProduct[]

    // Фильтры на клиентской выборке: цена и наличие независимы от сортировки
    if (sp.max && sp.max !== "any") {
      const maxRub = Number(sp.max)
      if (Number.isFinite(maxRub)) {
        products = products.filter((p) => {
          const price = productPriceRub(p)
          return price > 0 && price <= maxRub
        })
      }
    }
    if (sp.stock === "in") {
      products = products.filter((p) => productInStock(p))
    }

    products = sortCatalogProducts(products, sp.sort)
  } catch (e) {
    error = (e as Error).message
  }

  const title = sp.q
    ? "Результаты поиска"
    : activeCat?.name || (unavailableCategory ? "Раздел недоступен" : "Каталог товаров")
  const lead = sp.q
    ? `По запросу «${sp.q}»`
    : "Выберите категорию и уточните параметры."

  return (
    <div className="frame interior">
      <Breadcrumbs
        items={[
          {
            label: "Каталог",
            href:
              activeCat || sp.q ? catalogHref(filterState) : undefined,
          },
          ...ancestors.map((category, index) => ({ label: category.name, href: index < ancestors.length - 1 ? catalogHref(filterState, category.handle) : undefined })),
          ...(sp.q && !activeCat ? [{ label: "Поиск" }] : []),
        ]}
      />
      <PageIntro eyebrow="Каталог" title={title} lead={lead} />

      <div className="catalog-layout">
        <aside className="catalog-aside">
          <h2 className="catalog-cats-title">
            <span>Категории</span>
          </h2>
          <CatalogCategoryNav
            variant="aside"
            categories={categories}
            activeHandle={activeCat?.handle || sp.cat || null}
            filters={filterState}
          />
          <div className="aside-hint">
            <Icon name="info" /> Наличие и стоимость уточняются при оформлении.
          </div>
        </aside>

        <div className="catalog-content">
          {childCategories.length > 0 && (
            <section className="catalog-subcategories" aria-label={activeCat ? "Подкатегории" : "Разделы каталога"}>
              <h2>{activeCat ? "Подкатегории" : "Разделы каталога"}</h2>
              <div className="catalog-subcategory-links">
                {childCategories.map((category) => <Link key={category.id} href={catalogHref(filterState, category.handle)}>{category.name}</Link>)}
              </div>
            </section>
          )}
          <div className="catalog-mobile-sticky">
            <CatalogMobileCategories
              categories={categories}
              activeHandle={activeCat?.handle || sp.cat || null}
              filters={filterState}
            />
            <Suspense fallback={null}>
              <CatalogFilters count={products.length} />
            </Suspense>
          </div>

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
              <Link className="btn btn-primary" href={catalogHref(filterState)}>
                Все товары
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
