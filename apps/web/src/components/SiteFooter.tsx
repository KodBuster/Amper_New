import Link from "next/link"
import { Logo } from "@/components/Logo"

const INFO_LINKS = [
  { href: "/delivery", label: "Доставка и самовывоз" },
  { href: "/payment", label: "Оплата" },
  { href: "/returns", label: "Возврат и гарантия" },
  { href: "/claims", label: "Претензии и возврат денежных средств" },
  { href: "/seller", label: "Сведения о продавце" },
  { href: "/offer", label: "Условия продажи (оферта)" },
  { href: "/privacy", label: "Политика обработки данных" },
  { href: "/consent", label: "Согласие на обработку заявки" },
  { href: "/marketing-consent", label: "Согласие на рекламу" },
  { href: "/cookies", label: "Политика cookies" },
] as const

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="frame footer-main">
        <div className="footer-about">
          <Logo />
          <p>
            Электрика, инструмент и крепёж для дома и профессиональных задач.
          </p>
        </div>
        <div>
          <strong>Покупателям</strong>
          <Link href="/catalog">Каталог</Link>
          <Link href="/cart">Корзина</Link>
          <Link href="/account">Личный кабинет</Link>
          <Link href="/by-list">По списку электрика</Link>
          <Link href="/pro">Закупки для объекта</Link>
        </div>
        <div>
          <strong>Информация</strong>
          {INFO_LINKS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div>
          <strong>АМПЕР</strong>
          <Link href="/contacts">Контакты</Link>
          <Link href="/about">О магазине</Link>
        </div>
      </div>
      <div className="footer-bottom frame">
        <span>
          © {year} <strong className="footer-brand">АМПЕР</strong>. Все права
          защищены.
          <br />
          Разработка Digital Агентство{" "}
          <a
            className="footer-credit-link"
            href="https://kodbuster.ru/"
            target="_blank"
            rel="noopener noreferrer"
          >
            KodBuster
          </a>
        </span>
      </div>
    </footer>
  )
}
