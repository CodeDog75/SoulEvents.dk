import Link from "next/link";
import {
  AlertCircle,
  Check,
  Download,
  Eye,
  Mail,
  PauseCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  deleteFacilitatorFromOverviewAction,
  updateFacilitatorOverviewAction,
  updateUserRoleAction,
} from "@/app/admin/users/actions";
import type { AppRole, FacilitatorStatus } from "@/types/database";

type FacilitatorOverviewRow = {
  active_events: number;
  address_line?: string | null;
  auto_approve_events?: boolean | null;
  city?: string | null;
  company_name?: string | null;
  completed_events: number;
  created_at: string;
  draft_events: number;
  email: string;
  event_count: number;
  facilitator_categories?: string[];
  facilitator_tags?: string[];
  featured_sort_order?: number | null;
  full_name: string;
  host_reference_id?: string | null;
  id: string;
  is_active_host?: boolean | null;
  is_experienced_host?: boolean | null;
  is_featured?: boolean | null;
  latest_event_at?: string | null;
  long_description?: string | null;
  pending_bookings: number;
  phone: string | null;
  postal_code?: string | null;
  profile_id: string;
  public_email?: string | null;
  public_phone?: string | null;
  role: AppRole;
  short_description?: string | null;
  status: FacilitatorStatus;
  total_bookings: number;
  website_url?: string | null;
};

type UserRoleTableProps = {
  currentProfileId: string;
  exportHref: string;
  facilitators: FacilitatorOverviewRow[];
  returnHref: string;
};

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  facilitator: "Arrangør",
};

const statusLabels: Record<FacilitatorStatus, string> = {
  approved: "Godkendt",
  disabled: "Pauset",
  pending: "Afventer",
};

const statusClasses: Record<FacilitatorStatus, string> = {
  approved: "bg-sage-50 text-sage-700",
  disabled: "bg-midnight/10 text-midnight",
  pending: "bg-terracotta/10 text-terracotta",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Ikke registreret";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function RoleButton({ profileId, returnHref, role, label }: { profileId: string; returnHref: string; role: AppRole; label: string }) {
  return (
    <form action={updateUserRoleAction}>
      <input name="profile_id" type="hidden" value={profileId} />
      <input name="return_to" type="hidden" value={returnHref} />
      <input name="role" type="hidden" value={role} />
      <button
        className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        type="submit"
      >
        {role === "admin" ? <ShieldCheck className="size-4" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
        {label}
      </button>
    </form>
  );
}

function FacilitatorToggle({
  checked,
  facilitatorId,
  label,
  name,
  returnHref,
}: {
  checked?: boolean | null;
  facilitatorId: string;
  label: string;
  name: "auto_approve_events" | "is_active_host" | "is_experienced_host" | "is_featured";
  returnHref: string;
}) {
  return (
    <form action={updateFacilitatorOverviewAction}>
      <input name="facilitator_id" type="hidden" value={facilitatorId} />
      <input name="field" type="hidden" value={name} />
      <input name="return_to" type="hidden" value={returnHref} />
      <input name="value" type="hidden" value={checked ? "false" : "true"} />
      <button
        className={
          "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition " +
          (checked
            ? "border-[#CFE3C8] bg-[#F3F7F0] text-[#4F6F48] hover:border-sage-700"
            : "border-midnight/15 bg-white text-midnight hover:border-sage-700 hover:text-sage-700")
        }
        type="submit"
      >
        {name === "is_featured" ? <Star className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
        {label}
      </button>
    </form>
  );
}

function StatusButton({ facilitatorId, returnHref, status }: { facilitatorId: string; returnHref: string; status: FacilitatorStatus }) {
  const nextStatus = status === "approved" ? "disabled" : "approved";

  return (
    <form action={updateFacilitatorOverviewAction}>
      <input name="facilitator_id" type="hidden" value={facilitatorId} />
      <input name="field" type="hidden" value="status" />
      <input name="return_to" type="hidden" value={returnHref} />
      <input name="value" type="hidden" value={nextStatus} />
      <button
        className={
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition " +
          (nextStatus === "approved"
            ? "bg-sage-700 text-white hover:bg-sage-800"
            : "border border-midnight/15 bg-white text-midnight hover:border-terracotta hover:text-terracotta")
        }
        type="submit"
      >
        {nextStatus === "approved" ? <Check className="size-4" aria-hidden="true" /> : <PauseCircle className="size-4" aria-hidden="true" />}
        {nextStatus === "approved" ? "Aktivér arrangør" : "Pause arrangør"}
      </button>
    </form>
  );
}

function FeaturedPriorityForm({ facilitator, returnHref }: { facilitator: FacilitatorOverviewRow; returnHref: string }) {
  return (
    <form action={updateFacilitatorOverviewAction} className="flex items-center gap-2">
      <input name="facilitator_id" type="hidden" value={facilitator.id} />
      <input name="field" type="hidden" value="featured_sort_order" />
      <input name="return_to" type="hidden" value={returnHref} />
      <input
        aria-label="Prioritet"
        className="h-9 w-20 rounded-md border border-midnight/15 px-2 text-sm outline-none focus:border-sage-700"
        defaultValue={facilitator.featured_sort_order ?? 0}
        name="value"
        type="number"
      />
      <button className="h-9 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight hover:border-sage-700" type="submit">
        Prioritet
      </button>
    </form>
  );
}

function DeleteFacilitatorForm({ facilitator, returnHref }: { facilitator: FacilitatorOverviewRow; returnHref: string }) {
  const confirmation = "SLET " + (facilitator.host_reference_id || facilitator.email);

  return (
    <details className="rounded-md border border-terracotta/25 bg-[#FFF8F6] p-3">
      <summary className="cursor-pointer text-sm font-semibold text-terracotta">Slet arrangør</summary>
      <form action={deleteFacilitatorFromOverviewAction} className="mt-3 grid gap-2">
        <input name="facilitator_id" type="hidden" value={facilitator.id} />
        <input name="profile_id" type="hidden" value={facilitator.profile_id} />
        <input name="return_to" type="hidden" value={returnHref} />
        <p className="text-xs leading-5 text-ink/64">
          Sletning er kun mulig, hvis arrangøren ikke har bookings, rapporter eller fakturadata. Skriv <strong>{confirmation}</strong> for at bekræfte.
        </p>
        <input
          className="h-9 rounded-md border border-terracotta/30 px-3 text-sm outline-none focus:border-terracotta"
          name="confirmation"
          placeholder={confirmation}
        />
        <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-terracotta px-3 text-sm font-semibold text-white" type="submit">
          <Trash2 className="size-4" aria-hidden="true" />
          Slet sikkert
        </button>
      </form>
    </details>
  );
}

export function UserRoleTable({ currentProfileId, exportHref, facilitators, returnHref }: UserRoleTableProps) {
  return (
    <section className="overflow-hidden rounded-md border border-midnight/10 bg-white shadow-soft">
      <div className="border-b border-midnight/10 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-midnight">Samlet arrangøroversigt</h2>
            <p className="mt-1 text-sm text-ink/64">Find, vurder og administrer arrangører fra én oversigt.</p>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
            href={exportHref}
          >
            <Download className="size-4" aria-hidden="true" />
            Eksportér CSV
          </Link>
        </div>
      </div>

      {facilitators.length === 0 ? (
        <div className="p-8 text-center">
          <UserRound className="mx-auto size-8 text-sage-700" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-midnight">Ingen arrangører matcher søgningen</h3>
          <p className="mt-2 text-sm text-ink/64">Prøv et andet navn, medlemsnummer, tag, by eller status.</p>
        </div>
      ) : (
        <div className="divide-y divide-midnight/10">
          {facilitators.map((facilitator) => {
            const displayName = facilitator.company_name || facilitator.full_name || "Uden navn";
            const location = [facilitator.postal_code, facilitator.city].filter(Boolean).join(" ");

            return (
              <article className="grid gap-5 p-5 xl:grid-cols-[1fr_340px]" key={facilitator.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={"rounded-md px-4 py-2 text-sm font-bold " + statusClasses[facilitator.status]}>
                      {statusLabels[facilitator.status]}
                    </span>
                    <span className={`rounded-md px-4 py-2 text-sm font-bold ${facilitator.role === "admin" ? "bg-sage-50 text-sage-700" : "bg-midnight/10 text-midnight"}`}>
                      {roleLabels[facilitator.role]}
                    </span>
                    {facilitator.profile_id === currentProfileId && <span className="rounded-md bg-terracotta/10 px-4 py-2 text-sm font-bold text-terracotta">Dig</span>}
                    {facilitator.host_reference_id && <span className="rounded-md bg-white px-4 py-2 text-sm font-bold text-sage-700">{facilitator.host_reference_id}</span>}
                    {facilitator.is_featured && <span className="rounded-md bg-[#F4F0F7] px-4 py-2 text-sm font-bold text-[#6E5A86]">Fremhævet</span>}
                    {facilitator.auto_approve_events && <span className="rounded-md bg-[#F3F7F0] px-4 py-2 text-sm font-bold text-[#4F6F48]">Auto-godkendelse</span>}
                    {facilitator.is_active_host && <span className="rounded-md bg-[#F3F7F0] px-4 py-2 text-sm font-bold text-[#4F6F48]">Aktiv Arrangør</span>}
                    {facilitator.is_experienced_host && <span className="rounded-md bg-[#F4F0F7] px-4 py-2 text-sm font-bold text-[#6E5A86]">Erfaren Arrangør</span>}
                  </div>

                  <h3 className="mt-3 text-xl font-semibold text-midnight">{displayName}</h3>
                  {displayName !== facilitator.full_name ? <p className="mt-1 text-sm font-semibold text-ink/64">Kontaktperson: {facilitator.full_name}</p> : null}
                  <p className="mt-1 text-sm text-ink/64">
                    {facilitator.email}
                    {facilitator.phone ? " · " + facilitator.phone : ""}
                    {facilitator.public_phone ? " · offentlig: " + facilitator.public_phone : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink/64">
                    {[facilitator.address_line, location].filter(Boolean).join(", ") || "Lokation mangler"}
                    {" · Oprettet " + formatDate(facilitator.created_at)}
                  </p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-ink/72">
                    {facilitator.short_description || facilitator.long_description || "Ingen profiltekst endnu."}
                  </p>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ["Aktive events", facilitator.active_events],
                      ["Events i alt", facilitator.event_count],
                      ["Afholdte", facilitator.completed_events],
                      ["Kladder", facilitator.draft_events],
                      ["Tilmeldinger", facilitator.total_bookings],
                      ["Afventer", facilitator.pending_bookings],
                    ].map(([label, value]) => (
                      <div
                        className={
                          "rounded-md px-3 py-2 text-sm " +
                          (label === "Afventer" && Number(value) > 0 ? "bg-terracotta/10 text-terracotta" : "bg-sage-50 text-ink/70")
                        }
                        key={String(label)}
                      >
                        <p className="text-lg font-semibold">{value}</p>
                        <p className="text-xs">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-ink/68">
                    {[...(facilitator.facilitator_categories ?? []), ...(facilitator.facilitator_tags ?? [])].map((label) => (
                      <span className="rounded-md bg-sand px-2.5 py-1" key={label}>
                        {label}
                      </span>
                    ))}
                    {facilitator.pending_bookings > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-terracotta/10 px-2.5 py-1 text-terracotta">
                        <AlertCircle className="size-3" aria-hidden="true" />
                        Kræver handling
                      </span>
                    )}
                    <span className="rounded-md bg-midnight/5 px-2.5 py-1">Seneste event: {formatDate(facilitator.latest_event_at)}</span>
                  </div>
                </div>

                <div className="grid content-start gap-3">
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={"/facilitators/" + facilitator.id + "?admin_return=" + encodeURIComponent(returnHref)}>
                      <Eye className="size-4" aria-hidden="true" />
                      Vis profil
                    </Link>
                    <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={"/admin/facilitators/" + facilitator.id + "/edit"}>
                      <Pencil className="size-4" aria-hidden="true" />
                      Rediger
                    </Link>
                    <Link className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={"/admin/messages?facilitator=" + facilitator.id + "&return_to=" + encodeURIComponent(returnHref)}>
                      <Mail className="size-4" aria-hidden="true" />
                      Besked
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <StatusButton facilitatorId={facilitator.id} returnHref={returnHref} status={facilitator.status} />
                    {facilitator.role !== "admin" && <RoleButton label="Gør til admin" profileId={facilitator.profile_id} returnHref={returnHref} role="admin" />}
                    {facilitator.role !== "facilitator" && <RoleButton label="Fjern admin" profileId={facilitator.profile_id} returnHref={returnHref} role="facilitator" />}
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <FacilitatorToggle checked={facilitator.is_featured} facilitatorId={facilitator.id} label="Fremhæv" name="is_featured" returnHref={returnHref} />
                    <FacilitatorToggle checked={facilitator.auto_approve_events} facilitatorId={facilitator.id} label="Auto-godkend" name="auto_approve_events" returnHref={returnHref} />
                    <FacilitatorToggle checked={facilitator.is_active_host} facilitatorId={facilitator.id} label="Aktiv badge" name="is_active_host" returnHref={returnHref} />
                    <FacilitatorToggle checked={facilitator.is_experienced_host} facilitatorId={facilitator.id} label="Erfaren badge" name="is_experienced_host" returnHref={returnHref} />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <FeaturedPriorityForm facilitator={facilitator} returnHref={returnHref} />
                  </div>

                  <DeleteFacilitatorForm facilitator={facilitator} returnHref={returnHref} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
