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

function ProviderIcon({ provider }: { provider: (typeof availableProviders)[number]["id"] }) {
  if (provider === "facebook") {
    return (
      <svg aria-hidden="true" className="size-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22 12.06C22 6.49 17.52 2 12 2S2 6.49 2 12.06c0 5.02 3.66 9.19 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.25 22 17.08 22 12.06Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="size-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21.8 12.23c0-.72-.06-1.4-.18-2.06H12v3.9h5.5a4.7 4.7 0 0 1-2.04 3.08v2.52h3.3c1.93-1.78 3.04-4.4 3.04-7.44Z" />
      <path d="M12 22c2.75 0 5.05-.9 6.73-2.45l-3.3-2.52c-.9.6-2.07.96-3.43.96-2.64 0-4.89-1.78-5.69-4.18H2.9v2.6A10.16 10.16 0 0 0 12 22Z" />
      <path d="M6.31 13.81A6.08 6.08 0 0 1 6 12c0-.63.11-1.24.31-1.81v-2.6H2.9A10.02 10.02 0 0 0 1.82 12c0 1.6.39 3.11 1.08 4.41l3.41-2.6Z" />
      <path d="M12 6.01c1.5 0 2.84.51 3.9 1.52l2.9-2.9C17.04 2.99 14.74 2 12 2a10.16 10.16 0 0 0-9.1 5.59l3.41 2.6C7.11 7.79 9.36 6.01 12 6.01Z" />
    </svg>
  );
}

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
                className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#D8CBE4] bg-white px-4 text-sm font-semibold text-[#5F4B6E] shadow-soft transition hover:-translate-y-0.5 hover:border-[#7A5D91] hover:text-[#7A5D91] hover:shadow-lift focus:outline-none focus:ring-4 focus:ring-purple/15 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none sm:w-64"
                disabled={isLinked || Boolean(pendingProvider)}
                key={provider.id}
                onClick={() => linkProvider(provider.id)}
                type="button"
              >
                {pendingProvider === provider.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <ProviderIcon provider={provider.id} />
                )}
                {isLinked ? `${provider.label} er tilknyttet` : `Tilknyt ${provider.label}`}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
