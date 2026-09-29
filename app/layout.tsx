import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Автобусы у школы № 508",
  description: "Ближайшие автобусы на двух остановках у школы № 508.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Автобусы" },
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
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
