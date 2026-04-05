"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  Video,
  Instagram,
  Briefcase,
  Target,
  CheckCircle2,
  ArrowRight,
  Play,
  Star,
  Rocket,
  Crown,
  Menu,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SignInCard } from "@/components/auth/sign-in-card";
import { cn } from "@/lib/utils";
import { useState, type VideoHTMLAttributes } from "react";
import { LANDING_FAQ_ITEMS } from "@/content/landing-faq";

const CASE_STUDIES = {
  saas: {
    company: "ExamPaperGPT",
    result: "300% increase in signups",
    description:
      "Building a SaaS is easy, but marketing it is the hard part. ExamPaperGPT discovered that faceless videos were the perfect solution. They used noface.video to create compelling explainer videos showcasing how their AI-powered platform helps students create mock exam papers for exam prep. The videos demonstrated key features without needing on-camera talent, making production fast and cost-effective.",
    results: [
      "Generated 100K+ views across social platforms",
      "Converted 50+ new users in just 1 month",
      "Achieved 300% increase in signups",
    ],
    videoUrl: "https://www.tiktok.com/@exampapergpt/video/7541368677091003656",
    videoId: "7541368677091003656",
    isTikTok: true,
    gradient: "from-blue-500 to-cyan-500",
  },
  viral: {
    company: "Asif's Content",
    result: "30K views in first week",
    description:
      "Asif started from zero followers and used noface.video to create viral faceless content on TikTok and Instagram. His very first video using noface.video got 30K views in just 1 week, instantly growing his account to 500+ followers. His consistent posting strategy and engaging video templates helped him build a massive following quickly.",
    results: [
      "First video got 30K views in 1 week",
      "Gained 500+ followers in the first week",
    ],
    videoUrl: "https://www.tiktok.com/@exampapergpt/video/7541106758257855752",
    videoId: "7541106758257855752",
    isTikTok: true,
    gradient: "from-pink-500 to-rose-500",
  },
  brand: {
    company: "Keep the brand deals coming..",
    result: "Brands reaching out organically",
    description:
      "Build a viral faceless video presence using noface.video. By consistently growing her social accounts with engaging faceless content, brands started reaching out to you. Your engaging content caught the attention of major and minor brands, leading to your first sponsorship deal within 6 months of starting.",
    results: [
      "Grew social accounts with faceless videos",
      "Brands started reaching out organically",
    ],
    videoUrl: "https://www.instagram.com/reel/DQ8nxyQAvfv/",
    reelId: "DQ8nxyQAvfv",
    isInstagram: true,
    gradient: "from-yellow-500 to-orange-500",
  },
};

const PRICING_PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started with faceless video creation",
    features: [
      "5 Free videos",
      "720p video quality",
      "Watermark on exports",
    ],
    cta: "Get Started Free",
    popular: false,
    gradient: "from-gray-500 to-gray-600",
  },
  {
    id: "pro",
    name: "Pro Plan",
    price: "$29",
    period: "per month",
    description: "Best for individual creators & TikTok pages",
    features: [
      "250 credits per month",
      "~40 story narration videos",
      "~20 2-character videos",
      "Premium templates library",
      "All subtitle styles & animations",
      "4K video quality",
      "No watermark",
      "Priority support",
    ],
    cta: "Best for getting started",
    popular: true,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    id: "premium",
    name: "Premium Plan",
    price: "$60",
    period: "per month",
    description: "Best for daily posting & multiple accounts",
    features: [
      "600 credits per month",
      "24 AI UGC videos",
      "~100 story narration videos",
      "~45 2-character videos",
      "Premium templates library",
      "All subtitle styles & animations",
      "4K video quality",
      "No watermark",
      "Priority support",
    ],
    cta: "Start Premium",
    popular: false,
    gradient: "from-yellow-500 to-orange-500",
  },
];

/** One caption per unique clip (carousel repeats URLs; index uses modulo). */
const LANDING_VIDEO_CAROUSEL_CAPTIONS = [
  "Faceless short-form sample with bold captions and pacing suited for TikTok and Reels.",
  "Vertical video example showing narration-driven storytelling without an on-camera host.",
  "Educational style clip with b-roll and subtitles typical of viral explainers.",
  "Another faceless vertical preview highlighting hook and retention-focused editing.",
  "Instagram Reels style sample with dynamic framing and text overlays.",
  "Tech explainer clip with visuals and voiceover—no face required.",
  "Motivation or lifestyle style vertical formatted for algorithm-friendly watch time.",
  "Story-driven faceless edit demonstrating template-based layout and timing.",
  "Fast-cut vertical preview optimized for Shorts and in-feed discovery.",
];

const CAROUSEL_VIDEO_URLS = [
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/SnapTik.Cx_1769327353.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/a88e28e7-2c7a-4e31-87a4-b1c4e71c591c.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/Check%20out%20the%20incredible%20work%20of%20Bohlale%20Mphahlele!%20This%20young%20inventor%20is%20revolutionizing%20safet.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/a49d79ac-1aac-46c7-b9c8-0087254e6b08.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/SnapInsta.to_AQP2in0u-jcD43wusT7bKR1sSZ0ZW0oHVJkBkiWwpP35xP3aZot4nGL5HDqDBfgkSWC3O0N6vo6q080FEkP1Ma9Y.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/compiler-vs-intepreter-broll.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/SnapInsta.to_AQPWx9yTSLn4v2C-GRyTZvuenYwuYgg06TSvnINaFJszuxLNLBobtw4FeZBMi-56FTu8AeYWlfW1_2ywuVGsFg8R.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/a7a07848-b9dc-4b3d-a986-f7fff3c0f46e.mp4",
  "https://khjcirljcxmrzrrosssx.supabase.co/storage/v1/object/public/videos/landing-page/SnapTik.Cx_1769327304.mp4",
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    content:
      "I went from 0 to 2M followers in 3 months using noface.video. The templates are gold!",
    rating: 5,
  },
  {
    name: "Marcus Johnson",
    role: "SaaS Founder",
    content:
      "Our app signups increased 300% after we started using faceless videos for marketing. Game changer!",
    rating: 5,
  },
  {
    name: "Emma Rodriguez",
    role: "Influencer",
    content:
      "Got my first brand deal worth $10K after one viral video. This platform is incredible.",
    rating: 5,
  },
];


export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);

  return (
    <div className="relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/70 to-muted" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.15),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.1),_transparent_50%)]" />

      {/* Header with Logo and Navbar */}
      <header className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6 pt-3 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <Link href="/" className="flex items-center gap-2">
            <div className="text-lg sm:text-2xl font-bold text-foreground">
              noface.video
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <Link
              href="#case-studies"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Case Studies
            </Link>
            <Link
              href="/blog"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Blog
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#testimonials"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Testimonials
            </Link>
            <Link
              href="/privacy"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <a
              href="https://calendly.com/asifhassam14/booking"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Calendar className="h-4 w-4" />
              Free training
            </a>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <a
                href="https://calendly.com/asifhassam14/booking"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                Book a demo
              </a>
            </Button>
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => setSignInDialogOpen(true)}
            >
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </nav>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <nav className="flex flex-col gap-6 mt-8">
                <Link
                  href="#case-studies"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-foreground hover:text-primary transition-colors"
                >
                  Case Studies
                </Link>
                <Link
                  href="/blog"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-foreground hover:text-primary transition-colors"
                >
                  Blog
                </Link>
                <Link
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-foreground hover:text-primary transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="#testimonials"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-foreground hover:text-primary transition-colors"
                >
                  Testimonials
                </Link>
                <Link
                  href="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-base font-medium text-foreground hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
                <a
                  href="https://calendly.com/asifhassam14/booking"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Calendar className="h-4 w-4" />
                  Free training
                </a>
                <Button
                  variant="outline"
                  className="rounded-full w-full justify-center"
                  asChild
                >
                  <a
                    href="https://calendly.com/asifhassam14/booking"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Calendar className="h-4 w-4" />
                    Book a demo
                  </a>
                </Button>
                <Button
                  className="rounded-full mt-2 w-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSignInDialogOpen(true);
                  }}
                >
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </motion.div>
      </header>

      <main className="relative">
        {/* Hero Section */}
        <section className="relative mx-auto flex min-h-[60vh] sm:min-h-[70vh] max-w-7xl flex-col items-center justify-center gap-3 sm:gap-6 px-3 sm:px-6 pt-4 sm:pt-12 pb-3 sm:pb-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-3 sm:space-y-6 w-full"
          >
            <Badge className="w-fit rounded-full bg-primary/15 px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-primary mx-auto">
              <Rocket className="mr-1.5 sm:mr-2 h-3 w-3" />
              Create Viral Videos in Minutes
            </Badge>
            <h1 className="text-2xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl xl:text-7xl px-2">
              Create Faceless Viral Videos
              <br />
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                That Get Millions of Views
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-sm sm:text-xl text-muted-foreground lg:text-2xl px-3">
              The #1 platform for creating faceless videos that go viral on TikTok,
              Shorts, and Instagram—built so any faceless video creator can ship
              fast. Attract brand collaborations and grow your audience—no face
              required. If you want a reliable faceless video creator workflow from
              script to export, you are in the right place.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row px-3">
              <Button
                size="lg"
                className="h-11 sm:h-14 rounded-2xl px-5 sm:px-8 text-sm sm:text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 w-full sm:w-auto"
                onClick={() => setSignInDialogOpen(true)}
              >
                Sign in
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 sm:h-14 rounded-2xl px-5 sm:px-8 text-sm sm:text-lg font-semibold border-2 w-full sm:w-auto"
                asChild
              >
                <a
                  href="https://calendly.com/asifhassam14/booking"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                  Book a demo
                </a>
              </Button>
              {/* <Button
                asChild
                variant="outline"
                size="lg"
                className="h-11 sm:h-14 rounded-2xl px-5 sm:px-8 text-sm sm:text-lg font-semibold border-2 w-full sm:w-auto"
              >
                <Link href="#demo">
                  <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Watch Demo
                </Link>
              </Button> */}
            </div>
          </motion.div>
        </section>

        {/* Video Carousel Section */}
        <section className="relative w-full py-6 sm:py-12 overflow-hidden">
          <div className="flex gap-3 sm:gap-6 animate-video-carousel">
            {[...CAROUSEL_VIDEO_URLS, ...CAROUSEL_VIDEO_URLS].map((videoUrl, i) => {
              const cap =
                LANDING_VIDEO_CAROUSEL_CAPTIONS[
                  i % LANDING_VIDEO_CAROUSEL_CAPTIONS.length
                ];
              return (
                <div
                  key={i}
                  className="flex-shrink-0 w-[140px] sm:w-[224px] md:w-[256px]"
                >
                  <figure className="m-0">
                    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 shadow-lg">
                      <video
                        className="h-full w-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="none"
                        aria-label={cap}
                        {...({ loading: "lazy" } as VideoHTMLAttributes<HTMLVideoElement>)}
                      >
                        <source src={videoUrl} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                    <figcaption className="sr-only">{cap}</figcaption>
                  </figure>
                </div>
              );
            })}
          </div>
        </section>

        {/* How it works — crawlable steps (anchors #features for CTA) */}
        <section
          id="features"
          aria-labelledby="how-it-works-heading"
          className="relative mx-auto max-w-7xl px-3 sm:px-6 pt-2 pb-10 sm:pb-16"
        >
          <h2
            id="how-it-works-heading"
            className="text-center text-2xl sm:text-4xl font-bold text-foreground lg:text-5xl"
          >
            How noface.video Works
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-lg text-muted-foreground px-3">
            From idea to publish in three steps—built for creators who want a
            consistent faceless video creator pipeline without a film crew.
          </p>
          <div className="mt-8 sm:mt-12 grid gap-8 sm:gap-10 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-white/50 p-5 sm:p-6 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                1. Choose Your Template
              </h3>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Pick a layout that matches your niche—story narration, two-character
                dialogue, or short-form hooks. Templates set pacing, typography, and
                safe zones so your exports look native on TikTok, Reels, and Shorts.
                You spend less time fixing composition and more time testing ideas
                that can scale.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white/50 p-5 sm:p-6 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                2. Add Your Script or Topic
              </h3>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Paste a script, bullet points, or a single topic and let the workflow
                guide structure, scene breaks, and captions. Strong faceless content
                usually wins on clarity: a sharp hook, a simple storyline, and
                readable on-screen text. Iterate quickly until the watch time and
                completion rate match your goals.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white/50 p-5 sm:p-6 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg sm:text-xl font-bold text-foreground">
                3. Export and Post
              </h3>
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Render in the right aspect ratio and quality tier for your plan, then
                download and upload to your platforms. Batch similar formats on a
                schedule so the algorithm sees steady activity. Track what performs,
                double down on winning hooks, and keep your pipeline full without
                stepping in front of the camera.
              </p>
            </div>
          </div>
        </section>

        {/* Case Studies Section */}
        <section id="case-studies" className="relative mx-auto max-w-7xl px-3 sm:px-6 pt-6 sm:pt-12 pb-12 sm:pb-24">
          <div className="text-center">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground lg:text-5xl">
              Case Studies
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-lg text-muted-foreground px-3">
              Real results from creators and businesses using noface.video to
              achieve their goals.
            </p>
          </div>
          <div className="mt-8 sm:mt-16">
            <Tabs defaultValue="saas" className="w-full">
              <TabsList className="mx-auto mb-6 sm:mb-12 h-10 sm:h-12 w-fit rounded-full bg-white/70 p-1 shadow-lg flex flex-row gap-0.5 sm:gap-1">
                <TabsTrigger
                  value="saas"
                  className="rounded-full px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Briefcase className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  SaaS
                </TabsTrigger>
                <TabsTrigger
                  value="viral"
                  className="rounded-full px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <TrendingUp className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Viral
                </TabsTrigger>
                <TabsTrigger
                  value="brand"
                  className="rounded-full px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Target className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Brand
                </TabsTrigger>
              </TabsList>

              <TabsContent value="saas" className="mt-6 sm:mt-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="grid gap-4 sm:gap-12 lg:grid-cols-2 lg:items-center"
                >
                  <div className="relative aspect-[9/16] w-full max-w-[240px] sm:max-w-sm overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br shadow-2xl mx-auto lg:mx-0">
                    {CASE_STUDIES.saas.isTikTok ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.tiktok.com/embed/v2/${CASE_STUDIES.saas.videoId}`}
                        frameBorder="0"
                        allow="encrypted-media"
                        allowFullScreen
                        title="Embedded TikTok video: ExamPaperGPT SaaS case study"
                      />
                    ) : (
                      <figure className="relative m-0 h-full w-full">
                        <video
                          className="h-full w-full object-cover"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="none"
                          aria-label="Case study preview for ExamPaperGPT SaaS growth on social platforms"
                          {...({ loading: "lazy" } as VideoHTMLAttributes<HTMLVideoElement>)}
                        >
                          <source src={CASE_STUDIES.saas.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <figcaption className="sr-only">
                          Case study video preview for ExamPaperGPT showing faceless
                          marketing content and results.
                        </figcaption>
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-20 mix-blend-overlay",
                            CASE_STUDIES.saas.gradient,
                          )}
                        />
                      </figure>
                    )}
                  </div>
                  <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                          CASE_STUDIES.saas.gradient,
                        )}
                      >
                        <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-green-50 text-green-700 text-xs sm:text-sm"
                      >
                        {CASE_STUDIES.saas.result}
                      </Badge>
                    </div>
                    <h3 className="text-xl sm:text-3xl font-bold text-foreground">
                      {CASE_STUDIES.saas.company}
                    </h3>
                    <p className="text-sm sm:text-lg text-muted-foreground">
                      {CASE_STUDIES.saas.description}
                    </p>
                    <ul className="space-y-2 sm:space-y-3">
                      {CASE_STUDIES.saas.results.map((result, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-green-500" />
                          <span>{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="viral" className="mt-6 sm:mt-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="grid gap-4 sm:gap-12 lg:grid-cols-2 lg:items-center"
                >
                  <div className="relative aspect-[9/16] w-full max-w-[240px] sm:max-w-sm overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br shadow-2xl mx-auto lg:mx-0">
                    {CASE_STUDIES.viral.isTikTok ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.tiktok.com/embed/v2/${CASE_STUDIES.viral.videoId}`}
                        frameBorder="0"
                        allow="encrypted-media"
                        allowFullScreen
                        title="Embedded TikTok video: viral growth case study"
                      />
                    ) : (
                      <figure className="relative m-0 h-full w-full">
                        <video
                          className="h-full w-full object-cover"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="none"
                          aria-label="Case study preview for viral TikTok and Instagram faceless content"
                          {...({ loading: "lazy" } as VideoHTMLAttributes<HTMLVideoElement>)}
                        >
                          <source src={CASE_STUDIES.viral.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <figcaption className="sr-only">
                          Case study video preview highlighting viral performance in the
                          first week of posting.
                        </figcaption>
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-20 mix-blend-overlay",
                            CASE_STUDIES.viral.gradient,
                          )}
                        />
                      </figure>
                    )}
                  </div>
                  <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                          CASE_STUDIES.viral.gradient,
                        )}
                      >
                        <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-pink-50 text-pink-700 text-xs sm:text-sm"
                      >
                        {CASE_STUDIES.viral.result}
                      </Badge>
                    </div>
                    <h3 className="text-xl sm:text-3xl font-bold text-foreground">
                      {CASE_STUDIES.viral.company}
                    </h3>
                    <p className="text-sm sm:text-lg text-muted-foreground">
                      {CASE_STUDIES.viral.description}
                    </p>
                    <ul className="space-y-2 sm:space-y-3">
                      {CASE_STUDIES.viral.results.map((result, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-green-500" />
                          <span>{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="brand" className="mt-6 sm:mt-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="grid gap-4 sm:gap-12 lg:grid-cols-2 lg:items-center"
                >
                  <div className="relative aspect-[9/16] w-full max-w-[240px] sm:max-w-sm overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br shadow-2xl mx-auto lg:mx-0">
                    {CASE_STUDIES.brand.isInstagram ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.instagram.com/reel/${CASE_STUDIES.brand.reelId}/embed/`}
                        frameBorder="0"
                        allow="encrypted-media"
                        allowFullScreen
                        title="Embedded Instagram Reel: brand and sponsorship case study"
                      />
                    ) : (
                      <figure className="relative m-0 h-full w-full">
                        <video
                          className="h-full w-full object-cover"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="none"
                          aria-label="Case study preview for brand deals and sponsorship growth"
                          {...({ loading: "lazy" } as VideoHTMLAttributes<HTMLVideoElement>)}
                        >
                          <source src={CASE_STUDIES.brand.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <figcaption className="sr-only">
                          Case study video preview for brand outreach and organic
                          sponsorship opportunities.
                        </figcaption>
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-20 mix-blend-overlay",
                            CASE_STUDIES.brand.gradient,
                          )}
                        />
                      </figure>
                    )}
                  </div>
                  <div className="space-y-4 sm:space-y-6 mt-4 sm:mt-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                          CASE_STUDIES.brand.gradient,
                        )}
                      >
                        <Target className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-orange-50 text-orange-700 text-xs sm:text-sm"
                      >
                        {CASE_STUDIES.brand.result}
                      </Badge>
                    </div>
                    <h3 className="text-xl sm:text-3xl font-bold text-foreground">
                      {CASE_STUDIES.brand.company}
                    </h3>
                    <p className="text-sm sm:text-lg text-muted-foreground">
                      {CASE_STUDIES.brand.description}
                    </p>
                    <ul className="space-y-2 sm:space-y-3">
                      {CASE_STUDIES.brand.results.map((result, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 sm:gap-3 text-sm sm:text-base text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-green-500" />
                          <span>{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <div className="relative mx-auto max-w-7xl border-t border-border/40 px-3 py-5 text-center sm:px-6 sm:py-6">
          <Link
            href="/blog"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Learn from the best faceless creators — read our blog
          </Link>
        </div>

        {/* Pricing Section */}
        <section id="pricing" className="relative mx-auto max-w-7xl px-3 sm:px-6 py-12 sm:py-24">
          <div className="text-center">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground lg:text-5xl">
              Pricing
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-lg text-muted-foreground px-3">
              Choose the perfect plan for your video creation needs. Start free
              and upgrade when you&apos;re ready to scale.
            </p>
          </div>
          <div className="mt-8 sm:mt-16 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PRICING_PLANS.map((plan, index) => (
              <motion.div
                key={plan.id ?? plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card
                  className={cn(
                    "group relative h-full overflow-hidden border-2 transition hover:shadow-2xl",
                    plan.popular
                      ? "border-primary bg-gradient-to-br from-white to-primary/5 shadow-xl"
                      : "border-border bg-white/70 shadow-lg",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute right-2 sm:right-4 top-2 sm:top-4">
                      <Badge className="rounded-full bg-primary text-primary-foreground text-xs">
                        <Crown className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        <span className="hidden sm:inline">Most Popular</span>
                        <span className="sm:hidden">Popular</span>
                      </Badge>
                    </div>
                  )}
                  <CardContent className="relative p-4 sm:p-6">
                    <div className="mb-3 sm:mb-4">
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    <div className="mb-3 sm:mb-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-bold text-foreground">
                          {plan.price}
                        </span>
                        {plan.period !== "forever" && (
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            /{plan.period}
                          </span>
                        )}
                      </div>
                      {plan.period === "forever" && (
                        <span className="text-xs text-muted-foreground">
                          {plan.period}
                      </span>
                      )}
                    </div>
                    <ul className="mb-4 sm:mb-6 space-y-1.5 sm:space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-start gap-2 text-xs"
                        >
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-green-500" />
                          <span className="text-muted-foreground leading-relaxed">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn(
                        "w-full text-xs sm:text-sm",
                        plan.popular
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                          : "",
                      )}
                      variant={plan.popular ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSignInDialogOpen(true)}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-1.5 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="relative mx-auto max-w-7xl px-3 sm:px-6 py-12 sm:py-24">
          <div className="text-center">
            <h2 className="text-2xl sm:text-4xl font-bold text-foreground lg:text-5xl">
              Loved by Creators Worldwide
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-lg text-muted-foreground px-3">
              Join thousands of creators who are building viral audiences with
              noface.video
            </p>
          </div>
          <div className="mt-8 sm:mt-16 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full border-none bg-white/70 shadow-lg">
                  <CardContent className="p-4 sm:p-6">
                    <div className="mb-3 sm:mb-4 flex gap-1">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="mb-3 sm:mb-4 text-sm sm:text-base text-muted-foreground">
                      &quot;{testimonial.content}&quot;
                    </p>
                    <div>
                      <div className="text-sm sm:text-base font-semibold text-foreground">
                        {testimonial.name}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative mx-auto max-w-7xl px-3 sm:px-6 py-12 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-6 sm:p-12 text-center text-white shadow-2xl"
          >
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.1) 41px),
                                repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.1) 41px)`
            }} />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-4xl font-bold lg:text-5xl">
                Ready to Go Viral?
              </h2>
              <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-lg text-white/90 px-3">
                Start creating faceless videos that get millions of views and
                attract brand collaborations today. No credit card required.
              </p>
              <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center gap-3 sm:gap-4 sm:flex-row w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-11 sm:h-14 rounded-2xl bg-white px-5 sm:px-8 text-sm sm:text-lg font-semibold text-purple-600 shadow-lg hover:bg-white/90 w-full sm:w-auto"
                  onClick={() => setSignInDialogOpen(true)}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 sm:h-14 rounded-2xl border-2 border-white/30 bg-white/10 px-5 sm:px-8 text-sm sm:text-lg font-semibold text-white backdrop-blur-sm hover:bg-white/20 w-full sm:w-auto"
                >
                  <Link href="#features">Learn More</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="relative mx-auto max-w-3xl px-3 sm:px-6 py-12 sm:py-20"
        >
          <h2
            id="faq-heading"
            className="text-center text-2xl sm:text-4xl font-bold text-foreground lg:text-5xl"
          >
            Frequently asked questions
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-lg text-muted-foreground">
            Straight answers for creators researching faceless content and short-form
            growth.
          </p>
          <dl className="mt-8 sm:mt-12 space-y-6 sm:space-y-8">
            {LANDING_FAQ_ITEMS.map((item) => (
              <div
                key={item.question}
                className="rounded-2xl border border-border/60 bg-white/60 p-5 sm:p-6 shadow-sm backdrop-blur-sm"
              >
                <dt>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    {item.question}
                  </h3>
                </dt>
                <dd className="mt-2 text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="border-t border-border/50 bg-background/40 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-3 py-8 sm:flex-row sm:px-6">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} noface.video
            </p>
            <nav
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm"
              aria-label="Footer"
            >
              <Link
                href="/blog"
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Blog
              </Link>
              <Link
                href="/pricing"
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/case-studies"
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Case studies
              </Link>
              <Link
                href="/privacy"
                className="font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>
            </nav>
          </div>
        </footer>
      </main>

      {/* Sign In Dialog */}
      <Dialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none">
          <DialogTitle className="sr-only">
            Sign in to your account
          </DialogTitle>
          <DialogDescription className="sr-only">
            Sign in to your account to create faceless videos
          </DialogDescription>
          <SignInCard />
        </DialogContent>
      </Dialog>
    </div>
  );
}
