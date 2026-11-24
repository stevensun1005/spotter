import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "训练搭子 · Spotter",
  description: "两个人的训练计划、逐组记录与健身打卡。",
  appleWebApp: { title: "训练搭子", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
