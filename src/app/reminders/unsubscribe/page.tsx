import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function ReminderUnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const { token } = await searchParams;
  let success = false;

  if (token && isUuid(token)) {
    const admin = createAdminClient();
    const { error } = await admin
      .from("facilitator_event_reminders")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token);

    success = !error;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#FAF6EF] px-4 py-10 text-ink">
      <section className="w-full max-w-xl rounded-card border border-[#E5D4F7] bg-white p-8 text-center shadow-soft">
        <div className="mx-auto w-fit">
          <BrandLogo className="h-24 w-24" priority />
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-midnight">
          {success ? "Du er afmeldt påmindelser" : "Afmelding kunne ikke gennemføres"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-ink/70">
          {success
            ? "Du modtager ikke længere påmindelses-mails fra denne arrangør. Du kan altid tilmelde dig igen fra arrangørens profil."
            : "Linket er ugyldigt eller udløbet. Prøv linket fra den seneste mail, eller skriv til SoulEvents.dk."}
        </p>
        <Link className="mt-6 inline-flex h-11 items-center justify-center rounded-button bg-[#7A4EAB] px-5 text-sm font-semibold text-white" href="/">
          Til forsiden
        </Link>
      </section>
    </main>
  );
}
