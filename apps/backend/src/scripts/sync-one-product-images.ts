import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { MOYSKLAD_MODULE } from "../modules/moysklad"
import type MoySkladModuleService from "../modules/moysklad/service"

/**
 * Подтянуть фото из МойСклад для одного товара (по артикулу / коду / id МС).
 * Пример: npx medusa exec ./src/scripts/sync-one-product-images.ts SH203L
 * или: ... 2CDS243001R0324
 */
export default async function syncOneProductImages({ container }: ExecArgs) {
  // medusa exec глотает argv — ищем через SYNC_IMAGE_Q=артикул/код/id
  const needle = String(process.env.SYNC_IMAGE_Q || "")
    .trim()
    .toLowerCase()
  if (!needle) {
    throw new Error(
      "Задайте SYNC_IMAGE_Q, напр. SYNC_IMAGE_Q=2CDS243001R0324 npx medusa exec ./src/scripts/sync-one-product-images.ts"
    )
  }

  const moysklad: MoySkladModuleService = container.resolve(MOYSKLAD_MODULE)
  const client = moysklad.getClient()
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModule = container.resolve(Modules.PRODUCT)
  const fileModule = container.resolve(Modules.FILE)

  type Prod = {
    id: string
    title?: string
    thumbnail?: string | null
    metadata?: Record<string, unknown> | null
    images?: Array<{ id?: string; url?: string }>
  }

  const match: Prod[] = []
  const pageSize = 200
  for (let skip = 0; skip < 20000; skip += pageSize) {
    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "thumbnail",
        "metadata",
        "images.id",
        "images.url",
      ],
      pagination: { take: pageSize, skip },
    })
    const batch = (products || []) as Prod[]
    if (!batch.length) break
    for (const p of batch) {
      const meta = p.metadata || {}
      const hay = [
        p.id,
        p.title,
        meta.moysklad_id,
        meta.moysklad_article,
        meta.moysklad_code,
        meta.moysklad_external_code,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ")
      if (hay.includes(needle)) match.push(p)
    }
    if (batch.length < pageSize) break
  }

  if (!match.length) {
    throw new Error(`В Medusa не найден товар по «${needle}»`)
  }

  for (const p of match) {
    const msId = String(p.metadata?.moysklad_id || "")
    if (!msId) {
      console.log(`Пропуск ${p.id}: нет moysklad_id`)
      continue
    }

    const images = await client.listProductImages(msId)
    console.log(
      `${p.title}: в МС фото ${images.length}, в Medusa ${(p.images || []).length}`
    )
    if (!images.length) {
      console.log("  — в МойСкладе нет изображений, пропускаем")
      continue
    }

    const urls: string[] = []
    const sourceIds: string[] = []
    const fpParts: string[] = []

    for (const img of images.slice(0, 5)) {
      const downloadHref = img.meta?.downloadHref
      if (!downloadHref) continue
      fpParts.push(`${img.id || ""}:${img.updated || ""}`)
      const { buffer, mimeType, filename } = await client.downloadFile(
        downloadHref,
        img.filename || `${msId}.jpg`
      )
      const [uploaded] = await fileModule.createFiles([
        {
          filename: `ms-${msId}-${filename}`.replace(/[^\w.\-]+/g, "_"),
          mimeType,
          content: buffer.toString("base64"),
        },
      ])
      if (uploaded?.url) {
        urls.push(uploaded.url)
        sourceIds.push(img.id || downloadHref)
      }
    }

    if (!urls.length) {
      console.log("  — не удалось скачать/залить файлы")
      continue
    }

    await productModule.updateProducts(p.id, {
      thumbnail: urls[0],
      images: urls.map((url) => ({ url })),
      metadata: {
        ...(p.metadata || {}),
        moysklad_image_id: sourceIds[0] || "",
        moysklad_images_count: String(urls.length),
        moysklad_images_fp: fpParts.join("|"),
      },
    })
    console.log(`  — залито ${urls.length} фото, thumbnail=${urls[0]}`)
  }
}
