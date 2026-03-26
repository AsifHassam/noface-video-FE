"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { saveApiKey, checkApiKey } from "@/lib/api/custom-characters";
import { SubscriptionCard } from "@/components/dashboard/subscription-card";
import { subscriptionApi, type PaymentTransaction } from "@/lib/api/subscription";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Load existing API key on mount
  useEffect(() => {
    const loadApiKeyStatus = async () => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const result = await checkApiKey('elevenlabs');
        setHasApiKey(result.hasKey);
      } catch (error) {
        console.error("Error loading API key status:", error);
        // Don't show error toast - just log it
      } finally {
        setIsLoading(false);
      }
    };

    loadApiKeyStatus();
  }, [user?.id]);

  // Load payment transactions for billing tab
  useEffect(() => {
    const loadTransactions = async () => {
      if (!user?.id) return;
      setTransactionsLoading(true);
      try {
        const result = await subscriptionApi.getTransactions();
        setTransactions(result.transactions || []);
      } catch (e) {
        console.error("Error loading transactions:", e);
        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    };
    loadTransactions();
  }, [user?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      toast.error("Please enter your Eleven Labs API key");
      return;
    }

    setIsSaving(true);

    try {
      await saveApiKey(apiKey, 'elevenlabs');
      toast.success("API key saved successfully!");
      setHasApiKey(true);
      setApiKey(""); // Clear the input for security
      setShowApiKey(false);
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save API key");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account settings and API keys
        </p>
      </header>

      <div className="space-y-6">
        {/* Billing Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Manage your plan, credits, and subscription
          </p>
          <SubscriptionCard />

          {/* Payment transactions */}
          <div className="rounded-3xl border border-border/60 bg-white/80 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4" />
              Payment history
            </h3>
            {transactionsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No payment transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Reference</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Amount</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 text-muted-foreground">
                          {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(undefined, { dateStyle: "short" }) : "—"}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">{tx.reference}</td>
                        <td className="py-3 pr-4">
                          {tx.isInitialPayment ? "Initial" : tx.eventType || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {(tx.amountCents / 100).toFixed(2)} {tx.currency}
                        </td>
                        <td className="py-3">{tx.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Eleven Labs API Key Section */}
        <div className="rounded-3xl border border-border/60 bg-white/80 p-6 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Eleven Labs API Key</Label>
                {hasApiKey && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Key saved</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your Eleven Labs API key to use custom voices in your characters.
                Your key is encrypted and stored securely.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="elevenlabs-api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="elevenlabs-api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder={hasApiKey ? "••••••••••••••••" : "Enter your Eleven Labs API key"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="rounded-2xl pr-10"
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                    disabled={isSaving}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://elevenlabs.io/app/settings/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Eleven Labs Settings
                  </a>
                </p>
              </div>

              <Button
                type="submit"
                disabled={isSaving || !apiKey.trim()}
                className="rounded-2xl"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  hasApiKey ? "Update API Key" : "Save API Key"
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Info Section */}
        <div className="rounded-3xl border border-border/60 bg-muted/20 p-6">
          <h3 className="text-base font-semibold text-foreground mb-2">
            About Custom Characters
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Upload a transparent PNG image of your character</li>
            <li>Use your Eleven Labs voice ID for custom voices</li>
            <li>Your API key is encrypted and stored securely</li>
            <li>Custom characters are available for use in all video projects</li>
          </ul>
        </div>

        <p className="text-center text-sm text-muted-foreground sm:text-left">
          <Link
            href="/privacy"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

