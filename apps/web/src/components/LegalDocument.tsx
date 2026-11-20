import type { ReactNode } from "react"
import { LEGAL_OPERATOR } from "@/lib/legal-operator"

/** Общая оболочка правовых страниц */
export function LegalDocument({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <div className="frame interior">
      <div className="page-intro">
        <span className="eyebrow">Информация</span>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </div>
      <div className="policy-wrap">
        <div className="policy-alert" role="note">
          <strong>Реквизиты нужно подставить</strong>
          <p>
            В тексте стоят поля в квадратных скобках (название, ИНН, адрес,
            контакты). Замените их на данные продавца {LEGAL_OPERATOR.brand} до
            публикации. При необходимости покажите юристу.
          </p>
        </div>
        <div className="policy-panel">{children}</div>
      </div>
    </div>
  )
}
