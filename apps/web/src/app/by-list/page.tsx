"use client"

import { FormEvent, useState } from "react"

export default function ByListPage() {
  const [sent, setSent] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div className="wrap" style={{ paddingBottom: 48 }}>
      <h1 className="page-title">Купить по списку</h1>
      {sent ? (
        <div className="empty-state">Заявка принята. Менеджер свяжется с вами.</div>
      ) : (
        <form className="checkout-form" onSubmit={onSubmit}>
          <textarea name="list" required rows={8} placeholder="Вставьте список: название / артикул / количество" />
          <input name="contact" required placeholder="Телефон или email" />
          <button className="btn btn-yellow" type="submit">
            Отправить список
          </button>
        </form>
      )}
    </div>
  )
}
