"use client"

import Image from "next/image"
import { useState } from "react"

type Props = {
  title: string
  images: string[]
}

/**
 * Галерея карточки товара по разметке AMPER A v14.2:
 * большое фото + столбец миниатюр и кнопка «следующий кадр».
 */
export function ProductGallery({ title, images }: Props) {
  const list = images.length ? images : ["/assets/photo-product-101.webp"]
  const [index, setIndex] = useState(0)
  const current = list[Math.min(index, list.length - 1)]

  function go(i: number) {
    setIndex(((i % list.length) + list.length) % list.length)
  }

  return (
    <div className="product-gallery" aria-label="Фотографии товара">
      <div className="gallery-stage">
        <Image
          id="gallery-main-img"
          src={current}
          alt={`Изображение: ${title}`}
          width={720}
          height={900}
          priority
          sizes="(max-width:900px) 90vw, 480px"
          className={`view-${index % 4}`}
        />
        <span className="gallery-stage-number" id="gallery-counter">
          {index + 1} / {list.length}
        </span>
      </div>

      <div className="gallery-side">
        <div className="gallery-rail" id="gallery-rail" role="group" aria-label="Миниатюры товара">
          {list.map((src, i) => (
            <button
              key={`${src}-${i}`}
              className="gallery-thumb"
              type="button"
              data-index={i}
              aria-label={`Показать изображение ${i + 1} из ${list.length}`}
              aria-pressed={index === i}
              onClick={() => go(i)}
            >
              <Image
                src={src}
                alt=""
                width={120}
                height={150}
                loading="lazy"
                className={`view-${i % 4}`}
              />
            </button>
          ))}
        </div>
        {list.length > 1 ? (
          <button
            className="gallery-side-control"
            type="button"
            aria-label="Следующее изображение в галерее товара"
            onClick={() => go(index + 1)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m4 9 8 8 8-8" />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}
