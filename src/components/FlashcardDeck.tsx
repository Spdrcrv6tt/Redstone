"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle } from "lucide-react";
import type { FlashcardDeckSpec } from "@/types/study";

interface FlashcardDeckProps {
  deck: FlashcardDeckSpec;
}

function shuffleCards<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardDeck({ deck }: FlashcardDeckProps) {
  const [order, setOrder] = useState(() => deck.cards.map((_, i) => i));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = deck.cards[order[index]];
  const total = order.length;

  const reshuffle = useCallback(() => {
    setOrder(shuffleCards(deck.cards.map((_, i) => i)));
    setIndex(0);
    setFlipped(false);
  }, [deck.cards]);

  const go = useCallback(
    (delta: number) => {
      setFlipped(false);
      setIndex((i) => (i + delta + total) % total);
    },
    [total]
  );

  const progress = useMemo(
    () => `${index + 1} / ${total}`,
    [index, total]
  );

  if (!card) return null;

  return (
    <div className="study-deck my-4 rounded-xl border border-theme bg-surface-muted/40 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{deck.title}</h3>
        <span className="text-xs text-muted">{progress}</span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flashcard-face group relative mx-auto flex min-h-[200px] w-full max-w-xl flex-col items-center justify-center rounded-xl border border-theme bg-[#1a1d26] px-6 py-8 text-center transition hover:border-indigo-500/40"
      >
        <span className="mb-2 text-[10px] uppercase tracking-widest text-muted">
          {flipped ? "Answer" : "Question"} · tap to flip
        </span>
        <p className="text-base leading-relaxed text-primary">
          {flipped ? card.back : card.front}
        </p>
      </button>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          className="inline-flex items-center justify-center rounded-lg border border-theme bg-surface-muted px-2.5 py-2 text-muted transition hover:bg-surface-hover hover:text-primary"
          title="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="inline-flex items-center justify-center rounded-lg border border-theme bg-surface-muted px-4 py-2 text-xs text-muted transition hover:bg-surface-hover hover:text-primary"
        >
          Flip
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="inline-flex items-center justify-center rounded-lg border border-theme bg-surface-muted px-2.5 py-2 text-muted transition hover:bg-surface-hover hover:text-primary"
          title="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={reshuffle}
          className="inline-flex items-center justify-center rounded-lg border border-theme bg-surface-muted px-2.5 py-2 text-muted transition hover:bg-surface-hover hover:text-primary"
          title="Shuffle"
        >
          <Shuffle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setFlipped(false);
          }}
          className="inline-flex items-center justify-center rounded-lg border border-theme bg-surface-muted px-2.5 py-2 text-muted transition hover:bg-surface-hover hover:text-primary"
          title="Restart"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FlashcardDeckPending() {
  return (
    <div className="study-deck my-4 flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-theme bg-surface-muted/60">
      <p className="text-sm text-muted">Building flashcard deck…</p>
    </div>
  );
}
