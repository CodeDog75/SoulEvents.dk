/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft, CircleAlert, KeyRound, PauseCircle, RotateCcw, UserCog } from "lucide-react";
import {
  disableFacilitatorAction,
  reactivateFacilitatorAction,
  updateFacilitatorAdminSettingsAction,
  updateFacilitatorTemporaryPasswordAction,
} from "@/app/admin/facilitators/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { ProfileForm } from "@/components/facilitator/profile-form";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ errorSection?: string; message?: string; return_to?: string; saved?: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getAdminReturnHref(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin/users";

  try {
    const url = new URL(value, "https://soulevents.local");
    if (!url.pathname.startsWith("/admin")) return "/admin/users";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/admin/users";
  }
}

function statusLabel(facilitator: any) {
  if (facilitator.is_disabled) return "Deaktiveret";
  if (facilitator.is_paused) return "Sat på pause";
  if (facilitator.status === "approved") return "Aktiv";
  return "Afventer";
}

export default async function AdminEditFacilitatorPage({ params, searchParams }: PageProps) {
  const [{ id }, { errorSection, message, return_to: returnTo, saved }] = await Promise.all([params, searchParams, requireRole("admin")]);
  const adminReturnHref = getAdminReturnHref(returnTo);
  const thisPageHref = `/admin/facilitators/${id}/edit?return_to=${encodeURIComponent(adminReturnHref)}`;
  const supabase = createAdminClient();

  const [
    { data: facilitator, error: facilitatorError },
    { data: regions },
    { data: categories },
    { data: serviceTitles },
    { data: serviceRows },
  ] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "*, profiles!facilitator_profiles_profile_id_fkey(id, full_name, email, phone), facilitator_categories(category_id), facilitator_images(image_path, alt_text, sort_order)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("regions").select("id, name, slug").order("sort_order"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("service_titles").select("id, name, is_active, sort_order").eq("is_active", true).order("sort_order").order("name"),
    supabase
      .from("facilitator_profiles")
      .select("id, facilitator_service_titles(service_title_id, service_titles(id, name, is_active, sort_order))")
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (facilitatorError) {
    console.error("[admin-facilitator-edit] facilitator lookup failed", {
      code: facilitatorError.code,
      id,
      message: facilitatorError.message,
    });
  }

  if (!facilitator) {
    return (
      <main className="min-h-screen bg-[#fbfaf7] px-4 py-10">
        <section className="mx-auto max-w-3xl rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-midnight">Arrangøren blev ikke fundet</h1>
          <Link className="mt-4 inline-flex text-sm font-semibold text-sage-700" href={adminReturnHref}>
            Tilbage til arrangøroversigten
          </Link>
        </section>
      </main>
    );
  }

  const profile = first(facilitator.profiles) as { email: string; full_name: string; id: string; phone: string | null } | null;
  const selectedCategoryIds = facilitator.facilitator_categories?.map((row: { category_id: string }) => row.category_id) ?? [];
  const galleryImages = [...(facilitator.facilitator_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const selectedServiceTitleIds = serviceRows?.facilitator_service_titles?.map((row: { service_title_id: string }) => row.service_title_id) ?? [];
  const historicalServiceTitles =
    serviceRows?.facilitator_service_titles
      ?.map((row: any) => (Array.isArray(row.service_titles) ? row.service_titles[0] : row.service_titles))
      .filter((title: any) => title && !title.is_active) ?? [];
  const visibleServiceTitles = [...(serviceTitles ?? []), ...historicalServiceTitles].filter(
    (title, index, all) => all.findIndex((item) => item.id === title.id) === index,
  );
  const profileForForm = {
    email: profile?.email ?? "",
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
  };

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-sage-700 text-white">
              <UserCog className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Rediger arrangør</h1>
              <p className="mt-1 text-sm font-semibold text-ink/55">
                {facilitator.host_reference_id ? `Arrangør-ID ${facilitator.host_reference_id} · ` : ""}
                Status: {statusLabel(facilitator)}
              </p>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href={adminReturnHref}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Arrangører og admin
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5">
          <AuthMessage message={message} variant={message?.includes("gemt") || message?.includes("opdateret") ? "success" : "notice"} />
        </div>

        <section className="mb-6 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-midnight">Adminstatus og support</h2>
              <p className="mt-1 text-sm leading-6 text-ink/64">
                Pause skjuler profilen uden at blokere login. Deaktivering blokerer adgang og bevarer historik.
              </p>
            </div>
            <Link className="inline-flex h-10 items-center rounded-md border border-midnight/15 px-3 text-sm font-semibold text-midnight" href={`/facilitators/${id}?admin_return=${encodeURIComponent(thisPageHref)}`}>
              Se profil som admin
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {facilitator.is_disabled ? (
              <form action={reactivateFacilitatorAction} className="rounded-md border border-midnight/10 bg-midnight/5 p-4">
                <input name="facilitator_id" type="hidden" value={id} />
                <p className="font-semibold text-midnight">Arrangøren er deaktiveret</p>
                <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-sage-700 px-4 text-sm font-semibold text-white" type="submit">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Genaktivér arrangør
                </button>
              </form>
            ) : (
              <form action={disableFacilitatorAction} className="rounded-md border border-terracotta/25 bg-[#FFF8F6] p-4">
                <input name="facilitator_id" type="hidden" value={id} />
                <p className="font-semibold text-terracotta">Deaktiver arrangør</p>
                <textarea className="mt-3 min-h-20 w-full rounded-md border border-terracotta/25 p-3 text-sm" maxLength={500} name="disabled_reason" placeholder="Intern årsag (valgfri)" />
                <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-terracotta/30 bg-white px-4 text-sm font-semibold text-terracotta" type="submit">
                  <PauseCircle className="size-4" aria-hidden="true" />
                  Deaktiver arrangør
                </button>
              </form>
            )}

            <form action={updateFacilitatorTemporaryPasswordAction} className="rounded-md border border-[#D8CBE4] bg-[#F7F2FB] p-4">
              <input name="facilitator_id" type="hidden" value={id} />
              <input name="profile_id" type="hidden" value={profile?.id ?? ""} />
              <div className="flex items-start gap-2">
                <KeyRound className="mt-1 size-5 text-[#7A5D91]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-midnight">Midlertidig adgangskode</p>
                  <p className="mt-1 text-sm leading-6 text-ink/64">Supportfunktion. Del kun adgangskoden sikkert med brugeren.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <input className="h-11 rounded-md border border-midnight/15 px-3" minLength={10} name="temporary_password" placeholder="Ny midlertidig adgangskode" type="password" />
                <input className="h-11 rounded-md border border-midnight/15 px-3" minLength={10} name="confirm_temporary_password" placeholder="Gentag adgangskode" type="password" />
                <label className="flex items-start gap-2 rounded-md border border-[#D8CBE4] bg-white p-3 text-sm leading-6 text-ink/70">
                  <input className="mt-1 size-4 accent-[#7A5D91]" name="confirm_support_password_change" type="checkbox" value="yes" />
                  Jeg bekræfter, at adgangskoden ændres som supporthandling.
                </label>
                <p className="flex items-start gap-2 text-xs font-semibold text-terracotta">
                  <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                  Brugeren kan logge ind med den nye adgangskode med det samme.
                </p>
                <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                  Gem midlertidig adgangskode
                </button>
              </div>
            </form>
          </div>

          <form action={updateFacilitatorAdminSettingsAction} className="mt-5 rounded-md border border-midnight/10 bg-sage-50 p-4">
            <input name="facilitator_id" type="hidden" value={id} />
            <p className="font-semibold text-midnight">Adminindstillinger</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={Boolean(facilitator.is_featured)} name="is_featured" type="checkbox" />
                Fremhævet arrangør
              </label>
              <label className="flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={Boolean(facilitator.auto_approve_events)} name="auto_approve_events" type="checkbox" />
                Automatisk godkendelse af events
              </label>
              <label className="flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={Boolean(facilitator.is_active_host)} name="is_active_host" type="checkbox" />
                Aktiv Arrangør badge
              </label>
              <label className="flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={Boolean(facilitator.is_experienced_host)} name="is_experienced_host" type="checkbox" />
                Erfaren Arrangør badge
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Fremhævet sortering
                <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" defaultValue={facilitator.featured_sort_order ?? 0} name="featured_sort_order" type="number" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Maksimal billetpris pr. deltager
                <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" defaultValue={facilitator.max_ticket_price_per_person ?? ""} min={0} name="max_ticket_price_per_person" type="number" />
              </label>
              <label className="flex items-center gap-3 rounded-md border border-midnight/10 bg-white p-3 text-sm font-semibold text-midnight md:col-span-2">
                <input className="size-4 accent-sage-700" defaultChecked={facilitator.max_ticket_price_per_person === null} name="unlimited_ticket_price" type="checkbox" />
                Ingen beløbsgrænse
              </label>
            </div>
            <button className="mt-4 inline-flex h-10 items-center rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
              Gem adminindstillinger
            </button>
          </form>
        </section>

        <ProfileForm
          adminReturnTo={thisPageHref}
          adminTargetFacilitatorId={id}
          autosaveEnabled={false}
          backHref={adminReturnHref}
          backLabel="Tilbage til arrangøroversigten"
          categories={categories ?? []}
          errorSection={errorSection ?? null}
          facilitatorProfile={facilitator}
          feedbackMessage={message ?? null}
          galleryImages={galleryImages}
          presentationMode="admin"
          profile={profileForForm}
          regions={regions ?? []}
          savedSection={saved ?? null}
          selectedCategoryIds={selectedCategoryIds}
          selectedServiceTitleIds={selectedServiceTitleIds}
          serviceTitles={visibleServiceTitles}
          submitLabel="Gem hele arrangørprofilen"
        />
      </section>
    </main>
  );
}
