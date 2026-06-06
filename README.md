# SoulEvents.dk

SoulEvents.dk er en dansk SaaS-platform til events, facilitatorer og faellesskaber. Projektet er bygget med Next.js, React, TypeScript, Tailwind CSS og Supabase.

## Kom hurtigt i gang

### 1. Installer vaerktoejer

Sorg for at disse kommandoer virker i PowerShell:

```powershell
node --version
npm.cmd --version
git --version
```

Hvis `git` ikke virker direkte, kan Git normalt koeres saadan:

```powershell
& "C:\Program Files\Git\bin\git.exe" --version
```

### 2. Hent projektet

```powershell
cd C:\Users\RasmusMunch\Documents
& "C:\Program Files\Git\bin\git.exe" clone https://github.com/CodeDog75/SoulEvents.dk.git
cd SoulEvents.dk
```

### 3. Installer pakker

```powershell
npm.cmd install
```

### 4. Opret lokale miljoevariabler

Kopier `.env.example` til `.env.local`:

```powershell
copy .env.example .env.local
```

Udfyld derefter de relevante vaerdier:

```text
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Vigtigt: `.env.local` maa ikke gemmes paa GitHub, fordi den kan indeholde noegler og adgangsdata.

### 5. Start appen

```powershell
npm.cmd run dev
```

Appen starter som standard paa:

```text
http://localhost:3001
```

Hvis port 3001 er optaget, kan du bruge:

```powershell
npm.cmd run dev:3000
```

## Daglig arbejdsgang

### Naar du starter paa en maskine

```powershell
cd C:\Users\RasmusMunch\Documents\SoulEvents.dk
& "C:\Program Files\Git\bin\git.exe" pull
npm.cmd install
npm.cmd run dev
```

`npm.cmd install` er god at koere efter `git pull`, hvis der er kommet nye pakker eller aendringer i `package-lock.json`.

### Naar du er faerdig paa en maskine

Tjek om der er aendringer:

```powershell
cd C:\Users\RasmusMunch\Documents\SoulEvents.dk
& "C:\Program Files\Git\bin\git.exe" status
```

Gem aendringer og send dem til GitHub:

```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" commit -m "Gem seneste aendringer"
& "C:\Program Files\Git\bin\git.exe" push
```

Naar `git status` siger `working tree clean`, er koden gemt paa GitHub og klar til at blive hentet paa en anden maskine.

## Skift mellem maskiner uden at miste data

1. Foer du forlader en maskine: koer `git status`, `git add .`, `git commit` og `git push`.
2. Naar du starter paa en anden maskine: koer `git pull`, `npm.cmd install` og `npm.cmd run dev`.
3. Gem aldrig hemmelige noegler i GitHub. Brug `.env.local` lokalt og `.env.example` som skabelon.
4. Gem ikke `node_modules` paa GitHub. Den mappe genskabes med `npm.cmd install`.

## Nyttige kommandoer

```powershell
npm.cmd run dev
npm.cmd run dev:3000
npm.cmd run build
npm.cmd run start
npm.cmd run lint
npm.cmd run typecheck
npm.cmd audit
```

## Supabase

Supabase-konfiguration og databasefiler ligger i:

```text
supabase/
```

Mappen indeholder blandt andet migrations og auth templates. Selve Node-projektet ligger i roden af repoet, ikke i `supabase`-mappen.

## Fejl og hurtige loesninger

### `npm` kan ikke koeres i PowerShell

Brug:

```powershell
npm.cmd install
```

i stedet for:

```powershell
npm install
```

### `fatal: not a git repository`

Du staar sandsynligvis i den forkerte mappe. Gaa til projektet:

```powershell
cd C:\Users\RasmusMunch\Documents\SoulEvents.dk
```

### Appen aabner ikke paa localhost:3000

Projektet bruger som standard port 3001:

```text
http://localhost:3001
```

### Repoet virker tomt

Sorg for at bruge denne adresse:

```text
https://github.com/CodeDog75/SoulEvents.dk.git
```

Ikke:

```text
https://github.com/CodeDog75/SoulEvents.git
```
