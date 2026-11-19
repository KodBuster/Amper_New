/**
 * Заглушка правовой/информационной страницы — «рыба» до утверждения текстов.
 */
export function LegalStub({
  title,
  lead,
}: {
  title: string
  lead?: string
}) {
  return (
    <div className="frame interior">
      <div className="page-intro">
        <span className="eyebrow">Информация</span>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </div>
      <div className="legal-warning" role="note">
        <strong>Временная заглушка</strong>
        <p>
          Текст страницы будет заполнен после согласования с заказчиком.
        </p>
      </div>
    </div>
  )
}
