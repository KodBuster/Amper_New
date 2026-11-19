"use client"

import { FormEvent, useState } from "react"

export default function ProPage() {
  const [sent, setSent] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div className="wrap" style={{ paddingBottom: 48 }}>
      <h1 className="page-title">Для объекта / PRO</h1>
      {sent ? (
        <div className="empty-state">Заявка на комплектацию отправлена.</div>
      ) : (
        <form className="checkout-form" onSubmit={onSubmit}>
          <input name="company" required placeholder="Компания / объект" />
          <input name="contact" required placeholder="Контакт" />
          <textarea name="need" required rows={6} placeholder="Что нужно подобрать" />
          <button className="btn btn-yellow" type="submit">
            Оставить заявку
          </button>
        </form>
      )}
    </div>
  )
}
