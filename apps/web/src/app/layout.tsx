import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Suspense } from "react"
import { SiteFooter } from "@/components/SiteFooter"
import { SiteHeader } from "@/components/SiteHeader"
import { CartProvider } from "@/components/CartProvider"
import { CustomerProvider } from "@/components/CustomerProvider"
import { NavMemory } from "@/components/NavMemory"
import { ScrollRestoration } from "@/components/ScrollRestoration"
import { MetrikaPageViews } from "@/components/MetrikaPageViews"
import "@fontsource-variable/manrope"
import "@fontsource-variable/roboto-condensed"
import "./amper-v14.css"
import "./globals.css"

export const metadata: Metadata = {
  title: "АМПЕР — электрика с запасом",
  description: "Интернет-магазин электротоваров АМПЕР.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Не блокируем зум (доступность); уезд чиним кеглем полей ≥16px
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script id="yandex-metrika" strategy="beforeInteractive">{`
          window.dataLayer = window.dataLayer || [];
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a);
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=114486851','ym');
          ym(114486851,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
      </head>
      <body className="variant-a">
        <noscript>
          <div>
            {/* Tracking pixel must remain a plain image and must not use Next.js optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://mc.yandex.ru/watch/114486851" style={{ position: "absolute", left: "-9999px" }} alt="" />
          </div>
        </noscript>
        <Suspense fallback={null}>
          <MetrikaPageViews />
        </Suspense>
        <CartProvider>
          <CustomerProvider>
            <ScrollRestoration />
            <NavMemory />
            <SiteHeader />
            <main id="app">{children}</main>
            <SiteFooter />
          </CustomerProvider>
        </CartProvider>
      </body>
    </html>
  )
}
