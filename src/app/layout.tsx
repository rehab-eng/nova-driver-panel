import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nova Max | لوحة المندوب",
    template: "%s | Nova Max",
  },
  description: "لوحة تشغيل المندوبين لمنظومة Nova Max اللوجستية.",
  applicationName: "Nova Max",
  keywords: ["Nova Max", "Nova", "لوحة المندوب", "التوصيل", "لوجستيات"],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Nova Max | لوحة المندوب",
    description: "لوحة تشغيل المندوبين لمنظومة Nova Max اللوجستية.",
    type: "website",
    locale: "ar_LY",
  },
  twitter: {
    card: "summary",
    title: "Nova Max | لوحة المندوب",
    description: "لوحة تشغيل المندوبين لمنظومة Nova Max اللوجستية.",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
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
