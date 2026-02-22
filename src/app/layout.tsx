import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "لوحة السائق - نوفا ماكس",
  description: "تتبع الطلبات للسائقين في منصة نوفا ماكس",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
