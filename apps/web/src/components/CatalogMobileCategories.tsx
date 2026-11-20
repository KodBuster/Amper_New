"use client"

import { useEffect, useId, useState } from "react"
import { createPortal } from "react-dom"
import { CatalogCategoryNav } from "@/components/CatalogCategoryNav"
import { Icon } from "@/components/icons"
import { categoryShortName, type StoreCategory } from "@/lib/catalog-nav"

type Props = {
  categories: StoreCategory[]
  activeHandle?: string | null
  filters?: { max?: string; sort?: string; stock?: string }
}

/** Мобилка: кнопка «Каталог» → панель выбора категории */
export function CatalogMobileCategories({
  categories,
  activeHandle,
  filters,
}: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const titleId = useId()
  const activeName = activeHandle
    ? categories.find((c) => c.handle === activeHandle)?.name
    : null
  const label = activeName ? categoryShortName(activeName) : "Все товары"

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.classList.add("no-scroll")
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.classList.remove("no-scroll")
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const dialog =
    open && mounted
      ? createPortal(
          <div className="catalog-mobile-cats-root">
            <button
              type="button"
              className="catalog-mobile-cats-overlay"
              aria-label="Закрыть каталог"
              onClick={() => setOpen(false)}
            />
            <div
              className="catalog-mobile-cats-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="catalog-mobile-cats-head">
                <h2 id={titleId} className="catalog-cats-title">
                  <span>Категории</span>
                </h2>
                <button
                  type="button"
                  className="filters-modal-close"
                  aria-label="Закрыть"
                  onClick={() => setOpen(false)}
                >
                  <Icon name="x" />
                </button>
              </header>
              <CatalogCategoryNav
                variant="modal"
                categories={categories}
                activeHandle={activeHandle}
                filters={filters}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div className="catalog-mobile-cats">
      <button
        type="button"
        className={`filters-toggle catalog-mobile-cats-toggle${
          open ? " is-active" : ""
        }${activeHandle ? " has-filters" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="grid" />
        Каталог
        <span className="catalog-mobile-cats-current">{label}</span>
      </button>
      {dialog}
    </div>
  )
}
