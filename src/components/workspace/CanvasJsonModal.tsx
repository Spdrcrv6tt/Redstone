"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface CanvasJsonModalProps {
  title: string;
  payload: unknown;
  onClose: () => void;
}

export function CanvasJsonModal({
  title,
  payload,
  onClose,
}: CanvasJsonModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="canvas-json-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="canvas-json-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="canvas-json-title"
      >
        <div className="canvas-json-modal-header">
          <h2 id="canvas-json-title" className="canvas-json-modal-title">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="canvas-json-modal-close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <pre className="canvas-json-modal-body">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>,
    document.body
  );
}
