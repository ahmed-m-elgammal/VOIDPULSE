import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VOIDPULSE v1.0 — Season One",
  description:
    "A neon roguelite arena survival shooter with a full season: 30-tier VOIDPASS battle pass (free + Prime), Black Market cosmetics and boosters, season contracts, 12 enemy species and 4 bosses. Build your arsenal, ride the heat, dash through the swarm.",
  keywords: ["VOIDPULSE", "roguelite", "battle pass", "arcade shooter", "browser game", "survival"],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#04060d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-[#04060d] text-white overflow-hidden">
        {children}
      </body>
    </html>
  );
}
