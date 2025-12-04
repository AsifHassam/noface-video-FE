import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Bebas_Neue, Montserrat, Poppins, Roboto } from "next/font/google";
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

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
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
        className={`${inter.variable} ${jetBrains.variable} ${bebasNeue.variable} ${montserrat.variable} ${poppins.variable} ${roboto.variable} min-h-screen bg-gradient-to-br from-background via-background/70 to-muted antialiased`}
        style={{ 
          '--font-impact': 'Impact, "Arial Black", Arial, sans-serif',
          '--font-futura': 'Futura, "Futura-Medium", "Futura Medium", "Trebuchet MS", Arial, sans-serif',
        } as React.CSSProperties}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
