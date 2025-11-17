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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SignInCard } from "@/components/auth/sign-in-card";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
    name: "Pro",
    price: "$29",
    period: "per month",
    description: "For creators and businesses ready to scale",
    features: [
      "3 videos per week",
      "Premium templates library",
      "All subtitle styles & animations",
      "4K video quality",
      "No watermark",
      "Priority support",
    ],
    cta: "Start Pro Trial",
    popular: true,
    gradient: "from-purple-500 to-pink-500",
  },
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
      <header className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-4 sm:pt-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between"
        >
          <Link href="/" className="flex items-center gap-2">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
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
            <Button
              size="sm"
              className="rounded-full"
              onClick={() => setSignInDialogOpen(true)}
            >
              Get Started
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
                <Button
                  className="rounded-full mt-4"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setSignInDialogOpen(true);
                  }}
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </motion.div>
      </header>

      <main className="relative">
        {/* Hero Section */}
        <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-6 sm:gap-8 px-4 sm:px-6 pt-12 sm:pt-24 pb-8 sm:pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <Badge className="w-fit rounded-full bg-primary/15 px-4 py-1.5 text-primary mx-auto">
              <Rocket className="mr-2 h-3 w-3" />
              Create Viral Videos in Minutes
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-foreground lg:text-6xl xl:text-7xl">
              Create Faceless Viral Videos
              <br />
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                That Get Millions of Views
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-base sm:text-xl text-muted-foreground lg:text-2xl px-4">
              The #1 platform for creating faceless videos that go viral on TikTok,
              Shorts, and Instagram. Attract brand collaborations and grow your
              audience—no face required.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="h-12 sm:h-14 rounded-2xl px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 w-full sm:w-auto"
                onClick={() => setSignInDialogOpen(true)}
              >
                Sign in
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 sm:h-14 rounded-2xl px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 w-full sm:w-auto"
              >
                <Link href="#demo">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Case Studies Section */}
        <section id="case-studies" className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-8 sm:pt-12 pb-16 sm:pb-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground lg:text-5xl">
              Case Studies
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground px-4">
              Real results from creators and businesses using noface.video to
              achieve their goals.
            </p>
          </div>
          <div className="mt-16">
            <Tabs defaultValue="saas" className="w-full">
              <TabsList className="mx-auto mb-8 sm:mb-12 h-auto sm:h-12 w-full sm:w-fit rounded-full bg-white/70 p-1 shadow-lg flex flex-col sm:flex-row gap-1">
                <TabsTrigger
                  value="saas"
                  className="rounded-full px-4 sm:px-6 py-2 text-sm sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground w-full sm:w-auto"
                >
                  <Briefcase className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">SaaS Marketing</span>
                  <span className="sm:hidden">SaaS</span>
                </TabsTrigger>
                <TabsTrigger
                  value="viral"
                  className="rounded-full px-4 sm:px-6 py-2 text-sm sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground w-full sm:w-auto"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Viral Videos</span>
                  <span className="sm:hidden">Viral</span>
                </TabsTrigger>
                <TabsTrigger
                  value="brand"
                  className="rounded-full px-4 sm:px-6 py-2 text-sm sm:text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground w-full sm:w-auto"
                >
                  <Target className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Brand Collabs</span>
                  <span className="sm:hidden">Brand</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="saas" className="mt-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="grid gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center"
                >
                  <div className="relative aspect-[9/16] w-full max-w-[280px] sm:max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br shadow-2xl mx-auto lg:mx-0">
                    {CASE_STUDIES.saas.isTikTok ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.tiktok.com/embed/v2/${CASE_STUDIES.saas.videoId}`}
                        frameBorder="0"
                        allow="encrypted-media"
                        allowFullScreen
                        title="TikTok Video"
                      />
                    ) : (
                      <>
                        <video
                          className="h-full w-full object-cover"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                        >
                          <source src={CASE_STUDIES.saas.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <div
                          className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-20 mix-blend-overlay",
                            CASE_STUDIES.saas.gradient,
                          )}
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                          CASE_STUDIES.saas.gradient,
                        )}
                      >
                        <Briefcase className="h-6 w-6 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-green-50 text-green-700"
                      >
                        {CASE_STUDIES.saas.result}
                      </Badge>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {CASE_STUDIES.saas.company}
                    </h3>
                    <p className="text-base sm:text-lg text-muted-foreground">
                      {CASE_STUDIES.saas.description}
                    </p>
                    <ul className="space-y-3">
                      {CASE_STUDIES.saas.results.map((result, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                          <span>{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="viral" className="mt-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="grid gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center"
                >
                  <div className="relative aspect-[9/16] w-full max-w-[280px] sm:max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br shadow-2xl mx-auto lg:mx-0">
                    {CASE_STUDIES.viral.isTikTok ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.tiktok.com/embed/v2/${CASE_STUDIES.viral.videoId}`}
                        frameBorder="0"
                        allow="encrypted-media"
                        allowFullScreen
                        title="TikTok Video"
                      />
                    ) : (
                      <>
                        <video
                          className="h-full w-full object-cover"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                        >
                          <source src={CASE_STUDIES.viral.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <div
                          className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-20 mix-blend-overlay",
                            CASE_STUDIES.viral.gradient,
                          )}
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                          CASE_STUDIES.viral.gradient,
                        )}
                      >
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-pink-50 text-pink-700"
                      >
                        {CASE_STUDIES.viral.result}
                      </Badge>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {CASE_STUDIES.viral.company}
                    </h3>
                    <p className="text-base sm:text-lg text-muted-foreground">
                      {CASE_STUDIES.viral.description}
                    </p>
                    <ul className="space-y-3">
                      {CASE_STUDIES.viral.results.map((result, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                          <span>{result}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="brand" className="mt-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="grid gap-6 sm:gap-12 lg:grid-cols-2 lg:items-center"
                >
                  <div className="relative aspect-[9/16] w-full max-w-[280px] sm:max-w-sm overflow-hidden rounded-2xl bg-gradient-to-br shadow-2xl mx-auto lg:mx-0">
                    {CASE_STUDIES.brand.isInstagram ? (
                      <iframe
                        className="h-full w-full"
                        src={`https://www.instagram.com/reel/${CASE_STUDIES.brand.reelId}/embed/`}
                        frameBorder="0"
                        allow="encrypted-media"
                        allowFullScreen
                        title="Instagram Reel"
                      />
                    ) : (
                      <>
                        <video
                          className="h-full w-full object-cover"
                          controls
                          autoPlay
                          loop
                          muted
                          playsInline
                        >
                          <source src={CASE_STUDIES.brand.videoUrl} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <div
                          className={cn(
                            "absolute inset-0 bg-gradient-to-br opacity-20 mix-blend-overlay",
                            CASE_STUDIES.brand.gradient,
                          )}
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
                          CASE_STUDIES.brand.gradient,
                        )}
                      >
                        <Target className="h-6 w-6 text-white" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-orange-50 text-orange-700"
                      >
                        {CASE_STUDIES.brand.result}
                      </Badge>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                      {CASE_STUDIES.brand.company}
                    </h3>
                    <p className="text-base sm:text-lg text-muted-foreground">
                      {CASE_STUDIES.brand.description}
                    </p>
                    <ul className="space-y-3">
                      {CASE_STUDIES.brand.results.map((result, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-muted-foreground"
                        >
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
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

        {/* Pricing Section */}
        <section id="pricing" className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground lg:text-5xl">
              Pricing
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground px-4">
              Choose the perfect plan for your video creation needs. Start free
              and upgrade when you&apos;re ready to scale.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-2 lg:max-w-5xl lg:mx-auto">
            {PRICING_PLANS.map((plan, index) => (
              <motion.div
                key={plan.name}
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
                    <div className="absolute right-4 top-4">
                      <Badge className="rounded-full bg-primary text-primary-foreground">
                        <Crown className="mr-1 h-3 w-3" />
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="relative p-8">
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-foreground">
                        {plan.name}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                    </div>
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold text-foreground">
                          {plan.price}
                        </span>
                        {plan.period !== "forever" && (
                          <span className="text-muted-foreground">
                            /{plan.period}
                          </span>
                        )}
                      </div>
                      {plan.period === "forever" && (
                        <span className="text-sm text-muted-foreground">
                          {plan.period}
                        </span>
                      )}
                    </div>
                    <ul className="mb-8 space-y-3">
                      {plan.features.map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-start gap-3 text-sm"
                        >
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                          <span className="text-muted-foreground">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn(
                        "w-full",
                        plan.popular
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                          : "",
                      )}
                      variant={plan.popular ? "default" : "outline"}
                      size="lg"
                      onClick={() => setSignInDialogOpen(true)}
                    >
                      {plan.cta}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="relative mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground lg:text-5xl">
              Loved by Creators Worldwide
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground px-4">
              Join thousands of creators who are building viral audiences with
              noface.video
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full border-none bg-white/70 shadow-lg">
                  <CardContent className="p-6">
                    <div className="mb-4 flex gap-1">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>
                    <p className="mb-4 text-muted-foreground">
                      &quot;{testimonial.content}&quot;
                    </p>
                    <div>
                      <div className="font-semibold text-foreground">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
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
        <section className="relative mx-auto max-w-7xl px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-8 sm:p-12 text-center text-white shadow-2xl"
          >
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold lg:text-5xl">
                Ready to Go Viral?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-white/90 px-4">
                Start creating faceless videos that get millions of views and
                attract brand collaborations today. No credit card required.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 sm:h-14 rounded-2xl bg-white px-6 sm:px-8 text-base sm:text-lg font-semibold text-purple-600 shadow-lg hover:bg-white/90 w-full sm:w-auto"
                  onClick={() => setSignInDialogOpen(true)}
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 sm:h-14 rounded-2xl border-2 border-white/30 bg-white/10 px-6 sm:px-8 text-base sm:text-lg font-semibold text-white backdrop-blur-sm hover:bg-white/20 w-full sm:w-auto"
                >
                  <Link href="#features">Learn More</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Sign In Dialog */}
      <Dialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
        <DialogContent className="max-w-md p-0 border-none bg-transparent shadow-none">
          <SignInCard />
        </DialogContent>
      </Dialog>
    </div>
  );
}
