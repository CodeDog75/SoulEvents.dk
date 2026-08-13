import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { respondToExternalCoOrganizerInvitationAction } from "@/app/facilitator/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  externalInvitationLoginHref,
  externalInvitationSignupHref,
  hashExternalInvitationToken,
  isActivePublicEventForExternalInvitation,
  maskInvitationEmail,
  normalizeInvitationEmail,
} from "@/lib/co-organizers/external-invitations";
import { getCurrentProfile } from "@/lib/auth/roles";
import { formatDanishEventDate, formatDanishEventTime } from "@/lib/events/date-format";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ExternalCoOrganizerInvitationPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ message?: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  return formatDanishEventDate(value);
}

function formatTime(value?: string | null) {
  return formatDanishEventTime(value);
}

function formatLocation(input: {
  address_line?: string | null;
  city?: string | null;
  event_format?: string | null;
  postal_code?: string | null;
}) {
  if (input.event_format === "online") return "Online";
  return [input.address_line, [input.postal_code, input.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Sted mangler";
}

type InvitationEventSummaryProps = {
  coverImageUrl?: string | null;
  event?: {
    address_line?: string | null;
    city?: string | null;
    cover_image_path?: string | null;
    event_format?: string | null;
    starts_at?: string | null;
    title?: string | null;
    postal_code?: string | null;
  } | null;
};

function InvitationEventSummary({ coverImageUrl, event }: InvitationEventSummaryProps) {
  return (
    <div className="overflow-hidden rounded-card border border-[#E5D4F7] bg-[#FAF8FC]">
      {coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" className="aspect-[16/7] w-full object-cover" src={coverImageUrl} />
      ) : null}
      <div className="grid gap-3 p-4 text-sm text-ink/72">
        <p className="text-base font-semibold text-midnight">{event?.title ?? "Event"}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
            <span>{formatDate(event?.starts_at)}</span>
          </div>
          <div className="flex gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
            <span>{formatTime(event?.starts_at)}</span>
          </div>
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#7A5D91]" aria-hidden="true" />
            <span>{formatLocation(event ?? {})}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvitationAuthCard({
  coverImageUrl,
  currentEmail,
  email,
  event,
  eventTitle,
  isWrongAccount = false,
  primaryOrganizerName,
  token,
}: {
  coverImageUrl?: string | null;
  currentEmail?: string | null;
  email?: string | null;
  event?: InvitationEventSummaryProps["event"];
  eventTitle?: string | null;
  isWrongAccount?: boolean;
  primaryOrganizerName: string;
  token: string;
}) {
  return (
    <main className="min-h-screen bg-cream px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-2xl gap-5">
        <section className="rounded-card bg-white p-6 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Invitation til samarbejde</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-midnight">
            {isWrongAccount ? "Invitationen tilhører en anden konto" : "Du er inviteret som medarrangør"}
          </h1>
          <p className="mt-4 text-sm leading-6 text-ink/70">
            <span className="font-semibold text-midnight">{primaryOrganizerName}</span> vil gerne have dig med som medarrangør på eventet{" "}
            <span className="font-semibold text-midnight">"{eventTitle ?? "eventet"}"</span>.
          </p>
          <p className="mt-3 text-sm leading-6 text-ink/70">
            For at kunne blive vist som medarrangør på eventet skal du først oprette en gratis arrangørprofil på SoulEvents. Det tager kun et par minutter.
          </p>
          <div className="mt-5">
            <InvitationEventSummary coverImageUrl={coverImageUrl} event={event} />
          </div>
          <div className="mt-5 grid gap-2 rounded-card border border-[#E5D4F7] bg-[#FAF8FC] p-4 text-sm text-ink/72">
            {currentEmail ? (
              <p>
                Du er logget ind med: <span className="font-semibold text-midnight">{currentEmail}</span>
              </p>
            ) : null}
            {email ? (
              <p>
                Invitationen er sendt til: <span className="font-semibold text-midnight">{maskInvitationEmail(email)}</span>
              </p>
            ) : null}
            <p>Invitationen forpligter dig ikke til noget.</p>
            <p>Du bliver først vist offentligt som medarrangør, når du selv har accepteret invitationen, og din profil er godkendt.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="inline-flex h-11 items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft" href={externalInvitationSignupHref(token, email)}>
              Opret gratis profil
            </Link>
            <Link className="inline-flex h-11 items-center justify-center rounded-button border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#6E5A86]" href={externalInvitationLoginHref(token, email)}>
              Log ind og accepter invitation
            </Link>
            {isWrongAccount ? <SignOutButton /> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

export default async function ExternalCoOrganizerInvitationPage({ params, searchParams }: ExternalCoOrganizerInvitationPageProps) {
  const [{ token }, { message }, profile] = await Promise.all([params, searchParams, getCurrentProfile()]);
  const supabase = createAdminClient();
  const tokenHash = hashExternalInvitationToken(token);
  const { data: invitation } = await (supabase as any)
    .from("event_cohost_invitations")
    .select("id, email, name, status, expires_at, events(id, title, starts_at, ends_at, status, address_line, postal_code, city, event_format, cover_image_path, facilitator_profiles!events_facilitator_id_fkey(company_name, status, is_paused, is_disabled, profiles!facilitator_profiles_profile_id_fkey(full_name)))")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invitation) {
    redirect("/facilitator?message=" + encodeURIComponent("Invitationen kunne ikke findes."));
  }

  const event = first(invitation.events);
  const primaryOrganizer = first(event?.facilitator_profiles);
  const primaryOrganizerUser = first(primaryOrganizer?.profiles);
  const primaryOrganizerName = primaryOrganizer?.company_name || primaryOrganizerUser?.full_name || "Arrangør";
  const coverImageUrl = event?.cover_image_path ? supabase.storage.from("media").getPublicUrl(event.cover_image_path).data.publicUrl : null;
  const isExpired = new Date(invitation.expires_at).getTime() < Date.now();
  const eventIsAvailable =
    event &&
    isActivePublicEventForExternalInvitation(event) &&
    primaryOrganizer?.status === "approved" &&
    !primaryOrganizer.is_paused &&
    !primaryOrganizer.is_disabled;

  if (!profile) {
    return (
      <InvitationAuthCard
        coverImageUrl={coverImageUrl}
        email={invitation.email}
        event={event}
        eventTitle={event?.title}
        primaryOrganizerName={primaryOrganizerName}
        token={token}
      />
    );
  }

  if (normalizeInvitationEmail(profile.email) !== invitation.email) {
    return (
      <InvitationAuthCard
        coverImageUrl={coverImageUrl}
        currentEmail={profile.email}
        email={invitation.email}
        event={event}
        eventTitle={event?.title}
        isWrongAccount
        primaryOrganizerName={primaryOrganizerName}
        token={token}
      />
    );
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-4xl gap-5">
        <Link className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-ink/64 transition hover:text-midnight" href="/facilitator">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til dashboard
        </Link>
        <AuthMessage message={message} />

        <section className="overflow-hidden rounded-card bg-white shadow-soft">
          <div className="grid gap-6 p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Invitation til samarbejde</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-midnight sm:text-4xl">Du er inviteret som medarrangør</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
                <span className="font-semibold text-midnight">{primaryOrganizerName}</span> vil gerne have dig med som medarrangør på eventet{" "}
                <span className="font-semibold text-midnight">"{event?.title ?? "eventet"}"</span>.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
                For at kunne blive vist som medarrangør på eventet skal du først oprette en gratis arrangørprofil på SoulEvents. Det tager kun et par minutter.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
                Når din profil er oprettet, og den er blevet godkendt, kan du acceptere invitationen og bliver automatisk vist som medarrangør på eventet.
              </p>
              <p className="mt-2 text-sm text-ink/58">Invitationen er sendt til {maskInvitationEmail(invitation.email)}.</p>
            </div>

            <InvitationEventSummary coverImageUrl={coverImageUrl} event={event} />

            <div className="rounded-card border border-[#E5D4F7] bg-[#FAF8FC] p-4 text-sm leading-6 text-ink/72">
              <p className="font-semibold text-midnight">Det er godt at vide</p>
              <ul className="mt-2 grid gap-2">
                <li>Det er gratis at oprette en arrangørprofil.</li>
                <li>Invitationen forpligter dig ikke til noget.</li>
                <li>Du bliver først vist offentligt som medarrangør, når du selv har accepteret invitationen, og din profil er godkendt.</li>
              </ul>
            </div>

            {isExpired ? (
              <p className="rounded-card border border-[#E8D2CC] bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#9A4F45]">
                Invitationen er udløbet. Bed arrangøren sende en ny invitation.
              </p>
            ) : !eventIsAvailable ? (
              <p className="rounded-card border border-[#E8D2CC] bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#9A4F45]">
                Eventet findes ikke længere eller kan ikke modtage medarrangører.
              </p>
            ) : invitation.status === "pending" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <form action={respondToExternalCoOrganizerInvitationAction}>
                  <input name="token" type="hidden" value={token} />
                  <button className="inline-flex h-12 w-full items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft" name="response" type="submit" value="accepted">
                    Accepter invitation
                  </button>
                </form>
                <form action={respondToExternalCoOrganizerInvitationAction}>
                  <input name="token" type="hidden" value={token} />
                  <button className="inline-flex h-12 w-full items-center justify-center rounded-button border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#6E5A86]" name="response" type="submit" value="declined">
                    Nej tak
                  </button>
                </form>
              </div>
            ) : (
              <p className="rounded-card border border-[#E8E0D2] bg-[#FAF6EF] px-4 py-3 text-sm font-semibold text-ink/68">
                Invitationen er allerede behandlet.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
