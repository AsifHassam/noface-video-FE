"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/stores/auth-store";

const magicSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const passwordSignInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

const passwordSignUpSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type MagicValues = z.infer<typeof magicSchema>;
type PasswordSignInValues = z.infer<typeof passwordSignInSchema>;
type PasswordSignUpValues = z.infer<typeof passwordSignUpSchema>;
type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

function authErrorMessage(error: { message?: string } | null): string {
  const msg = error?.message ?? "";
  if (msg.includes("Invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (msg.includes("Email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (msg.includes("User already registered") || msg.includes("already been registered")) {
    return "An account with this email already exists. Try signing in.";
  }
  if (msg.includes("Password")) {
    return msg;
  }
  return msg || "Something went wrong. Please try again.";
}

export const SignInCard = () => {
  const router = useRouter();
  const {
    user,
    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    resetPasswordForEmail,
    initialize,
    loading,
  } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [signUpConfirmSent, setSignUpConfirmSent] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const magicForm = useForm<MagicValues>({
    resolver: zodResolver(magicSchema),
    defaultValues: { email: "" },
  });

  const passwordSignInForm = useForm<PasswordSignInValues>({
    resolver: zodResolver(passwordSignInSchema),
    defaultValues: { email: "", password: "" },
  });

  const passwordSignUpForm = useForm<PasswordSignUpValues>({
    resolver: zodResolver(passwordSignUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const forgotPasswordForm = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
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

  const onMagicSubmit = async (values: MagicValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await signInWithMagicLink(values.email);

      if (error) {
        const msg = error?.message ?? "";
        if (msg.includes("only request this after") || msg.includes("8 seconds") || msg.includes("429")) {
          toast.error("Please wait a few seconds before requesting another magic link.");
        } else {
          toast.error("Failed to send magic link. Please try again.");
        }
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

  const onPasswordSignIn = async (values: PasswordSignInValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await signInWithPassword(values.email, values.password);
      if (error) {
        toast.error(authErrorMessage(error));
        console.error("Password sign in error:", error);
      } else {
        toast.success("Signed in");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotPasswordSubmit = async (values: ForgotPasswordValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await resetPasswordForEmail(values.email);
      if (error) {
        toast.error(authErrorMessage(error));
        return;
      }
      setForgotSent(true);
      toast.success("If an account exists, we sent a reset link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPasswordSignUp = async (values: PasswordSignUpValues) => {
    setIsSubmitting(true);
    try {
      const { error, needsEmailConfirmation } = await signUpWithPassword(
        values.email,
        values.password
      );
      if (error) {
        toast.error(authErrorMessage(error));
        console.error("Sign up error:", error);
        return;
      }
      if (needsEmailConfirmation) {
        setSignUpConfirmSent(true);
        toast.success("Check your email to confirm your account.");
      }
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

  if (signUpConfirmSent) {
    return (
      <Card className="w-full max-w-md border-none bg-white/80 shadow-xl shadow-primary/5 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Confirm your email</CardTitle>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to your inbox. Open it to finish creating your account, then
            sign in here.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-2xl text-base"
            onClick={() => {
              setSignUpConfirmSent(false);
              passwordSignUpForm.reset();
            }}
          >
            Back to sign up
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border-none bg-white/80 shadow-xl shadow-primary/5 backdrop-blur-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">Sign in</CardTitle>
        <p className="text-sm text-muted-foreground">
          Use a magic link or your email and password.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="magic" className="w-full gap-4">
          <TabsList className="grid w-full grid-cols-2 rounded-xl p-1">
            <TabsTrigger value="magic" className="rounded-lg">
              Magic link
            </TabsTrigger>
            <TabsTrigger value="password" className="rounded-lg">
              Email &amp; password
            </TabsTrigger>
          </TabsList>

          <TabsContent value="magic" className="mt-4 space-y-4">
            <form onSubmit={magicForm.handleSubmit(onMagicSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  type="email"
                  placeholder="you@example.com"
                  aria-invalid={!!magicForm.formState.errors.email}
                  disabled={isSubmitting}
                  {...magicForm.register("email")}
                />
                {magicForm.formState.errors.email ? (
                  <p className="text-sm text-destructive">
                    {magicForm.formState.errors.email.message}
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
          </TabsContent>

          <TabsContent value="password" className="mt-4">
            <Tabs defaultValue="signin" className="w-full gap-4">
              <TabsList className="mb-4 grid w-full grid-cols-2 rounded-xl p-1">
                <TabsTrigger value="signin" className="rounded-lg">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg">
                  Sign up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <form
                  onSubmit={passwordSignInForm.handleSubmit(onPasswordSignIn)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="pw-signin-email">Email</Label>
                    <Input
                      id="pw-signin-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      {...passwordSignInForm.register("email")}
                    />
                    {passwordSignInForm.formState.errors.email ? (
                      <p className="text-sm text-destructive">
                        {passwordSignInForm.formState.errors.email.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="pw-signin-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-primary underline-offset-4 hover:underline"
                        onClick={() => {
                          const e = passwordSignInForm.getValues("email");
                          forgotPasswordForm.reset({ email: e || "" });
                          setForgotSent(false);
                          setForgotOpen(true);
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="pw-signin-password"
                      type="password"
                      autoComplete="current-password"
                      disabled={isSubmitting}
                      {...passwordSignInForm.register("password")}
                    />
                    {passwordSignInForm.formState.errors.password ? (
                      <p className="text-sm text-destructive">
                        {passwordSignInForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-2xl text-base"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form
                  onSubmit={passwordSignUpForm.handleSubmit(onPasswordSignUp)}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="pw-signup-email">Email</Label>
                    <Input
                      id="pw-signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      {...passwordSignUpForm.register("email")}
                    />
                    {passwordSignUpForm.formState.errors.email ? (
                      <p className="text-sm text-destructive">
                        {passwordSignUpForm.formState.errors.email.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-signup-password">Password</Label>
                    <Input
                      id="pw-signup-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      disabled={isSubmitting}
                      {...passwordSignUpForm.register("password")}
                    />
                    {passwordSignUpForm.formState.errors.password ? (
                      <p className="text-sm text-destructive">
                        {passwordSignUpForm.formState.errors.password.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-signup-confirm">Confirm password</Label>
                    <Input
                      id="pw-signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      {...passwordSignUpForm.register("confirmPassword")}
                    />
                    {passwordSignUpForm.formState.errors.confirmPassword ? (
                      <p className="text-sm text-destructive">
                        {passwordSignUpForm.formState.errors.confirmPassword.message}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full rounded-2xl text-base"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing, you agree to our{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </CardContent>

      <Dialog
        open={forgotOpen}
        onOpenChange={(open) => {
          setForgotOpen(open);
          if (!open) {
            setForgotSent(false);
            forgotPasswordForm.reset({ email: "" });
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              We&apos;ll email you a link to choose a new password. It expires after a short time.
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Check your inbox (and spam) for the reset link, then return here to sign in.
              </p>
              <Button
                type="button"
                className="w-full rounded-2xl"
                onClick={() => setForgotOpen(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <form
              onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                  {...forgotPasswordForm.register("email")}
                />
                {forgotPasswordForm.formState.errors.email ? (
                  <p className="text-sm text-destructive">
                    {forgotPasswordForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <Button type="submit" className="h-11 w-full rounded-2xl" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
