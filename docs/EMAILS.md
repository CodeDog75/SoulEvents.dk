# E-mails

Platformen bruger Resend til transaktionelle mails.

## Miljøvariabler

Tilføj i `.env`:

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

`RESEND_FROM_EMAIL` skal være en verificeret afsender i Resend, fx:

```text
SoulEvents.dk <noreply@ditdomæne.dk>
```

## Bookingmail til facilitator

Når en besøgende tilmelder sig et event:

1. Tilmeldingen gemmes i `bookings`.
2. Systemet sender mail til facilitatorens e-mail.
3. Mailstatus logges i `email_logs`.

Mailen indeholder:

- Eventtitel
- Dato og tidspunkt
- Deltagerens navn, e-mail og telefon
- Antal pladser
- Deltagerens besked
- Bookingværdi
- Beregnet kommission

Hvis Resend fejler, bliver tilmeldingen stadig gemt, og fejlen logges i `email_logs`.

## Svarmail til deltager

Når facilitator svarer på en tilmelding fra `/facilitator/bookings`, sendes mail til deltageren.

Understøttede svar:

- Bekræftet
- Udsolgt
- Aflyst

Mailen indeholder:

- Status på tilmeldingen
- Eventtitel
- Dato og tidspunkt
- Facilitatornavn

Mailstatus logges også i `email_logs`.
