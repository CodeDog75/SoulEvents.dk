"use client";

import { Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type LinkedLoginMethodsProps = {
  providers: string[];
};

const availableProviders = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
] as const;

function providerLabel(provider: string) {
  if (provider === "facebook") return "Facebook";
  if (provider === "google") return "Google";
  return provider;
}

function appOrigin() {
  return window.location.origin;
}

export function LinkedLoginMethods({ providers }: LinkedLoginMethodsProps) {
  const normalizedProviders = new Set(providers.map((provider) => provider.toLowerCase()));
  const linkedProviders = Array.from(normalizedProviders).filter((provider) => provider !== "email");
  const [error, setError] = useState("");
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  async function linkProvider(provider: (typeof availableProviders)[number]["id"]) {
    setError("");
    setPendingProvider(provider);

    try {
      const callbackUrl = new URL("/auth/callback", appOrigin());
      callbackUrl.searchParams.set("flow", "link-identity");
      callbackUrl.searchParams.set("provider", provider);

      const supabase = createClient();
      const { error: linkError } = await supabase.auth.linkIdentity({
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
        },
        provider,
      });

      if (linkError) {
        setError(
          "Loginmetoden kunne ikke tilknyttes. Hvis den allerede bruges på en anden SoulEvents-konto, kan den ikke tilknyttes her.",
        );
        setPendingProvider(null);
      }
    } catch {
      setError("Loginmetoden kunne ikke tilknyttes lige nu. Prøv igen om lidt.");
      setPendingProvider(null);
    }
  }

  return (
    <section className="rounded-md border border-midnight/10 bg-[#FAF8F4] p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-9 place-items-center rounded-md bg-[#F4F0F7] text-[#7A5D91]">
          <Link2 className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-midnight">Tilknyttede loginmetoder</h3>
          <p className="mt-1 text-sm leading-6 text-ink/64">
            Tilknyt en ekstra loginmetode, mens du er logget ind på den rigtige SoulEvents-profil.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {normalizedProviders.has("email") ? (
            <span className="rounded-full border border-sage-700/15 bg-sage-50 px-3 py-1 text-xs font-semibold text-sage-700">
              E-mail og adgangskode
            </span>
          ) : null}
          {linkedProviders.map((provider) => (
            <span
              className="rounded-full border border-[#D8CBE4] bg-white px-3 py-1 text-xs font-semibold text-[#7A5D91]"
              key={provider}
            >
              {providerLabel(provider)}
            </span>
          ))}
          {normalizedProviders.size === 0 ? (
            <span className="rounded-full border border-[#D8CBE4] bg-white px-3 py-1 text-xs font-semibold text-[#7A5D91]">
              Ingen registreret loginmetode
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-red-500/25 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {availableProviders.map((provider) => {
            const isLinked = normalizedProviders.has(provider.id);
            return (
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#D8CBE4] bg-white px-4 text-sm font-semibold text-[#7A5D91] transition hover:border-[#7A5D91] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLinked || Boolean(pendingProvider)}
                key={provider.id}
                onClick={() => linkProvider(provider.id)}
                type="button"
              >
                {pendingProvider === provider.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {isLinked ? `${provider.label} er tilknyttet` : `Tilknyt ${provider.label}`}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
