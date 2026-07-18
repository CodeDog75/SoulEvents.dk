import Link from "next/link";
import {
  Check,
  Download,
  Eye,
  Mail,
  PauseCircle,
  Pencil,
  RotateCcw,
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
import { updateFacilitatorStatusAction } from "@/app/admin/facilitators/actions";
import { AdminActionMenu, AdminActionMenuScope } from "@/components/admin/action-menu";
import { DisableFacilitatorDialog } from "@/components/admin/disable-facilitator-dialog";
import { FacilitatorAdminCard, getFacilitatorAdminTask } from "@/components/admin/facilitator-admin-card";
import { RequestFacilitatorChangesDialog } from "@/components/admin/reject-facilitator-dialog";
import { publicFacilitatorPath } from "@/lib/slug";
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
  is_disabled?: boolean | null;
  is_paused?: boolean | null;
  is_active_host?: boolean | null;
  is_experienced_host?: boolean | null;
  is_featured?: boolean | null;
  latest_event_at?: string | null;
  last_sign_in_at?: string | null;
  days_since_last_login?: number | null;
  long_description?: string | null;
  pending_bookings: number;
  phone: string | null;
  postal_code?: string | null;
  profile_id: string;
  profile_image_url?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  role: AppRole;
  short_description?: string | null;
  slug?: string | null;
  specialties?: string | null;
  status: FacilitatorStatus;
  total_bookings: number;
  website_url?: string | null;
  can_delete: boolean;
  delete_blockers?: string[];
};

type UserRoleTableProps = {
  currentProfileId: string;
  exportHref: string;
  facilitators: FacilitatorOverviewRow[];
  highlightedFacilitatorId?: string | null;
  pausedFacilitatorId?: string | null;
  returnHref: string;
};

const roleLabels: Record<AppRole, string> = {
  admin: "Administrator",
  facilitator: "Arrangør",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Ikke registreret";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value));
}

function relativeLoginLabel(days: number | null | undefined) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "i dag";
  if (days === 1) return "i går";
  return `for ${days} dage siden`;
}

function loginActivityText(facilitator: FacilitatorOverviewRow) {
  if (facilitator.last_sign_in_at === undefined) {
    return "Loginaktivitet ikke registreret";
  }

  if (facilitator.last_sign_in_at) {
    return `Senest logget ind: ${formatDate(facilitator.last_sign_in_at)} · ${relativeLoginLabel(facilitator.days_since_last_login)}`;
  }

  return "Aldrig logget ind";
}

function splitSpecialties(input: string | null | undefined) {
  return (input ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pauseMessageTemplate(name: string) {
  return `Hej ${name}

Vi har midlertidigt sat din arrangørprofil på pause, da der er nogle forhold, som skal rettes, før profilen igen kan vises på SoulEvents.

Det vil vi bede dig om at rette:

(Administrator udfylder dette afsnit.)

Når ændringerne er lavet, er du velkommen til at skrive tilbage. Vi gennemgår profilen hurtigst muligt og genåbner den, hvis alt er på plads.

Venlig hilsen
SoulEvents`;
}

function pauseMessageHref(facilitator: FacilitatorOverviewRow, returnHref: string) {
  const name = facilitator.company_name || facilitator.full_name || "arrangør";
  const params = new URLSearchParams({
    body: pauseMessageTemplate(name),
    facilitator: facilitator.id,
    return_to: returnHref,
    subject: "Din arrangørprofil er sat på pause",
  });

  return "/admin/messages?" + params.toString();
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

function StatusButton({ facilitator, returnHref }: { facilitator: FacilitatorOverviewRow; returnHref: string }) {
  const nextValue = facilitator.is_disabled ? "false" : "true";

  return (
    <form action={updateFacilitatorOverviewAction}>
      <input name="facilitator_id" type="hidden" value={facilitator.id} />
      <input name="field" type="hidden" value="is_disabled" />
      <input name="return_to" type="hidden" value={returnHref} />
      <input name="value" type="hidden" value={nextValue} />
      <button
        className={
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition " +
          (facilitator.is_disabled
            ? "bg-sage-700 text-white hover:bg-sage-800"
            : "border border-midnight/15 bg-white text-midnight hover:border-terracotta hover:text-terracotta")
        }
        type="submit"
      >
        {facilitator.is_disabled ? <Check className="size-4" aria-hidden="true" /> : <PauseCircle className="size-4" aria-hidden="true" />}
        {facilitator.is_disabled ? "Genaktivér arrangør" : "Deaktiver arrangør"}
      </button>
    </form>
  );
}

function PauseButton({ facilitator, returnHref }: { facilitator: FacilitatorOverviewRow; returnHref: string }) {
  if (facilitator.is_disabled) {
    return null;
  }

  const nextValue = facilitator.is_paused ? "false" : "true";

  return (
    <form action={updateFacilitatorOverviewAction}>
      <input name="facilitator_id" type="hidden" value={facilitator.id} />
      <input name="field" type="hidden" value="is_paused" />
      <input name="return_to" type="hidden" value={returnHref} />
      <input name="value" type="hidden" value={nextValue} />
      <button
        className={
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition " +
          (facilitator.is_paused
            ? "bg-sage-700 text-white hover:bg-sage-800"
            : "border border-midnight/15 bg-white text-midnight hover:border-sage-700 hover:text-sage-700")
        }
        type="submit"
      >
        {facilitator.is_paused ? <RotateCcw className="size-4" aria-hidden="true" /> : <PauseCircle className="size-4" aria-hidden="true" />}
        {facilitator.is_paused ? "Genåbn profil" : "Sæt på pause"}
      </button>
    </form>
  );
}

function ApproveFacilitatorForm({ facilitatorId, returnHref }: { facilitatorId: string; returnHref: string }) {
  return (
    <form action={updateFacilitatorStatusAction}>
      <input name="facilitator_id" type="hidden" value={facilitatorId} />
      <input name="return_to" type="hidden" value={returnHref} />
      <input name="status" type="hidden" value="approved" />
      <button className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full bg-sage-700 px-3 text-sm font-semibold text-white transition hover:bg-sage-800" type="submit">
        Godkend
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

  if (!facilitator.can_delete) {
    return (
      <div className="rounded-md border border-midnight/10 bg-sage-50 p-3 text-sm leading-6 text-ink/70">
        <p className="font-bold text-midnight">Arrangøren kan ikke slettes permanent</p>
        <p>Der findes aktivitet eller historik, som skal bevares. Du kan stadig deaktivere arrangøren og straks fjerne adgang og offentlig synlighed.</p>
        {facilitator.delete_blockers?.length ? (
          <p className="mt-1 text-xs text-ink/58">Blokeres af: {facilitator.delete_blockers.join(", ")}.</p>
        ) : null}
      </div>
    );
  }

  return (
    <details className="rounded-md border border-terracotta/25 bg-[#FFF8F6] p-3">
      <summary className="cursor-pointer text-sm font-semibold text-terracotta">Slet arrangør</summary>
      <form action={deleteFacilitatorFromOverviewAction} className="mt-3 grid gap-2">
        <input name="facilitator_id" type="hidden" value={facilitator.id} />
        <input name="profile_id" type="hidden" value={facilitator.profile_id} />
        <input name="return_to" type="hidden" value={returnHref} />
        <p className="text-xs leading-5 text-ink/64">
          Sletning er kun mulig for ubrugte profiler uden aktivitet eller historik. Skriv <strong>{confirmation}</strong> for at bekræfte.
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

export function UserRoleTable({ currentProfileId, exportHref, facilitators, highlightedFacilitatorId, pausedFacilitatorId, returnHref }: UserRoleTableProps) {
  const menuResetKey = returnHref + "|" + facilitators.map((facilitator) => facilitator.id).join(",");

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
          <h3 className="mt-4 text-lg font-semibold text-midnight">Ingen arrangører matcher de valgte filtre</h3>
          <p className="mt-2 text-sm text-ink/64">Prøv et andet navn, medlemsnummer, tag, by, status eller loginfilter.</p>
        </div>
      ) : (
        <AdminActionMenuScope key={menuResetKey}>
          <div className="grid gap-3 bg-[#fbfaf7] p-3 sm:p-4">
            {facilitators.map((facilitator) => {
            const displayName = facilitator.company_name || facilitator.full_name || "Uden navn";
            const showPauseMessagePrompt = pausedFacilitatorId === facilitator.id;
            const contactLine = [
              displayName !== facilitator.full_name ? "Kontaktperson: " + facilitator.full_name : null,
              facilitator.email,
              facilitator.phone,
              facilitator.public_phone ? "offentlig: " + facilitator.public_phone : null,
            ].filter(Boolean).join(" · ");
            const metadataBadges = (
              <>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${facilitator.role === "admin" ? "bg-sage-50 text-sage-700" : "bg-midnight/5 text-ink/64"}`}>
                  {roleLabels[facilitator.role]}
                </span>
                {facilitator.profile_id === currentProfileId ? <span className="rounded-full bg-terracotta/10 px-3 py-1 text-xs font-semibold text-terracotta">Dig</span> : null}
                {facilitator.is_featured ? <span className="rounded-full bg-[#F4F0F7] px-3 py-1 text-xs font-semibold text-[#6E5A86]">Fremhævet</span> : null}
                {facilitator.auto_approve_events ? <span className="rounded-full bg-[#F3F7F0] px-3 py-1 text-xs font-semibold text-[#4F6F48]">Auto-godkendelse</span> : null}
                {facilitator.is_active_host ? <span className="rounded-full bg-[#F3F7F0] px-3 py-1 text-xs font-semibold text-[#4F6F48]">Aktiv Arrangør</span> : null}
                {facilitator.is_experienced_host ? <span className="rounded-full bg-[#F4F0F7] px-3 py-1 text-xs font-semibold text-[#6E5A86]">Erfaren Arrangør</span> : null}
              </>
            );
            const isPendingReview = facilitator.status === "pending" && !facilitator.is_disabled && !facilitator.is_paused;
            const actions = (
              <>
                <Link className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={publicFacilitatorPath(facilitator.slug || facilitator.id) + "?admin_return=" + encodeURIComponent(returnHref)}>
                  <Eye className="size-4" aria-hidden="true" />
                  Se profil
                </Link>
                <Link className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-midnight/15 bg-white px-4 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={"/admin/facilitators/" + facilitator.id + "/edit?return_to=" + encodeURIComponent(returnHref)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  Rediger
                </Link>
                <AdminActionMenu id={facilitator.id}>
                    <div>
                      <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Kommunikation</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link className="inline-flex h-9 items-center gap-2 rounded-full border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700" href={"/admin/messages?facilitator=" + facilitator.id + "&return_to=" + encodeURIComponent(returnHref)}>
                          <Mail className="size-4" aria-hidden="true" />
                          Send besked
                        </Link>
                        {facilitator.is_paused ? (
                          <Link className="inline-flex h-9 items-center gap-2 rounded-full border border-sage-200 bg-sage-50 px-3 text-sm font-semibold text-sage-700 transition hover:border-sage-700" href={pauseMessageHref(facilitator, returnHref)}>
                            <Mail className="size-4" aria-hidden="true" />
                            Pausebesked
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Status</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {isPendingReview ? (
                          <>
                            <ApproveFacilitatorForm facilitatorId={facilitator.id} returnHref={returnHref} />
                            <RequestFacilitatorChangesDialog facilitatorId={facilitator.id} facilitatorName={displayName} returnHref={returnHref} />
                          </>
                        ) : null}
                        {facilitator.is_disabled ? <StatusButton facilitator={facilitator} returnHref={returnHref} /> : null}
                        {facilitator.is_paused && !facilitator.is_disabled ? <PauseButton facilitator={facilitator} returnHref={returnHref} /> : null}
                        {!isPendingReview && !facilitator.is_paused && !facilitator.is_disabled ? (
                          <PauseButton facilitator={facilitator} returnHref={returnHref} />
                        ) : null}
                      </div>
                    </div>
                    <div>
                      <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Synlighed</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <FacilitatorToggle checked={facilitator.is_featured} facilitatorId={facilitator.id} label="Fremhæv" name="is_featured" returnHref={returnHref} />
                        <FacilitatorToggle checked={facilitator.auto_approve_events} facilitatorId={facilitator.id} label="Auto-godkend" name="auto_approve_events" returnHref={returnHref} />
                        <FacilitatorToggle checked={facilitator.is_active_host} facilitatorId={facilitator.id} label="Aktiv badge" name="is_active_host" returnHref={returnHref} />
                        <FacilitatorToggle checked={facilitator.is_experienced_host} facilitatorId={facilitator.id} label="Erfaren badge" name="is_experienced_host" returnHref={returnHref} />
                        <FeaturedPriorityForm facilitator={facilitator} returnHref={returnHref} />
                      </div>
                    </div>
                    <div className="border-t border-midnight/10 pt-3">
                      <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink/45">Administration</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {facilitator.role !== "admin" && <RoleButton label="Gør til admin" profileId={facilitator.profile_id} returnHref={returnHref} role="admin" />}
                        {facilitator.role !== "facilitator" && <RoleButton label="Fjern admin" profileId={facilitator.profile_id} returnHref={returnHref} role="facilitator" />}
                        {!facilitator.is_disabled ? (
                          <DisableFacilitatorDialog
                            activeEventCount={facilitator.active_events}
                            facilitatorId={facilitator.id}
                            facilitatorName={displayName}
                            isPendingReview={isPendingReview}
                            returnHref={returnHref}
                          />
                        ) : null}
                      </div>
                      <div className="mt-3">
                        <DeleteFacilitatorForm facilitator={facilitator} returnHref={returnHref} />
                      </div>
                    </div>
                </AdminActionMenu>
              </>
            );
            const footer = (
              <>
                {showPauseMessagePrompt ? (
                  <div className="rounded-[18px] border border-sage-200 bg-sage-50 p-4 text-sm text-ink/72">
                    <p className="font-semibold text-midnight">Profilen er sat på pause.</p>
                    <p className="mt-1 leading-6">Send gerne en kort besked, så arrangøren ved, hvad der skal rettes.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-full border border-midnight/10 bg-white px-4 text-sm font-semibold text-ink/65 transition hover:border-sage-700 hover:text-sage-700"
                        href={returnHref}
                      >
                        Færdig
                      </Link>
                      <Link
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-sage-700 px-4 text-sm font-semibold text-white transition hover:bg-sage-800"
                        href={pauseMessageHref(facilitator, returnHref)}
                      >
                        <Mail className="size-4" aria-hidden="true" />
                        Send besked til arrangør
                      </Link>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink/68">
                  <span className="rounded-full bg-midnight/5 px-2.5 py-1">Seneste event: {formatDate(facilitator.latest_event_at)}</span>
                </div>
              </>
            );

            return (
              <FacilitatorAdminCard
                actions={actions}
                badges={metadataBadges}
                chips={[...(facilitator.facilitator_categories ?? []), ...(facilitator.facilitator_tags ?? [])]}
                contactLine={contactLine}
                description={facilitator.short_description || facilitator.long_description || "Ingen profiltekst endnu."}
                facilitator={facilitator}
                footer={footer}
                isHighlighted={highlightedFacilitatorId === facilitator.id}
                key={facilitator.id}
                loginActivityLine={loginActivityText(facilitator)}
                metaLine={"Oprettet " + formatDate(facilitator.created_at)}
                metrics={[
                  { label: "Aktive events", value: facilitator.active_events },
                  { label: "Events i alt", value: facilitator.event_count },
                  { label: "Afholdte", value: facilitator.completed_events },
                  { label: "Kladder", value: facilitator.draft_events },
                  { label: "Tilmeldinger", value: facilitator.total_bookings },
                  { label: "Afventer", tone: facilitator.pending_bookings > 0 ? "attention" : "neutral", value: facilitator.pending_bookings },
                ]}
                specialties={splitSpecialties(facilitator.specialties)}
                task={getFacilitatorAdminTask({
                  facilitator,
                })}
              />
            );
            })}
          </div>
        </AdminActionMenuScope>
      )}
    </section>
  );
}
