import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import "../lib/envCheck"; //validation des variables d'environnement au démarrage

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://admin.kro-no-delivery.com");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Krono Admin Console",
  description: "Console d'administration Krono Livraison",
  manifest: "/site.webmanifest",
  themeColor: "#0F172A",
  appleWebApp: {
    capable: true,
    title: "Krono Admin Console",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
      { url: "/assets/chrono.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Krono Admin Console",
    description: "Console d'administration Krono Livraison",
    images: [{ url: "/assets/chrono.png", alt: "Krono" }],
  },
  twitter: {
    card: "summary",
    title: "Krono Admin Console",
    images: ["/assets/chrono.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
