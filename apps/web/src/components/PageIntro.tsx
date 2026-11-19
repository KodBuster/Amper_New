/** Заголовок внутренней страницы как в v14.2 */
export function PageIntro({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead?: string
}) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {lead ? <p>{lead}</p> : null}
    </div>
  )
}
