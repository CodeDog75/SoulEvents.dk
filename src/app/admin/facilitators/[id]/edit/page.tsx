/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft, CircleAlert, KeyRound, Mail, PauseCircle, RotateCcw, UserCog, XCircle } from "lucide-react";
import {
  cancelAdminFacilitatorEmailChangeAction,
  disableFacilitatorAction,
  reactivateFacilitatorAction,
  requestAdminFacilitatorEmailChangeAction,
  updateFacilitatorAdminSettingsAction,
  updateFacilitatorTemporaryPasswordAction,
} from "@/app/admin/facilitators/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { ProfileForm } from "@/components/facilitator/profile-form";
import { requireRole } from "@/lib/auth/roles";
import { normalizeFacilitatorMoodImageSlots } from "@/lib/facilitators/mood-image-slots";
import { parseProfileChangeRequest } from "@/lib/facilitators/profile-change-request";
import { facilitatorWorkAreaSlugs } from "@/lib/facilitators/work-areas";
import { publicFacilitatorPath } from "@/lib/slug";
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
  if (facilitator.status === "changes_requested") return "Kræver ændringer";
  if (facilitator.status === "pending_review") return "Afventer godkendelse";
  return "Under udarbejdelse";
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
    { data: moderationHistory },
    { data: pendingEmailChange },
    { data: latestEmailChange },
  ] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "*, profiles!facilitator_profiles_profile_id_fkey(id, full_name, email, phone), facilitator_categories(category_id), facilitator_images(image_path, alt_text, sort_order)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("regions").select("id, name, slug").order("sort_order"),
    supabase.from("categories").select("id, name, slug, description").in("slug", facilitatorWorkAreaSlugs).eq("is_active", true).order("sort_order"),
    supabase
      .from("admin_audit_log")
      .select("id, action, reason, old_value, new_value, created_at, profiles!admin_audit_log_actor_profile_id_fkey(full_name, email)")
      .eq("facilitator_id", id)
      .in("action", ["facilitator_changes_requested", "facilitator_resubmitted_for_review", "facilitator_status_changed"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("email_change_requests")
      .select("id, new_email, expires_at, requested_at, requested_by_role, admin_reason, profiles!email_change_requests_requested_by_profile_id_fkey(full_name, email)")
      .eq("facilitator_id", id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("email_change_requests")
      .select("id, new_email, status, confirmed_at, cancelled_at, expires_at, requested_at")
      .eq("facilitator_id", id)
      .order("requested_at", { ascending: false })
      .limit(1)
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
  const galleryImages = normalizeFacilitatorMoodImageSlots(
    facilitator.facilitator_images as Array<{ alt_text: string | null; image_path: string; sort_order: number }> | null | undefined,
  );
  const profileForForm = {
    email: profile?.email ?? "",
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
  };
  const latestEmailStatus =
    latestEmailChange && !pendingEmailChange
      ? latestEmailChange.status === "completed"
        ? "Seneste mailændring er gennemført."
        : latestEmailChange.status === "expired"
          ? "Seneste mailændring er udløbet."
          : latestEmailChange.status === "cancelled"
            ? "Seneste mailændring er annulleret."
            : null
      : null;
  const pendingEmailRequester = pendingEmailChange
    ? first((pendingEmailChange as any).profiles) as { email?: string | null; full_name?: string | null } | null
    : null;
  const pendingEmailRequesterLabel = pendingEmailChange
    ? pendingEmailChange.requested_by_role === "admin"
      ? `Admin: ${pendingEmailRequester?.full_name || pendingEmailRequester?.email || "SoulEvents"}`
      : "Arrangøren selv"
    : null;

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
            <Link className="inline-flex h-10 items-center rounded-md border border-midnight/15 px-3 text-sm font-semibold text-midnight" href={publicFacilitatorPath(facilitator.slug || id) + `?admin_return=${encodeURIComponent(thisPageHref)}`}>
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
                <label className="mt-3 block text-sm font-semibold text-midnight">
                  Årsag
                  <select className="mt-2 h-10 w-full rounded-md border border-terracotta/25 bg-white px-3 text-sm" name="disabled_reason" required>
                    <option value="Matcher ikke SoulEvents' koncept">Matcher ikke SoulEvents&apos; koncept</option>
                    <option value="Spam eller falsk profil">Spam eller falsk profil</option>
                    <option value="Dubletprofil">Dubletprofil</option>
                    <option value="Uacceptabelt indhold">Uacceptabelt indhold</option>
                    <option value="Andet">Andet</option>
                  </select>
                </label>
                <label className="mt-3 block text-sm font-semibold text-midnight">
                  Kort besked til arrangøren (valgfrit)
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-md border border-terracotta/25 p-3 text-sm"
                    maxLength={500}
                    name="disabled_admin_message"
                    placeholder="Skriv kort og respektfuldt, hvad der ligger til grund for beslutningen."
                  />
                </label>
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

            <div className="rounded-md border border-[#D8CBE4] bg-white p-4">
              <div className="flex items-start gap-2">
                <Mail className="mt-1 size-5 text-[#7A5D91]" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-midnight">Login og kontaktmail</p>
                  <p className="mt-1 break-all text-sm leading-6 text-ink/64">{profile?.email ?? "Mailadresse mangler"}</p>
                </div>
              </div>
              {pendingEmailChange ? (
                <div className="mt-4 rounded-md border border-[#D8CBE4] bg-[#F7F2FB] p-3 text-sm leading-6 text-ink/72">
                  <p className="font-semibold text-midnight">Afventer bekræftelse: {pendingEmailChange.new_email}</p>
                  <p className="mt-1">
                    Anmodet af {pendingEmailRequesterLabel} den{" "}
                    {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(pendingEmailChange.requested_at))}.
                  </p>
                  <p className="mt-1">
                    Udløber {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(pendingEmailChange.expires_at))}.
                  </p>
                  {pendingEmailChange.admin_reason ? <p className="mt-2">Begrundelse: {pendingEmailChange.admin_reason}</p> : null}
                  <form action={cancelAdminFacilitatorEmailChangeAction} className="mt-3">
                    <input name="facilitator_id" type="hidden" value={id} />
                    <input name="profile_id" type="hidden" value={profile?.id ?? ""} />
                    <button className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D8CBE4] bg-white px-4 text-sm font-semibold text-[#7A5D91]" type="submit">
                      <XCircle className="size-4" aria-hidden="true" />
                      Annullér mailændring
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {latestEmailStatus ? (
                    <p className="mt-4 rounded-md border border-sage-700/15 bg-sage-50 p-3 text-sm font-semibold text-sage-700">
                      {latestEmailStatus}
                    </p>
                  ) : null}
                  <form action={requestAdminFacilitatorEmailChangeAction} className="mt-4 grid gap-3">
                    <input name="facilitator_id" type="hidden" value={id} />
                    <input name="profile_id" type="hidden" value={profile?.id ?? ""} />
                    <p className="rounded-md border border-terracotta/20 bg-[#FFF8F6] p-3 text-sm leading-6 text-terracotta">
                      Admin må ikke redigere loginmailen direkte. Den nye adresse skal verificeres, før Supabase Auth og profiles.email opdateres.
                    </p>
                    <input className="h-11 rounded-md border border-midnight/15 px-3" name="new_email" placeholder="Ny mailadresse" required type="email" />
                    <input className="h-11 rounded-md border border-midnight/15 px-3" name="confirm_new_email" placeholder="Gentag ny mailadresse" required type="email" />
                    <textarea
                      className="min-h-20 rounded-md border border-midnight/15 p-3 text-sm"
                      maxLength={500}
                      name="email_change_reason"
                      placeholder="Begrundelse for supportændringen"
                      required
                    />
                    <label className="flex items-start gap-2 rounded-md border border-[#D8CBE4] bg-[#F7F2FB] p-3 text-sm leading-6 text-ink/70">
                      <input className="mt-1 size-4 accent-[#7A5D91]" name="confirm_email_change" type="checkbox" value="yes" />
                      Jeg bekræfter, at loginmailen kun ændres via verificeret supportflow.
                    </label>
                    <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
                      Start mailændring
                    </button>
                  </form>
                </>
              )}
            </div>
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
              <div className="rounded-md border border-midnight/10 bg-white p-3 text-sm md:col-span-2">
                <p className="font-semibold text-midnight">Kommissions- og beløbsgrænser</p>
                <p className="mt-1 leading-6 text-ink/64">
                  Individuelle arrangørvilkår styres centralt under Kommission og fakturering, så samme grænse ikke kan ændres flere steder.
                </p>
                <Link
                  className="mt-3 inline-flex h-10 items-center rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-[#7A5D91] hover:text-[#7A5D91]"
                  href={`/admin/commission?tab=facilitators&facilitator=${encodeURIComponent(id)}`}
                >
                  Rediger kommissionsvilkår
                </Link>
              </div>
            </div>
            <button className="mt-4 inline-flex h-10 items-center rounded-md bg-midnight px-4 text-sm font-semibold text-white" type="submit">
              Gem adminindstillinger
            </button>
          </form>
        </section>

        {moderationHistory?.length ? (
          <section className="mb-6 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-midnight">Moderationshistorik</h2>
            <div className="mt-4 grid gap-3">
              {moderationHistory.map((item: any) => {
                const actor = first(item.profiles);
                const changeRequest = parseProfileChangeRequest(item.reason);
                const actionLabel =
                  item.action === "facilitator_changes_requested"
                    ? "Anmodet om ændringer"
                    : item.action === "facilitator_resubmitted_for_review"
                      ? "Sendt til ny godkendelse"
                      : item.new_value === "approved"
                        ? "Profil godkendt"
                        : "Status ændret";

                return (
                  <article className="rounded-[18px] border border-[#E5DDEA] bg-[#FAF8FC] p-4" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-midnight">{actionLabel}</p>
                      <time className="text-xs font-semibold text-ink/52">
                        {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-ink/64">
                      {actor?.full_name || actor?.email || "System"}
                    </p>
                    {changeRequest?.fields.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {changeRequest.fields.map((field) => (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#6F5A35]" key={field}>
                            {field}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {changeRequest?.comment ? (
                      <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-ink/72">{changeRequest.comment}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

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
          submitLabel="Gem hele arrangørprofilen"
        />
      </section>
    </main>
  );
}
