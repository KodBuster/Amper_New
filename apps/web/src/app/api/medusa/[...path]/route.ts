import type { NextRequest } from "next/server"

export const dynamic = "force-dynamic"

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  // Expose the customer API only. Admin and hooks remain on the backend domain.
  if (!["store", "auth"].includes(path[0]) || path.some((part) => part === "." || part === ".." || /[/\\]/.test(part))) {
    return Response.json({ message: "Not found" }, { status: 404 })
  }
  const base = process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
  const url = new URL(`${base.replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}`)
  url.search = request.nextUrl.search
  const headers = new Headers(request.headers)
  for (const name of ["host", "connection", "content-length", "transfer-encoding", "accept-encoding"]) headers.delete(name)
  const key = process.env.MEDUSA_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  if (key) headers.set("x-publishable-api-key", key)
  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    })
    const responseHeaders = new Headers(upstream.headers)
    for (const name of ["connection", "content-encoding", "content-length", "transfer-encoding"]) responseHeaders.delete(name)
    responseHeaders.set("cache-control", "no-store")
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json({ message: "Сервис магазина временно недоступен" }, { status: 502 })
  }
}

export { proxy as GET, proxy as HEAD, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS }
