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
    title: escapeHtml(input.primaryOrganizerName) + " har inviteret dig som medarrangør",
    children: [
      "<p>Hej " + escapeHtml(input.recipientName) + "</p>",
      "<p>Du er blevet inviteret til at stå som <strong>medarrangør</strong> på dette event på SoulEvents.</p>",
      renderEmailTable(rows),
      "<p>Hvis du bekræfter invitationen, bliver din arrangørprofil vist sammen med den primære arrangør på eventet.</p>",
      "<p><strong>Hvad betyder det?</strong></p>",
      "<ul><li>Din profil vises på eventet som medarrangør.</li><li>Gæster kan besøge din profil via eventet.</li><li>Den primære arrangør ejer fortsat eventet.</li><li>Alle tilmeldinger og administration håndteres fortsat af den primære arrangør.</li></ul>",
      "<p>Du får altså ingen administrative opgaver på eventet.</p>",
      renderEmailButton(input.invitationUrl, "Bekræft eller afvis invitation"),
      "<p>Har du ikke forventet denne invitation, kan du blot vælge <strong>Nej tak</strong>.</p>",
    ].join(""),
  });

  const text = [
    input.primaryOrganizerName + " har inviteret dig som medarrangør",
    "",
    "Hej " + input.recipientName,
    "",
    "Du er blevet inviteret til at stå som medarrangør på dette event på SoulEvents:",
    input.eventTitle,
    "",
    "Dato: " + formatDate(input.eventStartsAt),
    "Primær arrangør: " + input.primaryOrganizerName,
    "",
    "Hvis du bekræfter invitationen, bliver din arrangørprofil vist sammen med den primære arrangør på eventet.",
    "",
    "Når du bekræfter invitationen:",
    "- Din profil vises på eventet som medarrangør.",
    "- Gæster kan besøge din profil via eventet.",
    "- Den primære arrangør ejer fortsat eventet.",
    "- Alle tilmeldinger og administration håndteres fortsat af den primære arrangør.",
    "",
    "Du får altså ingen administrative opgaver på eventet.",
    "",
    "Bekræft eller afvis invitation: " + input.invitationUrl,
    "",
    "Har du ikke forventet denne invitation, kan du blot vælge Nej tak.",
    ...renderPlainTextFooter(),
  ].join("\n");

  return sendLoggedEmail({
    type: "co_organizer_invitation",
    to: input.recipientEmail,
    subject: 'Vil du stå som medarrangør på "' + input.eventTitle + '"?',
    html,
    text,
    eventId: input.eventId,
  });
}

export async function sendCoOrganizerStatusEmail(input: CoOrganizerStatusEmailInput) {
  const statusCopy = {
    accepted: "har bekræftet invitationen og vises nu som medarrangør på eventet.",
    declined: "har sagt nej tak til at stå som medarrangør på eventet.",
    withdrawn: "har trukket sig som medarrangør.",
    cancelled: "er fjernet som medarrangør.",
  }[input.status];

  const html = await renderEmailLayout({
    title: "Status på medarrangør",
    children: [
      "<p>Hej " + escapeHtml(input.primaryOrganizerName) + "</p>",
      "<p>" + escapeHtml(input.coOrganizerName) + " " + escapeHtml(statusCopy) + "</p>",
      renderEmailTable([["Event", input.eventTitle]]),
    ].join(""),
  });

  const text = [
    "Status på medarrangør",
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
