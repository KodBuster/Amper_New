import Link from "next/link"
import { Icon } from "@/components/icons"

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="АМПЕР — на главную">
      <span className="logo-sign">
        <Icon name="spark" />
      </span>
      <span className="logo-type">
        АМПЕР
        <small>ЭЛЕКТРИКА • ИНСТРУМЕНТ • КРЕПЁЖ</small>
      </span>
    </Link>
  )
}
