import assert from "node:assert/strict"
import { createServer } from "node:http"
import { once } from "node:events"
import { cp } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const web = path.join(root, "apps/web")
const standalone = path.join(web, ".next/standalone/apps/web")
await cp(path.join(web, "public"), path.join(standalone, "public"), { recursive: true })
await cp(path.join(web, ".next/static"), path.join(standalone, ".next/static"), { recursive: true })
const received = []
const require = createRequire(import.meta.url)
const categoryQueryConfig = require("../apps/backend/node_modules/@medusajs/medusa/dist/api/store/product-categories/query-config.js")
const mockCategories = [
  { id: "cat-root", name: "Электрика", handle: "electrics", parent_category_id: null },
  { id: "cat-child", name: "Лампы", handle: "lamps", parent_category_id: "cat-root" },
  ...Array.from({ length: 130 }, (_, index) => ({ id: `leaf-${index}`, name: `Лампы светодиодные ${index}`, handle: `led-${index}`, parent_category_id: "cat-child" })),
  { id: "orphan", name: "Скрытая ветка", handle: "hidden", parent_category_id: "archived-parent" },
]
const backend = createServer(async (request, response) => {
  let body = ""
  for await (const chunk of request) body += chunk
  received.push({ url: request.url, method: request.method, headers: request.headers, body })
  response.setHeader("content-type", "application/json")
  if (request.url.startsWith("/store/products")) return response.end(JSON.stringify({ products: [] }))
  if (request.url.startsWith("/store/product-categories")) {
    const url = new URL(request.url, "http://localhost")
    const fields = (url.searchParams.get("fields") || "").split(",")
    if (fields.some((field) => !categoryQueryConfig.defaults.includes(field))) {
      response.statusCode = 400
      return response.end(JSON.stringify({ message: "Unsupported category field" }))
    }
    const offset = Number(url.searchParams.get("offset") || 0)
    return response.end(JSON.stringify({ product_categories: mockCategories.slice(offset, offset + 100), count: mockCategories.length }))
  }
  response.statusCode = request.url.includes("missing") ? 404 : 200
  response.end(JSON.stringify({ echoed: body }))
})
backend.listen(0, "127.0.0.1")
await once(backend, "listening")
const reserve = createServer()
reserve.listen(0, "127.0.0.1")
await once(reserve, "listening")
const port = reserve.address().port
await new Promise((resolve) => reserve.close(resolve))
const server = spawn(process.execPath, [path.join(standalone, "server.js")], {
  cwd: root,
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port), MEDUSA_BACKEND_URL: `http://127.0.0.1:${backend.address().port}`, MEDUSA_PUBLISHABLE_KEY: "pk_runtime_test" },
  stdio: ["ignore", "pipe", "pipe"],
})
let logs = ""
server.stdout.on("data", (data) => { logs += data })
server.stderr.on("data", (data) => { logs += data })
const base = `http://127.0.0.1:${port}`
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs)
    if (await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false)) { ready = true; break }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  assert.ok(ready, logs)
  const page = await fetch(base)
  assert.equal(page.status, 200)
  const html = await page.text()
  assert.ok(html.includes("АМПЕР"))
  for (const url of [base, `${base}/about`]) {
    const document = await (await fetch(url)).text()
    assert.ok(document.includes("https://mc.yandex.ru/metrika/tag.js?id=114486851"), "Counter must be present on every page")
    assert.ok(document.includes("https://mc.yandex.ru/watch/114486851"), "No-script tracking pixel must be present")
    assert.ok(document.includes("/favicon-32x32.png"), "New favicon must be declared")
  }
  const favicon = await fetch(`${base}/favicon.ico`)
  assert.equal(favicon.status, 200)
  const ico = Buffer.from(await favicon.arrayBuffer())
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 3)
  const css = html.match(/href="([^"\s]+\.css[^"\s]*)"/)
  assert.ok(css, "Homepage must reference CSS")
  assert.equal((await fetch(new URL(css[1], base))).status, 200)
  assert.equal((await fetch(`${base}/assets/favicon.svg`)).status, 200)
  const catalog = await (await fetch(`${base}/catalog?cat=led-129`)).text()
  assert.ok(catalog.includes("Лампы светодиодные 129"), "Deep categories beyond the first API page must load")
  assert.ok(catalog.includes("aria-current=\"page\""), "Selected leaf must be active")
  assert.ok(catalog.includes("aria-expanded=\"true\""), "Ancestors of the selected leaf must open")
  assert.ok(catalog.includes("/catalog?cat=lamps"), "Breadcrumbs must link the parent")
  assert.ok(!catalog.includes("Скрытая ветка"), "Orphans below archived parents must not render")
  assert.ok(received.some((request) => request.url.startsWith("/store/products") && request.url.includes("leaf-129")), "Products must be filtered by selected category")
  const beforeInvalid = received.filter((request) => request.url.startsWith("/store/products")).length
  await fetch(`${base}/catalog?cat=hidden`)
  assert.equal(received.filter((request) => request.url.startsWith("/store/products")).length, beforeInvalid, "Hidden category must not fall back to all products")
  const result = await fetch(`${base}/api/medusa/store/order-lookup?test=runtime`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer customer-test" }, body: JSON.stringify({ display_id: "123" }),
  })
  assert.equal(result.status, 200)
  const last = received.at(-1)
  assert.equal(last.url, "/store/order-lookup?test=runtime")
  assert.equal(last.headers["x-publishable-api-key"], "pk_runtime_test")
  assert.equal(last.headers.authorization, "Bearer customer-test")
  assert.equal(last.body, '{"display_id":"123"}')
  assert.equal(result.headers.get("cache-control"), "no-store")
  assert.equal((await fetch(`${base}/api/medusa/auth/customer/emailpass`, { method: "POST", body: "{}" })).status, 200)
  assert.equal((await fetch(`${base}/api/medusa/store/missing`)).status, 404)
  const before = received.length
  assert.equal((await fetch(`${base}/api/medusa/admin/users`)).status, 404)
  assert.equal((await fetch(`${base}/api/medusa/hooks/moysklad`)).status, 404)
  assert.equal(received.length, before)
  await new Promise((resolve) => backend.close(resolve))
  assert.equal((await fetch(`${base}/api/medusa/store/products`)).status, 502)
  console.log("PASS: standalone startup, health, homepage, counter on dynamic/static pages, favicon, CSS/assets, runtime backend/key, auth/body/query, status forwarding, blocked admin/hooks, unavailable backend")
} finally {
  server.kill()
  if (server.exitCode === null) await once(server, "exit")
  backend.closeAllConnections()
  if (backend.listening) await new Promise((resolve) => backend.close(resolve))
}
