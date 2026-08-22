"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import {
  defaultInvitationBody,
  defaultInvitationButtonLabel,
  defaultInvitationButtonUrl,
  defaultInvitationPreheader,
  defaultInvitationSignoff,
  defaultInvitationSubject,
} from "@/lib/newsletters/facilitator-invitation-shared";

type FacilitatorInvitationEditorProps = {
  initialBody?: string | null;
  initialButtonLabel?: string | null;
  initialButtonUrl?: string | null;
  initialPreheader?: string | null;
  initialSignoff?: string | null;
  initialSubject?: string | null;
  templateId?: string | null;
};

function applyPreviewPlaceholders(body: string, name: string, personalIntro: string, buttonLabel: string) {
  return body
    .replaceAll("[navn]", name || "navn")
    .replaceAll("[personlig_indledning]", personalIntro)
    .replaceAll("[Bliv arrangør på SoulEvents]", buttonLabel || defaultInvitationButtonLabel);
}

export function FacilitatorInvitationEditor({
  initialBody,
  initialButtonLabel,
  initialButtonUrl,
  initialPreheader,
  initialSignoff,
  initialSubject,
  templateId,
}: FacilitatorInvitationEditorProps) {
  const [subject, setSubject] = useState(initialSubject || defaultInvitationSubject);
  const [preheader, setPreheader] = useState(initialPreheader || defaultInvitationPreheader);
  const [body, setBody] = useState(initialBody || defaultInvitationBody);
  const [buttonLabel, setButtonLabel] = useState(initialButtonLabel || defaultInvitationButtonLabel);
  const [buttonUrl, setButtonUrl] = useState(initialButtonUrl || defaultInvitationButtonUrl);
  const [signoff, setSignoff] = useState(initialSignoff || defaultInvitationSignoff);
  const [previewName, setPreviewName] = useState("Kristian");
  const [previewIntro, setPreviewIntro] = useState("Jeg blev særligt nysgerrig på den måde, du skaber rum for nærvær og fordybelse.");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  const previewBody = useMemo(() => applyPreviewPlaceholders(body, previewName, previewIntro, buttonLabel), [body, buttonLabel, previewIntro, previewName]);

  return (
    <section className="grid gap-5">
      <input name="template_id" type="hidden" value={templateId ?? ""} />

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Standardskabelon</p>
        <h2 className="mt-1 text-xl font-semibold text-midnight">Invitation til nye arrangører</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Emne
            <input className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700" maxLength={180} name="subject" onChange={(event) => setSubject(event.currentTarget.value)} required value={subject} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Preheader
            <input className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700" maxLength={220} name="preheader" onChange={(event) => setPreheader(event.currentTarget.value)} value={preheader} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Indhold
            <textarea className="min-h-[28rem] rounded-md border border-midnight/15 bg-white p-4 text-sm leading-7 outline-none transition focus:border-sage-700" name="body" onChange={(event) => setBody(event.currentTarget.value)} required value={body} />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-midnight">
              Knaptekst
              <input className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700" maxLength={90} name="button_label" onChange={(event) => setButtonLabel(event.currentTarget.value)} required value={buttonLabel} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-midnight">
              Knaplink
              <input className="h-12 rounded-md border border-midnight/15 bg-white px-4 text-base outline-none transition focus:border-sage-700" name="button_url" onChange={(event) => setButtonUrl(event.currentTarget.value)} required value={buttonUrl} />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Afslutning
            <textarea className="min-h-32 rounded-md border border-midnight/15 bg-white p-4 text-sm leading-7 outline-none transition focus:border-sage-700" name="signoff" onChange={(event) => setSignoff(event.currentTarget.value)} required value={signoff} />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sage-700">Forhåndsvisning</p>
            <h2 className="mt-1 text-xl font-semibold text-midnight">Se invitationen</h2>
          </div>
          <div className="flex rounded-full bg-[#F4F0F7] p-1">
            <button className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold ${previewMode === "desktop" ? "bg-white text-midnight shadow-soft" : "text-ink/58"}`} onClick={() => setPreviewMode("desktop")} type="button">
              <Monitor className="size-4" aria-hidden="true" />
              Computer
            </button>
            <button className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold ${previewMode === "mobile" ? "bg-white text-midnight shadow-soft" : "text-ink/58"}`} onClick={() => setPreviewMode("mobile")} type="button">
              <Smartphone className="size-4" aria-hidden="true" />
              Mobil
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Preview-navn
            <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" onChange={(event) => setPreviewName(event.currentTarget.value)} value={previewName} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-midnight">
            Personlig indledning
            <input className="h-11 rounded-md border border-midnight/15 bg-white px-3" name="preview_intro" onChange={(event) => setPreviewIntro(event.currentTarget.value)} value={previewIntro} />
          </label>
          <input name="preview_name" type="hidden" value={previewName} />
        </div>

        <div className={`mx-auto mt-5 overflow-hidden rounded-[28px] border border-[#E5DDEA] bg-[#FAF6EF] p-3 ${previewMode === "mobile" ? "max-w-sm" : "max-w-3xl"}`}>
          <div className="rounded-[24px] bg-white">
            <div className="rounded-t-[24px] bg-gradient-to-br from-[#4B5645] to-[#7A4EAB] p-6 text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="SoulEvents.dk" className="mb-4 size-[72px] object-contain" src="/brand/soulevents-logo.png" />
              <h3 className="mt-2 font-serif text-3xl font-semibold leading-tight">En varm invitation</h3>
              {preheader ? <p className="mt-3 text-sm leading-6 text-white/82">{preheader}</p> : null}
            </div>
            <div className="grid gap-4 p-6">
              <div className="whitespace-pre-line text-sm leading-7 text-ink/72">{previewBody}</div>
              <span className="mt-2 inline-flex w-fit min-h-11 items-center rounded-full bg-[#7A4EAB] px-5 text-sm font-semibold text-white">{buttonLabel || defaultInvitationButtonLabel}</span>
              <span className="text-sm text-[#7A4EAB]">{buttonUrl || defaultInvitationButtonUrl}</span>
              <div className="whitespace-pre-line text-sm leading-7 text-ink/72">{signoff}</div>
            </div>
            <div className="rounded-b-[24px] bg-[#F4F0F7] p-5 text-xs leading-5 text-ink/58">
              SoulEvents.dk · Link til “kontakt mig ikke igen” vises i rigtige invitationer.
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
