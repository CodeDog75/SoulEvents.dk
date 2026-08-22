import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { hashNewsletterUnsubscribeToken } from "@/lib/newsletters/facilitator-newsletter";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type NewsletterUnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>;
};

function isLikelyToken(value: string) {
  return /^[A-Za-z0-9_-]{32,120}$/.test(value);
}

export default async function NewsletterUnsubscribePage({ searchParams }: NewsletterUnsubscribePageProps) {
  const { token } = await searchParams;
  let success = false;

  if (token && isLikelyToken(token)) {
    const tokenHash = hashNewsletterUnsubscribeToken(token);
    const supabase = createAdminClient();
    const { data: recipient } = await supabase
      .from("admin_newsletter_recipients")
      .select("profile_id, facilitator_id")
      .eq("unsubscribe_token_hash", tokenHash)
      .maybeSingle();
    const { data: preference } = recipient
      ? { data: null }
      : await supabase
          .from("facilitator_newsletter_preferences")
          .select("profile_id, facilitator_id")
          .eq("unsubscribe_token_hash", tokenHash)
          .maybeSingle();
    const match = recipient ?? preference;

    if (match?.profile_id && match.facilitator_id) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("facilitator_newsletter_preferences")
        .update({
          status: "unsubscribed",
          unsubscribed_at: now,
          unsubscribe_source: "unsubscribe_link",
        })
        .eq("profile_id", match.profile_id);

      if (!error) {
        await supabase.from("facilitator_newsletter_consent_events").insert({
          action: "unsubscribed",
          facilitator_id: match.facilitator_id,
          profile_id: match.profile_id,
          source: "unsubscribe_link",
        });
        await supabase
          .from("admin_newsletter_recipients")
          .update({ status: "unsubscribed" })
          .eq("profile_id", match.profile_id)
          .in("status", ["pending", "sending"]);
        success = true;
      }
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#FAF6EF] px-4 py-10 text-ink">
      <section className="w-full max-w-xl rounded-card border border-[#E5D4F7] bg-white p-8 text-center shadow-soft">
        <div className="mx-auto w-fit">
          <BrandLogo className="h-24 w-24" priority />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-midnight">
          {success ? "Du er afmeldt nyhedsmails" : "Afmelding kunne ikke gennemføres"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          {success
            ? "Du modtager ikke længere nyhedsmails fra SoulEvents. Nødvendige drifts-, booking- og sikkerhedsmails kan stadig blive sendt."
            : "Linket er ugyldigt eller udløbet. Prøv linket fra den seneste mail, eller skriv til SoulEvents.dk."}
        </p>
        <Link className="mt-6 inline-flex h-11 items-center justify-center rounded-button bg-[#7A4EAB] px-5 text-sm font-semibold text-white" href="/">
          Til forsiden
        </Link>
      </section>
    </main>
  );
}
