import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.novamax.ly"),
  title: {
    default: "Nova Max | لوحة تحكم المندوب",
    template: "%s | Nova Max",
  },
  description: "لوحة تحكم المندوبين لمنظومة Nova Max اللوجستية.",
  applicationName: "Nova Max",
  keywords: ['Nova Max', 'Nova', 'لوحة تحكم المندوب', 'Delivery', 'Logistics'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Nova Max | لوحة تحكم المندوب",
    description: "لوحة تحكم المندوبين لمنظومة Nova Max اللوجستية.",
    type: "website",
    locale: "ar_LY",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Nova Max",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nova Max | لوحة تحكم المندوب",
    description: "لوحة تحكم المندوبين لمنظومة Nova Max اللوجستية.",
    images: ["/logo.png"],
  },
  manifest: "/manifest.webmanifest",
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
