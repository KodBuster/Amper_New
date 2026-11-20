import { redirect } from "next/navigation"

/** Избранное живёт в кабинете — сразу открываем нужный раздел */
export default function FavoritesPage() {
  redirect("/account?tab=favorites")
}
