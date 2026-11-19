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
