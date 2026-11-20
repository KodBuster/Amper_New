import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.moysklad.ru" },
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/static/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "9000", pathname: "/static/**" },
      // Tailscale / LAN — телефон ходит на IP, а не на localhost
      { protocol: "http", hostname: "100.116.162.44", port: "9000", pathname: "/static/**" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "**.amazonaws.com" },
    ],
  },
}

export default nextConfig
