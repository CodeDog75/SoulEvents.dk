# Mapbox-kortvisning

Den offentlige eventoversigt på `/events` viser et Danmarkskort med aktive events.

## Krav

Tilføj Mapbox token i `.env`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=
```

## Adresse til kortplacering

Facilitator skriver almindelig adresse, postnummer og by på eventet. Ved oprettelse forsøger systemet at slå adressen
op hos Mapbox og gemme:

- `latitude`
- `longitude`

De tekniske koordinater vises ikke i eventformularen. Hvis Mapbox-token mangler, oprettes eventet stadig, men det kan
først vises på kortet, når der er gemt koordinater.

## Markører

Markørfarven bruger eventets første kategori.

## Popup

Ved klik på en markør vises:

- Titel
- Facilitator
- Dato
- Pris
- Link til eventdetalje

Hvis Mapbox-token mangler, eller hvis events endnu mangler kortplacering, viser siden en fallback-besked i stedet for et
tomt kort.
