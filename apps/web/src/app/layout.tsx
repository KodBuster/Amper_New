import type { Metadata } from "next"
import { Manrope, Roboto_Condensed } from "next/font/google"
import { SiteFooter } from "@/components/SiteFooter"
import { SiteHeader } from "@/components/SiteHeader"
import { CartProvider } from "@/components/CartProvider"
import { ScrollRestoration } from "@/components/ScrollRestoration"
import "./amper-v14.css"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  // Без средних/жирных начертаний мелкий текст выглядит «воздушным»
  weight: ["500", "600", "700", "800"],
  variable: "--font-amper-body",
  display: "swap",
})

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-amper-display",
  display: "swap",
})

export const metadata: Metadata = {
  title: "АМПЕР — электрика с запасом",
  description: "Интернет-магазин электротоваров АМПЕР.",
  icons: { icon: "/assets/favicon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`variant-a ${manrope.variable} ${robotoCondensed.variable}`}>
        <CartProvider>
          <ScrollRestoration />
          <SiteHeader />
          <main id="app">{children}</main>
          <SiteFooter />
        </CartProvider>
      </body>
    </html>
  )
}
