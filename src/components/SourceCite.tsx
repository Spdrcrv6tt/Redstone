"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  formatCiteChipLabel,
  resolveCitedSources,
  sourceLabel,
} from "@/lib/search/sources";
import type { SearchSource } from "@/types";

interface SourceCiteProps {
  indices: number[];
  sources: SearchSource[];
}

export function SourceCite({ indices, sources }: SourceCiteProps) {
  const cited = resolveCitedSources(indices, sources);
  if (cited.length === 0) return null;

  const label = formatCiteChipLabel(cited);

  if (cited.length === 1) {
    return (
      <a
        href={cited[0].url}
        target="_blank"
        rel="noopener noreferrer"
        className="source-cite"
        title={cited[0].title}
      >
        {label}
      </a>
    );
  }

  return <SourceCiteMenu cited={cited} label={label} />;
}

function SourceCiteMenu({
  cited,
  label,
}: {
  cited: SearchSource[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span ref={ref} className="source-cite-wrap">
      <button
        type="button"
        className="source-cite"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <span className="source-cite-menu" role="menu">
          {cited.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="source-cite-menu-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-primary truncate">
                  {sourceLabel(s)}
                </span>
                <span className="block text-[10px] text-muted truncate">
                  {s.title}
                </span>
              </span>
              <ExternalLink className="w-3 h-3 text-muted flex-shrink-0" />
            </a>
          ))}
        </span>
      )}
    </span>
  );
}
