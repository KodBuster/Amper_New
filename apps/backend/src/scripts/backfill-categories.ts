import type { ExecArgs } from "@medusajs/framework/types"
import { syncMoyskladCatalogWorkflow } from "../workflows/sync-moysklad-catalog"

/** Reconcile against live source folders, never reconstruct archived folders from old metadata. */
export default async function backfillCategories({ container }: ExecArgs) {
  const { result } = await syncMoyskladCatalogWorkflow(container).run({})
  console.log("Category tree and product visibility reconciled:", result)
}
