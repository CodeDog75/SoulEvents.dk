import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, UsersRound } from "lucide-react";
import { respondToCoOrganizerInvitationAction } from "@/app/facilitator/events/actions";
import { AuthMessage } from "@/components/auth/auth-message";
import { requireRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CoOrganizerInvitationPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ message?: string }>;
};

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value?: string | null) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatLocation(input: { address_line?: string | null; city?: string | null; postal_code?: string | null }) {
  return [input.address_line, [input.postal_code, input.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Sted mangler";
}

export default async function CoOrganizerInvitationPage({ params, searchParams }: CoOrganizerInvitationPageProps) {
  const [{ token }, { message }, profile] = await Promise.all([params, searchParams, requireRole("facilitator")]);
  const supabase = createAdminClient();

  const [{ data: facilitatorProfile }, { data: invitation }] = await Promise.all([
    supabase.from("facilitator_profiles").select("id").eq("profile_id", profile.id).maybeSingle(),
    supabase
      .from("event_co_organizers")
      .select(
        "id, status, response_token, co_organizer_profile_id, events(id, title, starts_at, address_line, postal_code, city, cover_image_path, facilitator_profiles!events_facilitator_id_fkey(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)))",
      )
      .eq("response_token", token)
      .maybeSingle(),
  ]);

  if (!facilitatorProfile || !invitation || invitation.co_organizer_profile_id !== facilitatorProfile.id) {
    notFound();
  }

  const event = first(invitation.events);
  const primaryOrganizer = first(event?.facilitator_profiles);
  const primaryOrganizerUser = first(primaryOrganizer?.profiles);
  const primaryOrganizerName = primaryOrganizer?.company_name || primaryOrganizerUser?.full_name || "Arrangør";
  const coverImageUrl = event?.cover_image_path ? supabase.storage.from("media").getPublicUrl(event.cover_image_path).data.publicUrl : null;

  return (
    <main className="min-h-screen bg-cream px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-4xl gap-5">
        <Link className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-ink/64 transition hover:text-midnight" href="/facilitator">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Tilbage til dashboard
        </Link>
        <AuthMessage message={message} />

        <section className="overflow-hidden rounded-card bg-white shadow-soft">
          {coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="aspect-[16/7] w-full object-cover" src={coverImageUrl} />
          ) : (
            <div className="grid aspect-[16/7] place-items-center bg-[#F7F2FB] text-[#7A5D91]">
              <UsersRound className="size-14" aria-hidden="true" />
            </div>
          )}

          <div className="grid gap-6 p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Invitation til samarbejde</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-midnight sm:text-4xl">{event?.title ?? "Event"}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
                Du er inviteret til at blive vist som medarrangør. Den primære arrangør ejer og administrerer eventet og modtager alle tilmeldinger.
              </p>
            </div>

            <div className="grid gap-3 rounded-card border border-[#E5D4F7] bg-[#FAF8FC] p-4 text-sm text-ink/72">
              <div className="flex gap-2">
                <CalendarDays className="mt-0.5 size-4 text-[#7A5D91]" aria-hidden="true" />
                <span>{formatDate(event?.starts_at)}</span>
              </div>
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 text-[#7A5D91]" aria-hidden="true" />
                <span>{formatLocation(event ?? {})}</span>
              </div>
              <div className="flex gap-2">
                <UsersRound className="mt-0.5 size-4 text-[#7A5D91]" aria-hidden="true" />
                <span>Primær arrangør: {primaryOrganizerName}</span>
              </div>
            </div>

            {invitation.status === "pending" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <form action={respondToCoOrganizerInvitationAction}>
                  <input name="invitation_id" type="hidden" value={invitation.id} />
                  <input name="token" type="hidden" value={token} />
                  <button className="inline-flex h-12 w-full items-center justify-center rounded-button bg-[#7A5D91] px-5 text-sm font-semibold text-white shadow-soft" name="response" type="submit" value="accepted">
                    Acceptér invitation
                  </button>
                </form>
                <form action={respondToCoOrganizerInvitationAction}>
                  <input name="invitation_id" type="hidden" value={invitation.id} />
                  <input name="token" type="hidden" value={token} />
                  <button className="inline-flex h-12 w-full items-center justify-center rounded-button border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#6E5A86]" name="response" type="submit" value="declined">
                    Afvis invitation
                  </button>
                </form>
              </div>
            ) : invitation.status === "accepted" ? (
              <form action={respondToCoOrganizerInvitationAction}>
                <input name="invitation_id" type="hidden" value={invitation.id} />
                <input name="token" type="hidden" value={token} />
                <button className="inline-flex h-12 w-full items-center justify-center rounded-button border border-[#D8CBE4] bg-white px-5 text-sm font-semibold text-[#6E5A86] sm:w-auto" name="response" type="submit" value="withdrawn">
                  Træk mig som medarrangør
                </button>
              </form>
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
