/** Категории и быстрый старт — как в AMPER A v14.2 */

export type CatalogCat = {
  slug: string
  name: string
  short: string
  image: string
  /**
   * Подстроки для moysklad_path (нижний регистр).
   * Совпадают с корневыми/дочерними папками МойСклад.
   */
  pathHints: string[]
}

export const CATS: CatalogCat[] = [
  {
    slug: "cable",
    name: "Кабель и провод",
    short: "Кабель",
    image: "/assets/client-category-cable.jpg",
    pathHints: [
      "провод и кабель",
      "кабель-канал",
      "трубы для кабеля",
    ],
  },
  {
    slug: "sockets",
    name: "Розетки и выключатели",
    short: "Розетки",
    image: "/assets/client-category-sockets.jpg",
    pathHints: [
      "розетки и выключатели",
      "подрозетники",
      "распаечные",
      "удлинители",
      "ретро электрика",
    ],
  },
  {
    slug: "safety",
    name: "Автоматика и щиты",
    short: "Автоматы",
    image: "/assets/client-category-safety.jpg",
    pathHints: [
      "автоматика",
      "щитки",
      "боксы",
      "электросчетчики",
      "стабилизаторы",
    ],
  },
  {
    slug: "lighting",
    name: "Свет и лампы",
    short: "Освещение",
    image: "/assets/client-category-lighting.jpg",
    pathHints: ["светильники", "люстры", "лампы"],
  },
  {
    slug: "tools",
    name: "Инструмент",
    short: "Инструмент",
    image: "/assets/client-category-tools.jpg",
    // В МС это ветка «Крепеж и инструмент/Инструмент/…»
    pathHints: ["/инструмент/", "инструмент/"],
  },
  {
    slug: "fixings",
    name: "Крепёж и метизы",
    short: "Крепёж",
    image: "/assets/client-category-fixings.jpg",
    pathHints: [
      "крепеж и инструмент/креп",
      "/крепеж/",
      "замки, петли",
      "метиз",
    ],
  },
  {
    slug: "supplies",
    name: "Расходники",
    short: "Расходники",
    image: "/assets/client-category-supplies.jpg",
    pathHints: [
      "хозтовар",
      "клеммы",
      "колодки",
      "шины",
      "наконечники",
      "сантехника",
    ],
  },
]

export const TASKS = [
  {
    title: "Заменить розетку",
    hint: "Розетки",
    slug: "sockets",
    image: "/assets/client-category-sockets.jpg",
  },
  {
    title: "Поменять лампу",
    hint: "Лампы",
    slug: "lighting",
    image: "/assets/client-category-lighting.jpg",
  },
  {
    title: "Найти крепёж",
    hint: "Саморезы и анкеры",
    slug: "fixings",
    image: "/assets/client-category-fixings.jpg",
  },
  {
    title: "Выбрать инструмент",
    hint: "Для домашнего ремонта",
    slug: "tools",
    image: "/assets/client-category-tools.jpg",
  },
] as const

/** Товар подходит под категорию витрины по пути МойСклад */
export function productMatchesCat(
  product: { title?: string | null; metadata?: Record<string, unknown> | null },
  cat: CatalogCat
): boolean {
  const path = String(product.metadata?.moysklad_path || "").toLowerCase()
  const title = String(product.title || "").toLowerCase()
  const parts = path
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean)

  // «Крепеж и инструмент» — одна корневая папка МС, режем по дочерней
  if (cat.slug === "tools") {
    return parts.some((p) => p === "инструмент" || p.startsWith("инструмент "))
  }
  if (cat.slug === "fixings") {
    if (parts.some((p) => p.includes("замки") || p.includes("метиз"))) return true
    const underFasteners = parts[0]?.includes("крепеж")
    const isToolBranch = parts.some(
      (p) => p === "инструмент" || p.startsWith("инструмент ")
    )
    return Boolean(underFasteners && !isToolBranch)
  }

  const hay = `${path} ${title}`
  return cat.pathHints.some((h) => hay.includes(h.toLowerCase()))
}
