# Gabara Baustellen – Webseite + Büro-Verwaltung

Baustellen-Abwicklung und Abrechnung für die **Gabara Service GmbH** (Maler & Lackierer,
Münchener Str. 21, 86551 Aichach). Zwei Apps in einem Repo, alles im Browser (Chrome):

| App | Ordner | Dev-Port | Zweck |
|---|---|---|---|
| Webseite | `website/` | 5410 | Öffentliche Gabara-Seite + Anfrageformular (`/#/anfrage`) |
| Verwaltung | `admin/` | 5420 | Büro: Projekte, LV, Berichte, Kalender, FastBill-Abrechnung |

## Starten

```
npm install
npm run dev:admin      # Verwaltung  -> http://localhost:5420
npm run dev:website    # Webseite    -> http://localhost:5410
```

Demo-Zugänge (Lokal-Modus): `buero@gabara-demo.de` / `demo2026` (Büro) ·
`monteur@gabara-demo.de` / `demo2026` (Monteur).

## Architektur (Kurzfassung)

- **Datenhaltung** `shared/store.js`: EIN API, zwei Modi – `lokal` (localStorage, Demo)
  und `firebase` (Firestore europe-west3, Umschalten über `shared/firebase-config.js` → `enabled`).
- **FastBill ist führend** für Kunden, Artikel und Rechnungen (`shared/fastbill.js`).
  Rechnungen entstehen im Rechnungs-Assistenten (LV-Ist-Mengen + freigegebene Regieberichte +
  Spesen) und gehen per `invoice.create` als Entwurf nach FastBill – dort laufen
  Rechnungsnummer, E-Rechnung, Versand und Mahnwesen.
  - Zugang: Einstellungen → FastBill ODER `admin/.env.local`
    (`VITE_FASTBILL_EMAIL`, `VITE_FASTBILL_API_KEY` – **niemals committen**, `.gitignore` greift).
  - CORS: Dev über Vite-Proxy (`admin/vite.config.js`), Produktion über
    `seed/gabara-fastbill-proxy.gs` (GAS-Web-App, URL in Einstellungen → Proxy-URL).
- **LV** (`lvpositionen`): ein Firestore-Dokument je Position (OZ-Hierarchie, Soll/Ist/
  abgerechnet). Import per CSV (`seed/lv-beispiel.csv`) oder PDF-Text-Einfüge-Assistent.
- **Berichte** (`berichte`): Regie/Reklamation/Abnahme mit Pflichtfotos (Vorher+Nachher),
  Kundenunterschrift (Canvas, `shared/unterschrift.jsx`), Status
  entwurf → eingereicht → freigegeben → abgerechnet. **Alle PDFs entstehen im Web-Admin**
  (`admin/src/drucken.js`) – nie auf dem Handy.
- **Km-Rechner** `shared/route.js`: Nominatim + OSRM (kostenlos, ohne Key), nur klick-getriggert.
- Interne Feldnamen folgen der Vorlage (Collection `patients` = Kunden usw.) – bewusst
  keine Massen-Renames (Vorlagen-Regel).

## Fahrplan

- **V1 (dieses Repo, lokal):** fertig – kompletter Workflow Projekt → LV → Einsätze →
  Berichte → Rechnung → FastBill im Lokal-Modus (FastBill-API echt angebunden).
- **V2:** Firebase-Go-Live (Konto nasirdada.98@gmail.com, Spark, europe-west3,
  2 Hosting-Sites, `firestore.rules` deployen) + Google-Kalender-Anbindung (optional,
  `shared/googleCalendar.js` liegt bereit) + **Flutter-Mitarbeiter-App** `gabara_field`
  (Fork von `C:\Users\dadah\mam_solar`; sendet Berichte/Fotos/Unterschriften als Daten
  in dieselben Collections – PDFs bleiben im Web).

Details: `docs/projekt-dokumentation.md`.
