import { mkdir, symlink, lstat } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"

for (const key of ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "COOKIE_SECRET", "STORE_CORS", "ADMIN_CORS", "AUTH_CORS", "MEDUSA_BACKEND_URL"]) {
  if (!process.env[key] || /^(supersecret|change-me|REPLACE_)/.test(process.env[key])) {
    throw new Error(`Set a production value for ${key} in Amvera`)
  }
}
for (const key of ["JWT_SECRET", "COOKIE_SECRET"]) {
  if (process.env[key].length < 32) throw new Error(`${key} must contain at least 32 characters`)
}
const uploadDir = process.env.MEDUSA_UPLOAD_DIR || "/data/static"
await mkdir(uploadDir, { recursive: true })
await mkdir(process.env.MOYSKLAD_DATA_DIR || "/data/moysklad", { recursive: true })
// Medusa serves /static from the working directory; keep the files on the volume.
const staticPath = path.resolve("static")
if (!await lstat(staticPath).catch(() => null)) await symlink(uploadDir, staticPath, "dir")

const cli = "/app/node_modules/@medusajs/cli/cli.js"
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: "inherit", env: process.env })
    const forward = (signal) => child.kill(signal)
    const term = () => forward("SIGTERM")
    const int = () => forward("SIGINT")
    process.on("SIGTERM", term)
    process.on("SIGINT", int)
    child.on("error", reject)
    child.on("exit", (code, signal) => {
      process.off("SIGTERM", term)
      process.off("SIGINT", int)
      if (signal || code !== 0) reject(new Error(`Medusa ${args[0]} exited: ${signal || code}`))
      else resolve()
    })
  })
}
// A single backend replica owns migrations, scheduled sync and local uploads.
await run(["db:migrate"])
await run(["start", "--host", "0.0.0.0", "--port", process.env.PORT || "9000"])
