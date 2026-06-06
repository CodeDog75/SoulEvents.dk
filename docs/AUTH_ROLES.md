# Auth + brugerroller

Auth-modulet bruger Supabase Auth til login og `profiles.role` til rollebaseret adgang.

## Roller

- `admin`: adgang til `/admin`
- `facilitator`: adgang til `/facilitator`
- Besøgende: ingen konto påkrævet

## Ruter

- `/auth/login`: login for administrator og facilitator
- `/auth/signup`: opret facilitatorprofil
- `/auth/callback`: Supabase callback til magic links/OAuth senere
- `/dashboard`: rollebaseret redirect
- `/admin`: administrator-dashboard
- `/facilitator`: facilitator-dashboard

## Signup-flow for facilitator

1. Facilitator udfylder navn, e-mail, telefon, firmanavn og adgangskode.
2. Supabase Auth opretter brugeren.
3. Serveren opretter en række i `profiles` med rollen `facilitator`.
4. Serveren opretter en række i `facilitator_profiles` med status `pending`.
5. Facilitator sendes til `/facilitator`.

Facilitatorprofilen vises ikke offentligt, før administrator ændrer status til `approved`.

## Login-flow

1. Brugeren logger ind på `/auth/login`.
2. Appen sender brugeren til `/dashboard`.
3. `/dashboard` læser `profiles.role`.
4. Administrator sendes til `/admin`.
5. Facilitator sendes til `/facilitator`.

## Admin-godkendelse

Administrator kan godkende facilitatorer på `/admin`.

Flowet er:

1. Nye facilitatorer oprettes med `facilitator_profiles.status = 'pending'`.
2. Administrator ser profiler med status `pending` som standard.
3. Administrator kan ændre status til:
   - `approved`: profilen må vises offentligt.
   - `disabled`: profilen er deaktiveret og skjules offentligt.
   - `pending`: profilen sendes tilbage til afventer.
4. RLS-reglerne gør, at offentlige brugere kun kan læse facilitatorprofiler med status `approved`.

## Miljøvariabler

Følgende skal udfyldes i `.env`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` bruges kun på serveren til at oprette `profiles` og `facilitator_profiles` efter signup.

## Database

Kør migrationerne i denne rækkefølge:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_auth_roles_rls.sql`

## Første administrator

Den første administrator bør oprettes manuelt i Supabase:

1. Opret en bruger i Supabase Auth.
2. Indsæt en matchende række i `profiles` med samme `id`.
3. Sæt `role = 'admin'`.

Eksempel:

```sql
insert into profiles (id, role, full_name, email)
values ('AUTH_USER_ID_HER', 'admin', 'Administrator', 'admin@example.com');
```
