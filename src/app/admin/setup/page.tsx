import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { claimFirstAdminAction } from "@/app/admin/setup/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireProfile } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminSetupPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function AdminSetupPage({ searchParams }: AdminSetupPageProps) {
  const [{ message }, profile] = await Promise.all([searchParams, requireProfile()]);
  const supabase = createAdminClient();
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  const hasAdmin = (count ?? 0) > 0;

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbfaf7] px-4 py-10">
      <section className="w-full max-w-2xl rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
        <Link className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-midnight hover:text-terracotta" href="/dashboard">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage
        </Link>

        <div className="flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded-md bg-sage-700 text-white">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Admin opsætning</p>
            <h1 className="mt-2 text-2xl font-semibold text-midnight">Aktivér første administrator</h1>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              Denne side bruges kun til den første adminadgang. Når en administrator findes, styres adgang fra adminpanelet.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <AuthMessage message={message} />
        </div>

        <div className="mt-6 rounded-md bg-sage-50 p-4 text-sm leading-6 text-ink/72">
          Du er logget ind som <span className="font-semibold text-midnight">{profile.email}</span>.
        </div>

        {hasAdmin && profile.role !== "admin" ? (
          <div className="mt-6 rounded-md border border-terracotta/20 bg-terracotta/10 p-4 text-sm leading-6 text-midnight">
            Der findes allerede en administrator. Log ind med adminbrugeren for at godkende profiler og se dashboardet.
          </div>
        ) : (
          <form action={claimFirstAdminAction} className="mt-6">
            <button
              className="inline-flex h-11 items-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700"
              type="submit"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Aktivér adminadgang
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
