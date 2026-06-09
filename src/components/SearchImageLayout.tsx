"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { ImageLayout } from "@/lib/search/layout";
import type { SearchImage } from "@/types";

function imageSourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface SearchImageLayoutProps {
  images: SearchImage[];
  layout: ImageLayout;
}

function FigureCaption({ image }: { image: SearchImage }) {
  const label = image.sourceUrl ? imageSourceLabel(image.sourceUrl) : null;
  if (!label || !image.sourceUrl) return null;

  return (
    <figcaption className="search-image-caption">
      <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
        Source: {label}
        <ExternalLink className="w-3 h-3 opacity-60" />
      </a>
    </figcaption>
  );
}

function FigureImage({
  image,
  onFail,
}: {
  image: SearchImage;
  onFail: () => void;
}) {
  const [src, setSrc] = useState(image.imageUrl);
  const [triedThumb, setTriedThumb] = useState(false);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={image.title || ""}
      className="search-image"
      loading="eager"
      decoding="async"
      onError={() => {
        if (
          !triedThumb &&
          image.thumbnailUrl &&
          image.thumbnailUrl !== src
        ) {
          setTriedThumb(true);
          setSrc(image.thumbnailUrl);
          return;
        }
        onFail();
      }}
    />
  );
}

function SingleFigure({
  image,
  layout,
  fallbacks,
}: {
  image: SearchImage;
  layout: ImageLayout;
  fallbacks: SearchImage[];
}) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const current = index === 0 ? image : fallbacks[index - 1];
  if (!current || hidden) return null;

  const layoutClass =
    layout === "float-right"
      ? "search-figure-float-right"
      : layout === "float-left"
        ? "search-figure-float-left"
        : "search-figure-full";

  return (
    <figure className={`search-image-figure ${layoutClass}`}>
      <FigureImage
        key={`${current.imageUrl}-${index}`}
        image={current}
        onFail={() => {
          if (index < fallbacks.length) {
            setIndex((i) => i + 1);
            return;
          }
          setHidden(true);
        }}
      />
      <FigureCaption image={current} />
    </figure>
  );
}

function JournalGrid({ images }: { images: SearchImage[] }) {
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const visible = images
    .map((img, i) => ({ img, i }))
    .filter(({ i }) => !failed.has(i))
    .slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <div
      className={`search-journal-grid search-journal-grid-${Math.min(visible.length, 4)}`}
      role="group"
      aria-label="Related images"
    >
      {visible.map(({ img, i }) => (
        <figure key={`${img.imageUrl}-${i}`} className="search-journal-cell">
          <FigureImage
            image={img}
            onFail={() => setFailed((prev) => new Set(prev).add(i))}
          />
          <FigureCaption image={img} />
        </figure>
      ))}
    </div>
  );
}

export function SearchImageLayout({ images, layout }: SearchImageLayoutProps) {
  if (images.length === 0) return null;

  if (layout === "journal" && images.length >= 2) {
    return <JournalGrid images={images} />;
  }

  return (
    <SingleFigure
      image={images[0]}
      layout={layout === "journal" ? "float-right" : layout}
      fallbacks={images.slice(1)}
    />
  );
}
