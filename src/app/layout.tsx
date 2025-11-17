import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/app/providers";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "noface.video - Create Faceless Viral Videos That Get Millions of Views",
  description:
    "Create faceless viral videos for TikTok, Shorts, and Instagram. Attract brand collaborations and grow your audience with the #1 platform for faceless video content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetBrains.variable} min-h-screen bg-gradient-to-br from-background via-background/70 to-muted antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
