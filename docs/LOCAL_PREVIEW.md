# Lokal preview

Brug udviklingsserveren, når du vil se websitet løbende mens vi bygger.

## Fast arbejdsgang

Kør dette i din egen terminal:

```bash
cd "/Users/rasmusmunch/Documents/Spirituel Eventplatform"
npm run dev
```

Åbn derefter:

```text
http://localhost:3001
```

`npm run dev` bruger hot reload, så ændringer vises automatisk i browseren, når filer gemmes.

## Faste lokale testkonti

Efter `npx supabase db reset` kan du altid logge direkte ind i det lokale dev-miljø med disse konti:

```text
Admin
E-mail: admin@soulevents.test
Password: Admin1234!

Arrangør
E-mail: arrangoer@soulevents.test
Password: Arrangoer1234!
```

Kontiene seedes i `supabase/seed.sql` og bruger kun `.test`-adresser til lokal udvikling.

## Hvis port 3001 allerede er optaget

Find processen:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Stop den:

```bash
kill PID_HER
```

For den nuværende låste proces er kommandoen:

```bash
kill 56680
```

Start derefter igen:

```bash
npm run dev
```

## Når du vil teste produktionsbuild

Kør:

```bash
npm run preview
```

Det bygger først projektet og starter derefter en produktionsserver på:

```text
http://localhost:3001
```

Til daglig udvikling er `npm run dev` bedre end `npm run preview`, fordi du ikke skal genstarte serveren efter hver ændring.
