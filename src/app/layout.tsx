import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "@/components/providers";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Realtime Encrypted Chat App | Secure 1-on-1 Messaging",
  description:
    "Secure realtime chat application with end-to-end encryption. Chat privately with a single user using unique room IDs. Fast, private, and impossible for anyone else to join or read your messages.",
  icons: {
    icon: "/favicon.png",
  },
  keywords: [
    "realtime chat",
    "encrypted chat app",
    "secure messaging",
    "private chat",
    "end-to-end encryption",
    "1-on-1 chat",
    "secure communication",
    "private messaging app",
    "encrypted communication",
  ],
  openGraph: {
    title: "Realtime Encrypted Chat App",
    description:
      "The world's most secure realtime chat app with end-to-end encryption and private room-based messaging.",
    url: "https://chat.subhodeep.tech",
    siteName: "Realtime Chat App",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Realtime Encrypted Chat App",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Realtime Encrypted Chat App",
    description:
      "Private, secure, realtime encrypted chat. Only two people can chat — no one else can join.",
    images: ["/favicon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
