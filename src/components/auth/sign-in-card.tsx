"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";

const formSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

type FormValues = z.infer<typeof formSchema>;

export const SignInCard = () => {
  const router = useRouter();
  const { user, signInWithMagicLink, initialize, loading } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/app/dashboard");
    }
  }, [loading, router, user]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await signInWithMagicLink(values.email);
      
      if (error) {
        toast.error("Failed to send magic link. Please try again.");
        console.error("Sign in error:", error);
      } else {
        setEmailSent(true);
        toast.success("Check your email for the magic link!");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
      console.error("Sign in error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md border-none bg-white/80 shadow-xl shadow-primary/5 backdrop-blur-xl">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (emailSent) {
    return (
      <Card className="w-full max-w-md border-none bg-white/80 shadow-xl shadow-primary/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Check your email</CardTitle>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent you a magic link to sign in. Click the link in your email to continue.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-2xl text-base"
            onClick={() => setEmailSent(false)}
          >
            Try another email
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none bg-white/80 shadow-xl shadow-primary/5 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter your email to receive a magic link for instant access.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              aria-invalid={!!form.formState.errors.email}
              disabled={isSubmitting}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <Button 
            type="submit" 
            className="h-11 w-full rounded-2xl text-base"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending magic link..." : "Send magic link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
