"use client";

import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { SettingsModal } from "@/components/SettingsModal";

export default function Home() {
  return (
    <div className="flex h-full bg-zinc-950">
      <Sidebar />
      <ChatView />
      <SettingsModal />
    </div>
  );
}
