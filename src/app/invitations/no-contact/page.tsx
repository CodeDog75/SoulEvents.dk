import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  hashFacilitatorInvitationOptOutToken,
  normalizeInvitationEmail,
} from "@/lib/newsletters/facilitator-invitation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function FacilitatorInvitationNoContactPage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const normalizedToken = (token ?? "").trim();
  let title = "Linket kunne ikke bruges";
  let body = "Afmeldingslinket mangler eller er udløbet.";

  if (/^[A-Za-z0-9_-]{32,160}$/.test(normalizedToken)) {
    const tokenHash = hashFacilitatorInvitationOptOutToken(normalizedToken);
    const supabase = createAdminClient();
    const { data: send } = await supabase
      .from("potential_facilitator_invitation_sends")
      .select("id, contact_id, recipient_email")
      .eq("unsubscribe_token_hash", tokenHash)
      .maybeSingle();

    if (send) {
      const email = normalizeInvitationEmail(send.recipient_email);
      const now = new Date().toISOString();
      await supabase.from("potential_facilitator_invitation_suppressions").upsert({
        contact_id: send.contact_id,
        email,
        reason: "Frabedt sig yderligere invitationer via link.",
        source: "recipient_link",
        suppressed_at: now,
      }, { onConflict: "email" });

      if (send.contact_id) {
        await supabase
          .from("potential_facilitator_contacts")
          .update({
            invitation_status: "no_contact",
            no_contact_at: now,
            no_contact_source: "recipient_link",
            response_notes: "Frabedt sig yderligere invitationer via link.",
          })
          .eq("id", send.contact_id);
      }

      title = "Du modtager ikke flere invitationer";
      body = "Vi har registreret, at du ikke ønsker flere invitationsmails fra SoulEvents. Tak fordi du gav besked.";
    }
  }

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-4 py-12 text-ink">
      <section className="mx-auto max-w-xl rounded-[28px] border border-midnight/10 bg-white p-8 text-center shadow-soft">
        <div className="flex justify-center">
          <BrandLogo className="h-12 w-auto" />
        </div>
        <h1 className="mt-8 font-serif text-3xl font-semibold text-midnight">{title}</h1>
        <p className="mt-4 text-base leading-7 text-ink/70">{body}</p>
        <Link className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white" href="/">
          Til SoulEvents
        </Link>
      </section>
    </main>
  );
}
