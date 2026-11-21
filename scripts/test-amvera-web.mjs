import assert from "node:assert/strict"
import { createServer } from "node:http"
import { once } from "node:events"
import { cp } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const web = path.join(root, "apps/web")
const standalone = path.join(web, ".next/standalone/apps/web")
await cp(path.join(web, "public"), path.join(standalone, "public"), { recursive: true })
await cp(path.join(web, ".next/static"), path.join(standalone, ".next/static"), { recursive: true })
const received = []
const backend = createServer(async (request, response) => {
  let body = ""
  for await (const chunk of request) body += chunk
  received.push({ url: request.url, method: request.method, headers: request.headers, body })
  response.setHeader("content-type", "application/json")
  if (request.url.startsWith("/store/products")) return response.end(JSON.stringify({ products: [] }))
  if (request.url.startsWith("/store/product-categories")) return response.end(JSON.stringify({ product_categories: [] }))
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
  const css = html.match(/href="([^"\s]+\.css[^"\s]*)"/)
  assert.ok(css, "Homepage must reference CSS")
  assert.equal((await fetch(new URL(css[1], base))).status, 200)
  assert.equal((await fetch(`${base}/assets/favicon.svg`)).status, 200)
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
  console.log("PASS: standalone startup, health, homepage, CSS/assets, runtime backend/key, auth/body/query, status forwarding, blocked admin/hooks, unavailable backend")
} finally {
  server.kill()
  if (server.exitCode === null) await once(server, "exit")
  backend.closeAllConnections()
  if (backend.listening) await new Promise((resolve) => backend.close(resolve))
}
