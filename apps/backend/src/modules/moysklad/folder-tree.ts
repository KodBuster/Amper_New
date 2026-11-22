import type { MoySkladFolderRef, MoySkladProduct, MoySkladProductFolder } from "./types"

export function folderRefId(ref?: MoySkladFolderRef): string | undefined {
  return ref?.id || ref?.meta?.href?.split("?")[0].replace(/\/$/, "").split("/").pop()
}

export function buildFolderTree(folders: MoySkladProductFolder[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const fullPath = (folder: MoySkladProductFolder) => [folder.pathName, folder.name].filter(Boolean).join("/")
  const byPath = new Map(folders.map((folder) => [fullPath(folder), folder]))
  const parentId = new Map<string, string | undefined>()
  for (const folder of folders) {
    const parent = folderRefId(folder.productFolder) || (folder.pathName ? byPath.get(folder.pathName)?.id : undefined)
    if (!parent && folder.pathName) throw new Error(`Missing parent folder for ${folder.id}; sync cancelled`)
    if (parent && !byId.has(parent)) throw new Error(`Unknown parent folder for ${folder.id}; sync cancelled`)
    parentId.set(folder.id, parent)
  }
  const chains = new Map<string, MoySkladProductFolder[]>()
  function chain(id: string, visiting = new Set<string>()): MoySkladProductFolder[] {
    const cached = chains.get(id)
    if (cached) return cached
    if (visiting.has(id)) throw new Error("Cycle in MoySklad folders; sync cancelled")
    visiting.add(id)
    const folder = byId.get(id)!
    const parent = parentId.get(id)
    const result = [...(parent ? chain(parent, visiting) : []), folder]
    visiting.delete(id)
    chains.set(id, result)
    return result
  }
  const active = folders.filter((folder) => chain(folder.id).every((ancestor) => !ancestor.archived))
    .sort((a, b) => chain(a.id).length - chain(b.id).length || a.name.localeCompare(b.name, "ru"))
  const activeIds = new Set(active.map((folder) => folder.id))
  const productFolderId = (product: MoySkladProduct) => folderRefId(product.productFolder) || (product.pathName ? byPath.get(product.pathName)?.id : undefined)
  function isVisible(product: MoySkladProduct) {
    if (product.archived) return false
    const id = productFolderId(product)
    return id ? activeIds.has(id) : !product.pathName && !product.productFolder
  }
  return { active, activeIds, byId, byPath, parentId, chain, productFolderId, isVisible, fullPath }
}
