import Link from "next/link"
import { Icon } from "@/components/icons"

type Crumb = { label: string; href?: string }

/** Навигационная цепочка как в AMPER A v14.2 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "Главная", href: "/" }, ...items]
  return (
    <nav className="breadcrumbs" aria-label="Навигационная цепочка">
      {all.map((item, i) => (
        <span key={`${item.label}-${i}`} style={{ display: "contents" }}>
          {i ? <Icon name="chev" /> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}
