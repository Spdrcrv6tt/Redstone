import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redstone",
  description: "A modern frontend for your locally hosted Ollama LLM",
  icons: {
    icon: "/brand/mark.svg",
    apple: "/brand/mark.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Redstone",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eef6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
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
