import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://minevine.app";

export const metadata: Metadata = {
  title: {
    default: "Minevine | Safe Audio Chat for Kids Gaming",
    template: "%s | Minevine"
  },
  description: "Minevine is a fun, safe, and easy-to-use audio chat app designed specifically for kids playing games like Minecraft and Roblox. Create a room and invite friends!",
  keywords: ["Minevine", "kids audio chat", "safe voice chat", "gaming voice chat", "family friendly chat", "Minecraft chat", "Roblox voice chat", "kid safe gaming", "voice changer"],
  authors: [{ name: "Minevine" }],
  creator: "Minevine",
  publisher: "Minevine",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Minevine | Safe Audio Chat for Kids Gaming",
    description: "Fun, safe, and easy-to-use audio chat for kids playing games. Create a room, share the code, and start chatting with fun voice effects!",
    url: siteUrl,
    siteName: "Minevine",
    images: [
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Minevine Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Minevine | Safe Audio Chat for Kids Gaming",
    description: "Fun, safe, and easy-to-use audio chat for kids playing games. Create a room, share the code, and start chatting!",
    images: ["/icon-512.png"],
    creator: "@minevine",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Minevine",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full min-h-[100dvh] flex flex-col overscroll-none">{children}</body>
    </html>
  );
}
