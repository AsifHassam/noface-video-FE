"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscriptionApi } from "@/lib/api/subscription";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

const steps = [
  { label: "Step 1", description: "Write narration" },
  { label: "Step 2", description: "Choose background" },
  { label: "Step 3", description: "Preview & render" },
];

export default function StoryScriptPage() {
  const router = useRouter();
  const { draft, updateDraft } = useProjectStore();
  const { user } = useAuthStore();
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Initialize draft type for story narration and set default subtitle position
  useEffect(() => {
    if (draft?.type !== "story") {
      updateDraft({ 
        type: "story",
        subtitlePosition: draft?.subtitlePosition || { x: 50, y: 50 } // Center for story narration
      });
    } else if (!draft?.subtitlePosition || draft.subtitlePosition.y === 85) {
      // If subtitle position is still at default (y: 85), update to center (y: 50)
      updateDraft({ subtitlePosition: { x: 50, y: 50 } });
    }
  }, [draft?.type, draft?.subtitlePosition, updateDraft]);

  // Extract user script (without Reddit title prefix)
  const getUserScript = (fullScript: string, redditTitle?: string): string => {
    if (!redditTitle || !fullScript) return fullScript || "";
    // If script starts with the Reddit title, remove it
    const titlePrefix = redditTitle.trim() + "\n\n";
    if (fullScript.startsWith(titlePrefix)) {
      return fullScript.slice(titlePrefix.length);
    }
    // Also check without the newline
    if (fullScript.startsWith(redditTitle.trim())) {
      return fullScript.slice(redditTitle.trim().length).replace(/^\n+/, "");
    }
    return fullScript;
  };

  // Get the full script (with Reddit title if present)
  const getFullScript = (userScript: string, redditTitle?: string): string => {
    if (!redditTitle || !redditTitle.trim()) return userScript;
    // If user script already starts with the title, don't duplicate
    if (userScript.startsWith(redditTitle.trim())) return userScript;
    return redditTitle.trim() + "\n\n" + userScript;
  };

  const initialValue = useMemo(() => {
    // Extract user script without Reddit title prefix
    const userScript = getUserScript(draft?.scriptInput || "", draft?.redditTitle);
    if (userScript) return userScript;
    return "Once upon a time, in a world of endless possibilities...\n\nThis is where your story begins.\n\nLet your imagination run wild.";
  }, [draft?.scriptInput, draft?.redditTitle]);


  const MAX_CHARS = 1800; // Max characters for story narration
  const [text, setText] = useState(initialValue);

  const lines = useMemo(() => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [text]);

  const isValid = lines.length > 0;

  // Load user credits
  useEffect(() => {
    const loadUserCredits = async () => {
      if (!user?.id) {
        setUserCredits(null);
        return;
      }
      
      try {
        const result = await subscriptionApi.getSubscriptionInfo();
        setUserCredits(result.subscription.credits || 0);
      } catch (error) {
        console.error("Error loading user credits:", error);
        setUserCredits(null);
      }
    };

    loadUserCredits();
  }, [user?.id]);

  // Calculate estimated credits (Flash model: 0.2 credits/second)
  // Use full script including Reddit title if present
  const fullScriptText = useMemo(() => {
    return getFullScript(text, draft?.redditTitle);
  }, [text, draft?.redditTitle]);

  const estimatedCredits = useMemo(() => {
    if (!fullScriptText || fullScriptText.trim().length === 0) return 0;

    // Estimate duration: average speaking rate is ~150 words per minute = 2.5 words per second
    const words = fullScriptText.trim().split(/\s+/).length;
    const estimatedSeconds = words / 2.5;
    
    // Flash model rate: 0.2 credits/second
    const creditRate = 0.2;
    const estimatedCredits = estimatedSeconds * creditRate;
    
    return Math.max(0.01, estimatedCredits); // Minimum 0.01 credits
  }, [fullScriptText]);

  const handleChange = (value: string) => {
    // Prevent exceeding max characters (excluding Reddit title)
    const redditTitleLength = draft?.redditTitle ? draft.redditTitle.length + 2 : 0; // +2 for "\n\n"
    const maxUserChars = MAX_CHARS - redditTitleLength;
    if (value.length <= maxUserChars) {
    setText(value);
      // Automatically prepend Reddit title to scriptInput
      const fullScript = getFullScript(value, draft?.redditTitle);
      updateDraft({ scriptInput: fullScript });
    }
  };

  const handleSample = () => {
    const sample = `Welcome to the world of storytelling.

Here, every word matters and every sentence paints a picture.

Let's create something amazing together.

Your story is waiting to be told.`;
    handleChange(sample);
  };

  const handleClear = () => handleChange("");

  const handleNext = () => {
    if (!isValid) {
      toast.error("Please write at least one line of narration");
      return;
    }
    // Store narration lines with Reddit title prepended
    const fullScript = getFullScript(text, draft?.redditTitle);
    updateDraft({ scriptInput: fullScript });
    
    // If background is already set (from template), skip to preview
    if (draft?.backgroundId) {
      router.push("/app/create/story/preview");
    } else {
    router.push("/app/create/story/background");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Write your story narration</h1>
          <p className="text-sm text-muted-foreground">
            Write your narration line by line. Each line will be spoken by the narrator.
          </p>
        </header>
        
        {/* Reddit Title Input */}
        <div className="rounded-3xl border border-border/40 bg-white/70 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="reddit-title" className="text-sm font-medium">
              Reddit Story Title (Optional)
            </Label>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            Add a Reddit-style post title that will appear as an intro overlay while the title is being read.
          </p>
          <Input
            id="reddit-title"
            placeholder="e.g., My parents Took me Out of their Will, and are Giving Everything to my Sister because of WHAT??"
            value={draft?.redditTitle || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const newTitle = e.target.value;
              updateDraft({ redditTitle: newTitle });
              // Automatically update scriptInput to include the title
              if (newTitle.trim()) {
                const fullScript = getFullScript(text, newTitle);
                updateDraft({ scriptInput: fullScript });
              } else {
                // If title is removed, remove it from scriptInput
                updateDraft({ scriptInput: text });
              }
            }}
            className="rounded-xl"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="narration">Narration Lines</Label>
          
          {/* Read-only Reddit Title Section */}
          {draft?.redditTitle && draft.redditTitle.trim() && (
            <div className="rounded-xl border border-border/40 bg-muted/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Reddit Title (Auto-included, read-only)
                </Label>
              </div>
              <div className="text-sm font-medium text-foreground bg-background p-3 rounded-lg border border-border/20">
                {draft.redditTitle}
              </div>
            </div>
          )}
          
          <Textarea
            id="narration"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            maxLength={MAX_CHARS - (draft?.redditTitle ? draft.redditTitle.length + 2 : 0)}
            placeholder={draft?.redditTitle && draft.redditTitle.trim() 
              ? "Add your narration below the Reddit title..." 
              : "Enter your narration lines, one per line..."}
            className={cn(
              "min-h-[300px] font-mono text-sm",
              text.length >= (MAX_CHARS - (draft?.redditTitle ? draft.redditTitle.length + 2 : 0)) && "border-orange-300"
            )}
            rows={12}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {lines.length} line{lines.length !== 1 ? "s" : ""}
                </span>
                {estimatedCredits > 0 && (
                  <Badge 
                    variant={userCredits !== null && userCredits < estimatedCredits ? "destructive" : "secondary"} 
                    className="rounded-full px-2 py-0.5 text-xs"
                  >
                    Credits: {estimatedCredits.toFixed(2)}
                    {userCredits !== null && (
                      <span className="ml-1 opacity-75">
                        (Balance: {userCredits.toFixed(2)})
                      </span>
                    )}
                  </Badge>
                )}
              </div>
              <span className={text.length >= (MAX_CHARS - (draft?.redditTitle ? draft.redditTitle.length + 2 : 0)) ? "text-orange-600 font-medium" : "text-muted-foreground"}>
                {text.length} / {MAX_CHARS - (draft?.redditTitle ? draft.redditTitle.length + 2 : 0)} characters
                {draft?.redditTitle && draft.redditTitle.trim() && (
                  <span className="ml-2 text-muted-foreground">
                    (+ {draft.redditTitle.length + 2} for title)
                  </span>
                )}
              </span>
            </div>
            {estimatedCredits > 0 && (
              <div className="text-xs text-muted-foreground">
                Credits will only be used upon generating a preview in the next section
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl" onClick={handleSample}>
            Use Sample
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={handleClear}>
            Clear
          </Button>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.push("/app/create")}
          >
            Back
          </Button>
          <Button
            className="rounded-2xl px-6"
            disabled={!isValid}
            onClick={handleNext}
          >
            {draft?.backgroundId ? "Next: Preview" : "Next: Choose Background"}
          </Button>
        </div>
      </div>
    </div>
  );
}

