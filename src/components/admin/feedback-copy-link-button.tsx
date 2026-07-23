"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

export function FeedbackCopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-midnight transition hover:text-[#7A4EAB]"
      onClick={copy}
      type="button"
    >
      <Link2 className="size-3.5" aria-hidden="true" />
      {copied ? "Link kopieret" : "Kopiér link"}
    </button>
  );
}
