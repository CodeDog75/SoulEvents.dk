"use server";

import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { escapeHtml, sendLoggedEmail } from "@/lib/email/resend-mail";

const CONTACT_EMAIL = "hej@soulevents.dk";

export type ContactFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const contactErrorMessage = "Din besked kunne desværre ikke sendes lige nu. Prøv igen om lidt.";
const contactSuccessMessage = "Tak for din besked. Vi har modtaget din henvendelse og vender tilbage hurtigst muligt.";

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

function phoneDigitCount(phone: string) {
  return phone.replace(/\D/g, "").length;
}

function isValidOptionalPhone(phone: string) {
  if (!phone) return true;
  if (!/^[+\d\s]+$/.test(phone)) return false;

  const digits = phoneDigitCount(phone);
  return digits >= 8 && digits <= 15;
}

function validateContactForm(formData: FormData): ContactFormState | null {
  const { email, message, name, phone } = readContactForm(formData);

  if (!name || !email || !message || message.length > 500 || !email.includes("@")) {
    return {
      status: "error",
      message: "Udfyld navn, e-mail og besked. Beskeden må højst være 500 tegn.",
    };
  }

  if (!isValidOptionalPhone(phone)) {
    return {
      status: "error",
      message: "Telefonnummeret skal indeholde 8-15 cifre. Du må gerne bruge + og mellemrum.",
    };
  }

  if (!env.resendApiKey || !env.resendFromEmail) {
    return {
      status: "error",
      message: contactErrorMessage,
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

  const sent = await sendLoggedEmail({
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

  if (!sent) {
    throw new Error("Contact message could not be sent.");
  }
}

export async function sendContactMessageStateAction(
  _previousState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const validationError = validateContactForm(formData);

  if (validationError) {
    return validationError;
  }

  try {
    await sendContactMessage(formData);
  } catch {
    return {
      status: "error",
      message: contactErrorMessage,
    };
  }

  return {
    status: "success",
    message: contactSuccessMessage,
  };
}

export async function sendContactMessageAction(formData: FormData) {
  const validationError = validateContactForm(formData);

  if (validationError) {
    redirect("/contact?status=error");
  }

  try {
    await sendContactMessage(formData);
  } catch {
    redirect("/contact?status=send-error");
  }

  redirect("/contact?status=sent");
}
