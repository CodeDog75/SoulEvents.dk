"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

const CONTACT_EMAIL = "kontakt@soulevents.dk";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendContactMessageAction(formData: FormData) {
  const name = getValue(formData, "name");
  const email = getValue(formData, "email");
  const phone = getValue(formData, "phone");
  const message = getValue(formData, "message");

  if (!name || !email || !message || message.length > 500 || !email.includes("@")) {
    redirect("/?contact=error#contact");
  }

  if (!env.resendApiKey || !env.resendFromEmail) {
    redirect("/?contact=email-missing#contact");
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = phone ? escapeHtml(phone) : "Ikke oplyst";
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

  await sendLoggedEmail({
    type: "contact_form",
    to: CONTACT_EMAIL,
    replyTo: email,
    subject: `Ny besked fra ${name}`,
    html: `
      <h1>Ny besked fra SoulEvents.dk</h1>
      <p><strong>Navn:</strong> ${safeName}</p>
      <p><strong>E-mail:</strong> ${safeEmail}</p>
      <p><strong>Telefon:</strong> ${safePhone}</p>
      <p><strong>Besked:</strong></p>
      <p>${safeMessage}</p>
    `,
    text: `Ny besked fra SoulEvents.dk

Navn: ${name}
E-mail: ${email}
Telefon: ${phone || "Ikke oplyst"}

Besked:
${message}`,
  });

  redirect("/?contact=sent#contact");
}
