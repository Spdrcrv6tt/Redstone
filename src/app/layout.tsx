import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redstone",
  description: "A modern frontend for your locally hosted Ollama LLM",
  icons: {
    icon: "/brand/mark.svg",
    apple: "/brand/mark.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" className={`${GeistSans.variable} h-full`}>
      <body className={`${GeistSans.className} h-full antialiased`}>
        {children}
      </body>
    </html>
  );
}
