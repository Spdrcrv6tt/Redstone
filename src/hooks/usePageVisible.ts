"use client";

import { useEffect, useState } from "react";

/** True when the tab is visible and motion is allowed. */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => {
      const hidden = document.visibilityState !== "visible";
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setVisible(!hidden && !reduced);
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", sync);

    return () => {
      document.removeEventListener("visibilitychange", sync);
      mq.removeEventListener("change", sync);
    };
  }, []);

  return visible;
}
