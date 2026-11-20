"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { rememberPath } from "@/lib/nav-memory"

function NavMemoryInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const q = searchParams.toString()
    rememberPath(q ? `${pathname}?${q}` : pathname)
  }, [pathname, searchParams])

  return null
}

/** Пишет в sessionStorage откуда ушли — для динамической подписи «назад» */
export function NavMemory() {
  return (
    <Suspense fallback={null}>
      <NavMemoryInner />
    </Suspense>
  )
}
