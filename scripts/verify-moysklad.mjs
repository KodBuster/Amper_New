/**
 * Проверка токена МойСклад без запуска Medusa.
 * Использование: node scripts/verify-moysklad.mjs
 * Читает MOYSKLAD_API_TOKEN из env или apps/backend/.env
 */
import fs from "node:fs"
import path from "node:path"

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

loadEnvFile(path.resolve("apps/backend/.env"))
loadEnvFile(path.resolve(".env"))

const token = process.env.MOYSKLAD_API_TOKEN
const base = (process.env.MOYSKLAD_API_URL || "https://api.moysklad.ru/api/remap/1.2").replace(/\/$/, "")

if (!token) {
  console.error("MOYSKLAD_API_TOKEN не найден. Положите токен в apps/backend/.env")
  process.exit(1)
}

const res = await fetch(`${base}/entity/product?limit=3`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json;charset=utf-8",
  },
})

const text = await res.text()
if (!res.ok) {
  console.error("Ошибка API:", res.status, text.slice(0, 400))
  process.exit(1)
}

const data = JSON.parse(text)
console.log("OK. Товаров (meta.size):", data.meta?.size)
console.log(
  "Примеры:",
  (data.rows || []).map((r) => ({ id: r.id, name: r.name, article: r.article }))
)
