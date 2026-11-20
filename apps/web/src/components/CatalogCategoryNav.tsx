"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { categoryShortName, type StoreCategory } from "@/lib/catalog-nav"

type Filters = { max?: string; sort?: string; stock?: string }

type Props = {
  categories: StoreCategory[]
  activeHandle?: string | null
  filters?: Filters
  /** aside — сайдбар; modal — модалка на мобилке */
  variant: "aside" | "modal"
  onNavigate?: () => void
}

function catalogHref(filters: Filters | undefined, catHandle?: string | null) {
  const params = new URLSearchParams()
  if (catHandle) params.set("cat", catHandle)
  if (filters?.max && filters.max !== "any") params.set("max", filters.max)
  if (filters?.sort && filters.sort !== "popular") {
    params.set("sort", filters.sort)
  }
  if (filters?.stock === "in") params.set("stock", "in")
  const qs = params.toString()
  return qs ? `/catalog?${qs}` : "/catalog"
}

/** Список категорий + слева тонкий индикатор позиции прокрутки (не нативный скроллбар) */
export function CatalogCategoryNav({
  categories,
  activeHandle,
  filters,
  variant,
  onNavigate,
}: Props) {
  const listRef = useRef<HTMLElement>(null)
  const [rail, setRail] = useState({ show: false, thumbTop: 0, thumbH: 24 })

  const syncRail = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const overflow = scrollHeight > clientHeight + 2
    if (!overflow) {
      setRail((r) => (r.show ? { show: false, thumbTop: 0, thumbH: 24 } : r))
      return
    }
    const track = clientHeight
    const thumbH = Math.max(24, Math.round((clientHeight / scrollHeight) * track))
    const maxTop = track - thumbH
    const thumbTop =
      scrollHeight === clientHeight
        ? 0
        : Math.round((scrollTop / (scrollHeight - clientHeight)) * maxTop)
    setRail({ show: true, thumbTop, thumbH })
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    syncRail()
    el.addEventListener("scroll", syncRail, { passive: true })
    const ro = new ResizeObserver(syncRail)
    ro.observe(el)
    window.addEventListener("resize", syncRail)
    return () => {
      el.removeEventListener("scroll", syncRail)
      ro.disconnect()
      window.removeEventListener("resize", syncRail)
    }
  }, [syncRail, categories.length])

  const listClass =
    variant === "aside" ? "catalog-aside-nav" : "catalog-mobile-cats-list"

  return (
    <div
      className={`catalog-cat-nav-wrap${
        variant === "aside" ? " is-aside" : " is-modal"
      }`}
    >
      <nav
        ref={listRef}
        className={listClass}
        aria-label={variant === "aside" ? "Категории каталога" : "Категории"}
      >
        <Link
          className={`catalog-cat-all${!activeHandle ? " active" : ""}`}
          href={catalogHref(filters, null)}
          scroll={false}
          onClick={onNavigate}
        >
          Все товары
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            className={activeHandle === c.handle ? "active" : ""}
            href={catalogHref(filters, c.handle)}
            title={c.name}
            scroll={false}
            onClick={onNavigate}
          >
            {categoryShortName(c.name)}
          </Link>
        ))}
      </nav>
      {/* Визуальный рельс слева: мобилка / планшет; на широком десктопе скрыт CSS */}
      <div
        className={`catalog-scroll-rail${rail.show ? " is-visible" : ""}`}
        aria-hidden="true"
      >
        <i
          className="catalog-scroll-thumb"
          style={{ transform: `translateY(${rail.thumbTop}px)`, height: rail.thumbH }}
        />
      </div>
    </div>
  )
}
