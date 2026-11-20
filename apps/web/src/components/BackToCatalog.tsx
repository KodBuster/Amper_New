"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { backLabelFromPath, getPreviousPath } from "@/lib/nav-memory"

/** Назад по истории (откуда пришли), иначе в каталог */
export function BackToCatalog({
  label,
}: {
  label?: string
}) {
  const router = useRouter()
  const [autoLabel, setAutoLabel] = useState("Вернуться назад")

  useEffect(() => {
    if (label) return
    setAutoLabel(backLabelFromPath(getPreviousPath()))
  }, [label])

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
      {label || autoLabel}
    </button>
  )
}
