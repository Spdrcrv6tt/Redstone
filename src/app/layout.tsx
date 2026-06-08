import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redstone — Local AI Chat",
  description: "A modern frontend for your locally hosted Ollama LLM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
