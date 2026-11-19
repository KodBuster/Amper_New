"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/icons"

/** Фильтры каталога: цена и сортировка через query-параметры */
export function CatalogFilters({ count }: { count: number }) {
  const router = useRouter()
  const sp = useSearchParams()

  function buildUrl(patch: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString())
    Object.entries(patch).forEach(([k, v]) => {
      if (!v || v === "any" || v === "popular") params.delete(k)
      else params.set(k, v)
    })
    const qs = params.toString()
    return qs ? `/catalog?${qs}` : "/catalog"
  }

  function reset() {
    const params = new URLSearchParams()
    const cat = sp.get("cat")
    const q = sp.get("q")
    if (cat) params.set("cat", cat)
    if (q) params.set("q", q)
    const qs = params.toString()
    router.push(qs ? `/catalog?${qs}` : "/catalog", { scroll: false })
  }

  const max = sp.get("max") || "any"
  const sort = sp.get("sort") || "popular"

  return (
    <div className="filters-box is-open">
      <div className="filters-head">
        <strong>
          <Icon name="filter" /> Уточнить выбор
        </strong>
        <span>Показано: {count}</span>
      </div>
      <div className="filters-row" id="catalog-filter-fields">
        <label>
          Цена до
          <select
            aria-label="Цена до"
            value={max}
            onChange={(e) =>
              router.push(buildUrl({ max: e.target.value }), { scroll: false })
            }
          >
            <option value="any">Любая цена</option>
            <option value="300">300 ₽</option>
            <option value="1000">1 000 ₽</option>
            <option value="2000">2 000 ₽</option>
            <option value="5000">5 000 ₽</option>
            <option value="15000">15 000 ₽</option>
          </select>
        </label>
        <label>
          Сортировка
          <select
            aria-label="Сортировка товаров"
            value={sort}
            onChange={(e) =>
              router.push(buildUrl({ sort: e.target.value }), { scroll: false })
            }
          >
            <option value="popular">По умолчанию</option>
            <option value="low">Сначала дешевле</option>
            <option value="high">Сначала дороже</option>
          </select>
        </label>
      </div>
      <button className="reset-filters" type="button" onClick={reset}>
        Сбросить фильтры
      </button>
    </div>
  )
}
