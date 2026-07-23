import Link from "next/link";
import { Heart } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type FeedbackThanksPageProps = {
  params: Promise<{ token: string }>;
};

export default async function FeedbackThanksPage({ params }: FeedbackThanksPageProps) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data: survey } = await supabase
    .from("feedback_surveys")
    .select("thank_you_text")
    .eq("token", token)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-[#FAF6EF] px-4 py-8 text-[#2F2633] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-2xl rounded-[32px] border border-[#E5D9EE] bg-white p-6 text-center shadow-soft sm:p-10">
        <div className="flex justify-center">
          <BrandLogo className="size-20" />
        </div>
        <div className="mx-auto mt-8 grid size-16 place-items-center rounded-full bg-[#F1EAF5] text-[#7A4EAB]">
          <Heart className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-semibold leading-tight text-midnight sm:text-5xl">Tusind tak 💜</h1>
        <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-base leading-7 text-ink/70">
          {survey?.thank_you_text || "Din feedback hjælper os med at gøre SoulEvents endnu bedre."}
        </p>
        <Link className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#7A4EAB] px-6 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5" href="/">
          Til forsiden
        </Link>
      </section>
    </main>
  );
}
