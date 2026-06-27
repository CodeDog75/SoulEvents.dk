import Link from "next/link";
import { ArrowLeft, Save, UserCog } from "lucide-react";
import { updateAdminFacilitatorProfileAction } from "@/app/admin/facilitators/actions";
import { AdminTagSelector } from "./admin-tag-selector";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { FacilitatorStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
};

const statuses: Array<{ label: string; value: FacilitatorStatus }> = [
  { label: "Afventer", value: "pending" },
  { label: "Godkendt", value: "approved" },
  { label: "Deaktiveret", value: "disabled" },
];

function statusOptionsFor(currentStatus: FacilitatorStatus) {
  if (currentStatus === "pending") {
    return statuses;
  }

  return statuses.filter((status) => status.value !== "pending");
}


function AdminReminderEmailsSection({ subscribers }: { subscribers: Array<{ email: string | null; status: string | null; created_at: string | null }> }) {
  const activeSubscribers = subscribers.filter((subscriber) => subscriber.status === "active");

  return (
    <section className="mt-6 rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-midnight">Påmindelses-mails</h2>
          <p className="mt-1 text-sm text-ink/64">Kun admin kan se e-mailadresser. Arrangøren ser kun det samlede antal.</p>
        </div>
        <span className="rounded-full bg-[#EDE4F7] px-3 py-1 text-sm font-semibold text-[#7A4EAB]">
          {activeSubscribers.length} aktive
        </span>
      </div>
      {subscribers.length === 0 ? (
        <p className="mt-4 rounded-md bg-[#FAF6EF] px-4 py-3 text-sm text-ink/64">Ingen påmindelses-mails endnu.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-md border border-midnight/10">
          {subscribers.map((subscriber) => (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-midnight/10 px-4 py-3 text-sm last:border-b-0" key={(subscriber.email ?? "") + (subscriber.created_at ?? "")}>
              <span className="font-semibold text-midnight">{subscriber.email}</span>
              <span className="rounded-full bg-[#F6F1E7] px-3 py-1 text-xs font-semibold text-ink/60">{subscriber.status ?? "ukendt"}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default async function AdminEditFacilitatorPage({ params, searchParams }: PageProps) {
  const [{ id }, { message }] = await Promise.all([params, searchParams, requireRole("admin")]);
  const supabase = await createClient();
  const [{ data: facilitator }, { data: regions }, { data: categories }, { data: tags }, { data: reminderSubscribers }] = await Promise.all([
    supabase
      .from("facilitator_profiles")
      .select(
        "*, profiles(id, full_name, email, phone), regions(id, name), facilitator_categories(category_id), facilitator_tags(tag_id)",
      )
      .eq("id", id)
      .single(),
    supabase.from("regions").select("id, name").order("sort_order"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("tags").select("id, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("facilitator_event_reminders")
      .select("email, status, created_at")
      .eq("facilitator_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!facilitator) {
    return (
      <main className="min-h-screen bg-[#fbfaf7] px-4 py-10">
        <section className="mx-auto max-w-3xl rounded-md border border-midnight/10 bg-white p-6 shadow-soft">
          <h1 className="text-xl font-semibold text-midnight">Arrangøren blev ikke fundet</h1>
          <Link className="mt-4 inline-flex text-sm font-semibold text-sage-700" href="/admin">
            Tilbage til admin
          </Link>
        </section>
      </main>
    );
  }

  const profile = first(facilitator.profiles) as { id?: string; full_name?: string; email?: string; phone?: string | null } | null;
  const selectedCategoryIds = new Set(
    (facilitator.facilitator_categories ?? []).map((row: { category_id: string }) => row.category_id),
  );
  const selectedTagIds = new Set<string>((facilitator.facilitator_tags ?? []).map((row: { tag_id: string }) => row.tag_id));

  const { data: completedBadgeEvents } = await supabase
    .from("events")
    .select("id")
    .eq("facilitator_id", id)
    .eq("status", "completed");
  const completedBadgeEventIds = (completedBadgeEvents ?? []).map((event) => event.id).filter(Boolean);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const { count: activeBadgeEvents } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("facilitator_id", id)
    .eq("status", "active")
    .gte("created_at", ninetyDaysAgo.toISOString());
  const canReviewActiveBadge = (activeBadgeEvents ?? 0) >= 3 && !facilitator.is_active_host;
  const { data: badgeBookings } =
    completedBadgeEventIds.length > 0
      ? await supabase
          .from("bookings")
          .select("event_id")
          .in("event_id", completedBadgeEventIds)
          .in("status", ["pending", "confirmed", "completed", "invoiced", "paid"])
      : { data: [] as Array<{ event_id: string | null }> };
  const eventIdsWithBookings = new Set((badgeBookings ?? []).map((booking) => booking.event_id).filter(Boolean));
  const experiencedEligibleCount = completedBadgeEventIds.filter((eventId) => eventIdsWithBookings.has(eventId)).length;
  const canReviewExperiencedBadge = experiencedEligibleCount >= 5 && !facilitator.is_experienced_host;

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
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} variant={message?.includes("gemt") ? "success" : "notice"} />

        <form action={updateAdminFacilitatorProfileAction} className="mt-5 grid gap-6">
          <input name="facilitator_id" type="hidden" value={facilitator.id} />
          <input name="profile_id" type="hidden" value={profile?.id ?? ""} />

          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-midnight">Status og synlighed</h2>
              {facilitator.host_reference_id && (
                <span className="rounded-md bg-sage-50 px-3 py-2 text-sm font-semibold text-sage-700">
                  Arrangør-ID {facilitator.host_reference_id}
                </span>
              )}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Status
                <select
                  className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none focus:border-sage-700"
                  defaultValue={facilitator.status}
                  name="status"
                >
                  {statusOptionsFor(facilitator.status as FacilitatorStatus).map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex h-11 items-center gap-3 self-end rounded-md border border-midnight/10 px-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-sage-700" defaultChecked={Boolean(facilitator.is_featured)} name="is_featured" type="checkbox" />
                Fremhævet arrangør
              </label>
              <label className="flex h-11 items-center gap-3 self-end rounded-md border border-[#5F7A55]/25 bg-[#F3F7F0] px-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-[#5F7A55]" defaultChecked={Boolean(facilitator.is_active_host)} name="is_active_host" type="checkbox" />
                Aktiv Arrangør
              </label>
              <label className="flex h-11 items-center gap-3 self-end rounded-md border border-[#7A5D91]/25 bg-[#F6EFFF] px-3 text-sm font-semibold text-midnight">
                <input className="size-4 accent-[#7A5D91]" defaultChecked={Boolean(facilitator.is_experienced_host)} name="is_experienced_host" type="checkbox" />
                Erfaren Arrangør
              </label>
              <label className="flex min-h-11 items-center gap-3 self-end rounded-md border border-[#D8CBE4] bg-[#F4F0F7] px-3 py-2 text-sm font-semibold text-midnight">
                <input className="size-4 accent-[#7A5D91]" defaultChecked={Boolean(facilitator.auto_approve_events)} name="auto_approve_events" type="checkbox" />
                <span>
                  Automatisk godkendelse af events
                  <span className="block text-xs font-normal leading-5 text-ink/55">
                    Nye events fra denne arrangør publiceres uden manuel godkendelse.
                  </span>
                </span>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Sortering
                <input
                  className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none focus:border-sage-700"
                  defaultValue={facilitator.featured_sort_order ?? 0}
                  name="featured_sort_order"
                  type="number"
                />
              </label>
            </div>
            <div className="mt-5 grid gap-3 rounded-[18px] border border-[#D8CBE4] bg-[#F4F0F7] px-5 py-4 text-sm leading-6 text-[#4D4458]">
              <div>
                <p className="font-bold text-[#7A5D91]">Hvad betyder synlighedsvalgene?</p>
                <p className="mt-1">
                  <strong>Fremhævet arrangør</strong> er redaktionel synlighed. Brug den, når en arrangør skal vises særligt på forsiden, i kampagner eller udvalgte sektioner. Det er ikke et kvalitetsbadge.
                </p>
              </div>
              <p>
                <strong>Aktiv Arrangør</strong> viser løbende aktivitet på platformen. <strong>Erfaren Arrangør</strong> er et roligt erfaringsbadge, der bruges efter vurdering af gennemførte events og tilmeldinger via SoulEvents.
              </p>
              <p>
                <strong>Automatisk godkendelse</strong> betyder, at nye events fra arrangøren kan publiceres uden manuel moderation. Admin kan stadig redigere, afpublicere eller afvise events bagefter.
              </p>
            </div>
            {canReviewActiveBadge && (
              <div className="mt-5 rounded-[18px] border border-[#D7E4D1] bg-[#F3F7F0] px-5 py-4 text-sm text-[#4D6048]">
                <p className="font-bold text-[#5F7A55]">Klar til vurdering</p>
                <p className="mt-2 leading-6">
                  Denne arrangør har oprettet mindst 3 kommende eller offentliggjorte events på SoulEvents inden for de seneste 90 dage og kan vurderes til badget &quot;Aktiv Arrangør&quot;. Badget aktiveres ikke automatisk.
                </p>
              </div>
            )}
            {canReviewExperiencedBadge && (
              <div className="mt-5 rounded-[18px] border border-[#D8CBE4] bg-[#F4F0F7] px-5 py-4 text-sm text-[#4D4458]">
                <p className="font-bold text-[#7A5D91]">Klar til vurdering</p>
                <p className="mt-2 leading-6">
                  Denne arrangør har opnået 5 gennemførte events med minimum 1 tilmelding pr. event via SoulEvents og kan vurderes til badget &quot;Erfaren Arrangør&quot;. Badget aktiveres ikke automatisk.
                </p>
              </div>
            )}
          </section>

          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-midnight">Profiltekst</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Rigtigt navn
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none focus:border-sage-700" defaultValue={profile?.full_name ?? ""} name="full_name" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                E-mail
                <input className="h-11 rounded-md border border-midnight/15 bg-sage-50 px-3 text-base text-ink/60" defaultValue={profile?.email ?? ""} disabled />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Telefon
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none focus:border-sage-700" defaultValue={profile?.phone ?? ""} name="phone" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Vist navn / virksomhed
                <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none focus:border-sage-700" defaultValue={textValue(facilitator.company_name)} name="company_name" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72 md:col-span-2">
                Kort præsentation
                <textarea className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none focus:border-sage-700" defaultValue={textValue(facilitator.short_description)} name="short_description" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink/72 md:col-span-2">
                Uddybende præsentation
                <textarea className="min-h-40 rounded-md border border-midnight/15 p-3 text-base outline-none focus:border-sage-700" defaultValue={textValue(facilitator.long_description)} name="long_description" />
              </label>
            </div>
          </section>

          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-midnight">Kontakt, links og lokation</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ["Offentlig e-mail", "public_email", facilitator.public_email],
                ["Offentlig telefon", "public_phone", facilitator.public_phone],
                ["Hjemmeside", "website_url", facilitator.website_url],
                ["Facebook", "facebook_url", facilitator.facebook_url],
                ["Instagram", "instagram_url", facilitator.instagram_url],
                ["Adresse", "address_line", facilitator.address_line],
                ["Postnummer", "postal_code", facilitator.postal_code],
                ["By", "city", facilitator.city],
              ].map(([label, name, value]) => (
                <label className="grid gap-2 text-sm font-semibold text-ink/72" key={String(name)}>
                  {label}
                  <input className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none focus:border-sage-700" defaultValue={textValue(value)} name={String(name)} />
                </label>
              ))}
              <label className="grid gap-2 text-sm font-semibold text-ink/72">
                Region
                <select
                  className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none focus:border-sage-700"
                  defaultValue={facilitator.region_id ?? ""}
                  name="region_id"
                >
                  <option value="">Ingen region</option>
                  {(regions ?? []).map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-midnight">Kategorier og tags</h2>
            <p className="mt-1 text-sm text-ink/64">Tags bruges i arrangørsøgningen. Vælg højst fem tags.</p>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="font-semibold text-midnight">Kategorier</h3>
                <div className="mt-3 grid gap-2">
                  {(categories ?? []).map((category) => (
                    <label className="flex items-center gap-3 rounded-md border border-midnight/10 p-3 text-sm font-medium text-ink/75" key={category.id}>
                      <input className="size-4 accent-sage-700" defaultChecked={selectedCategoryIds.has(category.id)} name="category_ids" type="checkbox" value={category.id} />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>
              <AdminTagSelector
                selectedTagIds={Array.from(selectedTagIds)}
                tags={(tags ?? []).map((tag) => ({ id: tag.id, name: tag.name }))}
              />
            </div>
          </section>
          <AdminReminderEmailsSection subscribers={(reminderSubscribers ?? []).map((subscriber) => ({ email: subscriber.email, status: subscriber.status, created_at: subscriber.created_at }))} />

          <div className="flex justify-end">
            <button className="inline-flex h-11 items-center gap-2 rounded-md bg-midnight px-5 text-sm font-semibold text-white shadow-soft transition hover:bg-sage-700" type="submit">
              <Save className="size-4" aria-hidden="true" />
              Gem arrangørprofil
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
