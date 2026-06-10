"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ImageUp, Camera, Presentation } from "lucide-react";

interface ComposerAttachMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onUploadImage: () => void;
  onTakePhoto: () => void;
  onSelectCanvas?: () => void;
  showCanvasOption?: boolean;
  disabled?: boolean;
}

export function ComposerAttachMenu({
  open,
  onOpenChange,
  anchorRef,
  onUploadImage,
  onTakePhoto,
  onSelectCanvas,
  showCanvasOption = false,
  disabled,
}: ComposerAttachMenuProps) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 240, above: false });

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 248;
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12
    );
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const above = spaceBelow < 200 && spaceAbove > spaceBelow;
    const top = above ? rect.top - 8 : rect.bottom + 8;
    setPos({ top, left, width, above });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const onClick = (e: MouseEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return;
      const portal = document.getElementById("composer-attach-portal");
      if (portal?.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open, anchorRef, onOpenChange]);

  const menuItem = (
    label: string,
    icon: ReactNode,
    onClick: () => void,
    active?: boolean
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-left text-sm transition-colors",
        active
          ? "bg-accent-muted text-primary font-medium"
          : "text-primary hover:bg-surface-hover",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span className="text-secondary flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {active ? (
        <Check
          className="w-4 h-4 flex-shrink-0"
          style={{ color: "var(--accent)" }}
        />
      ) : null}
    </button>
  );

  const dropdown =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            id="composer-attach-portal"
            className="fixed z-[200] rounded-2xl bg-surface border border-theme shadow-[0_12px_40px_rgba(0,0,0,0.15)] overflow-hidden py-1.5"
            style={{
              width: pos.width,
              left: pos.left,
              ...(pos.above
                ? { bottom: window.innerHeight - pos.top }
                : { top: pos.top }),
            }}
            initial={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos.above ? 8 : -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            {menuItem(
              "Upload image",
              <ImageUp className="w-4 h-4" strokeWidth={1.75} />,
              () => {
                onOpenChange(false);
                onUploadImage();
              }
            )}
            {menuItem(
              "Take a photo",
              <Camera className="w-4 h-4" strokeWidth={1.75} />,
              () => {
                onOpenChange(false);
                onTakePhoto();
              }
            )}

            {showCanvasOption && onSelectCanvas ? (
              <>
                <div className="my-1.5 mx-3 border-t border-theme" />
                <p className="px-4 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
                  Workspace
                </p>
                {menuItem(
                  "Canvas",
                  <Presentation className="w-4 h-4" strokeWidth={1.75} />,
                  () => {
                    onOpenChange(false);
                    onSelectCanvas();
                  }
                )}
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    );

  return dropdown;
}
