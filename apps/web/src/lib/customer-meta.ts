/** Metadata покупателя в кабинете (избранное и списки) */

export type SavedListItem = {
  variant_id: string
  quantity: number
  title?: string
  sku?: string
  product_id?: string
  handle?: string
}

export type SavedList = {
  id: string
  name: string
  created_at: string
  items: SavedListItem[]
}

export type CustomerCabinetMeta = {
  favorites: string[]
  saved_lists: SavedList[]
}

export function parseCabinetMeta(
  metadata: Record<string, unknown> | null | undefined
): CustomerCabinetMeta {
  const favRaw = metadata?.favorites
  const favorites = Array.isArray(favRaw)
    ? favRaw.filter((x): x is string => typeof x === "string")
    : []

  const listsRaw = metadata?.saved_lists
  const saved_lists: SavedList[] = []
  if (Array.isArray(listsRaw)) {
    for (const row of listsRaw) {
      if (!row || typeof row !== "object") continue
      const r = row as Record<string, unknown>
      const id = String(r.id || "")
      const name = String(r.name || "Список")
      const created_at = String(r.created_at || new Date().toISOString())
      const itemsRaw = Array.isArray(r.items) ? r.items : []
      const items: SavedListItem[] = []
      for (const it of itemsRaw) {
        if (!it || typeof it !== "object") continue
        const i = it as Record<string, unknown>
        const variant_id = String(i.variant_id || "")
        if (!variant_id) continue
        items.push({
          variant_id,
          quantity: Math.max(1, Number(i.quantity) || 1),
          title: i.title ? String(i.title) : undefined,
          sku: i.sku ? String(i.sku) : undefined,
          product_id: i.product_id ? String(i.product_id) : undefined,
          handle: i.handle ? String(i.handle) : undefined,
        })
      }
      if (id) saved_lists.push({ id, name, created_at, items })
    }
  }

  return { favorites, saved_lists }
}

export function newListId(): string {
  return `list_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
