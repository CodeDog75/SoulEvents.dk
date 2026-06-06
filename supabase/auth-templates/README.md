# SoulEvents Supabase Auth-mails

Supabase hosted projects læser ikke disse filer automatisk. Kopiér indholdet ind i Supabase Dashboard:

Authentication -> Emails -> Templates

Brug disse emner:

- Confirm Signup: `Velkommen til SoulEvents 🌿 Bekræft din e-mail`
- Magic Link Login: `Log ind på SoulEvents`
- Reset Password: `Nulstil din adgangskode`
- Change Email: `Bekræft din nye e-mailadresse`

Skabeloner:

- Confirm Signup: `confirm-signup.html`
- Magic Link Login: `magic-link-login.html`
- Reset Password: `reset-password.html`
- Change Email: `change-email.html`
- Management API samlet payload: `management-api-payload.json`

Vigtigt:

- Behold `{{ .ConfirmationURL }}` i links. Det er Supabase' sikre standardflow.
- Behold `{{ .NewEmail }}` i Change Email-skabelonen.
- Logoet hentes fra `{{ .SiteURL }}/brand/soulevents-logo.png`, så Supabase Site URL skal pege på den rigtige offentlige adresse i produktion.
