"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import { useCart } from "@/components/CartProvider"
import { Icon } from "@/components/icons"
import { Logo } from "@/components/Logo"
import { categoryShortName, type StoreCategory } from "@/lib/catalog-nav"
import { medusa } from "@/lib/medusa"

export function SiteHeader() {
  const { items } = useCart()
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const router = useRouter()
  const [q, setQ] = useState("")
  const [navOpen, setNavOpen] = useState(false)
  const [categories, setCategories] = useState<StoreCategory[]>([])

  useEffect(() => {
    let cancelled = false
    medusa.store.category
      .list({ limit: 100, fields: "id,name,handle,is_active" })
      .then(({ product_categories }) => {
        if (cancelled) return
        const list = ((product_categories || []) as StoreCategory[])
          .filter((c) => (c as { is_active?: boolean }).is_active !== false)
          .sort((a, b) => a.name.localeCompare(b.name, "ru"))
        setCategories(list)
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/catalog")
    setNavOpen(false)
  }

  return (
    <header className="site-header">
      <div className="header-main frame">
        <Logo />

        <Link href="/catalog" className="head-cat">
          <Icon name="grid" />
          <span>Каталог</span>
        </Link>

        <form className="global-search" onSubmit={onSearch} role="search">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск товара или артикула"
            aria-label="Поиск по товарам"
            autoComplete="off"
          />
          <button type="submit" aria-label="Найти">
            <Icon name="search" />
            <span>Найти</span>
          </button>
        </form>

        <div className="header-icons">
          <Link
            href="/account"
            className="head-icon account-trigger"
            aria-label="Открыть личный кабинет"
          >
            <Icon name="user" />
            <span>Кабинет</span>
          </Link>
          <Link
            href="/favorites"
            className="head-icon fav-trigger"
            aria-label="Избранное"
          >
            <Icon name="heart" />
            <span>Избранное</span>
          </Link>
          <Link
            href="/cart"
            className="head-icon cart-trigger"
            aria-label="Открыть корзину"
          >
            <Icon name="bag" />
            <span>Корзина</span>
            {cartCount > 0 ? <b className="count">{cartCount}</b> : null}
          </Link>
          <button
            type="button"
            className="head-icon mobile-menu"
            aria-label="Открыть главное меню"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Icon name={navOpen ? "x" : "menu"} />
            <span>Меню</span>
          </button>
        </div>
      </div>

      <nav
        className={`main-nav ${navOpen ? "is-open" : ""}`}
        aria-label="Основная навигация"
      >
        <div className="frame nav-wrap">
          {/* Много динамических категорий — скролл внутри, без раздувания страницы */}
          <div className="nav-cats">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/catalog?cat=${encodeURIComponent(c.handle)}`}
                onClick={() => setNavOpen(false)}
                title={c.name}
              >
                {categoryShortName(c.name)}
              </Link>
            ))}
          </div>
          <span className="nav-spacer" />
          <div className="nav-actions">
            <Link
              className="nav-action"
              href="/by-list"
              onClick={() => setNavOpen(false)}
            >
              По списку электрика
            </Link>
            <Link
              className="nav-action"
              href="/pro"
              onClick={() => setNavOpen(false)}
            >
              Профессионалам
            </Link>
            <Link
              className="nav-action"
              href="/account"
              onClick={() => setNavOpen(false)}
            >
              Кабинет
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}
