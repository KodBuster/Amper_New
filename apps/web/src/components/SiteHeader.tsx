"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { useCart } from "@/components/CartProvider"
import { Icon } from "@/components/icons"
import { Logo } from "@/components/Logo"
import { CATS } from "@/lib/catalog-nav"

export function SiteHeader() {
  const { items } = useCart()
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const router = useRouter()
  const [q, setQ] = useState("")
  const [navOpen, setNavOpen] = useState(false)

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
          {CATS.map((c) => (
            <Link
              key={c.slug}
              href={`/catalog?cat=${c.slug}`}
              onClick={() => setNavOpen(false)}
            >
              {c.short}
            </Link>
          ))}
          <span className="nav-spacer" />
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
      </nav>
    </header>
  )
}
