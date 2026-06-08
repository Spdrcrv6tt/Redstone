"use client";

import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { SettingsModal } from "@/components/SettingsModal";
import { StoreHydrator } from "@/components/StoreHydrator";
import { FirstRunGate } from "@/components/FirstRunGate";

export default function Home() {
  return (
    <>
      <StoreHydrator />
      <FirstRunGate />
      <div className="flex h-full bg-zinc-950">
        <Sidebar />
        <ChatView />
        <SettingsModal />
      </div>
    </>
  );
}
