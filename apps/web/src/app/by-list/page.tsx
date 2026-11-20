"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useCustomer } from "@/components/CustomerProvider"

export default function ByListPage() {
  const { customer } = useCustomer()
  const [sent, setSent] = useState(false)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <div className="frame interior" style={{ paddingBottom: 48 }}>
      <h1 className="page-title">Купить по списку</h1>
      {sent ? (
        <div className="empty-state">
          <p>Заявка принята. Менеджер свяжется с вами.</p>
          {customer ? (
            <p>
              Чтобы сохранить набор из корзины сами:{" "}
              <Link href="/cart">корзина</Link> → «Сохранить как список».
            </p>
          ) : (
            <p>
              <Link href="/account">Зарегистрируйтесь</Link>, чтобы хранить
              списки и избранное в кабинете.
            </p>
          )}
        </div>
      ) : (
        <form className="checkout-form" onSubmit={onSubmit}>
          <textarea
            name="list"
            required
            rows={8}
            placeholder="Вставьте список: название / артикул / количество"
          />
          <input name="contact" required placeholder="Телефон или email" />
          <button className="btn btn-yellow" type="submit">
            Отправить список
          </button>
        </form>
      )}
    </div>
  )
}
