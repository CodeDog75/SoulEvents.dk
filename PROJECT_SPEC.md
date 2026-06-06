# SoulEvents.dk – Komplet Projektbeskrivelse til Codex

### Projektoversigt

Udvikl en moderne, responsiv og mobilvenlig SaaS-platform, der samler spirituelle facilitatorer, undervisere, behandlere, coaches og arrangører af begivenheder i Danmark.

Platformen skal fungere som et samlet univers for spirituelle aktiviteter, hvor facilitatorer kan oprette profiler og markedsføre deres arrangementer, mens brugere kan søge, filtrere, opdage og tilmelde sig relevante begivenheder.

Platformen skal udvikles efter Mobile First-princippet og fungere optimalt på mobil, tablet og desktop.

Platformens primære sprog er dansk.

## Brugerroller

### Administrator

Administrator har fuld adgang til systemet.

Administrator skal kunne:

- Godkende og deaktivere facilitatorer
- Administrere alle brugere
- Administrere alle begivenheder
- Oprette, redigere og slette kategorier
- Oprette og redigere geografiske områder
- Administrere nyhedsbreve
- Administrere handelsbetingelser
- Administrere privatlivspolitik
- Administrere indholdssider
- Se statistik og rapporter
- Se alle tilmeldinger
- Generere fakturakladder
- Eksportere data til Excel og CSV

### Facilitator

Facilitator skal kunne oprette en konto.

Ved registrering skal følgende oplysninger udfyldes:

#### Profiloplysninger

- Navn
- Firmanavn (valgfrit)
- Profilbillede
- Op til 3 ekstra profilbilleder
- Kort præsentation
- Uddybende beskrivelse
- E-mail
- Telefonnummer
- Website
- Facebook-link
- Instagram-link

#### Lokation

- Adresse
- Postnummer
- By
- Region

#### Kategorier

Facilitator skal kunne vælge en eller flere kategorier.

#### Accept af betingelser

Registrering må ikke gennemføres uden accept af:

- Handelsbetingelser
- Privatlivspolitik
- Platformens retningslinjer

### Besøgende bruger

Brugeren skal kunne:

- Søge begivenheder
- Filtrere begivenheder
- Se facilitatorprofiler
- Tilmelde sig begivenheder
- Tilmelde sig nyhedsbrev

Der kræves ikke login for at tilmelde sig en begivenhed.

## Kategorier

Administrator skal kunne oprette ubegrænset antal kategorier.

Hver kategori indeholder:

- Navn
- Beskrivelse
- Farve
- Ikon

Standardkategorier:

- Yoga
- Meditation
- Ceremoni
- Shamanisme
- Saunagus
- Lydbad
- Coaching
- Retreat
- Musik & Dans
- Foredrag
- Undervisning
- Healing
- Breathwork
- Mindfulness
- Kropsarbejde
- Naturforløb
- Spirituel Udvikling

## Facilitatorprofil

Offentlig profilside skal vise:

- Profilbillede
- Billedgalleri
- Navn
- Beskrivelse
- Lokation
- Website
- Facebook
- Instagram
- Kategorier
- Kommende begivenheder

## Begivenheder

Facilitator skal kunne oprette begivenheder.

### Felter

#### Grundoplysninger

- Titel
- Kort beskrivelse
- Lang beskrivelse

#### Billeder

- Forsidebillede
- Op til 3 ekstra billeder

#### Dato og tid

- Dato
- Starttidspunkt
- Sluttidspunkt

#### Lokation

- Adresse
- Postnummer
- By
- Region

#### Pris

- Pris pr. deltager inkl. moms
- Gratis arrangement muligt (0 kr.)

#### Kapacitet

- Maksimalt antal deltagere

#### Kontakt

- Telefon
- E-mail

#### Sociale medier

- Facebook-link
- Instagram-link

#### Kategorier

- Mulighed for flere kategorier

#### Status

- Aktiv
- Udsolgt
- Aflyst
- Afholdt

Systemet skal automatisk beregne ledige pladser.

## Forside

Forsiden skal vise:

### Interaktivt Danmarkskort

Vis alle aktive begivenheder.

Hver markør skal være farvekodet efter kategori.

Ved klik vises:

- Titel
- Dato
- Pris
- Facilitator
- Link til begivenheden

### Dagens begivenheder

Automatisk liste over dagens arrangementer.

### Kommende begivenheder

Visning af kommende arrangementer.

Visningsformer:

- Liste
- Kort
- Kalender

## Filtrering

Brugeren skal kunne filtrere på:

### Geografi

- Hele Danmark
- Storkøbenhavn
- Nordsjælland
- Midtsjælland
- Sydsjælland
- Vestsjælland
- Fyn
- Bornholm
- Sønderjylland
- Midtjylland
- Nordjylland

### Kategorier

Mulighed for valg af flere kategorier.

### Pris

- Gratis
- Under 250 kr.
- 250-500 kr.
- 500-1000 kr.
- Over 1000 kr.

### Dato

- I dag
- Denne uge
- Denne måned
- Valgfri periode

### Facilitator

Fritekstsøgning på navn.

## Kalender

Kalenderen skal understøtte:

- Dag
- Uge
- Måned

## Nyhedsbrev

Brugeren skal kunne tilmelde sig nyhedsbrev.

Ved tilmelding vælges:

- Region(er)
- Kategori(er)

Systemet skal automatisk kunne sende mails om nye relevante arrangementer.

## Tilmelding til begivenheder

På hver begivenhed skal der være en knap:

“Tilmeld dig”

Ved klik åbnes formular:

- Navn
- E-mail
- Telefonnummer
- Antal pladser
- Besked til facilitator (maks. 200 ord)

Ved afsendelse registreres tilmeldingen i databasen.

## Mail til facilitator

Ved ny tilmelding sendes automatisk mail til facilitator.

Mailen skal indeholde:

- Eventtitel
- Dato
- Tidspunkt
- Navn
- E-mail
- Telefonnummer
- Antal pladser
- Besked
- Beregnet kommission

## Facilitators svarmuligheder

Facilitator skal kunne vælge:

- Bekræft tilmelding
- Arrangementet er udsolgt
- Arrangementet er aflyst

Når facilitator vælger en status, sendes automatisk mail til brugeren.

## Ingen betaling via platformen

Platformen håndterer ikke betaling mellem deltager og facilitator.

Betaling foregår direkte mellem deltager og facilitator.

Platformen fungerer alene som formidler af tilmeldinger.

## Forretningsmodel

Platformen er gratis for facilitatorer at benytte.

Der findes ingen abonnementsmodel.

Platformen tjener alene penge via kommission på registrerede tilmeldinger.

## Kommissionsmodel

### Betalte arrangementer

Hvis eventprisen er større end 1 krone pr. deltager:

Platformen opkræver:

12% kommission af den samlede bookingværdi.

Formel:

Pris pr. deltager × antal pladser × 12%

Eksempel:

- Pris: 300 kr.
- Pladser: 2
- Bookingværdi: 600 kr.
- Kommission: 72 kr.

### Gratis arrangementer

Hvis eventprisen er 0 kr.:

- Kommission = 0 kr.

Der opkræves ingen kommission på gratis arrangementer.

## Database for tilmeldinger

Gem følgende:

- ID
- Event-ID
- Facilitator-ID
- Eventtitel
- Kategori
- Dato
- Navn
- Mail
- Telefon
- Antal pladser
- Besked
- Pris pr. deltager
- Samlet bookingværdi
- Beregnet kommission
- Status
- Oprettelsesdato

Status:

- Afventer
- Bekræftet
- Udsolgt
- Aflyst
- Afholdt
- Faktureret
- Betalt

## Administrator Dashboard

Administrator skal kunne:

- Se alle tilmeldinger
- Filtrere på facilitator
- Filtrere på kategori
- Filtrere på dato
- Filtrere på status
- Se samlet omsætning
- Se samlet kommission
- Se antal tilmeldinger
- Se antal pladser

## Statistik

Dashboard skal vise:

- Antal facilitatorer
- Antal begivenheder
- Antal tilmeldinger
- Samlet bookingværdi
- Samlet kommissionsindtægt
- Mest populære kategorier
- Mest aktive facilitatorer

## Månedsrapport

Administrator skal kunne generere rapport pr. facilitator.

Rapporten skal vise:

- Periode
- Events
- Antal tilmeldinger
- Antal pladser
- Samlet bookingværdi
- Samlet kommission

Rapporten skal kunne sendes som mailkladde.

## Fakturakladde

Systemet skal kunne generere fakturakladder.

Fakturaen skal vise:

- Facilitator
- Periode
- Registrerede tilmeldinger
- Samlet kommission
- Betalingsfrist
- Bankoplysninger
- Betalingsreference

Administrator skal godkende faktura før afsendelse.

## Teknologi

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:

- Supabase
- PostgreSQL

Autentifikation:

- Supabase Auth

Kort:

- Mapbox

Mail:

- Resend

Hosting:

- Vercel

Filupload:

- Supabase Storage

## Design

Designet skal være:

- Spirituelt
- Moderne
- Roligt
- Professionelt
- Minimalistisk

Farver:

- Salviegrøn
- Sand
- Terracotta
- Midnatsblå
- Hvid

Designet skal være WCAG-kompatibelt.

## Fremtidige funktioner (Version 2)

- Ventelister
- Anmeldelser
- Ratings
- Favoritfacilitatorer
- Push-notifikationer
- Mobilapp
- AI-baserede anbefalinger
- Direkte online betaling
- Gavekort
- Medlemskaber
