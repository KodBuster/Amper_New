"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/** The init snippet records the initial view; Next.js transitions need explicit hits. */
export function MetrikaPageViews() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previousUrl = useRef<string | null>(null)

  useEffect(() => {
    const url = window.location.href
    if (previousUrl.current && previousUrl.current !== url) {
      const metrika = (window as Window & { ym?: (...args: unknown[]) => void }).ym
      metrika?.(114486851, "hit", url, {
        referer: previousUrl.current,
        title: document.title,
      })
    }
    previousUrl.current = url
  }, [pathname, searchParams])

  return null
}
