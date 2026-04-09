import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { FaviconClient } from "@/components/FaviconClient";
import config from "@/lib/config";
import { getSiteUrl } from "@/lib/siteUrl";
import "../lib/envCheck"; //validation des variables d'environnement au démarrage

const iconUrl = config.app.iconUrl;
const appName = config.app.name;
const appDescription = config.app.description;
const siteUrl = getSiteUrl();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: appName,
    template: "%s | Krono Admin",
  },
  description: appDescription,
  manifest: "/site.webmanifest",
  themeColor: "#0F172A",
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: iconUrl, type: "image/png", sizes: "512x512" }],
    shortcut: iconUrl,
    apple: iconUrl,
  },
  openGraph: {
    title: appName,
    description: appDescription,
    images: [{ url: iconUrl, alt: appName }],
  },
  twitter: {
    card: "summary",
    title: appName,
    description: appDescription,
    images: [iconUrl],
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
        <FaviconClient />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
