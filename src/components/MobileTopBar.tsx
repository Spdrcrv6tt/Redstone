"use client";

import { Menu, SquarePen } from "lucide-react";
import { RedstoneLogo } from "@/components/RedstoneLogo";

interface MobileTopBarProps {
  onOpenMenu: () => void;
  onNewChat: () => void;
}

export function MobileTopBar({ onOpenMenu, onNewChat }: MobileTopBarProps) {
  const iconBtn =
    "w-11 h-11 rounded-full flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-hover active:scale-95 transition-all";

  return (
    <header className="mobile-top-bar md:hidden flex items-center justify-between px-3 safe-top flex-shrink-0">
      <button
        type="button"
        onClick={onOpenMenu}
        className={iconBtn}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" strokeWidth={1.75} />
      </button>

      <RedstoneLogo variant="mark" size={28} />

      <button
        type="button"
        onClick={onNewChat}
        className={iconBtn}
        aria-label="New chat"
      >
        <SquarePen className="w-5 h-5" strokeWidth={1.75} />
      </button>
    </header>
  );
}
