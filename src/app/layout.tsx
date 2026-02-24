import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nova Max Driver",
  description: "Driver operations for Nova Max Logistics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
