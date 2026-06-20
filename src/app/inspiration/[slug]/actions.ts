"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
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

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  await sendLoggedEmail({
    type: "inspirator_contact",
    to: inspirator.contact_email,
    replyTo: email,
    subject: "Ny besked via SoulEvents.dk til " + inspirator.name,
    html: `
      <h1>Ny besked via SoulEvents.dk</h1>
      <p><strong>Til:</strong> ${escapeHtml(inspirator.name)}</p>
      <p><strong>Navn:</strong> ${safeName}</p>
      <p><strong>E-mail:</strong> ${safeEmail}</p>
      <p><strong>Besked:</strong></p>
      <p>${safeMessage}</p>
    `,
    text: `Ny besked via SoulEvents.dk

Til: ${inspirator.name}
Navn: ${name}
E-mail: ${email}

Besked:
${message}`,
  });

  redirect("/inspiration/" + encodeURIComponent(slug) + "?contact=sent#contact");
}
