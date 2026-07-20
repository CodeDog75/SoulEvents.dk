"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";
import { getString } from "@/lib/forms/form-data";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendInspiratorContactAction(formData: FormData) {
  const slug = getString(formData, "slug");
  const name = getString(formData, "name");
  const email = getString(formData, "email");
  const message = getString(formData, "message");

  if (!slug || !name || !email || !message || message.length > 1000 || !email.includes("@")) {
    redirect("/inspiration/" + encodeURIComponent(slug || "") + "?contact=error#contact");
  }

  const supabase = createAdminClient();
  const { data: inspirator } = await supabase
    .from("inspirator_profiles")
    .select("name, contact_email")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!inspirator?.contact_email) {
    redirect("/inspiration/" + encodeURIComponent(slug) + "?contact=email-missing#contact");
  }

  if (!env.resendApiKey || !env.resendFromEmail) {
    redirect("/inspiration/" + encodeURIComponent(slug) + "?contact=email-missing#contact");
  }

  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");
  const html = await renderEmailLayout({
    title: "Ny besked via SoulEvents.dk",
    children: [
      renderEmailTable([
        ["Til", inspirator.name],
        ["Navn", name],
        ["E-mail", email],
      ]),
      '<p style="margin: 22px 0 8px; font-weight: 700;">Besked</p>',
      `<p style="margin: 0; white-space: pre-line;">${safeMessage}</p>`,
    ].join(""),
  });

  await sendLoggedEmail({
    type: "inspirator_contact",
    to: inspirator.contact_email,
    replyTo: email,
    subject: "Ny besked via SoulEvents.dk til " + inspirator.name,
    html,
    text: `Ny besked via SoulEvents.dk

Til: ${inspirator.name}
Navn: ${name}
E-mail: ${email}

Besked:
${message}
${renderPlainTextFooter().join("\n")}`,
  });

  redirect("/inspiration/" + encodeURIComponent(slug) + "?contact=sent#contact");
}
