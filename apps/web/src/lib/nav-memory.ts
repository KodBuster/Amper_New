const CURR_KEY = "amper-curr-path"
const PREV_KEY = "amper-prev-path"

/** Запомнить текущий путь; предыдущий — откуда ушли (для «Вернуться назад…») */
export function rememberPath(fullPath: string) {
  try {
    const cur = sessionStorage.getItem(CURR_KEY)
    if (cur && cur !== fullPath) {
      sessionStorage.setItem(PREV_KEY, cur)
    }
    sessionStorage.setItem(CURR_KEY, fullPath)
  } catch {
    // sessionStorage может быть недоступен
  }
}

export function getPreviousPath(): string | null {
  try {
    return sessionStorage.getItem(PREV_KEY)
  } catch {
    return null
  }
}

/** Подпись кнопки «назад» по пути, с которого пришли */
export function backLabelFromPath(path: string | null | undefined): string {
  if (!path) return "Вернуться назад"
  const qIndex = path.indexOf("?")
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path
  const params = new URLSearchParams(qIndex >= 0 ? path.slice(qIndex + 1) : "")
  const tab = params.get("tab")

  if (pathname === "/favorites" || (pathname === "/account" && tab === "favorites")) {
    return "Вернуться назад в избранное"
  }
  if (pathname === "/account" && tab === "lists") {
    return "Вернуться назад к спискам"
  }
  if (pathname === "/account" && tab === "orders") {
    return "Вернуться назад к заказам"
  }
  if (pathname === "/account") {
    return "Вернуться назад в кабинет"
  }
  if (pathname === "/catalog" || pathname.startsWith("/catalog/")) {
    return "Вернуться назад в каталог"
  }
  if (pathname === "/cart") {
    return "Вернуться назад в корзину"
  }
  if (pathname === "/by-list") {
    return "Вернуться назад к списку"
  }
  if (pathname === "/checkout") {
    return "Вернуться назад к оформлению"
  }
  if (pathname === "/") {
    return "Вернуться назад на главную"
  }
  return "Вернуться назад"
}
