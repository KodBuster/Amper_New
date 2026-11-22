import type { MedusaContainer } from "@medusajs/framework/types"
import { createProductCategoriesWorkflow, updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { toCategoryHandle } from "./category-utils"
import { buildFolderTree } from "./folder-tree"
import type { MoySkladProductFolder } from "./types"

/** Mirror source folders by stable IDs; keep disabled categories for order/history links. */
export async function ensureMoyskladCategories(container: MedusaContainer, folders: MoySkladProductFolder[]) {
  const tree = buildFolderTree(folders)
  const productModule = container.resolve(Modules.PRODUCT)
  const existing: Awaited<ReturnType<typeof productModule.listProductCategories>> = []
  for (let skip = 0; ; skip += 500) {
    const page = await productModule.listProductCategories({}, { take: 500, skip })
    existing.push(...page)
    if (page.length < 500) break
  }
  const byFolderId = new Map<string, string>()
  const used = new Set<string>()
  let created = 0, reactivated = 0, deactivated = 0
  for (const folder of tree.active) {
    const parent = tree.parentId.get(folder.id)
    const parentCategoryId = parent ? byFolderId.get(parent)! : null
    const found = existing.find((cat) => cat.metadata?.moysklad_folder_id === folder.id) ||
      (!parent ? existing.find((cat) => !cat.metadata?.moysklad_folder_id && cat.metadata?.moysklad_root === folder.name && !used.has(cat.id)) : undefined)
    const metadata = { ...found?.metadata, moysklad_folder_id: folder.id, moysklad_path: tree.fullPath(folder), moysklad_root: tree.chain(folder.id)[0].name }
    let id: string
    if (found) {
      id = found.id
      if (!found.is_active) reactivated++
      if (!found.is_active || found.is_internal || found.name !== folder.name || (found.parent_category_id || null) !== parentCategoryId || found.metadata?.moysklad_path !== metadata.moysklad_path || !found.metadata?.moysklad_folder_id) {
        await updateProductCategoriesWorkflow(container).run({ input: { selector: { id }, update: { name: folder.name, parent_category_id: parentCategoryId, is_active: true, is_internal: false, metadata } } })
      }
    } else {
      const { result } = await createProductCategoriesWorkflow(container).run({ input: { product_categories: [{
        name: folder.name, handle: `${toCategoryHandle(folder.name)}-${folder.id}`, parent_category_id: parentCategoryId,
        is_active: true, is_internal: false, metadata,
      }] } })
      id = result[0].id
      created++
    }
    byFolderId.set(folder.id, id)
    used.add(id)
  }
  for (const cat of existing) {
    if (!used.has(cat.id) && (cat.metadata?.moysklad_folder_id || cat.metadata?.moysklad_root) && cat.is_active) {
      await updateProductCategoriesWorkflow(container).run({ input: { selector: { id: cat.id }, update: { is_active: false } } })
      deactivated++
    }
  }
  const categoryIdsForProduct = (product: Parameters<typeof tree.isVisible>[0]): string[] => {
    const id = tree.productFolderId(product)
    // Ancestor links allow parent filters to include all descendants without huge query strings.
    return id && tree.activeIds.has(id) ? tree.chain(id).map((folder) => byFolderId.get(folder.id)!) : []
  }
  return { tree, byFolderId, categoryIdsForProduct, created, reactivated, deactivated }
}
