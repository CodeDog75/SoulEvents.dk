"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type SocialAuthButtonsProps = {
  mode: "login" | "signup";
};

type SocialAuthProvider = "apple" | "facebook" | "google";

const providers = [
  {
    icon: (
      <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
        <path
          d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.44Z"
          fill="#4285F4"
        />
        <path
          d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A9.99 9.99 0 0 0 12 22Z"
          fill="#34A853"
        />
        <path
          d="M6.41 13.9A6.01 6.01 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.51H3.06A9.99 9.99 0 0 0 2 12c0 1.61.39 3.14 1.06 4.49l3.35-2.59Z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.98 14.7 2 12 2A9.99 9.99 0 0 0 3.06 7.51l3.35 2.59C7.2 7.74 9.4 5.98 12 5.98Z"
          fill="#EA4335"
        />
      </svg>
    ),
    label: "Fortsæt med Google",
    provider: "google",
  },
  {
    icon: (
      <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
        <path
          d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.23.2 2.23.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06Z"
          fill="#1877F2"
        />
      </svg>
    ),
    label: "Fortsæt med Facebook",
    provider: "facebook",
  },
  {
    icon: (
      <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16.52 13.04c-.03-2.88 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.17-2.27-1.78-.18-3.46 1.05-4.36 1.05-.91 0-2.3-1.02-3.79-.99-1.95.03-3.75 1.14-4.76 2.9-2.03 3.53-.52 8.75 1.46 11.61.97 1.4 2.12 2.97 3.63 2.91 1.46-.06 2.01-.94 3.78-.94 1.76 0 2.26.94 3.8.91 1.57-.03 2.56-1.43 3.52-2.83 1.11-1.62 1.57-3.19 1.59-3.27-.03-.02-3.14-1.21-3.17-4.74ZM13.65 4.55c.8-.97 1.34-2.32 1.19-3.66-1.15.05-2.55.77-3.38 1.74-.74.86-1.39 2.23-1.22 3.54 1.29.1 2.61-.65 3.41-1.62Z" />
      </svg>
    ),
    label: "Fortsæt med Apple",
    provider: "apple",
  },
] as const;

const showAppleLogin = false;
const visibleProviders = providers.filter((provider) => showAppleLogin || provider.provider !== "apple");

function appOrigin() {
  return window.location.origin;
}

function rememberOAuthFlow() {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = "soulevents_oauth_flow=1; path=/; max-age=600; samesite=lax" + secure;
}

function providerLabel(provider: SocialAuthProvider) {
  if (provider === "apple") return "Apple";
  if (provider === "facebook") return "Facebook";
  return "Google";
}

export function SocialAuthButtons({ mode }: SocialAuthButtonsProps) {
  const [error, setError] = useState("");
  const [pendingProvider, setPendingProvider] = useState<SocialAuthProvider | null>(null);

  async function startSocialLogin(provider: SocialAuthProvider) {
    setError("");
    setPendingProvider(provider);

    try {
      const callbackUrl = new URL("/auth/callback", appOrigin());
      callbackUrl.searchParams.set("flow", "oauth");
      callbackUrl.searchParams.set("provider", provider);
      callbackUrl.searchParams.set("mode", mode);
      rememberOAuthFlow();

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        options: {
          redirectTo: callbackUrl.toString(),
          queryParams: provider === "google" ? { access_type: "offline", prompt: "select_account" } : undefined,
        },
        provider,
      });

      if (signInError) {
        setError(`Login med ${providerLabel(provider)} kunne ikke startes lige nu. Prøv igen om lidt.`);
        setPendingProvider(null);
      }
    } catch (loginError) {
      console.error("Social login could not start", loginError);
      setError("Login kunne ikke startes lige nu. Prøv igen om lidt.");
      setPendingProvider(null);
    }
  }

  return (
    <section aria-label="Social login" className="grid gap-3">
      {visibleProviders.map((provider) => (
        <div key={provider.provider}>
          <button
            aria-busy={pendingProvider === provider.provider}
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#7A4EAB]/12 bg-white px-4 text-sm font-semibold text-[#2F2633] shadow-[0_10px_28px_rgba(47,38,51,0.07)] transition hover:-translate-y-0.5 hover:border-[#7A4EAB]/25 hover:shadow-soft"
            disabled={Boolean(pendingProvider)}
            onClick={() => startSocialLogin(provider.provider)}
            type="button"
          >
            {provider.icon}
            {pendingProvider === provider.provider ? "Sender dig videre..." : provider.label}
          </button>
        </div>
      ))}

      {error ? (
        <p className="rounded-2xl border border-[#D8A7B1]/35 bg-[#FFF8F6] px-4 py-3 text-sm leading-6 text-[#8A3342]">
          {error}
        </p>
      ) : null}

      <p className="text-xs leading-5 text-[#2F2633]/58">
        Vi henter kun de oplysninger, du vælger at dele, f.eks. navn, e-mail og profilbillede.
      </p>
    </section>
  );
}
