"use client";

import { createContext, useContext } from "react";

export const CanvasWorkspaceContext = createContext<{ conversationId: string }>({
  conversationId: "",
});

export function useCanvasWorkspace() {
  return useContext(CanvasWorkspaceContext);
}
