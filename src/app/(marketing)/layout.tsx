import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LANDING_FAQ_ITEMS } from "@/content/landing-faq";

const SITE_URL = "https://noface.video";
const META_TITLE = "Create Faceless Viral Videos | noface.video";
const META_DESCRIPTION =
  "Create faceless videos that go viral on TikTok, YouTube Shorts & Instagram. No camera needed. Start free today.";
const OG_IMAGE_PATH = "/opengraph-image";

const softwareApplicationLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "noface.video",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  description: META_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

const faqPageLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/`,
    siteName: "noface.video",
    title: META_TITLE,
    description: META_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "noface.video — create faceless viral videos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: META_TITLE,
    description: META_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqPageLd),
        }}
      />
      {children}
    </>
  );
}
