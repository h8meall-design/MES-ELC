import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MES ЭлектроРемонт",
  description: "Система управления ремонтом электродвигателей",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}