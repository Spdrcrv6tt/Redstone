"use client";

import { ExternalLink, Link2 } from "lucide-react";
import type { SearchLink } from "@/types";

interface LinkCardRowProps {
  links: SearchLink[];
}

export function LinkCardRow({ links }: LinkCardRowProps) {
  if (!links.length) return null;

  return (
    <div className="link-cards my-4 space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
        <Link2 className="h-3.5 w-3.5" />
        Related links
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link-card group flex flex-col rounded-xl border border-theme bg-surface-muted/50 p-3 transition hover:border-indigo-500/40 hover:bg-surface-hover"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-sm font-medium text-primary group-hover:text-indigo-300">
                {link.title}
              </span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-80" />
            </span>
            <span className="mt-1 text-[11px] text-muted">{link.domain}</span>
            {link.snippet && (
              <span className="mt-2 line-clamp-2 text-xs leading-relaxed text-secondary">
                {link.snippet}
              </span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
