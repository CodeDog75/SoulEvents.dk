"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { sendLoggedEmail } from "@/lib/email/resend-mail";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import {
  createFacilitatorInvitationOptOutToken,
  defaultInvitationButtonLabel,
  defaultInvitationButtonUrl,
  defaultInvitationPreheader,
  defaultInvitationSignoff,
  defaultInvitationSubject,
  facilitatorInvitationOptOutUrl,
  hashFacilitatorInvitationOptOutToken,
  normalizeInvitationEmail,
  normalizeInvitationUrl,
  renderFacilitatorInvitationHtml,
  renderFacilitatorInvitationText,
} from "@/lib/newsletters/facilitator-invitation";
import { createAdminClient } from "@/lib/supabase/admin";

function invitationRedirect(message: string, contactId?: string | null): never {
  const params = new URLSearchParams({ message });
  if (contactId) params.set("contact", contactId);
  redirect("/admin/newsletters/invitations?" + params.toString());
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeTemplatePayload(formData: FormData, adminProfileId: string) {
  const subject = getString(formData, "subject").trim().slice(0, 180) || defaultInvitationSubject;
  const preheader = getOptionalString(formData, "preheader")?.trim().slice(0, 220) || defaultInvitationPreheader;
  const body = getString(formData, "body").trim().slice(0, 8000);
  const buttonLabel = getString(formData, "button_label").trim().slice(0, 90) || defaultInvitationButtonLabel;
  const buttonUrl = normalizeInvitationUrl(getString(formData, "button_url"));
  const signoff = getString(formData, "signoff").trim().slice(0, 1000) || defaultInvitationSignoff;

  if (!body) {
    invitationRedirect("Skriv indhold til invitationsskabelonen.");
  }

  return {
    body,
    button_label: buttonLabel,
    button_url: buttonUrl,
    preheader,
    subject,
    signoff,
    updated_by_profile_id: adminProfileId,
  };
}

export async function saveFacilitatorInvitationTemplateAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const templateId = getOptionalString(formData, "template_id");
  const payload = normalizeTemplatePayload(formData, adminProfile.id);
  const supabase = createAdminClient();

  const result = templateId
    ? await supabase
        .from("potential_facilitator_invitation_templates")
        .update(payload)
        .eq("id", templateId)
        .select("id")
        .single()
    : await supabase
        .from("potential_facilitator_invitation_templates")
        .insert({
          ...payload,
          created_by_profile_id: adminProfile.id,
          is_default: true,
          name: "Standard invitation",
        })
        .select("id")
        .single();

  if (result.error || !result.data) {
    invitationRedirect("Invitationsskabelonen kunne ikke gemmes.");
  }

  revalidatePath("/admin/newsletters/invitations");
  invitationRedirect("Invitationsskabelonen er gemt.");
}

export async function savePotentialFacilitatorContactAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const contactId = getOptionalString(formData, "contact_id");
  const name = getString(formData, "name").trim().slice(0, 160);
  const email = normalizeInvitationEmail(getString(formData, "email"));
  const company = getOptionalString(formData, "company")?.trim().slice(0, 180) || null;
  const contactSource = getString(formData, "contact_source").trim().slice(0, 500);
  const lawfulBasis = getString(formData, "lawful_contact_basis").trim().slice(0, 1000);
  const responseNotes = getOptionalString(formData, "response_notes")?.trim().slice(0, 2000) || null;
  const legalConfirmed = formData.get("lawful_contact_confirmed") === "on";

  if (!name || !email || !contactSource || !lawfulBasis) {
    invitationRedirect("Udfyld navn, e-mail, kilde og kontaktgrundlag.", contactId);
  }

  if (!isValidEmail(email)) {
    invitationRedirect("E-mailadressen er ikke gyldig.", contactId);
  }

  const supabase = createAdminClient();
  const { data: suppression } = await supabase
    .from("potential_facilitator_invitation_suppressions")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (suppression) {
    invitationRedirect("Denne e-mail har frabedt sig kontakt og kan ikke gemmes som ny invitation.", contactId);
  }

  const now = new Date().toISOString();
  const payload = {
    company,
    contact_source: contactSource,
    email,
    lawful_contact_basis: lawfulBasis,
    lawful_contact_confirmed_at: legalConfirmed ? now : null,
    lawful_contact_confirmed_by_profile_id: legalConfirmed ? adminProfile.id : null,
    name,
    response_notes: responseNotes,
    updated_by_profile_id: adminProfile.id,
  };

  const result = contactId
    ? await supabase
        .from("potential_facilitator_contacts")
        .update(payload)
        .eq("id", contactId)
        .neq("invitation_status", "no_contact")
        .select("id")
        .single()
    : await supabase
        .from("potential_facilitator_contacts")
        .insert({ ...payload, created_by_profile_id: adminProfile.id })
        .select("id")
        .single();

  if (result.error || !result.data) {
    invitationRedirect("Kontakten kunne ikke gemmes. Tjek om e-mailen allerede findes.");
  }

  revalidatePath("/admin/newsletters/invitations");
  invitationRedirect("Kontakten er gemt.", result.data.id);
}

async function getDefaultTemplate(supabase: ReturnType<typeof createAdminClient>) {
  const { data } = await supabase
    .from("potential_facilitator_invitation_templates")
    .select("id, subject, preheader, body, button_label, button_url, signoff")
    .eq("is_default", true)
    .maybeSingle();

  return data;
}

export async function sendFacilitatorInvitationTestAction(formData: FormData) {
  await requireRole("admin");
  const testEmail = normalizeInvitationEmail(getString(formData, "test_email"));
  const contactName = getOptionalString(formData, "preview_name")?.trim() || "navn";
  const personalIntro = getOptionalString(formData, "preview_intro")?.trim() || "";
  const subject = getString(formData, "subject").trim() || defaultInvitationSubject;
  const preheader = getOptionalString(formData, "preheader")?.trim() || defaultInvitationPreheader;
  const body = getString(formData, "body").trim();
  const buttonLabel = getString(formData, "button_label").trim() || defaultInvitationButtonLabel;
  const buttonUrl = normalizeInvitationUrl(getString(formData, "button_url"));
  const signoff = getString(formData, "signoff").trim() || defaultInvitationSignoff;

  if (!isValidEmail(testEmail)) {
    invitationRedirect("Skriv en gyldig testmailadresse.");
  }
  if (!body) {
    invitationRedirect("Skriv indhold før testmailen sendes.");
  }

  const html = renderFacilitatorInvitationHtml({
    body,
    buttonLabel,
    buttonUrl,
    contactName,
    noContactUrl: null,
    personalIntro,
    preheader,
    signoff,
    subject,
  });
  const text = renderFacilitatorInvitationText({
    body,
    buttonLabel,
    buttonUrl,
    contactName,
    noContactUrl: null,
    personalIntro,
    preheader,
    signoff,
    subject,
  });

  const ok = await sendLoggedEmail({
    html,
    subject: "[TEST] " + subject,
    text,
    to: testEmail,
    type: "potential_facilitator_invitation_test",
  });

  invitationRedirect(ok ? "Testinvitationen er sendt." : "Testinvitationen kunne ikke sendes. Tjek mailopsætningen.");
}

export async function sendPotentialFacilitatorInvitationAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const contactId = getString(formData, "contact_id");
  const legalConfirmed = formData.get("send_lawful_contact_confirmed") === "on";
  if (!legalConfirmed) {
    invitationRedirect("Bekræft først, at SoulEvents lovligt må kontakte modtageren.", contactId);
  }

  const supabase = createAdminClient();
  const [{ data: contact }, template] = await Promise.all([
    supabase
      .from("potential_facilitator_contacts")
      .select("id, name, email, lawful_contact_confirmed_at, invitation_status, response_notes")
      .eq("id", contactId)
      .maybeSingle(),
    getDefaultTemplate(supabase),
  ]);

  if (!contact || !template) {
    invitationRedirect("Kontakt eller skabelon blev ikke fundet.", contactId);
  }

  const email = normalizeInvitationEmail(contact.email);
  const { data: suppression } = await supabase
    .from("potential_facilitator_invitation_suppressions")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (suppression || contact.invitation_status === "no_contact") {
    invitationRedirect("Modtageren har frabedt sig kontakt og må ikke inviteres.", contactId);
  }
  if (contact.invitation_status === "invited") {
    invitationRedirect("Invitationen er allerede sendt til denne modtager.", contactId);
  }
  if (!contact.lawful_contact_confirmed_at) {
    invitationRedirect("Kontaktgrundlaget skal bekræftes, før invitationen kan sendes.", contactId);
  }

  const token = createFacilitatorInvitationOptOutToken();
  const tokenHash = hashFacilitatorInvitationOptOutToken(token);
  const noContactUrl = facilitatorInvitationOptOutUrl(token);
  const personalIntro = getOptionalString(formData, "personal_intro")?.trim().slice(0, 1500) || "";
  const renderInput = {
    body: template.body,
    buttonLabel: template.button_label,
    buttonUrl: template.button_url,
    contactName: contact.name,
    noContactUrl,
    personalIntro,
    preheader: template.preheader,
    signoff: template.signoff,
    subject: template.subject,
  };
  const sendRow = await supabase
    .from("potential_facilitator_invitation_sends")
    .insert({
      body_snapshot: template.body,
      contact_id: contact.id,
      created_by_profile_id: adminProfile.id,
      is_test: false,
      personal_intro_snapshot: personalIntro || null,
      recipient_email: email,
      recipient_name: contact.name,
      status: "pending",
      subject: template.subject,
      template_id: template.id,
      unsubscribe_token_hash: tokenHash,
    })
    .select("id")
    .single();

  if (sendRow.error || !sendRow.data) {
    const isDuplicate = sendRow.error.code === "23505";
    invitationRedirect(isDuplicate ? "Invitationen er allerede klargjort eller sendt til denne modtager." : "Invitationen kunne ikke klargøres.", contactId);
  }

  const ok = await sendLoggedEmail({
    html: renderFacilitatorInvitationHtml(renderInput),
    subject: template.subject,
    text: renderFacilitatorInvitationText(renderInput),
    to: email,
    type: "potential_facilitator_invitation",
  });

  const now = new Date().toISOString();
  await supabase
    .from("potential_facilitator_invitation_sends")
    .update({ error_message: ok ? null : "Mailudbyderen returnerede fejl. Se email_logs.", sent_at: ok ? now : null, status: ok ? "sent" : "failed" })
    .eq("id", sendRow.data.id);

  if (ok) {
    await supabase
      .from("potential_facilitator_contacts")
      .update({ invitation_sent_at: now, invitation_status: "invited", updated_by_profile_id: adminProfile.id })
      .eq("id", contact.id)
      .neq("invitation_status", "no_contact");
  }

  revalidatePath("/admin/newsletters/invitations");
  invitationRedirect(ok ? "Invitationen er sendt." : "Invitationen kunne ikke sendes. Se email_logs.", contactId);
}

export async function suppressPotentialFacilitatorContactAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const contactId = getString(formData, "contact_id");
  const reason = getOptionalString(formData, "suppression_reason")?.trim().slice(0, 1000) || "Frabedt sig kontakt.";
  const supabase = createAdminClient();
  const { data: contact } = await supabase
    .from("potential_facilitator_contacts")
    .select("id, email")
    .eq("id", contactId)
    .maybeSingle();

  if (!contact) {
    invitationRedirect("Kontakten blev ikke fundet.");
  }

  const email = normalizeInvitationEmail(contact.email);
  const now = new Date().toISOString();
  await supabase.from("potential_facilitator_invitation_suppressions").upsert({
    contact_id: contact.id,
    created_by_profile_id: adminProfile.id,
    email,
    reason,
    source: "admin",
    suppressed_at: now,
  }, { onConflict: "email" });

  await supabase
    .from("potential_facilitator_contacts")
    .update({
      invitation_status: "no_contact",
      no_contact_at: now,
      no_contact_source: "admin",
      response_notes: reason,
      updated_by_profile_id: adminProfile.id,
    })
    .eq("id", contact.id);

  revalidatePath("/admin/newsletters/invitations");
  invitationRedirect("Kontakten er markeret som må ikke kontaktes igen.", contact.id);
}
