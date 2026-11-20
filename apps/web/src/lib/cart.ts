"use client"

const CART_KEY = "amper-medusa-cart-id"

export function getCartId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(CART_KEY)
}

export function setCartId(id: string) {
  localStorage.setItem(CART_KEY, id)
}

export function clearCartId() {
  localStorage.removeItem(CART_KEY)
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message || ""
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>
    if (typeof o.message === "string") return o.message
    if (typeof o.type === "string") return o.type
    if (typeof o.status === "number") return String(o.status)
    if (typeof o.statusText === "string") return o.statusText
  }
  return String(err || "")
}

/** Корзины реально нет (можно сбрасывать ID) */
export function isCartGoneError(err: unknown): boolean {
  const msg = errText(err)
  return (
    /not[_ ]?found|404|does not exist|cart_not_found|unknown cart/i.test(msg) ||
    (typeof err === "object" &&
      err !== null &&
      "status" in err &&
      Number((err as { status?: number }).status) === 404)
  )
}

/** Сеть / рестарт бэкенда — ID корзины не трогаем */
export function isTransientCartError(err: unknown): boolean {
  if (isCartGoneError(err)) return false
  const msg = errText(err)
  return (
    !msg ||
    /failed to fetch|network|timeout|abort|econnrefused|econnreset|502|503|504|fetch failed|load failed/i.test(
      msg
    )
  )
}

/** Несколько попыток retrieve — на мобилке после рестарта API иначе сносит корзину */
export async function withCartRetries<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 450
): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (isCartGoneError(err)) throw err
      if (i < attempts - 1 && isTransientCartError(err)) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw last
}
