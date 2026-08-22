"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { sendNewsletterTestAction } from "@/app/admin/newsletters/actions";

type NewsletterTestMailFormProps = {
  newsletterId: string;
};

export function NewsletterTestMailForm({ newsletterId }: NewsletterTestMailFormProps) {
  const [testEmail, setTestEmail] = useState("");
  const trimmedEmail = testEmail.trim();

  return (
    <form action={sendNewsletterTestAction} className="rounded-[20px] border border-[#D8CBE4] bg-[#F7F2FB] p-4">
      <input name="newsletter_id" type="hidden" value={newsletterId} />
      <label className="grid gap-2 text-sm font-semibold text-midnight">
        Testmail
        <input
          className="h-11 rounded-md border border-midnight/15 bg-white px-3"
          name="test_email"
          onChange={(event) => setTestEmail(event.currentTarget.value)}
          placeholder="test@soulevents.dk"
          required
          type="email"
          value={testEmail}
        />
      </label>
      <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-[#D8CBE4] bg-white px-4 text-sm font-semibold text-[#7A4EAB]" type="submit">
        <Send className="size-4" aria-hidden="true" />
        {trimmedEmail ? `Send testmail til ${trimmedEmail}` : "Send testmail"}
      </button>
    </form>
  );
}
