import Link from "next/link"
import Image from "next/image"

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="АМПЕР — на главную">
      <Image
        src="/assets/amper-logo-yellow.svg"
        alt="АМПЕР"
        width={1540}
        height={425}
        className="logo-image"
        unoptimized
      />
    </Link>
  )
}
