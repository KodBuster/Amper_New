/** Быстрый старт и картинки категорий — визуал v14.2; список категорий с API */

export type StoreCategory = {
  id: string
  name: string
  handle: string
  is_active?: boolean
  is_internal?: boolean
  parent_category_id?: string | null
}

export type CategoryNode = StoreCategory & { children: CategoryNode[] }

/** Filter orphans too: children of an inactive category must never become roots. */
export function visibleCategories(categories: StoreCategory[]): StoreCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return categories.filter((category) => {
    const seen = new Set<string>()
    let current: StoreCategory | undefined = category
    while (current) {
      if (seen.has(current.id) || current.is_active === false || current.is_internal) return false
      seen.add(current.id)
      if (!current.parent_category_id) return true
      current = byId.get(current.parent_category_id)
    }
    return false
  }).sort((a, b) => a.name.localeCompare(b.name, "ru"))
}

export function buildCategoryTree(categories: StoreCategory[]): CategoryNode[] {
  const nodes = new Map(visibleCategories(categories).map((category) => [category.id, { ...category, children: [] as CategoryNode[] }]))
  const roots: CategoryNode[] = []
  for (const node of nodes.values()) {
    if (node.parent_category_id) nodes.get(node.parent_category_id)?.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function categoryAncestors(categories: StoreCategory[], id?: string): StoreCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const result: StoreCategory[] = []
  const seen = new Set<string>()
  let current = id ? byId.get(id) : undefined
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    result.unshift(current)
    current = current.parent_category_id ? byId.get(current.parent_category_id) : undefined
  }
  return result
}

/** Картинки для сетки на главной — подбираем по словам в названии папки МС */
const CATEGORY_IMAGES: Array<{ match: string[]; image: string }> = [
  {
    match: ["кабель", "провод", "кабель-канал"],
    image: "/assets/client-category-cable.jpg",
  },
  {
    match: ["розетк", "выключател", "подрозетник", "удлинител"],
    image: "/assets/client-category-sockets.jpg",
  },
  {
    match: ["автоматик", "щит", "бокс", "счетчик", "стабилизатор"],
    image: "/assets/client-category-safety.jpg",
  },
  {
    match: ["свет", "ламп", "люстр", "светильник"],
    image: "/assets/client-category-lighting.jpg",
  },
  {
    match: ["инструмент"],
    image: "/assets/client-category-tools.jpg",
  },
  {
    match: ["креп", "метиз", "замк", "петл"],
    image: "/assets/client-category-fixings.jpg",
  },
  {
    match: ["хозтовар", "клемм", "колодк", "расход"],
    image: "/assets/client-category-supplies.jpg",
  },
]

const FALLBACK_IMAGES = [
  "/assets/client-category-cable.jpg",
  "/assets/client-category-sockets.jpg",
  "/assets/client-category-safety.jpg",
  "/assets/client-category-lighting.jpg",
  "/assets/client-category-tools.jpg",
  "/assets/client-category-fixings.jpg",
  "/assets/client-category-supplies.jpg",
]

export function categoryImage(name: string, index = 0): string {
  const lower = name.toLowerCase()
  for (const row of CATEGORY_IMAGES) {
    if (row.match.some((m) => lower.includes(m))) return row.image
  }
  return FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]
}

/** Короткое имя для шапки */
export function categoryShortName(name: string): string {
  const parts = name.split(/[,/]/).map((p) => p.trim()).filter(Boolean)
  const first = parts[0] || name
  return first.length > 22 ? `${first.slice(0, 20)}…` : first
}

export const TASKS = [
  {
    title: "Заменить розетку",
    hint: "Розетки",
    /** Подстрока имени категории МС */
    nameHint: "розетк",
    image: "/assets/client-category-sockets.jpg",
  },
  {
    title: "Поменять лампу",
    hint: "Лампы",
    nameHint: "ламп",
    image: "/assets/client-category-lighting.jpg",
  },
  {
    title: "Найти крепёж",
    hint: "Саморезы и анкеры",
    nameHint: "креп",
    image: "/assets/client-category-fixings.jpg",
  },
  {
    title: "Выбрать инструмент",
    hint: "Для домашнего ремонта",
    nameHint: "инструмент",
    image: "/assets/client-category-tools.jpg",
  },
] as const

/** Найти категорию для задачи быстрого старта */
export function findCategoryForTask(
  categories: StoreCategory[],
  nameHint: string
): StoreCategory | undefined {
  const needle = nameHint.toLowerCase()
  return categories.find((c) => c.name.toLowerCase().includes(needle))
}
