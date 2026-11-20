"use client"

import { useRouter } from "next/navigation"

/** Назад в каталог: история браузера (фильтры/скролл), иначе /catalog */
export function BackToCatalog({
  label = "Вернуться к товарам",
}: {
  label?: string
}) {
  const router = useRouter()

  function onClick() {
    if (typeof window !== "undefined") {
      const ref = document.referrer
      const fromSite =
        ref &&
        (() => {
          try {
            return new URL(ref).origin === window.location.origin
          } catch {
            return false
          }
        })()
      if (fromSite || window.history.length > 1) {
        router.back()
        return
      }
    }
    router.push("/catalog")
  }

  return (
    <button type="button" className="back-to-catalog" onClick={onClick}>
      {label}
    </button>
  )
}
