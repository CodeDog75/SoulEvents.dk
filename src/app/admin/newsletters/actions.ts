"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { sendLoggedEmail } from "@/lib/email/resend-mail";
import { getOptionalString, getString } from "@/lib/forms/form-data";
import {
  createNewsletterUnsubscribeToken,
  hashNewsletterUnsubscribeToken,
  maxNewsletterImageFileSize,
  maxNewsletterSections,
  newsletterImageContentTypeFromPath,
  newsletterImageExtensionFromMetadata,
  newsletterUnsubscribeUrl,
  normalizeNewsletterImageFocus,
  normalizeNewsletterImageLayout,
  normalizeNewsletterImagePath,
  normalizeNewsletterTargetSegment,
  normalizeNewsletterUrl,
  renderFacilitatorNewsletterHtml,
  renderFacilitatorNewsletterText,
  validateNewsletterImageMetadata,
  type NewsletterSectionInput,
  type NewsletterTargetSegment,
} from "@/lib/newsletters/facilitator-newsletter";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureMediaStorageBucket } from "@/lib/supabase/storage-buckets";

const newsletterBatchSize = 25;

type RecipientCandidate = {
  facilitatorId: string;
  name: string | null;
  profileId: string;
  email: string;
  preferenceStatus: "subscribed" | "unsubscribed";
};

function adminNewsletterRedirect(message: string, newsletterId?: string | null): never {
  const params = new URLSearchParams({ message });
  if (newsletterId) params.set("newsletter", newsletterId);
  redirect("/admin/newsletters?" + params.toString());
}

function safeName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function newsletterImagePath(input: { fileName: string; type?: string | null }) {
  const extension = newsletterImageExtensionFromMetadata(input);
  if (!extension) return null;
  return "newsletters/images/" + Date.now() + "-" + crypto.randomUUID() + "-" + (safeName(input.fileName) || "newsletter") + "." + extension;
}

function parseSections(formData: FormData) {
  const raw = getOptionalString(formData, "sections_json");
  if (!raw) return [] as NewsletterSectionInput[];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    adminNewsletterRedirect("Afsnittene kunne ikke læses.");
  }

  if (!Array.isArray(parsed)) {
    adminNewsletterRedirect("Afsnittene kunne ikke læses.");
  }

  return parsed.slice(0, maxNewsletterSections).map((item) => {
    const section = item as Partial<NewsletterSectionInput>;
    const buttonUrl = normalizeNewsletterUrl(typeof section.buttonUrl === "string" ? section.buttonUrl : "");
    const imagePath = normalizeNewsletterImagePath(typeof section.imagePath === "string" ? section.imagePath : "");
    const imageLayout = normalizeNewsletterImageLayout(typeof section.imageLayout === "string" ? section.imageLayout : "none");

    if (section.buttonUrl && !buttonUrl) {
      adminNewsletterRedirect("Et knaplink er ugyldigt. Brug et almindeligt http- eller https-link.");
    }

    if (section.imagePath && !imagePath) {
      adminNewsletterRedirect("Et billede har en ugyldig storage-sti.");
    }

    return {
      body: typeof section.body === "string" ? section.body.trim().slice(0, 4000) : "",
      buttonLabel: typeof section.buttonLabel === "string" ? section.buttonLabel.trim().slice(0, 80) : "",
      buttonUrl,
      heading: typeof section.heading === "string" ? section.heading.trim().slice(0, 160) : "",
      imageFocus: normalizeNewsletterImageFocus(typeof section.imageFocus === "string" ? section.imageFocus : "center"),
      imageLayout: imagePath ? imageLayout : "none",
      imagePath,
    };
  });
}

async function getNewsletterWithSections(supabase: ReturnType<typeof createAdminClient>, newsletterId: string) {
  const [{ data: newsletter, error }, { data: sections, error: sectionsError }] = await Promise.all([
    supabase.from("admin_newsletters").select("id, subject, preheader, status, target_segment").eq("id", newsletterId).maybeSingle(),
    supabase
      .from("admin_newsletter_sections")
      .select("heading, body, image_path, image_layout, image_focus, button_label, button_url, sort_order")
      .eq("newsletter_id", newsletterId)
      .order("sort_order", { ascending: true }),
  ]);

  if (error || sectionsError || !newsletter) {
    return null;
  }

  return {
    newsletter,
    sections: (sections ?? []).map((section) => ({
      body: section.body ?? "",
      buttonLabel: section.button_label ?? "",
      buttonUrl: section.button_url ?? "",
      heading: section.heading ?? "",
      imageFocus: normalizeNewsletterImageFocus(section.image_focus),
      imageLayout: normalizeNewsletterImageLayout(section.image_layout),
      imagePath: section.image_path ?? "",
    })) satisfies NewsletterSectionInput[],
  };
}

async function getRecipientCandidates(supabase: ReturnType<typeof createAdminClient>, segment: NewsletterTargetSegment) {
  let query = supabase
    .from("facilitator_profiles")
    .select("id, profile_id, status, is_paused, is_disabled, company_name, profiles!facilitator_profiles_profile_id_fkey(email, full_name)")
    .eq("is_disabled", false);

  if (segment === "active") {
    query = query.eq("status", "approved").eq("is_paused", false);
  } else if (segment === "paused") {
    query = query.eq("is_paused", true);
  } else if (segment === "onboarding") {
    query = query.in("status", ["draft", "pending", "pending_review", "changes_requested"]).eq("is_paused", false);
  }

  const { data: facilitators, error } = await query;
  if (error) {
    throw new Error("Modtagerlisten kunne ikke hentes: " + error.message);
  }

  const profileIds = (facilitators ?? []).map((facilitator) => facilitator.profile_id).filter(Boolean);
  const { data: preferences, error: preferencesError } = profileIds.length
    ? await supabase
        .from("facilitator_newsletter_preferences")
        .select("profile_id, status")
        .in("profile_id", profileIds)
    : { data: [], error: null };

  if (preferencesError) {
    throw new Error("Nyhedsbrevssamtykker kunne ikke hentes: " + preferencesError.message);
  }

  const preferencesByProfileId = new Map((preferences ?? []).map((preference) => [preference.profile_id, preference.status as "subscribed" | "unsubscribed"]));

  return (facilitators ?? [])
    .map((facilitator) => {
      const profileRelation = facilitator.profiles as { email?: string | null; full_name?: string | null } | Array<{ email?: string | null; full_name?: string | null }> | null;
      const profile = Array.isArray(profileRelation) ? profileRelation[0] : profileRelation;
      const email = profile?.email?.trim().toLowerCase() ?? "";
      if (!facilitator.profile_id || !email) return null;

      return {
        email,
        facilitatorId: facilitator.id,
        name: facilitator.company_name || profile?.full_name || null,
        preferenceStatus: preferencesByProfileId.get(facilitator.profile_id) ?? "unsubscribed",
        profileId: facilitator.profile_id,
      } satisfies RecipientCandidate;
    })
    .filter((candidate): candidate is RecipientCandidate => Boolean(candidate));
}

export async function getNewsletterRecipientSummary(segmentValue: string | null | undefined) {
  await requireRole("admin");
  const segment = normalizeNewsletterTargetSegment(segmentValue);
  const supabase = createAdminClient();
  const candidates = await getRecipientCandidates(supabase, segment);
  const optedOut = candidates.filter((candidate) => candidate.preferenceStatus !== "subscribed").length;

  return {
    matching: candidates.length,
    optedOut,
    sendable: candidates.length - optedOut,
  };
}

export async function createSignedNewsletterImageUploadAction(input: {
  contentType: string;
  fileName: string;
  size: number;
}) {
  await requireRole("admin");

  const metadata = {
    fileName: input.fileName,
    size: Number(input.size),
    type: input.contentType,
  };
  const validationError = validateNewsletterImageMetadata(metadata);

  if (validationError) {
    return { contentType: null, error: validationError, path: null, token: null };
  }

  const imagePath = newsletterImagePath(metadata);
  if (!imagePath) {
    return { contentType: null, error: "Billedet skal være JPG, PNG, WebP eller HEIC.", path: null, token: null };
  }

  const supabase = createAdminClient();
  const bucketError = await ensureMediaStorageBucket(supabase);
  if (bucketError) {
    console.error("Newsletter image bucket setup error", {
      message: bucketError.message,
      path: imagePath,
      size: metadata.size,
      type: metadata.type,
    });
    return { contentType: null, error: "Media-bucketten kunne ikke klargøres.", path: null, token: null };
  }

  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(imagePath, { upsert: false });
  if (error) {
    console.error("Signed newsletter image upload URL could not be created", {
      message: error.message,
      path: imagePath,
      size: metadata.size,
      type: metadata.type,
    });
    return { contentType: null, error: "Upload kunne ikke startes: " + error.message, path: null, token: null };
  }

  return {
    contentType: newsletterImageContentTypeFromPath(imagePath),
    error: null,
    path: data.path,
    token: data.token,
  };
}

export async function saveNewsletterDraftAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const newsletterId = getOptionalString(formData, "newsletter_id");
  const subject = getString(formData, "subject").slice(0, 180);
  const preheader = getOptionalString(formData, "preheader")?.slice(0, 220) ?? null;
  const targetSegment = normalizeNewsletterTargetSegment(getOptionalString(formData, "target_segment"));
  const sections = parseSections(formData);

  if (!subject) {
    adminNewsletterRedirect("Skriv en emnelinje.", newsletterId);
  }

  const supabase = createAdminClient();
  const payload = {
    preheader,
    subject,
    target_segment: targetSegment,
    updated_by_profile_id: adminProfile.id,
  };

  const result = newsletterId
    ? await supabase.from("admin_newsletters").update(payload).eq("id", newsletterId).eq("status", "draft").select("id").single()
    : await supabase.from("admin_newsletters").insert({ ...payload, created_by_profile_id: adminProfile.id }).select("id").single();

  if (result.error || !result.data) {
    adminNewsletterRedirect("Nyhedsmailen kunne ikke gemmes.", newsletterId);
  }

  const id = result.data.id;
  const { error: deleteError } = await supabase.from("admin_newsletter_sections").delete().eq("newsletter_id", id);
  if (deleteError) {
    adminNewsletterRedirect("Kladde gemt, men afsnittene kunne ikke opdateres.", id);
  }

  if (sections.length) {
    const { error: insertError } = await supabase.from("admin_newsletter_sections").insert(
      sections.map((section, index) => ({
        body: section.body || null,
        button_label: section.buttonLabel || null,
        button_url: section.buttonUrl || null,
        heading: section.heading || null,
        image_focus: section.imageFocus,
        image_layout: section.imagePath ? section.imageLayout : "none",
        image_path: section.imagePath || null,
        newsletter_id: id,
        sort_order: (index + 1) * 10,
      })),
    );

    if (insertError) {
      adminNewsletterRedirect("Kladde gemt, men afsnittene kunne ikke gemmes.", id);
    }
  }

  revalidatePath("/admin/newsletters");
  adminNewsletterRedirect("Nyhedsmailen er gemt som kladde.", id);
}

export async function sendNewsletterTestAction(formData: FormData) {
  await requireRole("admin");
  const newsletterId = getString(formData, "newsletter_id");
  const testEmail = "hej@soulevents.dk";
  if (!newsletterId) {
    adminNewsletterRedirect("Vælg en gemt kladde før testmailen sendes.", newsletterId);
  }

  const supabase = createAdminClient();
  const data = await getNewsletterWithSections(supabase, newsletterId);
  if (!data) {
    adminNewsletterRedirect("Nyhedsmailen blev ikke fundet.", newsletterId);
  }

  const html = renderFacilitatorNewsletterHtml({
    preheader: data.newsletter.preheader,
    sections: data.sections,
    subject: data.newsletter.subject,
    unsubscribeUrl: null,
  });
  const text = renderFacilitatorNewsletterText({
    preheader: data.newsletter.preheader,
    sections: data.sections,
    subject: data.newsletter.subject,
    unsubscribeUrl: null,
  });
  const sent = await sendLoggedEmail({
    html,
    subject: "[TEST] " + data.newsletter.subject,
    text,
    to: testEmail,
    type: "facilitator_newsletter_test",
  });

  adminNewsletterRedirect(sent ? "Testmailen er sendt." : "Testmailen kunne ikke sendes. Tjek mailopsætningen.", newsletterId);
}

async function createRecipientSnapshot(supabase: ReturnType<typeof createAdminClient>, newsletterId: string, segment: NewsletterTargetSegment) {
  const existing = await supabase
    .from("admin_newsletter_recipients")
    .select("id", { count: "exact", head: true })
    .eq("newsletter_id", newsletterId);
  if ((existing.count ?? 0) > 0) return;

  const candidates = await getRecipientCandidates(supabase, segment);
  const sendable = candidates.filter((candidate) => candidate.preferenceStatus === "subscribed");
  if (!sendable.length) return;

  const rows = sendable.map((candidate) => ({
    facilitator_id: candidate.facilitatorId,
    newsletter_id: newsletterId,
    profile_id: candidate.profileId,
    recipient_email: candidate.email,
    recipient_name: candidate.name,
    status: "pending",
  }));

  const { error } = await supabase.from("admin_newsletter_recipients").insert(rows);

  if (error) {
    throw new Error("Modtagerlisten kunne ikke låses: " + error.message);
  }

}

async function processNewsletterBatch(newsletterId: string) {
  const supabase = createAdminClient();
  const data = await getNewsletterWithSections(supabase, newsletterId);
  if (!data) {
    throw new Error("Nyhedsmailen blev ikke fundet.");
  }

  const { data: recipients, error } = await supabase
    .from("admin_newsletter_recipients")
    .select("id, profile_id, recipient_email, recipient_name, unsubscribe_token_hash")
    .eq("newsletter_id", newsletterId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(newsletterBatchSize);

  if (error) {
    throw new Error("Modtagere kunne ikke hentes: " + error.message);
  }

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients ?? []) {
    const { data: preference } = await supabase
      .from("facilitator_newsletter_preferences")
      .select("status")
      .eq("profile_id", recipient.profile_id)
      .maybeSingle();

    if (preference?.status !== "subscribed") {
      await supabase
        .from("admin_newsletter_recipients")
        .update({ status: "unsubscribed" })
        .eq("id", recipient.id);
      continue;
    }

    const token = createNewsletterUnsubscribeToken();
    const tokenHash = hashNewsletterUnsubscribeToken(token);
    await supabase
      .from("admin_newsletter_recipients")
      .update({ status: "sending", unsubscribe_token_hash: tokenHash })
      .eq("id", recipient.id)
      .eq("status", "pending");

    const unsubscribeUrl = newsletterUnsubscribeUrl(token);
    const html = renderFacilitatorNewsletterHtml({
      preheader: data.newsletter.preheader,
      sections: data.sections,
      subject: data.newsletter.subject,
      unsubscribeUrl,
    });
    const text = renderFacilitatorNewsletterText({
      preheader: data.newsletter.preheader,
      sections: data.sections,
      subject: data.newsletter.subject,
      unsubscribeUrl,
    });
    const ok = await sendLoggedEmail({
      html,
      subject: data.newsletter.subject,
      text,
      to: recipient.recipient_email,
      type: "facilitator_newsletter",
    });

    if (ok) {
      sent += 1;
      await supabase
        .from("admin_newsletter_recipients")
        .update({ error_message: null, sent_at: new Date().toISOString(), status: "sent" })
        .eq("id", recipient.id);
    } else {
      failed += 1;
      await supabase
        .from("admin_newsletter_recipients")
        .update({ error_message: "Mailudbyderen returnerede fejl. Se email_logs.", status: "failed" })
        .eq("id", recipient.id);
    }
  }

  const { count: remaining } = await supabase
    .from("admin_newsletter_recipients")
    .select("id", { count: "exact", head: true })
    .eq("newsletter_id", newsletterId)
    .eq("status", "pending");

  if ((remaining ?? 0) === 0) {
    const { count: failedCount } = await supabase
      .from("admin_newsletter_recipients")
      .select("id", { count: "exact", head: true })
      .eq("newsletter_id", newsletterId)
      .eq("status", "failed");

    await supabase
      .from("admin_newsletters")
      .update({ sent_at: new Date().toISOString(), status: (failedCount ?? 0) > 0 ? "failed" : "sent" })
      .eq("id", newsletterId);
  }

  return { failed, remaining: remaining ?? 0, sent };
}

export async function sendNewsletterNowAction(formData: FormData) {
  await requireRole("admin");
  const newsletterId = getString(formData, "newsletter_id");
  if (!newsletterId) {
    adminNewsletterRedirect("Nyhedsmailen mangler ID.");
  }

  const supabase = createAdminClient();
  const data = await getNewsletterWithSections(supabase, newsletterId);
  if (!data) {
    adminNewsletterRedirect("Nyhedsmailen blev ikke fundet.", newsletterId);
  }
  if (data.newsletter.status !== "draft" && data.newsletter.status !== "sending" && data.newsletter.status !== "failed") {
    adminNewsletterRedirect("Nyhedsmailen kan ikke sendes igen.", newsletterId);
  }
  if (!data.sections.length) {
    adminNewsletterRedirect("Tilføj mindst ét afsnit før udsendelse.", newsletterId);
  }

  try {
    await createRecipientSnapshot(supabase, newsletterId, normalizeNewsletterTargetSegment(data.newsletter.target_segment));
    await supabase
      .from("admin_newsletters")
      .update({ locked_at: new Date().toISOString(), status: "sending" })
      .eq("id", newsletterId)
      .in("status", ["draft", "sending", "failed"]);
    const result = await processNewsletterBatch(newsletterId);
    revalidatePath("/admin/newsletters");
    adminNewsletterRedirect(
      result.remaining > 0
        ? `Første batch er sendt. ${result.remaining} modtagere mangler og kan sendes fra samme side.`
        : "Nyhedsmailen er færdigbehandlet.",
      newsletterId,
    );
  } catch (error) {
    console.error("[admin-newsletter] send failed", {
      message: error instanceof Error ? error.message : "Ukendt fejl.",
      newsletterId,
    });
    adminNewsletterRedirect(error instanceof Error ? error.message : "Nyhedsmailen kunne ikke sendes.", newsletterId);
  }
}

export async function processNewsletterBatchAction(formData: FormData) {
  await requireRole("admin");
  const newsletterId = getString(formData, "newsletter_id");
  if (!newsletterId) {
    adminNewsletterRedirect("Nyhedsmailen mangler ID.");
  }

  try {
    const result = await processNewsletterBatch(newsletterId);
    revalidatePath("/admin/newsletters");
    adminNewsletterRedirect(
      result.remaining > 0
        ? `Batch sendt. ${result.remaining} modtagere mangler.`
        : "Nyhedsmailen er færdigbehandlet.",
      newsletterId,
    );
  } catch (error) {
    adminNewsletterRedirect(error instanceof Error ? error.message : "Batchen kunne ikke sendes.", newsletterId);
  }
}

export async function adminUnsubscribeFacilitatorNewsletterAction(formData: FormData) {
  const adminProfile = await requireRole("admin");
  const facilitatorId = getString(formData, "facilitator_id");
  if (!facilitatorId) {
    adminNewsletterRedirect("Arrangøren mangler ID.");
  }

  const supabase = createAdminClient();
  const { data: facilitator } = await supabase
    .from("facilitator_profiles")
    .select("id, profile_id")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (!facilitator?.profile_id) {
    adminNewsletterRedirect("Arrangøren blev ikke fundet.");
  }

  const now = new Date().toISOString();
  await supabase.from("facilitator_newsletter_preferences").upsert({
    facilitator_id: facilitator.id,
    profile_id: facilitator.profile_id,
    status: "unsubscribed",
    unsubscribed_at: now,
    unsubscribe_source: "admin",
  }, { onConflict: "profile_id" });
  await supabase.from("facilitator_newsletter_consent_events").insert({
    action: "unsubscribed",
    actor_profile_id: adminProfile.id,
    facilitator_id: facilitator.id,
    profile_id: facilitator.profile_id,
    source: "admin",
  });

  revalidatePath("/admin/facilitators/" + facilitatorId + "/edit");
  redirect("/admin/facilitators/" + facilitatorId + "/edit?message=" + encodeURIComponent("Arrangøren er afmeldt nyhedsmails."));
}
