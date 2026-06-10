"use client";

import { ExternalLink } from "lucide-react";
import type { SearchVideo } from "@/types";

interface YouTubeEmbedProps {
  videos: SearchVideo[];
}

export function YouTubeEmbed({ videos }: YouTubeEmbedProps) {
  const video = videos[0];
  if (!video) return null;

  return (
    <figure className="youtube-embed my-4 overflow-hidden rounded-xl border border-theme bg-[#0f1117] shadow-sm">
      <div className="relative aspect-video w-full">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.videoId}`}
          title={video.title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
        <span className="truncate text-secondary">{video.title}</span>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 hover:text-primary"
        >
          YouTube
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      </figcaption>
    </figure>
  );
}
