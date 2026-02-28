import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.novamax.ly"),
  title: {
    default: "Nova Max | لوحة دخول المندوبين والمتاجر",
    template: "%s | Nova Max",
  },
  description: "بوابة الدخول الرسمية للمندوبين والمتاجر في منظومة Nova Max.",
  applicationName: "Nova Max",
  keywords: ['Nova Max', 'Nova', 'لوحة دخول المندوبين والمتاجر', 'Delivery', 'Logistics'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Nova Max | لوحة دخول المندوبين والمتاجر",
    description: "بوابة الدخول الرسمية للمندوبين والمتاجر في منظومة Nova Max.",
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
    title: "Nova Max | لوحة دخول المندوبين والمتاجر",
    description: "بوابة الدخول الرسمية للمندوبين والمتاجر في منظومة Nova Max.",
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
