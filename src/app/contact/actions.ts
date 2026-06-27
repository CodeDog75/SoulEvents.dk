"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

const CONTACT_EMAIL = "kontakt@soulevents.dk";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readContactForm(formData: FormData) {
  const name = getValue(formData, "name");
  const email = getValue(formData, "email");
  const phone = getValue(formData, "phone");
  const message = getValue(formData, "message");

  return { email, message, name, phone };
}

function validateContactForm(formData: FormData): ContactFormState | null {
  const { email, message, name } = readContactForm(formData);

  if (!name || !email || !message || message.length > 500 || !email.includes("@")) {
    return {
      status: "error",
      message: "Udfyld navn, e-mail og besked. Beskeden må højst være 500 tegn.",
    };
  }

  if (!env.resendApiKey || !env.resendFromEmail) {
    return {
      status: "error",
      message: "Mailafsendelse mangler opsætning. Tilføj RESEND_API_KEY og RESEND_FROM_EMAIL i .env.local.",
    };
  }

  return null;
}

async function sendContactMessage(formData: FormData) {
  const { email, message, name, phone } = readContactForm(formData);

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
}

export async function sendContactMessageStateAction(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const validationError = validateContactForm(formData);

  if (validationError) {
    return validationError;
  }

  await sendContactMessage(formData);

  return {
    status: "success",
    message: "Tak for din besked. Vi vender tilbage hurtigst muligt.",
  };
}

export async function sendContactMessageAction(formData: FormData) {
  const validationError = validateContactForm(formData);

  if (validationError) {
    redirect("/contact?status=error");
  }

  await sendContactMessage(formData);

  redirect("/contact?status=sent");
}
