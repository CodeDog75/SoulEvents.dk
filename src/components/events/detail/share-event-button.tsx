"use client";

import { Copy, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { trackAnalyticsEvent, type AnalyticsShareMethod } from "@/lib/analytics/client";
import { publicEventPath } from "@/lib/slug";

type ShareEventButtonProps = {
  eventId: string;
  eventSlug?: string | null;
  eventTitle: string;
  facilitatorName: string;
  startsAt: string;
};

function formatEventDate(startsAt: string) {
  return new Intl.DateTimeFormat("da-DK", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(startsAt));
}

export function ShareEventButton({ eventId, eventSlug, eventTitle, facilitatorName, startsAt }: ShareEventButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareData = useMemo(() => {
    const relativeUrl = publicEventPath(eventSlug || eventId);
    const eventUrl =
      typeof window === "undefined"
        ? relativeUrl
        : window.location.origin + relativeUrl;
    const eventDate = formatEventDate(startsAt);
    const text =
      "Jeg fandt dette event på SoulEvents: " +
      eventTitle +
      " med " +
      facilitatorName +
      " den " +
      eventDate +
      ". Se mere her: " +
      eventUrl;

    return {
      eventUrl,
      text,
      title: eventTitle,
    };
  }, [eventId, eventSlug, eventTitle, facilitatorName, startsAt]);

  async function shareEvent() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareData.title,
          text: shareData.text,
          url: shareData.eventUrl,
        });
        trackAnalyticsEvent({ eventId, shareMethod: "native_share", type: "event_share" });
        return;
      } catch {
        return;
      }
    }

    setMenuOpen((current) => !current);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareData.eventUrl);
      setCopied(true);
      trackAnalyticsEvent({ eventId, shareMethod: "copy_link", type: "event_share" });
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMenuOpen(true);
    }
  }

  function trackShareMethod(shareMethod: AnalyticsShareMethod) {
    trackAnalyticsEvent({ eventId, shareMethod, type: "event_share" });
  }

  const encodedText = encodeURIComponent(shareData.text);
  const encodedUrl = encodeURIComponent(shareData.eventUrl);
  const mailHref = "mailto:?subject=" + encodeURIComponent("Event på SoulEvents: " + eventTitle) + "&body=" + encodedText;
  const smsHref = "sms:?&body=" + encodedText;
  const messengerHref = "https://www.facebook.com/sharer/sharer.php?u=" + encodedUrl;

  return (
    <section className="rounded-card border border-sage-700/15 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-olive">Del event</h2>
          <p className="mt-1 text-sm leading-6 text-ink/64">Send eventet til en ven eller gem linket til senere.</p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-button bg-olive px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          onClick={shareEvent}
          type="button"
        >
          <Share2 className="size-4" aria-hidden="true" />
          Del event
        </button>
      </div>

      {(menuOpen || copied) && (
        <div className="mt-4 grid gap-2">
          {copied && <p className="rounded-md bg-sage-50 px-3 py-2 text-sm font-semibold text-olive">Link kopieret</p>}
          {menuOpen && (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-olive/15 bg-white px-3 py-2 text-sm font-semibold text-olive transition hover:border-sage-700 hover:bg-sage-50"
                onClick={copyLink}
                type="button"
              >
                <Copy className="size-4" aria-hidden="true" />
                Kopiér link
              </button>
              <a
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-olive/15 bg-white px-3 py-2 text-sm font-semibold text-olive transition hover:border-sage-700 hover:bg-sage-50"
                href={mailHref}
                onClick={() => trackShareMethod("email")}
              >
                <Mail className="size-4" aria-hidden="true" />
                Del via e-mail
              </a>
              <a
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-olive/15 bg-white px-3 py-2 text-sm font-semibold text-olive transition hover:border-sage-700 hover:bg-sage-50"
                href={smsHref}
                onClick={() => trackShareMethod("sms")}
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                Del via SMS
              </a>
              <a
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-olive/15 bg-white px-3 py-2 text-sm font-semibold text-olive transition hover:border-sage-700 hover:bg-sage-50"
                href={messengerHref}
                onClick={() => trackShareMethod("messenger")}
                rel="noreferrer"
                target="_blank"
              >
                <Send className="size-4" aria-hidden="true" />
                Del via Messenger
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
