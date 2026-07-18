import { renderEmailButton, renderEmailLayout, renderEmailTable, renderPlainTextFooter } from "@/lib/email/email-layout";
import { escapeHtml, formatDate, sendLoggedEmail } from "@/lib/email/resend-mail";

type CoOrganizerInvitationEmailInput = {
  eventId: string;
  eventStartsAt: string;
  eventTitle: string;
  invitationUrl: string;
  primaryOrganizerName: string;
  recipientEmail: string;
  recipientName: string;
};

type CoOrganizerStatusEmailInput = {
  eventId: string;
  eventTitle: string;
  primaryOrganizerEmail: string;
  primaryOrganizerName: string;
  coOrganizerName: string;
  status: "accepted" | "declined" | "withdrawn" | "cancelled";
};

export async function sendCoOrganizerInvitationEmail(input: CoOrganizerInvitationEmailInput) {
  const rows: Array<[string, string]> = [
    ["Event", input.eventTitle],
    ["Dato", formatDate(input.eventStartsAt)],
    ["Primær arrangør", input.primaryOrganizerName],
  ];

  const html = await renderEmailLayout({
    title: "Du er inviteret som medarrangør",
    children: [
      "<p>Hej " + escapeHtml(input.recipientName) + "</p>",
      "<p>" + escapeHtml(input.primaryOrganizerName) + " har inviteret dig til at blive vist som medarrangør på eventet:</p>",
      renderEmailTable(rows),
      "<p>Som medarrangør bliver din SoulEvents-profil vist på eventet, når du har accepteret invitationen.</p>",
      "<p>Den primære arrangør ejer og administrerer eventet og modtager alle tilmeldinger.</p>",
      "<p>Du kan acceptere eller afvise invitationen på SoulEvents.</p>",
      renderEmailButton(input.invitationUrl, "Se invitation"),
    ].join(""),
  });

  const text = [
    "Du er inviteret som medarrangør",
    "",
    "Hej " + input.recipientName,
    "",
    input.primaryOrganizerName + " har inviteret dig til at blive vist som medarrangør på eventet:",
    input.eventTitle,
    "",
    "Dato: " + formatDate(input.eventStartsAt),
    "Primær arrangør: " + input.primaryOrganizerName,
    "",
    "Som medarrangør bliver din SoulEvents-profil vist på eventet, når du har accepteret invitationen.",
    "Den primære arrangør ejer og administrerer eventet og modtager alle tilmeldinger.",
    "Se invitation: " + input.invitationUrl,
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    type: "co_organizer_invitation",
    to: input.recipientEmail,
    subject: "Du er inviteret som medarrangør på " + input.eventTitle,
    html,
    text,
    eventId: input.eventId,
  });
}

export async function sendCoOrganizerStatusEmail(input: CoOrganizerStatusEmailInput) {
  const statusCopy = {
    accepted: "har accepteret invitationen og vises nu som medarrangør på eventet.",
    declined: "har afvist invitationen.",
    withdrawn: "har trukket sig som medarrangør.",
    cancelled: "er fjernet som medarrangør.",
  }[input.status];

  const html = await renderEmailLayout({
    title: "Status på medarrangørinvitation",
    children: [
      "<p>Hej " + escapeHtml(input.primaryOrganizerName) + "</p>",
      "<p>" + escapeHtml(input.coOrganizerName) + " " + escapeHtml(statusCopy) + "</p>",
      renderEmailTable([["Event", input.eventTitle]]),
    ].join(""),
  });

  const text = [
    "Status på medarrangørinvitation",
    "",
    "Hej " + input.primaryOrganizerName,
    "",
    input.coOrganizerName + " " + statusCopy,
    "",
    "Event: " + input.eventTitle,
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    type: "co_organizer_status",
    to: input.primaryOrganizerEmail,
    subject: "Status på medarrangør: " + input.eventTitle,
    html,
    text,
    eventId: input.eventId,
  });
}

export async function sendCoOrganizerRemovedEmail(input: {
  coOrganizerEmail: string;
  coOrganizerName: string;
  eventId: string;
  eventTitle: string;
  primaryOrganizerName: string;
}) {
  const html = await renderEmailLayout({
    title: "Du er ikke længere medarrangør",
    children: [
      "<p>Hej " + escapeHtml(input.coOrganizerName) + "</p>",
      "<p>" + escapeHtml(input.primaryOrganizerName) + " har fjernet dig som medarrangør på eventet.</p>",
      renderEmailTable([["Event", input.eventTitle]]),
      "<p>Din profil vises derfor ikke længere som medarrangør på eventet.</p>",
    ].join(""),
  });

  const text = [
    "Du er ikke længere medarrangør",
    "",
    "Hej " + input.coOrganizerName,
    "",
    input.primaryOrganizerName + " har fjernet dig som medarrangør på eventet.",
    "Event: " + input.eventTitle,
    "Din profil vises derfor ikke længere som medarrangør på eventet.",
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    type: "co_organizer_removed",
    to: input.coOrganizerEmail,
    subject: "Du er ikke længere medarrangør på " + input.eventTitle,
    html,
    text,
    eventId: input.eventId,
  });
}
