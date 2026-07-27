import { Mail } from "lucide-react";
import {
  activateFacilitatorProfileAction,
  requestFacilitatorProfileClosureAction,
  sendFacilitatorAdminMessageAction,
} from "@/app/facilitator/actions";
import {
  FacilitatorClearMessagesAction,
  FacilitatorMessageRemoveAction,
  FacilitatorMessageReplyAction,
} from "@/components/facilitator/facilitator-message-actions";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Tidspunkt mangler";
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MessageStatusLabel({ status, type }: { status: string; type?: string }) {
  if (type === "admin_reply" && status === "unread") {
    return "Ny besked";
  }
  if (type === "admin_reply" && status === "read") {
    return "Læst";
  }

  const labels: Record<string, string> = {
    handled: "Behandlet",
    read: "Set af administrationen",
    unread: "Afventer svar",
  };

  return labels[status] ?? status;
}

function MessageSenderLabel({ type }: { type?: string | null }) {
  return type === "admin_reply" ? "SoulEvents administration" : "Dig";
}

export function FacilitatorAdminMessagesSection({
  adminMessages,
}: {
  adminMessages: Array<{
    created_at: string | null;
    id: string;
    message: string | null;
    status: string;
    subject: string | null;
    type?: string | null;
  }>;
}) {
  if (adminMessages.length === 0) {
    return (
      <section className="rounded-[20px] bg-[#F4F0F7] p-5">
        <h2 className="font-semibold text-[#2F2437]">Beskedhistorik</h2>
        <p className="mt-2 text-sm leading-6 text-[#6E6475]">Der er endnu ingen beskeder mellem dig og SoulEvents administration.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] bg-[#F4F0F7] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#2F2437]">Beskedhistorik</h2>
          <p className="mt-1 text-sm leading-6 text-[#6E6475]">
            Nyeste beskeder vises øverst. Dine beskeder gemmes i op til 3 måneder og slettes derefter automatisk.
          </p>
        </div>
        <FacilitatorClearMessagesAction />
      </div>
      <div className="mt-4 grid gap-3">
        {adminMessages.map((item) => (
          <article
            className={
              "rounded-[16px] border p-4 text-sm " +
              (item.type === "admin_reply" ? "border-[#D8CBE4] bg-white" : "border-[#E8E0D8] bg-[#FFFDF9]")
            }
            key={item.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7A5D91]">
                  <MessageSenderLabel type={item.type} />
                </p>
                <p className="mt-1 font-semibold text-[#2F2437]">{item.subject}</p>
              </div>
              {item.type === "admin_reply" ? (
                <span className="rounded-full bg-[#FAF7F2] px-3 py-1 text-xs font-semibold text-[#6E6475]">
                  <MessageStatusLabel status={item.status} type={item.type ?? undefined} />
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-semibold text-[#8B7F93]">
              Sendt {formatDateTime(item.created_at)}
            </p>
            <p className="mt-2 leading-6 text-[#6E6475]">{item.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.type === "admin_reply" ? <FacilitatorMessageReplyAction /> : null}
              <FacilitatorMessageRemoveAction messageId={item.id} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FacilitatorSupportForm() {
  return (
    <form action={sendFacilitatorAdminMessageAction} className="rounded-[20px] border border-[#E5DDEA] bg-[#FAF7F2] p-5" id="kontakt-support">
      <input name="return_to" type="hidden" value="/facilitator/messages" />
      <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Kontakt</p>
      <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Skriv til SoulEvents</h2>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">Send en kort besked direkte til SoulEvents.dk. Maks. 500 tegn.</p>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">
        Dine beskeder gemmes i op til 3 måneder og slettes derefter automatisk.
      </p>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
        Emne
        <input className="h-11 rounded-md border border-[#E5DDEA] px-3 outline-none focus:border-[#7A5D91]" maxLength={80} name="subject" placeholder="Fx spørgsmål til min profil" />
      </label>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
        Besked
        <textarea className="min-h-28 scroll-mt-24 rounded-md border border-[#E5DDEA] p-3 outline-none focus:border-[#7A5D91]" id="facilitator-support-message" maxLength={500} name="message" placeholder="Skriv højst 500 tegn..." required />
      </label>
      <button className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#7A5D91] px-5 text-sm font-semibold text-white" type="submit">
        <Mail className="size-4" aria-hidden="true" />
        Send besked
      </button>
    </form>
  );
}

export function FacilitatorPauseSection({ isPaused }: { isPaused: boolean }) {
  return isPaused ? (
    <form action={activateFacilitatorProfileAction} className="rounded-[20px] border border-[#D7E4D1] bg-[#F3F7F0] p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#5F7A55]">Aktivér</p>
      <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Aktivér profil igen</h2>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">
        Når du aktiverer profilen igen, kan din offentlige profil og dine aktive events vises på SoulEvents efter de eksisterende regler.
      </p>
      <button className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[#5F7A55] px-5 text-sm font-semibold text-white" type="submit">
        Aktivér profil igen
      </button>
    </form>
  ) : (
    <form action={requestFacilitatorProfileClosureAction} className="rounded-[20px] border border-[#E9CED6] bg-[#FFF8FA] p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#7A5D91]">Pause</p>
      <h2 className="mt-1 text-lg font-semibold text-[#2F2437]">Sæt profil på pause</h2>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">
        Har du brug for en pause, kan du midlertidigt skjule din profil på SoulEvents.
      </p>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">
        Din offentlige profil og dine kommende events bliver skjult. Du kan selv aktivere profilen igen, når du ønsker at vende tilbage.
      </p>
      <p className="mt-2 text-sm leading-6 text-[#6E6475]">
        Ønsker du i stedet at få slettet din profil og dine data, kan du skrive det i kommentarfeltet nedenfor.
      </p>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#2F2437]">
        Kommentar (valgfri)
        <textarea className="min-h-24 rounded-md border border-[#E5DDEA] bg-white p-3 outline-none focus:border-[#7A5D91]" maxLength={500} name="reason" placeholder="Skriv gerne hvorfor du ønsker pause. Hvis du ønsker datasletning, så skriv det her." />
      </label>
      <label className="mt-4 flex items-start gap-3 text-sm font-semibold text-[#2F2437]">
        <input className="mt-1 size-4 accent-[#7A5D91]" name="confirm_closure" type="checkbox" />
        Jeg er sikker på, at jeg ønsker at sætte min arrangørprofil på pause.
      </label>
      <button className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-[#7A5D91] bg-white px-5 text-sm font-semibold text-[#7A5D91]" type="submit">
        Sæt profil på pause
      </button>
    </form>
  );
}
