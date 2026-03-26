"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const initialize = useAuthStore((s) => s.initialize);

  const [phase, setPhase] = useState<"checking" | "ready" | "invalid">("checking");
  const recoverySeen = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Subscribe ASAP so we don’t miss PASSWORD_RECOVERY if it fires before useEffect runs.
  useLayoutEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        recoverySeen.current = true;
        setPhase("ready");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fallback: PASSWORD_RECOVERY may have fired before subscribe; recovery session can also arrive late.
  useEffect(() => {
    let cancelled = false;
    const poll = window.setInterval(async () => {
      if (cancelled || recoverySeen.current) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        recoverySeen.current = true;
        setPhase("ready");
        window.clearInterval(poll);
      }
    }, 450);

    const fail = window.setTimeout(async () => {
      if (cancelled || recoverySeen.current) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setPhase("invalid");
      }
      window.clearInterval(poll);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(fail);
    };
  }, []);

  const onSubmit = async (values: FormValues) => {
    const { error } = await updatePassword(values.password);
    if (error) {
      toast.error(error.message || "Could not update password.");
      return;
    }
    toast.success("Password updated. You’re signed in.");
    router.replace("/app/dashboard");
  };

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-none bg-white/90 shadow-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-center text-sm text-muted-foreground">
              Verifying your reset link…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md border-none bg-white/90 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Link invalid or expired</CardTitle>
            <p className="text-sm text-muted-foreground">
              Request a new reset link from the sign-in page (Email &amp; password → Forgot
              password).
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full rounded-2xl">
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md border-none bg-white/90 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Set a new password</CardTitle>
          <p className="text-sm text-muted-foreground">Choose a strong password for your account.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-pw">New password</Label>
              <Input
                id="reset-pw"
                type="password"
                autoComplete="new-password"
                disabled={form.formState.isSubmitting}
                {...form.register("password")}
              />
              {form.formState.errors.password ? (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-pw2">Confirm new password</Label>
              <Input
                id="reset-pw2"
                type="password"
                autoComplete="new-password"
                disabled={form.formState.isSubmitting}
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-2xl"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
