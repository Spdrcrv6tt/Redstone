"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Code2, Trash2 } from "lucide-react";

interface CanvasCardContextMenuProps {
  x: number;
  y: number;
  onDelete: () => void;
  onViewJson: () => void;
  onClose: () => void;
}

export function CanvasCardContextMenu({
  x,
  y,
  onDelete,
  onViewJson,
  onClose,
}: CanvasCardContextMenuProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = () => onClose();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="canvas-card-menu"
      style={{ top: y, left: x }}
      onMouseDown={(e) => e.stopPropagation()}
      role="menu"
    >
      <button type="button" className="canvas-card-menu-item" onClick={onViewJson}>
        <Code2 className="w-4 h-4" strokeWidth={1.75} />
        View JSON
      </button>
      <button
        type="button"
        className="canvas-card-menu-item canvas-card-menu-item--danger"
        onClick={onDelete}
      >
        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
        Delete
      </button>
    </div>,
    document.body
  );
}
