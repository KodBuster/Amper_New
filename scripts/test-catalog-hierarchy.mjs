import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import Module, { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)
// Resolve relative to the checkout without relying on URL decoding of Windows Cyrillic paths.
const checkout = path.resolve(".")
const steps = new Map()
const categories = [{ id: "old-root", name: "Электрика", handle: "elektrika", is_active: true, parent_category_id: null, metadata: { moysklad_root: "Электрика" } }]
categories.push(...Array.from({ length: 501 }, (_, index) => ({ id: `unmanaged-${index}`, name: "Other", handle: `other-${index}`, is_active: false, parent_category_id: null, metadata: {} })))
const products = []
const flows = {
  createProductCategoriesWorkflow: () => ({ run: async ({ input }) => {
    const category = { ...input.product_categories[0], id: `cat-${categories.length}` }
    categories.push(category)
    return { result: [category] }
  } }),
  updateProductCategoriesWorkflow: () => ({ run: async ({ input }) => {
    Object.assign(categories.find((category) => category.id === input.selector.id), input.update)
  } }),
  updateProductsWorkflow: () => ({ run: async ({ input }) => {
    for (const row of input.products) products.find((product) => product.id === row.id).categories = row.category_ids.map((id) => ({ id }))
  } }),
}
const cache = new Map()
function load(relative) {
  const filename = path.resolve(checkout, relative)
  if (cache.has(filename)) return cache.get(filename)
  const mod = new Module(filename)
  cache.set(filename, mod.exports)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod.require = (name) => {
    if (name === "@medusajs/medusa/core-flows") return flows
    if (name === "@medusajs/framework/workflows-sdk") return {
      createStep: (name, handler) => { steps.set(name, handler); return () => ({}) },
      createWorkflow: () => () => ({}),
      StepResponse: class { constructor(value) { this.result = value } },
      WorkflowResponse: class {},
    }
    if (name === "../modules/moysklad") return { MOYSKLAD_MODULE: "moysklad" }
    if (name.startsWith(".")) return load(path.relative(checkout, path.resolve(path.dirname(filename), `${name}.ts`)))
    return require(name)
  }
  mod._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText, filename)
  cache.set(filename, mod.exports)
  return mod.exports
}
const { buildFolderTree } = load("apps/backend/src/modules/moysklad/folder-tree.ts")
const { ensureMoyskladCategories } = load("apps/backend/src/modules/moysklad/ensure-categories.ts")
const nav = load("apps/web/src/lib/catalog-nav.ts")
const folders = [
  { id: "root", name: "Электрика", pathName: "" },
  { id: "child", name: "Лампы", pathName: "Электрика" },
  { id: "leaf", name: "Светодиодные", pathName: "Электрика/Лампы" },
  { id: "other", name: "Инструмент", pathName: "" },
  { id: "archived", name: "Архив", pathName: "", archived: true },
  { id: "hidden-child", name: "Вложенная", pathName: "Архив" },
]
const tree = buildFolderTree(folders)
assert.deepEqual(tree.chain("leaf").map((folder) => folder.id), ["root", "child", "leaf"])
assert.equal(tree.isVisible({ id: "p", name: "p", pathName: "Архив/Вложенная" }), false)
assert.equal(tree.isVisible({ id: "p", name: "p", archived: true }), false)
assert.equal(tree.isVisible({ id: "p", name: "p", productFolder: { meta: { href: "https://api.moysklad.ru/api/remap/1.2/entity/productfolder/leaf" } } }), true)
assert.equal(tree.isVisible({ id: "p", name: "p", pathName: "Missing" }), false)
const { MoySkladClient } = load("apps/backend/src/modules/moysklad/client.ts")
const client = new MoySkladClient({ apiToken: "test", apiUrl: "https://example.invalid" })
const requests = []
client.get = async (request) => {
  requests.push(request)
  const url = new URL(request, "https://example.invalid")
  const archived = url.searchParams.get("filter") === "archived=true"
  const offset = Number(url.searchParams.get("offset"))
  const size = archived ? 2 : 201
  return { meta: { size }, rows: Array.from({ length: Math.max(0, Math.min(100, size - offset)) }, (_, i) => ({ id: `${archived}-${offset + i}`, name: "test", archived })) }
}
assert.equal((await client.listProductFolders()).length, 203)
assert.ok(requests.some((request) => request.includes("archived=true")))
assert.ok(requests.some((request) => request.includes("offset=200")))
assert.throws(() => buildFolderTree([{ id: "orphan", name: "x", pathName: "Missing" }]), /Missing parent/)
assert.throws(() => buildFolderTree([{ id: "a", name: "a", productFolder: { id: "b" } }, { id: "b", name: "b", productFolder: { id: "a" } }]), /Cycle/)

const productService = {
  listProductCategories: async (_filter, { skip = 0, take }) => categories.slice(skip, skip + take),
  listProducts: async (_filter, { skip = 0, take }) => products.slice(skip, skip + take),
  updateProducts: async (id, update) => Object.assign(products.find((product) => product.id === id), update),
}
const { Modules } = require("@medusajs/framework/utils")
let sourceProducts = []
let sourceFails = false
const services = {
  [Modules.PRODUCT]: productService,
  [Modules.SALES_CHANNEL]: { listSalesChannels: async () => [] },
  [Modules.FULFILLMENT]: { listShippingProfiles: async () => [] },
  [Modules.FILE]: {},
  moysklad: {
    resolveDefaults: async () => ({}),
    getClient: () => ({ listProducts: async () => { if (sourceFails) throw new Error("Source unavailable"); return sourceProducts }, listProductFolders: async () => folders }),
    toHandle: (product) => product.id, toSku: (product) => product.id,
    pickSalePriceKopecks: () => 0, pickUomName: () => "шт",
  },
}
const container = { resolve: (key) => { assert.ok(services[key], `Unknown service ${key}`); return services[key] } }
const first = await ensureMoyskladCategories(container, folders)
assert.equal(first.byFolderId.get("root"), "old-root", "Preserve existing root URLs")
const leafId = first.byFolderId.get("leaf")
const leafHandle = categories.find((category) => category.id === leafId).handle
assert.equal(categories.find((category) => category.id === leafId).parent_category_id, first.byFolderId.get("child"))
assert.equal((await ensureMoyskladCategories(container, folders)).created, 0)
folders.find((folder) => folder.id === "leaf").pathName = "Инструмент"
folders.find((folder) => folder.id === "leaf").name = "LED"
await ensureMoyskladCategories(container, folders)
assert.equal(categories.find((category) => category.id === leafId).handle, leafHandle)
assert.equal(categories.find((category) => category.id === leafId).parent_category_id, first.byFolderId.get("other"))

const publicTree = nav.buildCategoryTree([
  ...categories,
  { id: "disabled", name: "hidden", handle: "hidden", is_active: false },
  { id: "orphan", name: "hidden-child", handle: "hidden-child", parent_category_id: "disabled" },
])
assert.equal(publicTree.length, 2)
assert.equal(nav.categoryAncestors(categories, leafId).at(-1).name, "LED")

load("apps/backend/src/workflows/sync-moysklad-catalog.ts")
const sync = steps.get("moysklad-sync-products")
sourceProducts = [{ id: "active", name: "Активный", pathName: "Инструмент/LED" }, { id: "blocked", name: "Скрытый", pathName: "Архив/Вложенная" }]
for (const id of ["active", "blocked", "deleted", "manual"]) products.push({ id, title: id, status: "published", metadata: id === "manual" ? {} : { moysklad_id: id }, variants: [], categories: [] })
let result = await sync(undefined, { container })
assert.deepEqual(result.result.errors, [])
assert.equal(products.find((product) => product.id === "blocked").status, "draft")
assert.equal(products.find((product) => product.id === "deleted").status, "draft")
assert.equal(products.find((product) => product.id === "manual").status, "published")
assert.deepEqual(products.find((product) => product.id === "active").categories.map((category) => category.id), [first.byFolderId.get("other"), leafId])
folders.find((folder) => folder.id === "other").archived = true
await sync(undefined, { container })
assert.equal(products.find((product) => product.id === "active").status, "draft")
assert.equal(categories.find((category) => category.id === leafId).is_active, false)
folders.find((folder) => folder.id === "other").archived = false
await sync(undefined, { container })
assert.equal(products.find((product) => product.id === "active").status, "published")
assert.equal(categories.find((category) => category.id === leafId).is_active, true)
const before = JSON.stringify({ products, categories })
sourceFails = true
await assert.rejects(sync(undefined, { container }), /Source unavailable/)
assert.equal(JSON.stringify({ products, categories }), before)
console.log("PASS: hierarchy, archived ancestors, invalid trees, stable IDs/URLs, moves/renames, parent links, product withdrawal/restoration, source failure safety")
