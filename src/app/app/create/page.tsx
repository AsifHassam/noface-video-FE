import Link from "next/link";
import { Stepper } from "@/components/create/stepper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, BookOpen } from "lucide-react";

const steps = [
  { label: "Step 1", description: "Choose video type" },
  { label: "Step 2", description: "Configure characters & script" },
  { label: "Step 3", description: "Preview & render" },
];

const cards = [
  {
    title: "Reddit Story Narration",
    description: "AI voiceover with B-roll and motion captions.",
    icon: BookOpen,
    href: "#",
    disabled: true,
  },
  {
    title: "2 Characters Having a Conversation",
    description: "Pick two characters, write a script, add overlays, and share.",
    icon: MessageCircle,
    href: "/app/create/two-char/characters",
    disabled: false,
  },
  {
    title: "Normal Story Narration",
    description: "Traditional storytelling with one narrator and visual accents.",
    icon: Sparkles,
    href: "/app/create/story/script",
    disabled: false,
  },
];

export default function CreatePage() {
  return (
    <div className="flex h-full flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      <section className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => {
          const content = (
            <Card className="group h-full rounded-3xl border-none bg-white/70 p-6 shadow-lg shadow-primary/5 transition hover:-translate-y-1 hover:shadow-xl">
              <CardHeader className="space-y-6 p-0">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <card.icon className="h-6 w-6" />
                </span>
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    {card.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="mt-6 flex items-center justify-between p-0">
                {card.disabled ? (
                  <Badge variant="outline" className="rounded-full">
                    Coming soon
                  </Badge>
                ) : card.title === "2 Characters Having a Conversation" ? (
                  <Badge className="rounded-full bg-primary/10 text-primary">
                    Most popular
                  </Badge>
                ) : null}
                <Button
                  variant={card.disabled ? "outline" : "default"}
                  className="rounded-2xl"
                  disabled={card.disabled}
                >
                  {card.disabled ? "Locked" : "Start"}
                </Button>
              </CardContent>
            </Card>
          );

          if (card.disabled) {
            return (
              <Tooltip key={card.title}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link key={card.title} href={card.href} className="w-full">
              {content}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
