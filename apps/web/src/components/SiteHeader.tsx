"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useEffect, useState } from "react"
import { useCart } from "@/components/CartProvider"
import { useCustomer } from "@/components/CustomerProvider"
import { Icon } from "@/components/icons"
import { Logo } from "@/components/Logo"
import { categoryShortName, type StoreCategory } from "@/lib/catalog-nav"
import { listStoreCategories } from "@/lib/medusa"

function accountLabel(customer: {
  first_name?: string | null
  email: string
} | null): string {
  if (!customer) return "Кабинет"
  const name = String(customer.first_name || "").trim()
  if (name) return name
  const email = customer.email || ""
  const at = email.indexOf("@")
  return at > 0 ? email.slice(0, at) : email || "Кабинет"
}

export function SiteHeader() {
  const { items } = useCart()
  const { customer } = useCustomer()
  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const router = useRouter()
  const [q, setQ] = useState("")
  const [navOpen, setNavOpen] = useState(false)
  const [categories, setCategories] = useState<StoreCategory[]>([])
  const cabinetLabel = accountLabel(customer)

  useEffect(() => {
    let cancelled = false
    listStoreCategories(true)
      .then((list) => {
        if (cancelled) return
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
            className={`head-icon account-trigger${customer ? " is-logged-in" : ""}`}
            aria-label={
              customer
                ? `Кабинет: вы вошли как ${cabinetLabel}`
                : "Открыть личный кабинет"
            }
            title={customer ? `Вы вошли · ${customer.email}` : "Личный кабинет"}
          >
            <Icon name="user" />
            <span>{cabinetLabel}</span>
            {customer ? <i className="account-online-dot" aria-hidden /> : null}
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
              className={`nav-action${customer ? " is-logged-in" : ""}`}
              href="/account"
              onClick={() => setNavOpen(false)}
            >
              {customer ? `Кабинет · ${cabinetLabel}` : "Кабинет"}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  )
}
