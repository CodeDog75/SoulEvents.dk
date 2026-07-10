"use client";

import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useState } from "react";

type ShareFacilitatorButtonProps = {
  facilitatorName: string;
  facilitatorId: string;
};

export function ShareFacilitatorButton({ facilitatorName, facilitatorId }: ShareFacilitatorButtonProps) {
  const [copied, setCopied] = useState(false);
  const relativeUrl = "/facilitators/" + facilitatorId;

  function getShareUrl() {
    return typeof window === "undefined" ? relativeUrl : window.location.origin + relativeUrl;
  }

  function getShareText(url: string) {
    return "Jeg fandt " + facilitatorName + " på SoulEvents.dk. Se profilen her: " + url;
  }

  function getMailHref(url: string) {
    return "mailto:?subject=" + encodedSubject + "&body=" + encodeURIComponent(getShareText(url));
  }

  function getSmsHref(url: string) {
    return "sms:?&body=" + encodeURIComponent(getShareText(url));
  }

  const text = getShareText(relativeUrl);
  const encodedText = encodeURIComponent(text);
  const encodedSubject = encodeURIComponent(facilitatorName + " | Arrangør på SoulEvents.dk");

  async function shareNative() {
    const url = getShareUrl();
    const text = getShareText(url);
    if (navigator.share) {
      await navigator.share({ title: facilitatorName + " | SoulEvents.dk", text, url });
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function updateMailHref(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = getMailHref(getShareUrl());
  }

  function updateSmsHref(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = getSmsHref(getShareUrl());
  }

  return (
    <section className="rounded-card bg-white p-6 shadow-soft">
      <h2 className="text-3xl font-medium text-olive">Del arrangør</h2>
      <div className="mt-4 grid gap-2">
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-button bg-olive px-4 text-sm font-semibold text-white"
          onClick={shareNative}
          type="button"
        >
          <Share2 className="size-4" aria-hidden="true" />
          Del profil
        </button>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive"
          onClick={copyLink}
          type="button"
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Link kopieret" : "Kopiér link"}
        </button>
        <a
          className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive"
          href={"mailto:?subject=" + encodedSubject + "&body=" + encodedText}
          onClick={updateMailHref}
          suppressHydrationWarning
        >
          <Mail className="size-4" aria-hidden="true" />
          E-mail
        </a>
        <a
          className="inline-flex h-11 items-center justify-center gap-2 rounded-button border border-olive/15 bg-white px-4 text-sm font-semibold text-olive"
          href={"sms:?&body=" + encodedText}
          onClick={updateSmsHref}
          suppressHydrationWarning
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          SMS
        </a>
      </div>
    </section>
  );
}
