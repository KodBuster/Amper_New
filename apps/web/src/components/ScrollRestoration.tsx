"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/** Страницы из блока «Информация» в подвале */
const INFO_PATHS = new Set([
  "/delivery",
  "/payment",
  "/returns",
  "/claims",
  "/seller",
  "/offer",
  "/privacy",
  "/consent",
  "/marketing-consent",
  "/cookies",
  "/contacts",
  "/about",
])

/**
 * При «Назад» с информационной страницы сразу ставим скролл в конец
 * (подвал) — одно и то же положение, без плавной анимации.
 */
export function ScrollRestoration() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)
  const isPop = useRef(false)

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual"
    }
    const onPop = () => {
      isPop.current = true
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    const from = prevPath.current
    prevPath.current = pathname

    if (!isPop.current) return
    isPop.current = false

    if (!INFO_PATHS.has(from)) return

    // После отрисовки страницы — резко в самый низ (подвал)
    const jump = () => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    }
    requestAnimationFrame(() => requestAnimationFrame(jump))
  }, [pathname])

  return null
}
