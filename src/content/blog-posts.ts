import { BRAND_DEALS_TIKTOK_INSTAGRAM_BODY } from "@/content/post-body-brand-deals-tiktok-instagram";
import { FACELESS_YOUTUBE_2026_BODY } from "@/content/post-body-faceless-youtube-2026";

export type BlogFaqItem = {
  question: string;
  answer: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  author: string;
  bodyMarkdown: string;
  /** Hero image URL (Supabase Storage or external) */
  heroImageUrl?: string | null;
  /** Dedicated meta description (differs from excerpt when set) */
  metaDescription?: string;
  /** When set, used for document title and og:title; article H1 still uses `title` */
  metaTitle?: string;
  faqItems?: BlogFaqItem[];
  /** Higher = newer when `date` ties; used for blog index order */
  sortOrder?: number;
};

const TECHNERD_POST: BlogPost = {
  slug: "how-technerd-stewie-got-53800-followers-without-showing-his-face",
  title:
    "How technerd_stewie Got 53,800 Instagram Followers Without Ever Showing His Face",
  subtitle: "And how you can replicate this strategy with AI video tools",
  excerpt:
    "53,800 followers. 136 posts. Zero face cam. Here's the exact strategy behind one of Instagram's fastest growing faceless tech accounts — and how to replicate it.",
  date: "2026-04-05",
  author: "noface.video team",
  sortOrder: 1,
  bodyMarkdown: `When most people think about building a social media following, they assume you need a ring light, a camera, and the confidence to put yourself on screen. technerd_stewie proves otherwise. With 136 posts and 53,800 followers, this faceless Instagram account has built a massive audience in the AI and tech education niche — and the creator's face has never appeared once.

Here's exactly how they did it, and how you can replicate the strategy.

## The Niche: Riding the AI Wave

technerd_stewie picked one of the fastest growing content categories on the internet right now — AI tools and tech education. Every post answers a specific question people are already searching for: "7 Free AI Tools by Google", "Free AI for High Quality 3D Models", "Build N8N Workflows with 1 Prompt". These are not random topics. They are search-driven titles that function as SEO for social media.

## The Visual Identity: Consistency Over Originality

Rather than showing a face, the account built a recognisable character — a Stewie Griffin-inspired AI mascot in sunglasses. Every thumbnail uses the same character, the same bold text format, and the same colour palette. Viewers know it's technerd_stewie before they even read the handle. This consistency is what drives follows — people subscribe to a visual identity, not just a video.

## The Format: Short, Specific, Valuable

Every post follows the same structure: bold topic title on the thumbnail, short video delivering exactly what the title promised, no fluff. The account doesn't try to be entertaining — it tries to be useful. In the AI niche, usefulness is the hook.

## The Results

- 53,800 followers from 136 posts — roughly 396 followers per post on average
- Consistent engagement across the AI tools, tech news, and tutorial categories
- Brand partnership inquiries (promotion email listed in bio)
- Built entirely without showing a face, hiring talent, or expensive production

## How noface.video Helps You Do This

Replicating the technerd_stewie model used to require design skills, video editing software, and hours of production time per post. noface.video compresses that entire workflow into minutes. You choose your topic, add your script, and export a polished faceless video with voiceover, captions, and broll — ready to post on Instagram Reels, TikTok, or YouTube Shorts.

The strategy is proven. The tools are ready. The only thing missing is your first post.

[Start creating faceless videos free at noface.video →](/app)`,
};

const FACELESS_YOUTUBE_2026_POST: BlogPost = {
  slug: "how-to-start-a-faceless-youtube-channel-2026",
  title:
    "How to Start a Faceless YouTube Channel in 2026 (And Actually Make Money)",
  excerpt:
    "No camera. No followers. No experience. Here's the complete step-by-step guide to launching a profitable faceless YouTube channel in 2026 — including the best niches, formats, and tools.",
  date: "2026-04-05",
  author: "noface.video team",
  sortOrder: 2,
  metaDescription:
    "No camera required. Learn how to start a faceless YouTube channel in 2026, pick the right niche, make your first video, and earn money — complete beginner's guide.",
  faqItems: [
    {
      question: "Can you make money on YouTube without showing your face?",
      answer:
        "Yes. Thousands of creators earn full-time income from faceless YouTube channels through AdSense, brand sponsorships, and affiliate marketing. Channels in high-CPM niches like finance and AI tools earn between $15 and $45 per thousand views.",
    },
    {
      question: "What is the best niche for a faceless YouTube channel?",
      answer:
        "Finance and investing, AI tools and tech news, and motivational content are the three highest-earning faceless niches in 2026. They combine high advertiser CPM with evergreen search demand.",
    },
    {
      question: "How long does it take to grow a faceless YouTube channel?",
      answer:
        "Most creators reach YouTube's monetisation threshold of 1,000 subscribers and 4,000 watch hours within 3 to 6 months of consistent posting. Growth depends heavily on niche selection, hook quality, and posting frequency.",
    },
  ],
  bodyMarkdown: FACELESS_YOUTUBE_2026_BODY,
};

const BRAND_DEALS_TIKTOK_INSTAGRAM_POST: BlogPost = {
  slug: "how-faceless-creators-land-brand-deals-tiktok-instagram",
  title:
    "How Faceless Creators Land Brand Deals on TikTok and Instagram in 2026",
  metaTitle:
    "How Faceless Creators Land Brand Deals on TikTok and Instagram",
  excerpt:
    "No face required. Here's exactly how anonymous creators are securing paid brand collaborations on TikTok and Instagram — what brands pay, what they want, and how to get your first deal without a big following.",
  date: "2026-04-06",
  author: "noface.video team",
  sortOrder: 3,
  metaDescription:
    "Learn how faceless TikTok and Instagram creators land paid brand collaborations in 2026 — with real rates, pitch templates, and a step-by-step guide to your first deal.",
  faqItems: [
    {
      question: "Can faceless creators get brand deals?",
      answer:
        "Yes. Brands increasingly partner with faceless creators because the content keeps the focus on the product rather than the presenter. Faceless accounts with as few as 5,000 engaged followers in a defined niche regularly secure paid brand collaborations on TikTok and Instagram.",
    },
    {
      question: "How much do faceless TikTok creators earn from brand deals?",
      answer:
        "Faceless TikTok creators with 10,000–50,000 followers typically earn $200–$1,000 per sponsored post. Rates increase with follower count and niche — finance and tech creators consistently command higher rates due to their premium advertiser audiences.",
    },
    {
      question: "How do I get my first brand deal as a faceless creator?",
      answer:
        "Build a one-page media kit showing your niche, average views, and engagement rate. Search for brands already sponsoring creators in your niche, then pitch them directly via email. Creating an unsolicited demo video for a product you use and tagging the brand is one of the fastest ways to open a paid partnership conversation.",
    },
  ],
  bodyMarkdown: BRAND_DEALS_TIKTOK_INSTAGRAM_BODY,
};

/** Bundled fallback when DB is empty or service role is not configured */
export const STATIC_BLOG_POSTS: BlogPost[] = [
  BRAND_DEALS_TIKTOK_INSTAGRAM_POST,
  FACELESS_YOUTUBE_2026_POST,
  TECHNERD_POST,
];
