import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Bebas_Neue, Montserrat, Poppins, Roboto, Nunito_Sans, Oswald } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/app/providers";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";

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

const nunitoSans = Nunito_Sans({
  variable: "--font-futura",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const oswald = Oswald({
  variable: "--font-impact",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://noface.video"),
  title: {
    default: "Create Faceless Viral Videos | noface.video",
    template: "%s",
  },
  description:
    "Create faceless videos that go viral on TikTok, YouTube Shorts & Instagram. No camera needed. Start free today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetBrains.variable} ${bebasNeue.variable} ${montserrat.variable} ${poppins.variable} ${roboto.variable} ${nunitoSans.variable} ${oswald.variable} min-h-screen bg-gradient-to-br from-background via-background/70 to-muted antialiased`}
        style={{ 
          '--font-zy-resolve': '"ZY Resolve", "Arial Black", Arial, sans-serif',
        } as React.CSSProperties}
      >
        <GoogleAnalytics />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
