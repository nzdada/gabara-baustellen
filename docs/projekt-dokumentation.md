# Gabara Baustellen – Gesamtdokumentation

> **Stand: 01.08.2026** · Online auf Firebase · FastBill echt angebunden
> Gabara Service GmbH, Münchener Str. 21, 86551 Aichach · Maler & Lackierer
>
> Diese Datei wurde am 01.08.2026 vollständig neu aus dem **Quelltext** erhoben
> (fünf parallele Erfassungen plus eine Gegenprüfung), nicht aus dem Gedächtnis
> fortgeschrieben. Zeilenangaben beziehen sich auf diesen Stand und wandern bei
> jeder Änderung – die Dateinamen bleiben gültig.

## Auf einen Blick

| | |
|---|---|
| Öffentliche Webseite | https://gabara-system.web.app |
| Verwaltung | https://gabara-system-admin.web.app |
| Firebase-Projekt | `gabara-system` (Firestore europe-west3, Auth, Hosting) |
| Ablage | Firestore – `FIREBASE_CONFIG.enabled = true` |
| FastBill | echt angebunden, online über die Apps-Script-Weiterleitung |
| Sprachen | Deutsch und Arabisch (inkl. Rechts-nach-links) |
| Darstellung | Hell / Dunkel / wie das Gerät |

## Inhalt

1. [Architektur, Datenmodell und Rechte](#1-architektur-datenmodell-und-rechte)
2. [Arbeitsabläufe](#2-arbeitsablaeufe)
3. [Betrieb, Bauen, Veröffentlichen](#3-betrieb-bauen-veroeffentlichen)
4. [Fremdsysteme](#4-fremdsysteme)
5. [Oberfläche und Querschnittsthemen](#5-oberflaeche-und-querschnittsthemen)
6. [Nachträge aus der Gegenprüfung](#6-nachtraege-aus-der-gegenpruefung)
7. [Widersprüche und offene Punkte](#7-widersprueche-und-offene-punkte)

---

<a id="architektur-datenmodell-und-rechte"></a>

## 1. Architektur, Datenmodell und Rechte

### Aufbau: zwei Ablage-Modi in einer Datei

`shared/store.js` enthält zwei vollständige Implementierungen derselben API. Welche verwendet wird, entscheidet ein einziges Flag:

```js
// shared/store.js:532-545
_store = FIREBASE_CONFIG.enabled ? await firebaseStore() : lokalerStore()
export function storeModus() { return FIREBASE_CONFIG.enabled ? 'firebase' : 'lokal' }
```

`FIREBASE_CONFIG.enabled` steht in `shared/firebase-config.js:21` auf **`true`** – aktiv ist damit der **Firestore-Modus** gegen das Projekt `gabara-system` (`firebase-config.js:24`, Standort laut Kommentar Zeile 3 europe-west3). Der lokale Modus ist vollständig vorhanden, aber derzeit tot; er wird nur erreicht, wenn jemand `enabled` wieder auf `false` setzt.

| Merkmal | Lokal (`lokalerStore`, store.js:69-262) | Firebase (`firebaseStore`, store.js:272-525) |
|---|---|---|
| Speicherort | `localStorage`, Schlüssel `gabara-baustellen-demo-db` (store.js:59) | Firestore, Client-Cache `persistentLocalCache` + `persistentMultipleTabManager` (store.js:283-285) |
| Erstbefüllung | beim ersten Laden automatisch `erzeugeDemoDaten()` (store.js:70-73) | keine – die Datenbank ist, was drinsteht |
| Live-Updates | nur zwischen Tabs desselben Geräts: `BroadcastChannel` (store.js:83, 115) + `storage`-Event (store.js:116-118) | `onSnapshot`, geräteübergreifend |
| Offline | keiner (Schreiben schlägt bei vollem Speicher hart fehl) | Schreib-Queue über IndexedDB-Persistenz |
| Fehlerbild bei vollem Speicher | `alert(...)` einmalig + geworfener Fehler (store.js:86-98) | entfällt |
| Nummernkreis | Lesen/Schreiben ohne Sperre (store.js:194-205) | `runTransaction` auf `settings/nummernkreis` (store.js:352-363) |
| `slots` | existiert nicht; `subscribeSlots` rechnet Belegtzeiten aus `appointments` + `requests` zusammen (store.js:208-221) | eigene Collection `slots` (store.js:366, 396, 415) |
| `schreibeSlot` / `loescheSlot` | **nicht vorhanden** | vorhanden (store.js:412-424) |

Weil die beiden Slot-Methoden lokal fehlen, prüfen alle Aufrufer vorher den Modus: `admin/src/components/NeuerTermin.jsx:183,233,291`, `admin/src/components/TerminModal.jsx:99,108`, `admin/src/pages/Anfragen.jsx:377`.

Gemeinsame API beider Modi: `subscribe`, `subscribeWhere`, `list`, `get`, `listWhere`, `add` (Upsert bei mitgegebener `id`), `addMany` (Firebase: `writeBatch` in 400er-Blöcken, store.js:321-334), `update`, `remove`, `removeMany`, `naechsteNummer`, `subscribeSlots`, `subscribePausen`, `subscribeOeffnungszeiten`, `ladeOeffnungszeiten`, `addPublicRequest`, `resetDemo`.

Zugriff aus der Verwaltung ausschließlich über `admin/src/hooks.js`: `useCollection(name)` (Vollabo, hooks.js:12-26), `useWhere(name, feld, wert)` (gefiltertes Abo über `subscribeWhere`, hooks.js:30-45), `withStore(fn)` (hooks.js:47-50) und `speichereSetting` (hooks.js:54-59). `useEinstellungen()` (hooks.js:6-9) legt `settings/global` über `EINSTELLUNGEN_DEFAULTS`, liest dafür aber die **ganze** `settings`-Liste.

### Sammlungen (COLLECTIONS, store.js:47-51)

`COLLECTIONS` umfasst 15 Namen. `slots` ist **nicht** enthalten – die Collection wird im Firebase-Modus trotzdem geschrieben und in `resetDemo` gesondert mitbehandelt (store.js:444).

| Sammlung | Inhalt | Dokument-ID | Wichtige Felder / Verweise | Besonderheiten |
|---|---|---|---|---|
| `patients` | Kunden (UI-Label „Kunden"), Spiegel von FastBill | frei vergeben (`k-bothmer`, demoData.js:77) | `firma`, `vorname/nachname`, `strasse`, `plzOrt`, `typ` (`gu`/`privat`), `ustModus` (`13b`/`ust19`), `zahlungszielTage`, `sicherheitseinbehaltProzent`, `fastbillCustomerId` | Der Sammlungsname stammt aus der Arztpraxis-Vorlage und wurde nicht umbenannt |
| `appointments` | Termine/Einsätze | frei (`t-1`) | `projektId`, `titel`, `kategorie`, `mitarbeiterIds[]` (= Auth-UIDs), `datum`, `start`, `ende`, `erledigt`, `erledigtAm`, `positionsIds[]` | Trägt zusätzlich unbenutzte Vorlagen-Felder: `behandlung`, `arzt`, `patientId`, `patientName`, `befunde`, `leistungen`, `erinnerung` (demoData.js:212-216) |
| `requests` | Anfragen von der öffentlichen Webseite | Auto-ID (`addDoc`, store.js:391) | `name`, `telefon`, `email`, `anliegen`, `anliegenId`, `nachricht`, `sprache`, `status:'neu'`, `createdAt`, optional `datum`/`start`/`dauer` | Einzige Sammlung mit anonymem Schreibrecht; Feldliste ist in `firestore.rules:50` per `hasOnly` fest verdrahtet |
| `photos` | Baustellenfotos als komprimierte Daten-URLs | frei (`ph-1`) | `dataUrl`, `phase` (`vorher`/`nachher`/`beleg`/`sonstig`), `projektId`, `berichtId`, `terminId`, `von`, `vonId` (Auth-UID), `name`, `createdAt` | Ein Dokument je Foto; Größenschranke `dataUrl.size() < 980000` in der Regel (rules:159) |
| `katalog` | Artikel/Dienstleistungen, Spiegel von FastBill | frei (`a-001`, `d-001`) | `code`, `name`, `einheit`, `preis`, `ekPreis`, `kategorie`, `fastbillArticleId` | – |
| `bausteine` | Textbausteine (§13b, VOB, Zahlungsziel, Sicherheitseinbehalt) | frei (`bs-13b`) | `titel`, `text` | Werden im lokalen Modus nachgerüstet, wenn die alte Demo-DB sie nicht hat (store.js:78-82) |
| `settings` | globale Einstellungen | **feste IDs**: `global` (`shared/einstellungen.js:6`), `pausen`, `oeffnungszeiten`, `nummernkreis` | `nummernkreis`: `{bericht:{jahr,laufend}, rechnung:{jahr,laufend}}`; `oeffnungszeiten`: `{fenster:{1..6:[{von,bis}]}, telefon[], urlaub[]}` | Wird als **ganze Liste** gelesen → darf laut Kommentar (store.js:37-38) nichts Geheimes enthalten |
| `users` | Mitarbeiter/Logins | **muss die Firebase-Auth-UID sein** (demoData.js:62-67, rules:7-9) | `email`, `name`, `rolle` (`admin`/`mitarbeiter`), `team`, `farbe`, `qualifikation` (`facharbeiter`/`helfer`), `stundensatzIntern`, `aktiv` | Grundlage des gesamten Rollenmodells; `team`/`farbe` steuern die Kalenderfarben (`shared/teams.js:24-38`) |
| `projekte` | Baustellen | frei (`p-iga`) | `nummer` (`P-JJJJ-NNN`), `name`, `kundeId` → `patients`, `anschrift{strasse,plzOrt}`, `gewerk`, `status`, `startDatum`, `endeDatum`, `projektvolumen`, `farbe` | Status aus `shared/projektstatus.js`: `offen`, `beauftragt`, `inArbeit`, `abrechnung`, `abgeschlossen`; Alt-Stati werden über `ALT_ZUORDNUNG` (projektstatus.js:16-28) gemappt |
| `lvpositionen` | Leistungsverzeichnis, ein Dokument je Position | abgeleitet: `lv-<projektId>-<oz mit „-" statt „.">` (demoData.js:130) | `projektId`, `oz`, `typ` (`titel`/`position`), `kurztext`, `langtext`, `menge`, `einheit`, `einheitspreis`, `flags{bedarf,nep}`, `istMenge`, `istVon`, `istAm`, `abgerechnetMenge`, `sort` | Hierarchie steckt allein in der OZ-Zeichenkette, es gibt keinen Elternverweis |
| `berichte` | Regieberichte, Reklamationen, Abnahmen | frei (`b-1`) | `typ` (`regie`/`reklamation`/`abnahme`), `nummer` (`RB-`/`RK-`/`AB-JJJJ-NNN`), `projektId`, `terminId`, `mitarbeiterId` (**Auth-UID**, rules:127), `status`, `stunden[]`, `material[]`, `unterschriftKunde` (Daten-URL), `angeordnetDurch`, `freigegebenAm/Von` | Status-Kette `entwurf → eingereicht → freigegeben → abgerechnet`; ab `freigegeben` von den Regeln gesperrt |
| `spesen` | Hotel-/Fahrtkosten | frei (`s-1`) | `projektId`, `mitarbeiterId` (Auth-UID), `typ` (`fahrt`/`hotel`), `datum`, `betrag`, `fahrt{von,bis,km,kmSatz}`, `belegFotoId` → `photos`, `status` | Statuswert `erstattet` gilt in den Regeln als gesperrt (rules:44) |
| `rechnungen` | Spiegel der FastBill-Rechnungen | Auto-ID (`RechnungWizard.jsx:140`) | `projektId`, `fastbillInvoiceId`, `status` (`vorbereitet`/`uebertragen`/…), `uebertragenAm`, Positionen | Wird per `useWhere('rechnungen','projektId',…)` gefiltert gelesen (ProjektDetail.jsx:138) |
| `apilog` | Protokoll der FastBill-Aufrufe | Auto-ID | `dienst:'fastbill'`, `service`, `status` (`simuliert`/`ok`/`fehler`), `bezugId`, `fehlerText`, `createdAt` (`shared/fastbill.js:74-76`) | Query-Anteil von URLs wird vorher abgeschnitten, damit kein Proxy-Secret im Log landet (`fastbill.js:64-69`) |
| `integrationen` | Zugangsdaten zu Fremdsystemen | **feste ID `fastbill`** (`fastbill.js:22`, `Einstellungen.jsx:567`) | `fastbillEmail`, `fastbillApiKey`, `proxyUrl` | Eigene Sammlung statt `settings`-Dokument, damit die Listenabfrage auf `settings` erlaubt bleiben kann |
| `slots` *(nicht in COLLECTIONS)* | belegte Zeitfenster, ohne Kundendaten | ID des Termins (store.js:415) bzw. Auto-ID bei Web-Anfragen (store.js:396) | `datum`, `start`, `ende`, `status` (`belegt`/`angefragt`) | Öffentlich lesbar; Schreibfehler werden absichtlich verschluckt (store.js:402-404, 418-420) |

### Firestore-Regeln (`firestore.rules`)

**Rollenmodell (rules:14-45)**

| Funktion | Bedingung | Bedeutung |
|---|---|---|
| `angemeldet()` | `request.auth != null` | irgendein Firebase-Login |
| `eigenesProfil()` | Dokument `users/<auth.uid>` existiert | Voraussetzung für jede Rollenaussage |
| `istBuero()` | `users/<uid>.rolle == 'admin'` | Büro |
| `istMonteur()` | `users/<uid>.rolle == 'mitarbeiter'` | Monteur |
| `keinRollenmodell()` | angemeldet, aber **kein** `users/<uid>` | Übergangsregel: zählt wie Büro |
| `darfVerwalten()` | `istBuero() \|\| keinRollenmodell()` | Schreibrecht der Verwaltung |
| `nurFelder(felder)` | `diff(resource.data).affectedKeys().hasOnly(felder)` | Feldschranke bei Updates |
| `gesperrterStatus(s)` | `freigegeben`, `abgerechnet`, `erstattet` | Beweismittel-Sperre |

Alle Feldzugriffe auf Dokumentdaten laufen über `.get(feld, vorgabe)` – ein fehlendes Feld würde die Regel sonst mit einem Fehler abbrechen lassen.

**Regel je Sammlung**

| Sammlung | Lesen | Schreiben |
|---|---|---|
| `requests` (rules:49-65) | `angemeldet()` | `create` anonym erlaubt, aber nur mit fester Feldliste (`hasOnly`), Pflichtfeldern `name/anliegen/status`, `status=='neu'`, Namenslänge 2–119, `nachricht<3000`, `email<200`, `telefon<60`; `update/delete` nur angemeldet |
| `slots` (rules:71-74) | **jeder, auch ohne Login** | `angemeldet()` |
| `patients`, `projekte`, `katalog`, `bausteine`, `rechnungen` | `angemeldet()` | `darfVerwalten()` |
| `appointments` (rules:94-101) | `angemeldet()` | Anlegen/Löschen: `darfVerwalten()`; Monteur darf nur an Terminen mit seiner UID in `mitarbeiterIds` die Felder `erledigt`, `erledigtAm` ändern |
| `lvpositionen` (rules:111-116) | `angemeldet()` | Anlegen/Löschen Büro; Monteur nur `istMenge`, `istVon`, `istAm` |
| `berichte` (rules:123-136) | `angemeldet()` | Monteur nur unter eigener UID (`mitarbeiterId == auth.uid`) und nur solange nicht gesperrt; Büro nur solange nicht gesperrt – **außer** dem reinen Statuswechsel `['status','freigegebenAm','freigegebenVon']`, mit dem eine Freigabe zurückgenommen werden kann; Löschen nur Büro |
| `spesen` (rules:139-152) | `angemeldet()` | wie `berichte`, Ausnahmefeldliste ist hier nur `['status']` |
| `photos` (rules:154-165) | `angemeldet()` | `create`/`update`: **jeder Angemeldete**, nur begrenzt durch `dataUrl.size() < 980000`; `delete`: Büro oder eigener Upload (`vonId == auth.uid`) |
| `apilog` (rules:172-175) | nur `darfVerwalten()` | nur `darfVerwalten()` |
| `users` (rules:188-191) | `angemeldet()` | `darfVerwalten()` – ausdrücklich, damit sich kein Monteur selbst `rolle:'admin'` setzt |
| `settings` (rules:198-204) | `get` auf `pausen`/`oeffnungszeiten` **öffentlich**, sonst `angemeldet()`; `list` nur `angemeldet()` | **`angemeldet()`** – also auch jeder Monteur |
| `integrationen` (rules:217-219) | **`istBuero()`** | **`istBuero()`** |
| alles Übrige (rules:221-223) | `false` | `false` |

`settings` ist bewusst in `get` und `list` getrennt: eine Bedingung auf die Dokument-ID würde jede Listenabfrage scheitern lassen (Kommentar rules:193-197). Das Schreibrecht für alle Angemeldeten hat einen erkennbaren Grund im Code: `naechsteNummer('bericht')` schreibt beim Einreichen eines Berichts auf `settings/nummernkreis` (`admin/src/components/BerichtForm.jsx:71` → `store.js:352-363`), und Berichte reichen auch Monteure ein.

**Warum `integrationen` strenger ist** – im Regelwerk selbst begründet (rules:206-216): Dort liegt der FastBill-API-Schlüssel. Alle anderen Sammlungen nutzen `darfVerwalten()`, das die Übergangsregel `keinRollenmodell()` einschließt – ein in der Firebase-Konsole angelegtes Konto **ohne** `users`-Dokument gilt damit automatisch als Verwaltung. Für den API-Schlüssel wird dieser Kulanzweg abgeschnitten und ausschließlich `istBuero()` verlangt, also ein existierendes `users/<uid>` mit `rolle:'admin'`. Zweiter Grund (store.js:39-40, fastbill.js:14-19): Der Schlüssel darf nicht in `settings` liegen, weil die Verwaltung `settings` als komplette Liste abonniert – er wäre entweder für jeden Monteur lesbar oder würde die Listenabfrage blockieren.

Sichtbare Folge im Betrieb: Wer in den Einstellungen „Missing or insufficient permissions" auf FastBill sieht, hat kein `users`-Dokument mit `rolle:'admin'` unter seiner Auth-UID.

### `resetDemo`

Aufgerufen wird die Funktion nur aus `admin/src/pages/Einstellungen.jsx:708-744` (Reiter „Daten"), mit zwei Knöpfen für zwei Absichten.

**Firebase-Variante (store.js:435-523)**

1. Sammlungsliste bilden: alle `COLLECTIONS` **ohne** `integrationen`, dazu `slots` (store.js:443-444).
2. Bestand aufnehmen: `getDocs` je Sammlung; ein Lesefehler wird mit Sammlungsnamen weitergeworfen (`Lesen von "x" nicht erlaubt: …`, store.js:456).
3. `nurWennLeer: true` bricht ab, sobald irgendwo Dokumente liegen – nichts wird geändert (store.js:459-461).
4. Zu schreibende Dokumente sammeln (nur wenn `mitDemodaten`): jedes Demo-Dokument **ohne** das Feld `id` (die Identität ist die Dokument-ID), zusätzlich je nicht abgesagtem Demo-Termin ein `slots`-Eintrag (store.js:468-476). Das Weglassen von `id` ist zwingend, weil die `requests`-Regel per `hasOnly` nur die feste Feldliste erlaubt.
5. Eigenes Konto retten: liegt `behalteNutzer.uid` vor, wird `users/<uid>` mit `rolle:'admin'`, `team:'Büro'`, `farbe:'#8b1a1a'`, `qualifikation:'facharbeiter'`, `stundensatzIntern:0`, `aktiv:true` geschrieben (store.js:483-494). Ohne das wäre man nach dem Zurücksetzen in der Monteur-Ansicht gefangen.
6. Löschen und Schreiben in Blöcken von 400 (`BLOCK`, store.js:497), Fortschritt über den Rückruf `melde({schritt, fertig, gesamt})`; scheitert ein Block, nennt die Fehlermeldung die betroffenen Sammlungen (store.js:505, 518).
7. Rückgabe `{ geloescht, geschrieben }`.

**Schalter `mitDemodaten`**

| Wert | Wirkung | Bedienung |
|---|---|---|
| `true` (Vorgabe) | alles löschen, danach die Beispieldaten aus `erzeugeDemoDaten()` schreiben | einfache Rückfrage (`confirm`), Einstellungen.jsx:710 |
| `false` | alles löschen, **nichts** neu schreiben außer dem eigenen Konto | `confirm` + getipptes Bestätigungswort per `prompt`, Einstellungen.jsx:715-721 |

**Verschont bleiben**

- `integrationen` (der FastBill-Zugang) – wird weder gelesen, noch gelöscht, noch überschrieben (store.js:440-443). Laut Kommentar dort war genau das früher der Fehler: ein Beispieldatensatz mit leeren Feldern hat den Zugang bei jedem Reset stillschweigend gekillt.
- Das Konto des Ausführenden, sofern `behalteNutzer` übergeben wird – das tut die Verwaltung nur im Online-Modus (`online && user?.userId`, Einstellungen.jsx:731-733).
- Formular-Entwürfe: **nur im lokalen Modus** wird `alleEntwuerfeLoeschen()` aufgerufen (store.js:257). Die Firebase-Variante lässt lokal gespeicherte Entwürfe stehen.

**Lokale Variante (store.js:243-260)** zählt die Dokumente, prüft `nurWennLeer`, ersetzt `db` komplett durch `erzeugeDemoDaten()` bzw. durch ein Objekt aus leeren Arrays für **alle** `COLLECTIONS`, löscht die Entwürfe und speichert.

### Bekannte Grenzen, im Code sichtbar

- **Keine `limit`- oder `orderBy`-Klausel im gesamten Store.** `subscribe` abonniert `collection(dbf, coll)` ungefiltert (store.js:293-295), `list` liest `getDocs(collection(...))` (store.js:300-302). Gefiltert wird nur per einfachem `where(feld,'==',wert)` (store.js:297-298, 309-311). Passend dazu ist `firestore.indexes.json` leer (`{"indexes": [], "fieldOverrides": []}`) – zusammengesetzte Abfragen gibt es nicht.
- **Vollabos auf wachsende Sammlungen.** `appointments`, `berichte`, `spesen`, `rechnungen`, `lvpositionen`, `patients`, `projekte` werden an mehreren Stellen komplett abonniert, u. a. Dashboard.jsx:99-106, Kalender.jsx:96-102, Stunden.jsx:45-47, Uebersicht.jsx:49-54. Jeder Seitenaufruf liest damit den kompletten Bestand.
- **`apilog` wächst unbegrenzt.** Jeder FastBill-Aufruf legt ein Dokument an (`fastbill.js:71-78`), es gibt keine Aufbewahrungsgrenze. `Einstellungen.jsx:549` abonniert die Sammlung vollständig, und das Leeren läuft als Schleife mit einem `remove` je Dokument (`Einstellungen.jsx:665`) – nicht über `removeMany`.
- **Fotos liegen als Daten-URL im Dokument.** Grenze ist die Regel `dataUrl.size() < 980000` (rules:159); Firebase Storage wird nicht verwendet. Im lokalen Modus ist das der Hauptgrund für den `QuotaExceeded`-Pfad (store.js:89-98).
- **Regel-`get()` bei jedem Zugriff.** `istBuero()` und `istMonteur()` lesen `users/<uid>` bei jeder Regelauswertung (rules:20-37); jede Schreiboperation kostet damit zusätzliche Dokumentlesungen.
- **`slots` wird geschrieben, aber nirgends gelesen.** Sechs Schreibstellen (siehe oben) und drei Store-Leser (`subscribeSlots`, store.js:208/366) – `subscribeSlots`, `subscribePausen`, `subscribeOeffnungszeiten` und `ladeOeffnungszeiten` haben in `admin/src` und `website/src` **keinen** Aufrufer. Die öffentliche Seite nutzt vom Store ausschließlich `addPublicRequest` (`website/src/pages/Anfrage.jsx:30-38`), und sie sendet weder `datum` noch `start` – der Zweig zur Slot-Reservierung in `addPublicRequest` (store.js:394-405) läuft von der Webseite aus also nie an.
- **Rechte-Kulanz im Übergang.** Solange kein `users/<uid>` existiert, gilt jeder Angemeldete über `keinRollenmodell()` als Verwaltung (rules:26-31). Parallel dazu stuft `shared/auth.js:60-63` den ersten Anmeldenden als `admin` ein, wenn die `users`-Sammlung nachweislich leer ist.
- **Kein Leserechte-Zuschnitt auf zugewiesene Baustellen.** Ausdrücklich vermerkt in rules:81-83: jeder Angemeldete liest alle Kunden, Projekte, Berichte, Spesen und Rechnungen.

---

<a id="arbeitsablaeufe"></a>

## 2. Arbeitsabläufe

### Anfrage → Kunde → Projekt → LV → Termine

#### 1. Anfrage von der Webseite

Das öffentliche Formular (`website/src/pages/Anfrage.jsx:22-46`) sendet über `store.addPublicRequest` genau diese Felder: `name`, `telefon`, `email`, `anliegen`, `anliegenId`, `nachricht`, `sprache`. **Kein Wunschtermin** (kein `datum`, `start`, `dauer`). Der Store ergänzt `status:'neu'` und `createdAt` (`shared/store.js:222` lokal, `:389-407` Firebase). Die Slot-Reservierung im Firebase-Zweig (`shared/store.js:394-405`) läuft nur, wenn `datum` und `start` vorhanden sind – aus diesem Formular also nie.

Pflichtprüfung im Formular: Anliegen gewählt, Name ≥ 2 Zeichen, Telefon **oder** E-Mail (`website/src/pages/Anfrage.jsx:24-26`).

In der Verwaltung landet die Anfrage in `admin/src/pages/Anfragen.jsx`. Offene Anfragen = `status === 'neu'`, aufsteigend nach `createdAt` (`:107`), darunter die letzten 10 erledigten (`:108`). Parallel meldet `LiveToast` in `admin/src/App.jsx:68-125` neue Anfragen mit Toast + Zweiton (`piepton`, `:46-61`) und verlinkt per `#/anfragen?id=<id>`; dieser Deep-Link öffnet den Bestätigen-Dialog direkt (`Anfragen.jsx:98-105`).

#### 2. Anfrage → Kunde

`BestaetigenModal` (`Anfragen.jsx:299-502`):

- Dublettenvorschlag über normalisierte Telefonnummer (nur Ziffern) **oder** identischen Voll-Namen (`:301-309`).
- Zwei Modi: `vorhanden` (bestehenden Kunden mit den im Dialog bearbeiteten Feldern aktualisieren, `:327-329`) oder `neu`.
- Beim Neuanlegen werden Abrechnungsvorgaben mitgeschrieben (`:334-345`), abgeleitet allein aus dem Feld *Firma*:

| Feld | mit Firma (`typ: 'gu'`) | ohne Firma (`typ: 'privat'`) |
|---|---|---|
| `ustModus` | `13b` | `ust19` |
| `zahlungszielTage` | 16 | 14 |
| `sicherheitseinbehaltProzent` | 10 | 0 |
| `fastbillCustomerId` | `null` | `null` |

- Ein Termin wird nur angelegt, wenn `anfrage.datum && anfrage.start` (`:353-384`) – mit dem aktuellen Webformular also nicht. Ansonsten: `status:'bestaetigt'`, `terminId: null` an der Anfrage (`:385`).
- Die Kunden-Mail läuft im Hintergrund (`mailSenden`, `:68-81`). `shared/mail.js:1-12` sagt selbst, dass `MAIL_DIENST.url` leer ist → `mailKonfiguriert()` ist `false`, der gespeicherte `mailStatus` ist damit `'nicht-konfiguriert'`.
- Ablehnen: `AblehnenModal` (`:213-272`) mit vier Gründen (`telefon`, `ausgebucht`, `urlaub`, leer), schreibt `status:'abgelehnt'` + `ablehnGrund`.

**Ein Projekt entsteht aus der Anfrage nicht.** Der Ablauf endet beim Kunden.

#### 3. Projekt (Baustelle)

Anlage nur manuell in `admin/src/pages/Projekte.jsx:353-465`:

- Pflicht: `name` und `kundeId` (`:366`).
- Nummer wird als `P-<Jahr>-<lfd. 3-stellig>` aus der höchsten vorhandenen Nummer des laufenden Jahres vorgeschlagen (`:50-58`), Doppelvergabe wird geprüft (`:368-370`), Ende vor Start wird abgelehnt (`:371-373`).
- Vorbelegung `gewerk: 'Malerarbeiten'`, `status: 'offen'`.
- Statuskette (`shared/projektstatus.js:7-13`): `offen → beauftragt → inArbeit → abrechnung → abgeschlossen`; „offen" heißt alles außer `abgeschlossen` (`:34-39`). Alt-Stati werden gemappt (`:16-28`). „Überfällig" = `endeDatum < heute` bei offenem Projekt (`:50-54`).
- Status ist direkt in der Tabelle per Select änderbar (`Projekte.jsx:192-203`) und im Detail-Panel (`ProjektDetail.jsx:539-547`).
- Löschen erfordert Eintippen von „LÖSCHEN" und entfernt die Anhänge `lvpositionen, berichte, photos, appointments, spesen, rechnungen` mit (`Projekte.jsx:32, 246-296`).

`ProjektDetail.jsx` gliedert die Baustelle in neun Bereiche (`:183-193`): Übersicht (Beschreibung + Logbuch aus Terminen und nicht-Entwurf-Berichten, `:196-220`), LV, Bilder, Regie, Reklamation, Abnahme, Rechnungen, Termine, Spesen. Das Projektvolumen kommt automatisch aus dem LV (Σ Menge × EP ohne Bedarfs-/NEP-Positionen, `:166-170`); nur ohne LV-Position ist das Feld manuell (`:609-624`).

#### 4. Leistungsverzeichnis (Import CSV / PDF-Text)

`admin/src/components/LvImport.jsx` bietet zwei Wege in **dieselbe** editierbare Vorschau:

- **CSV**: Datei-Upload, Auto-Zuordnung der Spalten über Regex-Liste (`:29-55`), manuell korrigierbar; Analyse in `csvAnalysieren` (`:114-152`) sammelt unlesbare Zahlen (mit Excel-Zeilennummer) und übersprungene Zeilen und zeigt sie über der Vorschau (`:380-406`).
- **PDF**: **kein Datei-Upload**, sondern Einfügen des Textes in eine Textarea (`:348-354`); Analyse in `admin/src/lvparser.js:77-155`.

Heuristik des Parsers: OZ = Ziffern/Punkte am Zeilenanfang plus echter Text (`lvparser.js:41, 126`); Menge/Einheit/EP/GP aus der Mengenzeile am Zeilenende (`:37-63`), EP wird bei Bedarf aus GP/Menge abgeleitet (`:106-108`); Einheiten werden normalisiert (`:27`). Flags `bedarf`/`nep` werden aus Textmustern gesetzt (Bedarfsposition, Alternativ-/Eventualposition → `bedarf`; NEP/Nachtragsposition → `nep`, `:90-94`). `markiereTitel` (`:158-173`) setzt `typ='titel'`, wenn eine Position keine Menge hat und untergeordnete OZ existieren – sonst `position`. Zeilen vor der ersten OZ landen in `ignoriert` und werden dem Benutzer gezeigt.

Übernahme (`LvImport.jsx:192-229`): ein Schreibvorgang über `addMany`; `sort` läuft bei maxSort+1 weiter bzw. bei 1, wenn „vorher löschen" gewählt ist. Jede Position startet mit `istMenge: 0`, `abgerechnetMenge: 0` (`:58-75`). Warnungen vor der Übernahme: Positionen ohne Menge bzw. ohne Preis werden **mit OZ** benannt (`:176-190`), außerdem eine Vorschau-Summe.

Danach ist das LV inline editierbar (`admin/src/components/LvEditor.jsx`, Debounce 600 ms + Blur-Flush).

#### 5. Termine / Einsätze

Anlage über `admin/src/components/NeuerTermin.jsx` (Kalender-Klick, Baustellen-Panel-Button „Aufgabe", Terminliste):

- Zwei Typen: `einsatz` und `intern` (Blocker, `:65`).
- Kategorien (`:17-23`): `umsetzung, fertigstellung, reklamation, krank, privat`.
- Standardzeit 07:00–16:00 (`:68-71`), Dauer-Schnellwahl 60/120/240/480/600 Min (`:35`).
- Projektauswahl nur aus **offenen** Projekten (`:116-121`); Projektwahl zieht Kunde und Titelvorschlag nach (`:159-171`). LV-Positionen des Projekts sind als `positionsIds` (Aufgabenliste) auswählbar (`:122-127`).
- Prüfung beim Anlegen (`:204-218`): Datum, Von/Bis, Bis > Von, Kunde **oder** Projekt (außer bei `krank`/`privat`); ohne zugewiesene Monteure erscheint eine Rückfrage (`confirm`), keine Blockade.
- Optional Google-Kalender-Event und Slot-Schreibung (`:288-298`).

`TerminModal.jsx` erlaubt: Monteure per Chip zuweisen (`:48-55`), erledigt/zurück (`:75-81`), Kopie auf den Folgetag (`:84-102`), Arbeitsauftrag-PDF mit den gewählten LV-Positionen (`:60-73`), Absagen/Reaktivieren inkl. Slot- und Google-Pflege (`:104-116`), Fotos zum Termin.

`Termine.jsx` ist die Tabellensicht mit Spaltenfiltern und den Tabs „Meine/Alle" (Admin startet auf „alle", `:36`); „meine" prüft `mitarbeiterIds` oder das Altfeld `arzt` (`:62-67`).

---

### Regiebericht, Reklamation, Abnahme (`admin/src/components/BerichtForm.jsx`)

Ein Formular für drei Typen mit fortlaufender Nummer `RB-/RK-/AB-JJJJ-NNN` (`:24-25, 69-74`); der Zähler wird im Firebase-Modus atomar per `runTransaction` gezogen (`shared/store.js:352-363`).

#### Aufbau (nummerierte Abschnitts-Karten)

1. Basisdaten (Projekt, Datum, Erstellt von; bei Regie zusätzlich Anordnungsblock; bei Reklamation Rüge-/Fristblock)
2. Fotos **vorher**
3. Arbeiten / Mangel / Abnahme (Beschreibung, bei Abnahme Art, Ort, Leistungsumfang, Mängel, Vorbehalte)
4. nur Regie: Arbeitszeit + Material
5. Fotos **nachher**
6. Unterschriften

#### Das Gate vor dem Einreichen

`einreichenOk` (`:183-190`) und die Klartext-Liste `gateHinweis()` (`:192-204`):

| Bedingung | gilt für | Code |
|---|---|---|
| Projekt gewählt | alle | `:188` |
| Beschreibung nicht leer | alle | `:188` |
| mindestens 1 Vorher-Foto | **alle drei Typen** | `:189` |
| mindestens 1 Nachher-Foto | **alle drei Typen** | `:189` |
| jede Stundenzeile mit Name und `anzahl > 0`, mindestens eine Zeile | nur `regie` | `:183` |
| `angeordnetDurch` gefüllt | nur `regie` | `:184` |
| Kundenunterschrift + Name + Funktion, Monteurunterschrift | nur `abnahme` | `:185-186` |
| Entscheidung Vertragsstrafe ja/nein (nicht `null`) | nur `abnahme` | `:187` |

Der Einreichen-Knopf ist bis dahin `disabled` (`:727-730`); zusätzlich prüft `speichern('eingereicht')` erneut (`:255`). „Als Entwurf" speichert immer (nur `projektId` nötig, `:254`).

#### Fotos vorher/nachher

Getrennte Sektionen mit Kamera-Auslöser (`capture="environment"`) und Mehrfach-Upload (`:322-359`). Jedes Bild wird auf 1200 px Kante / JPEG 0,72 komprimiert (`:55-63`) und als Data-URL in einem eigenen `photos`-Dokument gespeichert (`:232-237`) mit `phase`, `projektId`, `berichtId`, `von`, `vonId`. Über 950.000 Zeichen wird abgelehnt (`:230`); die Firestore-Regel spiegelt das mit 980.000 (`firestore.rules:158-159`). Beim ersten Foto wird der Bericht bereits als Dokument mit `status:'entwurf'` und Nummer angelegt (`stelleDocSicher`, `:206-217`).

#### Arbeitszeit je Person

Je Zeile: `userId`, `name`, `datum`, `art` (facharbeiter|helfer), `von`, `bis`, `anzahl`, `satz` (`:146-160`, `:273-277`). Von/Bis rechnet die Stunden auf 0,1 h gerundet (`dauerStunden`, `:31-36`); eine manuell eingetragene Stundenzahl verschiebt umgekehrt die Bis-Uhrzeit (`bisAus`, `:39-46`). Der Stundensatz kommt **nicht** aus einem Dropdown im Bericht, sondern aus der Qualifikation des Mitarbeiters und den Einstellungen (`satzFuer`, `:116`; Defaults 35 €/31 € in `shared/einstellungen.js:24-25`). Namen können aus der Mitarbeiterliste gewählt oder frei getippt werden (`:549-590`).

#### Unterschriften

Zwei Felder (Auftraggeber, Monteur/Gabara) mit Zeichenfläche `UnterschriftFeld`, gespeichert als Data-URL, dazu `unterschriftName`, `unterschriftFunktion`, `unterschriftFirma` (`:674-709`, `:265-267`). Bei `abnahme` Pflicht, bei Regie/Reklamation als „Anerkenntnis" optional.

#### Genannte Rechtsgrundlagen im Code

| Fundstelle | Norm | Inhalt |
|---|---|---|
| `BerichtForm.jsx:15, 19, 68, 427, 532` | § 15 Abs. 3 VOB/B | Anzeige der Stundenlohnarbeiten vor Beginn; Namen + Stunden je Person |
| `BerichtForm.jsx:514` | § 11 VOB/B | Vorbehalt der Vertragsstrafe bei der Abnahme |
| `drucken.js:351-356` | § 15 Abs. 3 Satz 1 VOB/B | Anordnungs-Block auf dem Ausdruck |
| `drucken.js:364-368` | § 15 Abs. 3 VOB/B | Anerkennungsfiktion nach 6 Werktagen |
| `drucken.js:359-361` | § 13 Abs. 5 VOB/B | Mängelrüge/Frist auf dem Reklamationsprotokoll |
| `drucken.js:436-440` | § 12, § 12 Abs. 6 VOB/B | Abnahme, Gefahrübergang |
| `drucken.js:404-406, 439` | § 13 Abs. 4 VOB/B (4 Jahre) bzw. § 634a BGB (5 Jahre) | Verjährung, abgeleitet aus `kunde.typ === 'gu'` |
| `drucken.js:414-419` | § 11 VOB/B | Vorbehalte-Block im Abnahmeprotokoll |
| `RechnungWizard.jsx:20` | § 13b UStG | Reverse-Charge-Text auf der Rechnung |

PDF-Ausgabe: `druckeRegiebericht` (`drucken.js:303-392`) und `druckeAbnahme` (`:395-445`), Stundenliste `druckeStundenliste`/`…Sammel` (`:496 ff.`). Ein Rechnungs-Eigendruck existiert bewusst nicht (`drucken.js:492-494`).

---

### Status-Kette der Berichte und Sperren

`entwurf → eingereicht → freigegeben → abgerechnet` (Spesen: `entwurf → eingereicht → erstattet`).

| Übergang | Auslöser |
|---|---|
| `entwurf` | Anlage über „Als Entwurf" oder automatisch beim ersten Foto (`BerichtForm.jsx:206-217`) |
| `eingereicht` | Einreichen-Knopf, setzt `eingereichtAm`, `eingereichtVon` (`BerichtForm.jsx:269-270`) |
| `freigegeben` | Büro in `Berichte.jsx:61-66` oder im Bericht-Modal `ProjektDetail.jsx:695-699`; setzt `freigegebenAm`, `freigegebenVon` |
| zurück auf `entwurf` | „Zurückweisen" im Bericht-Modal (`ProjektDetail.jsx:854-859`) |
| `abgerechnet` | Rechnungs-Speichern im Wizard (`RechnungWizard.jsx:148-149`) |
| zurück auf `freigegeben` | Löschen einer vorbereiteten Rechnung (`Abrechnung.jsx:125-126`) |

Gesperrt wird bei `freigegeben` und `abgerechnet`:

- UI: `gesperrt` in `BerichtForm.jsx:103` schaltet alle Felder auf `disabled`, blendet Speichern-Knöpfe aus (`:722`), verhindert Fotolöschen (`:247`) und lehnt `speichern()` ab (`:253`).
- Server: `firestore.rules:118-136` – `gesperrterStatus()` umfasst `freigegeben`, `abgerechnet`, `erstattet` (`:41-43`). Auch das Büro darf an einem gesperrten Bericht nur noch `status`, `freigegebenAm`, `freigegebenVon` ändern (`:130`); der Monteur nur eigene, ungesperrte Berichte (`mitarbeiterId == uid`, `:131-134`).
- Einschränkung: Die Rollenprüfung greift erst, wenn zur Auth-UID ein `users`-Dokument existiert. Solange nicht, gilt `keinRollenmodell()` und **jeder Angemeldete zählt als Büro** (`firestore.rules:24-30`).

In der Liste `Berichte.jsx:168-172` sind `entwurf` und `eingereicht` „bearbeiten", alles andere „ansehen" (öffnet dasselbe Formular im gesperrten Zustand).

---

### Abrechnung

#### Quellen einer Rechnung (`admin/src/components/RechnungWizard.jsx`)

| Quelle | Filter | Übernahme als Position |
|---|---|---|
| LV (`quelle: 'lv'`) | `typ==='position'`, ohne `flags.bedarf`/`flags.nep`, `max(menge, istMenge) − abgerechnetMenge > 0` (`:49-53`) | OZ, Kurztext, Menge, Einheit, EP (`:78-82`) |
| Regiebericht Stunden (`'regie'`) | `typ==='regie'` **und** `status==='freigegeben'` (`:54-55`) | je Stundenzeile eine Position: „Regiestunden Facharbeiter/Helfer (Name, Datum) – Berichtsnummer", Menge = Stunden, EP = Satz (`:88-94`) |
| Regiebericht Material (`'material'`) | dieselben Berichte | je Materialzeile eine Position (`:95-98`) |
| Spesen (`'spesen'`) | `status==='eingereicht'` (`:56-57`) | Pauschale, Menge 1, EP = Betrag (`:100-104`) |
| frei (`'frei'`) | manuell in Schritt 3 (`:384-385`) | frei editierbar |

Mengensteuerung im LV-Block: vorbelegt ist die vom Monteur gemeldete Restmenge (`istMenge − abgerechnetMenge`), Obergrenze ist `max(istOffen, sollOffen)` (`:60-63, 275-276`). Wird mehr als gemeldet abgerechnet, färbt sich das Feld gelb und ein Hinweis erscheint (`:277-278, 289-293`). Eine leere Auswahl blockiert nicht (`:105-106`).

#### Rechnen (Schritt 3, `:115-122`)

```
netto      = Σ menge × ep
ist13b     = (kunde.ustModus || '13b') === '13b'
ust        = ist13b ? 0 : netto × 0,19
brutto     = netto + ust
einbehalt  = brutto × einbehaltProzent/100
zahlbetrag = brutto − einbehalt
```

- **§ 13b**: Der Modus hängt am Kunden (`ustModus`, gepflegt in `Kunden.jsx:206-211, 310-315`); Default für Neukunden/Gewerbe ist `13b` (`shared/einstellungen.js:22`). Bei `13b` wird keine USt gerechnet und statt der Brutto-Zeilen der Rechtstext angezeigt – aus dem Textbaustein `bs-13b`, sonst die Konstante `RECHTSTEXT_13B` (`:20, 121-122, 390-397`). Dieser Text geht als `INTROTEXT` an FastBill (`Abrechnung.jsx:70`, `shared/fastbill.js:325`), die Positionen bekommen `VAT_PERCENT: 0` (`fastbill.js:321, 332`).
- **Sicherheitseinbehalt**: Vorbelegung `kunde.sicherheitseinbehaltProzent ?? 0` (`:111`), Eingabefeld 0–20 % (`:400`). Gespeichert werden `einbehaltProzent`, `einbehaltBetrag`, `zahlbetrag` (`:134-135`). USt und Brutto werden **nicht** gespeichert.

#### Fortschreibung der Quellen (`:139-152`)

Beim Speichern – auch bei „Als Entwurf" ohne Übertragung – wird `lvpositionen.abgerechnetMenge` erhöht, jeder beteiligte Bericht auf `abgerechnet` und jede Spese auf `erstattet` gesetzt.

#### FastBill-Strecke (`admin/src/pages/Abrechnung.jsx`)

Status-Kette der Rechnung: `vorbereitet → uebertragen → gestellt → bezahlt` (+ `storniert`, `:20-26`).

- „An FastBill" (`:60-75`): legt bei Bedarf den Kunden an (`syncKunde`), erzeugt einen FastBill-**Entwurf**, setzt `fastbillInvoiceId` + `status:'uebertragen'`. Ohne Zugangsdaten meldet die Anbindung „simuliert" und es wird nichts geschrieben.
- „Abschließen" (`:89-100`): `invoice.complete` – erst hier vergibt FastBill die Rechnungsnummer.
- „Per Mail" (`:102-111`): Empfänger per `prompt`, nur aktiv wenn `fastbillNummer` existiert (`:207`).
- „Abgleichen" (`:77-87`): Status/Nummer/Dokument-URL aus FastBill zurücklesen.
- Löschen nur bei `vorbereitet` und mit vollständiger Rückbuchung: LV-Mengen minus, Berichte zurück auf `freigegeben`, Spesen zurück auf `eingereicht` (`:113-131`).
- Das Rechnungs-PDF kommt ausschließlich aus FastBill über `dokumentUrl` (`:217-227`).

---

### Stundenlisten (`admin/src/pages/Stunden.jsx`)

Datenquelle sind ausschließlich die Stundenzeilen der **Regieberichte** – die Seite rechnet nichts neu (`:13-18, 66-96`).

- **Monatsauswahl**: laufender Monat + die 11 davor, Beschriftung lokalisiert (`:127-140`). Zusätzlich der Umschalter „ganzer Monat / Monat bis heute"; „bis heute" ist nur im laufenden Monat aktivierbar (`:55-57, 202-213`).
- **Datenbasis**: Checkbox „Nur freigegebene Berichte" (Standard an) lässt nur `freigegeben` und `abgerechnet` zu; abgewählt zählen auch Entwürfe und eingereichte Berichte mit (`:67`).
- **Bündelung** je Person über `userId`, ersatzweise über den Namen (`:74-81`). Zeilen ohne eigenes Datum zählen zum Berichtsdatum (`:71`).
- **Pausenberechnung** (`:104-112`): `beginn` = kleinstes „Von" des Tages, `ende` = größtes „Bis"; `pause = (ende − beginn) − Stunden×60`, nie negativ.
- **Warnung „unstimmig"**: gemeldete Stunden × 60 > Anwesenheit + 1 Minute (`:112`). Folge: Zeile gelb hinterlegt, in der Pausenspalte steht „!" statt einer Zahl (`:283, 292-294`), im Kopf ein Chip „n × prüfen" (`:257-262`).
- Kennzahlen je Person: Arbeitstage (Tage mit Stunden > 0), Summe Stunden, Lohn = Σ Stunden × Satz (`:117-120`).
- **Druck**: „Stundenliste drucken" je Person; der **Sammeldruck**-Knopf erscheint erst ab zwei Personen (`:183-187`) und erzeugt bewusst *ein* Dokument mit einer Seite je Person (`:174-178`, `druckeStundenlistenSammel`).
- Die Bildschirmtabelle zeigt nur Tage mit Stunden > 0 (`:282`); das PDF bekommt über `blattVon` **alle** Kalendertage des Zeitraums (`:151-160`).

---

### Monteur-Ansicht (`admin/src/pages/monteur/`)

Wer mit Rolle `mitarbeiter` angemeldet ist, bekommt **immer** die Vollbild-Handy-Ansicht ohne Verwaltungs-Chrome (`admin/src/App.jsx:304-306`); Admins erreichen sie als Vorschau über `/monteur` (`:307-309`).

Zuordnung „meine Einsätze": Admin sieht alles; sonst `mitarbeiterIds` enthält die eigene `userId` oder das Altfeld `arzt` entspricht dem Namen (`MonteurApp.jsx:36-40`).

**Tab Heute** (`MonteurApp.jsx:93-202`): eigene Einsätze, ohne abgesagte und ohne Kategorie `privat`, nur auf offenen Baustellen (`:104-108`). Listenansicht gruppiert Heute/Demnächst/Früher und blendet erledigte Alt-Termine aus, die Kalenderansicht (`DatumWahl`) zeigt alles (`:113, 121-127`). Aktionen: Maps-Link zur Anschrift, „Zur Baustelle", „Erledigt melden" (schreibt `erledigt` + `erledigtAm`, `:129-131`).

**Tab Baustellen** (`:204-245`): offene Projekte, auf denen der Monteur Termine hat, mit Fortschrittsbalken aus `istMenge × EP` gegen `menge × EP`.

**Baustellen-Detail** (`MonteurBaustelle.jsx`):

- Kopf mit Navigation (Google Maps) und Kunden-Telefonlink, Fortschritt in Prozent **und in Euro** (`:100-102, 137-144`).
- Arbeitsauftrag: alle LV-Positionen mit Eingabefeld für die Ist-Menge. `IstFeld` schreibt debounced (600 ms + Blur) `istMenge`, `istVon`, `istAm` (`:24-77`); mehr als Soll wird gelb markiert und beschriftet, aber **nicht blockiert** (`:27, 70-74`). Langtext ist per Antippen aufklappbar.
- Vier große Knöpfe: Regiebericht, Reklamation, Abnahme, Spesen (`:148-161`) – dieselben Formulare wie im Büro.
- Eigene Berichte der Baustelle mit Status-Chip; anklickbar (= bearbeitbar) sind nur `entwurf` (`:204-221`).

**Tab Spesen** (`MonteurApp.jsx:247-293`): eigene Spesen (Admin: alle); nur Entwürfe sind editierbar. `SpesenForm.jsx` deckt Fahrt (km × Satz, optional automatische Kilometer über `berechneRoute`), Hotel und Sonstiges mit Belegfoto ab; gespeichert wird als `entwurf` oder `eingereicht` (`:100-124, 220-224`).

Serverseitige Rechte des Monteurs (`firestore.rules`):

| Sammlung | erlaubt |
|---|---|
| `appointments` | nur `erledigt`, `erledigtAm` und nur bei eigener Zuweisung (`:97-100`) |
| `lvpositionen` | nur `istMenge`, `istVon`, `istAm` (`:114-115`) |
| `berichte` / `spesen` | anlegen und ändern nur mit eigener `mitarbeiterId` und nur solange nicht gesperrt (`:125-134, 141-150`) |
| `photos` | anlegen jeder Angemeldete; löschen nur eigene (`vonId == uid`) (`:154-165`) |
| `projekte`, `rechnungen`, `katalog` | nur lesen |
| `apilog` | kein Zugriff |

---

### Abweichungen zwischen Code und Kommentar/Doku

- **Bericht-Status-Badge bleibt leer**: `ProjektDetail.jsx:20-25` definiert `schluessel`, `StatusBadge` liest aber `s.label` (`:55-56`). Für alle bekannten Status (`entwurf`, `eingereicht`, `freigegeben`, `abgerechnet`) ist das `undefined` → der Chip wird ohne Text gerendert, im Bericht-Detail-Modal wie in der Spesen-Tabelle.
- **Gleiche Stelle in der Abrechnung**: `Abrechnung.jsx:85` meldet `STATUS[erg.status]?.label` – ebenfalls nie gesetzt, es erscheint der Rohstatus aus FastBill.
- **Statustext im Kalender nicht übersetzt**: `Kalender.jsx:484` nutzt `st.label` (fest deutsch aus `shared/projektstatus.js:8-12`), während `Projekte.jsx:102` und `Dashboard.jsx:524` denselben Status über `t('projektstatus.…')` ausgeben.
- **Toter Terminzweig in den Anfragen**: `Anfragen.jsx:353-384` legt bei einem Wunschtermin Termin, Slot und Google-Event an – das Webformular sendet aber nie `datum`/`start` (`website/src/pages/Anfrage.jsx:31-39`). Die deutschen und die englischen/arabischen Hinweistexte widersprechen sich deshalb (`Anfragen.jsx:35`: „Der Kunde steht danach für Projekte und Termine bereit" vs. „The appointment appears in the calendar immediately").
- **Kommentar am Berichtsformular greift zu kurz**: `BerichtForm.jsx:12-15` beschreibt die Struktur als mam_solar-Feldprotokoll für Regie; tatsächlich verlangt das Gate Vorher- **und** Nachher-Foto auch bei Reklamation und Abnahme (`:189`).
- **Sicherheitseinbehalt erreicht FastBill nicht**: `RechnungWizard.jsx:134-135` speichert `einbehaltBetrag`/`zahlbetrag`, `shared/fastbill.js:320-338` überträgt aber nur `ITEMS` – die FastBill-Rechnung lautet über den vollen Betrag ohne Einbehaltszeile.
- **„Als Entwurf" ist keine folgenlose Aktion**: Schon das Entwurf-Speichern setzt Berichte auf `abgerechnet`, Spesen auf `erstattet` und erhöht `abgerechnetMenge` (`RechnungWizard.jsx:139-152`) – rückgängig nur über das Löschen der Rechnung.
- **Kunden-Import setzt weniger als behauptet**: Der Kommentar in `Import.jsx:142` verspricht „Abrechnungs-Standards wie bei neuen Kunden", gesetzt werden aber nur `typ` und `ustModus` – `zahlungszielTage` und `sicherheitseinbehaltProzent` fehlen, obwohl `Anfragen.jsx:338-341` sie schreibt.
- **Pflichtmarkierung im Import wirkungslos**: `Import.jsx:191-192` liest `z.pflicht`, die Liste `ZIELE` (`:70-79`) hat dieses Feld nicht – Sternchen und Fettung erscheinen nie.
- **LV-Ersetzen löscht auch Abgerechnetes**: `LvImport.jsx:501-508` warnt bloß, wenn Positionen mit `abgerechnetMenge > 0` betroffen sind; gelöscht wird trotzdem alles (`:210-215`).
- **Stundenliste – Kommentar vs. Anzeige**: `Stunden.jsx:98-99` beschreibt „je Person eine Zeile pro Kalendertag – auch für Tage ohne Einsatz". Das gilt nur für das PDF; die Bildschirmtabelle filtert Tage ohne Stunden heraus (`:282`).
- **Rollenmodell noch nicht scharf**: `firestore.rules:24-30` lässt bei fehlendem `users`-Dokument zur Auth-UID jeden Angemeldeten als Büro durchgehen – die im Code beschriebene Trennung Büro/Monteur wirkt erst, wenn die UIDs gepflegt sind.
- **Mailversand faktisch aus**: `shared/mail.js:1-6` hält fest, dass das Apps-Script-Gegenstück fehlt und `MAIL_DIENST.url` leer ist; alle Bestätigungs-/Absage-Mails der Anfragen enden deshalb im Status `nicht-konfiguriert`.

---

<a id="betrieb-bauen-veroeffentlichen"></a>

## 3. Betrieb, Bauen, Veröffentlichen

### Start, Build und Veröffentlichung

#### npm-Befehle

Alles läuft über npm-Workspaces. Die Wurzel `package.json` (`C:\Users\dadah\gabara-baustellen\package.json`, Zeilen 6–14) definiert die beiden Arbeitsbereiche `website` und `admin` und genau drei Skripte:

| Befehl (Wurzel) | Definition | Wirkung |
|---|---|---|
| `npm run dev:website` | `npm run dev -w website` (Zeile 11) | Vite-Dev-Server der öffentlichen Seite |
| `npm run dev:admin` | `npm run dev -w admin` (Zeile 12) | Vite-Dev-Server der Verwaltung |
| `npm run build` | `npm run build -w website && npm run build -w admin` (Zeile 13) | baut **beide** Apps, Webseite zuerst |

In den Arbeitsbereichen selbst stehen jeweils drei identisch benannte Skripte:

| Arbeitsbereich | `dev` | `build` | `preview` |
|---|---|---|---|
| `website/package.json` (Z. 7–9) | `vite --port 5410` | `vite build` | `vite preview` |
| `admin/package.json` (Z. 7–9) | `vite --port 5420` | `vite build` | `vite preview` |

Einzeln baubar mit `npm run build -w website` bzw. `npm run build -w admin`. Ein **Deploy-Skript gibt es in keiner `package.json`** – veröffentlicht wird nur über den direkt eingetippten `firebase-tools`-Aufruf (siehe unten).

Der Port steckt fest im `dev`-Skript, nicht in `vite.config.js`. Für `preview` ist kein Port gesetzt, dort gilt der Vite-Standard (4173) für beide Apps – zwei Vorschauen gleichzeitig kollidieren also.

`.claude/launch.json` enthält zwei Einträge, `website` (Port 5410) und `admin` (Port 5420), beide rufen `npm run dev -w <name>` auf.

Wurzel-`devDependencies` besteht nur aus `sharp` (`package.json` Z. 15–17). Eine Verwendung von `sharp` findet sich in keiner `.js`/`.mjs`/`.py`/`.md`-Datei des Projekts (Suche ohne Treffer außerhalb von `node_modules`/`package-lock.json`).

#### Alias `@shared` und die `@source`-Zeile

Beide Vite-Konfigurationen sind fast identisch aufgebaut:

- `website/vite.config.js` Z. 9–11 und `admin/vite.config.js` Z. 9–11: `alias: { '@shared': path.resolve(__dirname, '../shared') }`.
- Z. 14 bzw. Z. 14: `server.fs.allow` wird auf das Wurzelverzeichnis (`path.resolve(__dirname, '..')`) erweitert – ohne das würde der Dev-Server den Zugriff auf `shared/` außerhalb des Arbeitsbereichs verweigern.
- Der Alias wird real genutzt: 39 Dateien unter `admin/src` und `website/src` importieren über `@shared`, z. B. `admin/src/App.jsx:3` `import { beobachteAnmeldung, abmelden } from '@shared/auth.js'`.

Der einzige Unterschied zwischen beiden Konfigurationen ist der **FastBill-Dev-Proxy**, den es nur im Admin gibt (`admin/vite.config.js` Z. 18–24): `/fastbill-api` → `https://my.fastbill.com`, mit `rewrite` auf `/api/1.0`. Der Kommentar Z. 15–17 hält fest, dass in Produktion eine GAS-Proxy-Web-App diese Rolle übernimmt.

Beide `index.css` beginnen mit denselben zwei Zeilen (`admin/src/index.css:1` und `website/src/index.css:1`):

```css
@import 'tailwindcss';
@source '../../shared';
```

Der Kommentar darüber (`admin/src/index.css:3–9`, wortgleich in `website/src/index.css:3–9`) begründet die `@source`-Zeile: Tailwind 4 durchsucht standardmäßig nur den eigenen Arbeitsbereich; die gemeinsamen Komponenten (`shared/ui.jsx`, `shared/unterschrift.jsx`) liegen außerhalb. Ohne die Zeile fehlten alle nur dort verwendeten Klassen im erzeugten CSS – konkret genannt wird `touch-none` auf der Unterschriftsfläche, wodurch das Handy beim Zeichnen scrollte.

#### Farbdefinitionen

Beide Apps benutzen dieselben Variablennamen (`--color-praxis-*`), aber unterschiedliche Werte:

| | Verwaltung (`admin/src/index.css`, `@theme` ab Z. 23) | Webseite (`website/src/index.css`, `@theme` ab Z. 16) |
|---|---|---|
| Markenfarbe | `--color-praxis-600: #8b1a1a` (Dunkelrot, Z. 34) | `--color-praxis-600: #10346b` (Marineblau, Z. 23) |
| Dunkle Fläche | `--color-praxis-900: #1a1a1e` (Seitenleiste) | `--color-praxis-700: #1c244b` (Kopf/Fuß) |
| Schrift | `--font-sans: 'Segoe UI', system-ui, …` (Z. 78) | dieselbe Definition (Z. 27) |

Der Admin definiert zusätzlich Flächen-/Rahmen-/Schriftfarben, Status- und Signalfarben, drei Radien (`--radius-feld/karte/modal`), drei Schatten sowie eine **dunkle Darstellung** über `:root[data-thema='dunkel']` (ab Z. 113), die dieselben Variablen umfärbt. `html { font-size: 17px }` (Z. 86) skaliert die gesamte Verwaltung. Die Webseite hat kein Dunkel-Thema, dafür die Hilfsklasse `.bild-flaeche` mit dunklem Verlaufsschleier (Z. 35–48).

#### Firebase

- Projekt: `gabara-system`, gesetzt als `projects.default` in `.firebaserc` (Z. 3).
- Hosting-Ziele (`.firebaserc` Z. 5–12): Ziel `website` → Site `gabara-system`, Ziel `admin` → Site `gabara-system-admin`.
- `firebase.json` (Z. 6–48) enthält zwei Hosting-Blöcke, adressiert über `target`, mit `public: website/dist` bzw. `admin/dist` und jeweils SPA-Rewrite `** → /index.html`.
- `firestore.rules` und `firestore.indexes.json` sind in `firebase.json` Z. 2–5 registriert. `firestore.indexes.json` ist leer (`{"indexes": [], "fieldOverrides": []}`).
- **Keine `predeploy`-Hooks** in `firebase.json`: `npm run build` muss vor jedem Deploy von Hand laufen.

Deploy-Befehl (identisch in `.claude/skills/gabara/SKILL.md:139` und `docs/projekt-dokumentation.md:118`):

```
npx --yes firebase-tools deploy --only hosting,firestore:rules --project <id>
```

Ein bereits erfolgter Deploy ist an den Zwischenspeicher-Dateien in `.firebase/` ablesbar: `hosting.YWRtaW5cZGlzdA.cache` (Base64 für `admin\dist`, Zeitstempel 01.08. 22:49) und `hosting.d2Vic2l0ZVxkaXN0.cache` (`website\dist`, 01.08. 21:17).

Header/Caching aus `firebase.json`:

| Site | Muster | Cache-Control | weitere Header |
|---|---|---|---|
| website | `/bilder/**` (Z. 14–15) | `public, max-age=604800, stale-while-revalidate=86400` | – |
| website | `/assets/**` (Z. 18–19) | `public, max-age=31536000, immutable` | – |
| website | `/index.html` (Z. 23–24) | `no-cache, no-store, must-revalidate` | – |
| admin | `/assets/**` (Z. 35–36) | `public, max-age=31536000, immutable` | – |
| admin | `**` (Z. 40–44) | `no-cache, no-store, must-revalidate` | `X-Robots-Tag: noindex, nofollow` |

Die Begründungen stehen als `"//"`-Pseudoschlüssel in der Datei selbst: `index.html` darf nie zwischengespeichert werden, weil der Dateiname konstant bleibt (Z. 22); die Verwaltung wird komplett vom Zwischenspeicher und von Suchmaschinen ausgenommen (Z. 39).

Beachten: Im Admin-Block deckt das Muster `**` (Z. 40) auch `/assets/**` ab, für das drei Zeilen vorher `immutable` gesetzt wird. Die beiden Regeln überschneiden sich; die Webseite hat diesen Fall nicht, weil dort keine Catch-all-Regel existiert.

Der Ordner `website/public/` enthält `bilder/`, `robots.txt`, `sitemap.xml`, `admin/public/` nur `demo/`. Beide `dist/`-Ordner sind aktuell gebaut vorhanden, aber per `.gitignore` (Z. 2) ausgeschlossen.

#### Geheimnisse und `.gitignore`

`.gitignore` (Wurzel) schließt aus: `node_modules/`, `dist/`, `.firebase/`, `*.log`, `.env`, `.env.local`, `firebase-debug.log` sowie (als noch nicht committete Ergänzung) `gabara_test_suite.zip` und `seed/gabara_test_assets/`.

| Datei | Inhalt | Git |
|---|---|---|
| `admin/.env.local` | `VITE_FASTBILL_EMAIL` und `VITE_FASTBILL_API_KEY` – ein **echter, unmaskierter FastBill-API-Schlüssel im Klartext** | nicht getrackt, kommt auch in keinem Commit der History vor (`git log --all -- admin/.env.local` ist leer) |
| `shared/firebase-config.js` | `apiKey`, `authDomain`, `projectId`, `appId` des Projekts `gabara-system`, `enabled: true` | **getrackt**; der Kopfkommentar (Z. 8–10) hält ausdrücklich fest, dass der `apiKey` kein Geheimnis ist und der Schutz allein über `firestore.rules` läuft |
| `seed/gabara-fastbill-proxy.gs` | laut `SKILL.md:132` und `STAND.md:56` ein selbst zu setzendes `SECRET` | getrackt – dort darf kein echter Wert stehen bleiben |

Ein `website/.env*` existiert nicht; die einzige `.env`-Datei im Projekt ist `admin/.env.local`.

Wichtig für den Build: `shared/fastbill.js:26–31` liest die beiden `VITE_FASTBILL_*`-Variablen **nur unter `import.meta.env.DEV`**. Der Kommentar Z. 23–25 nennt den Grund – Vite kompiliert `VITE_`-Variablen im Klartext ins Bundle, deshalb darf der Schlüssel im Produktions-Build nicht aus der Umgebung kommen. Im ausgelieferten Stand stammt der Zugang aus der Firestore-Sammlung `integrationen/fastbill` (Z. 21–22), die laut Kommentar Z. 15–20 bewusst von `settings` getrennt liegt.

#### Abweichungen zwischen Code und Dokumentation

- `SKILL.md:33–34` nennt die launch.json-Einträge `gabara-website` / `gabara-admin`. In `.claude/launch.json` heißen sie tatsächlich `website` und `admin`. Dasselbe falsche Namenspaar steht in `STAND.md:199–200`.
- `.firebaserc` ist gegenüber dem letzten Commit geändert (`git diff`): Projekt und Sites hießen dort noch `gabara-baustellen` / `gabara-baustellen-admin`, jetzt `gabara-system` / `gabara-system-admin`. Der Umbenennungsstand ist also noch nicht committet.
- `STAND.md` widerspricht sich selbst: Z. 11–17 meldet beide Apps als online mit bereitgestellten Regeln, Z. 44 führt „Firestore-Regeln nach Rolle | geschrieben, **noch nie deployt**" und Z. 48–60 listet „Firebase-Projekt anlegen" weiterhin als Blocker.
- `README.md:45–52` beschreibt den Firebase-Go-Live noch als offenes V2-Vorhaben („V1 … lokal"), während `shared/firebase-config.js` `enabled: true` mit echten Projektwerten enthält und `.firebase/` bereits Deploy-Zwischenspeicher beider Sites führt.
- `SKILL.md:117–139` beschreibt die Go-Live-Checkliste durchgehend im Futur (Firebase-Projekt anlegen, Werte eintragen, `enabled: true` setzen) – diese Schritte sind im Code bereits erledigt.
- `STAND.md:157–159` empfiehlt `npm run build -w admin && npm run build -w website`; das Wurzel-Skript `build` baut in der umgekehrten Reihenfolge (Webseite zuerst). Sachlich gleichwertig, aber nicht deckungsgleich.
- `SKILL.md:25` nennt als Start-Befehl `npm run dev:admin --prefix C:\Users\dadah\gabara-baustellen`; ein `dev:website`-Pendant wird dort im Codeblock nicht gezeigt, obwohl das Skript existiert.

---

<a id="fremdsysteme"></a>

## 4. Fremdsysteme

### Anbindungen an andere Systeme

Die Anwendung spricht drei fremde Systeme an: **FastBill** (Kunden, Artikel, Rechnungen), **Google Kalender** (Termine) und einen **Apps-Script-Mail-Dienst**. Nur FastBill ist tatsächlich in Betrieb; die beiden anderen sind vorbereitet, aber nicht konfiguriert.

#### FastBill – aufgerufene Dienste

Alle Aufrufe laufen über eine einzige Funktion `fastbillCall(service, {data, filter, limit, bezugId})` in `C:\Users\dadah\gabara-baustellen\shared\fastbill.js` (Zeile 82–170). Genutzt werden zehn FastBill-Services:

| Service | Wrapper in `shared/fastbill.js` | Aufgerufen von |
|---|---|---|
| `customer.get` | `pruefeVerbindung` (Z. 176, `LIMIT 1`), `ladeKundenVonFastbill` (Z. 226, `LIMIT 100`) | `admin/src/pages/Einstellungen.jsx:588` |
| `customer.create` | `syncKunde` (Z. 213) | `Abrechnung.jsx:65`, `RechnungWizard.jsx:163` |
| `customer.update` | `syncKunde` (Z. 206) | dieselben, wenn `fastbillCustomerId` schon gesetzt ist |
| `article.get` | `ladeArtikelVonFastbill` (Z. 294, `LIMIT 100`) | `Einstellungen.jsx:295` |
| `article.create` | `syncArtikel` (Z. 283) | `Einstellungen.jsx:311` |
| `article.update` | `syncArtikel` (Z. 276) | dito, wenn `fastbillArticleId` gesetzt |
| `invoice.create` | `erstelleFastbillRechnung` (Z. 335) | `Abrechnung.jsx:70`, `RechnungWizard.jsx:171` |
| `invoice.complete` | `schliesseRechnungAb` (Z. 342) | `Abrechnung.jsx:92` |
| `invoice.sendbyemail` | `sendeRechnungPerMail` (Z. 348) | `Abrechnung.jsx:107` |
| `invoice.get` | `holeRechnungStatus` (Z. 362, `FILTER: {INVOICE_ID}`) | `Abrechnung.jsx:79` und `:94` |

Es gibt keinen Hintergrund-Abgleich und keinen Timer – jeder Aufruf hängt an einem Knopf. Begründung im Kopfkommentar `shared/fastbill.js:10`: Rate-Limit des Solo-Tarifs, 50 Aufrufe pro Stunde. Der Knopf „Artikel übertragen" warnt in `Einstellungen.jsx:305` explizit davor.

Datenrichtung: FastBill ist führend. `ladeKundenVonFastbill` (Z. 225–262) und `ladeArtikelVonFastbill` (Z. 293–314) schreiben in die lokalen Spiegel-Sammlungen `patients` bzw. `katalog` und ordnen über `fastbillCustomerId` / `fastbillArticleId` zu. Beim Neuanlegen eines Kunden setzt die App Vorbelegungen selbst: `ustModus` `13b` bzw. `ust19`, `zahlungszielTage` 16 bzw. 14, `sicherheitseinbehaltProzent` 10 bzw. 0 (Z. 253–255). Der Umsatzsteuersatz in Rechnungspositionen richtet sich nach `kunde.ustModus`: `13b` → `VAT_PERCENT: 0`, sonst 19 (Z. 321). Artikel gehen dagegen immer mit `VAT_PERCENT: 19` raus (Z. 273).

#### FastBill – wo der Zugang liegt

`zugang()` (Z. 20–49) liest drei Werte:

1. **Firestore, Sammlung `integrationen`, Dokument `fastbill`** – Felder `fastbillEmail`, `fastbillApiKey`, `proxyUrl` (Z. 22, 43–44). Eigene Sammlung, nicht `settings`; die Begründung steht als Kommentar in Z. 14–19: `settings` wird als komplette Liste abonniert, und Firestore erlaubt eine Sammlungs-Abfrage nur, wenn jedes Dokument darin lesbar ist. Die Regel dazu steht in `firestore.rules:217–219`: `allow read, write: if istBuero()` – bewusst `istBuero()` statt `darfVerwalten()`, weil `darfVerwalten()` über `keinRollenmodell()` jeden angemeldeten Zugang ohne `users`-Dokument durchlässt (Kommentar `firestore.rules:209–216`).
2. **`admin/.env.local`**, aber nur als Fallback und nur im Dev-Modus (Z. 28–31, `if (import.meta.env.DEV)`). Der Kommentar Z. 23–25 nennt den Grund: Vite kompiliert `VITE_`-Variablen als Klartext ins Bundle. Die Datei existiert lokal (291 Bytes, in `.gitignore`) und setzt `VITE_FASTBILL_EMAIL` und `VITE_FASTBILL_API_KEY`.
3. **Proxy-Adresse**: `integ.proxyUrl` wird nur übernommen, wenn sie auf `https://`, `http://` oder `/` passt (Regex Z. 36). Sonst greift der Dev-Pfad `/fastbill-api/api.php` (Z. 41). `proxyFehlt` ist `true`, wenn die App ausgeliefert läuft (`!DEV`) und keine gültige Adresse hinterlegt ist (Z. 47).

Priorität: Firestore-Wert vor `.env`-Wert (`integ.fastbillEmail || envEmail`, Z. 43).

#### FastBill – Aufbau des Aufrufs

Der Body-Kern ist immer gleich (Z. 95–98): `{ SERVICE, FILTER?, LIMIT?, DATA? }`. Ab hier gibt es **zwei Varianten**, unterschieden durch `istExternerProxy = /^https?:/i.test(proxyUrl)` (Z. 109):

| | Dev (Vite-Proxy) | Produktion (Apps-Script-Proxy) |
|---|---|---|
| URL | `/fastbill-api/api.php` → in `admin/vite.config.js` per `rewrite` auf `https://my.fastbill.com/api/1.0/api.php` | die eingetragene `…/exec`-Adresse, **ohne** die Parameter `secret` und `auth` (Z. 128–130) |
| Header | `Content-Type: application/json` + `Authorization: Basic <base64>` (Z. 141) | nur `Content-Type: text/plain;charset=utf-8` (Z. 140) |
| Body | `{SERVICE, …}` direkt | `{ secret, auth, payload: {SERVICE, …} }` (Z. 132) |

**Warum `text/plain`:** Kommentar Z. 138 – „text/plain vermeidet den CORS-Preflight – GAS beantwortet kein OPTIONS". `application/json` ist kein einfacher Content-Type und löst eine `OPTIONS`-Vorabanfrage aus; eine Apps-Script-Web-App beantwortet nur `doGet`/`doPost`, der Preflight würde also scheitern und der Aufruf nie stattfinden. `shared/mail.js:23` nutzt denselben Trick.

**Warum Zugang und Secret im Body:** Kommentar Z. 103–108 – GAS-Web-Apps reichen keinen `Authorization`-Header durch, und URLs landen im Browser-Verlauf, in Referrern und in Googles Server-Logs. Deshalb wandert der Basic-Auth-String in `umschlag.auth`, das Proxy-Secret in `umschlag.secret`.

Zwei Detail-Vorkehrungen, die im Code eigens begründet sind:

- `base64()` (Z. 57–62) kodiert vorher nach UTF-8, weil `btoa()` nur Latin-1 kennt und bei einem Umlaut in der Konto-Mail mit `InvalidCharacterError` abbräche (Kommentar Z. 99–101).
- Das Secret wird **nicht** über `searchParams.get()` gelesen (Z. 116–127), weil das `+` als Leerzeichen dekodiert; Base64-Secrets enthalten regelmäßig `+`. Stattdessen wird `u.search` roh zerlegt und nur `decodeURIComponent` angewandt.

**Umgang mit dem Secret in Meldungen:** `ohneGeheimnis()` (Z. 67–69) schneidet alles ab dem ersten `?` weg, bevor eine Adresse in einer Fehlermeldung oder im Protokoll landet (angewandt in Z. 163). Im Formular ist das Proxy-Feld als `type="password"` maskiert, mit eigenem Zeigen/Verbergen-Schalter (`Einstellungen.jsx:612–618`), Begründung im Kommentar Z. 609–611: die Adresse trägt das Secret und stünde sonst auf jedem Bildschirmfoto.

#### FastBill – Fehlerbehandlung und `apilog`

`fastbillCall` unterscheidet vier Ausgänge:

- `proxyFehlt` → Abbruch mit erklärendem Text vor jedem Netzwerkzugriff (Z. 84–90), Protokollstatus `fehler`.
- kein Zugang → `{ simuliert: true }`, Protokollstatus `simuliert` (Z. 91–94).
- `fetch` wirft → Protokoll `Netzwerk: …`, nach außen „FastBill nicht erreichbar (Netzwerk/Proxy prüfen)." (Z. 144–147).
- Antwort ohne `RESPONSE` oder mit `RESPONSE.ERRORS` → Fehler. Der Sonderfall `keinJson` (Z. 148–156, 163) ist eigens abgefangen: In der ausgelieferten App existiert `/fastbill-api` nicht, die SPA-Umleitung liefert `index.html` mit HTTP 200 zurück – laut Kommentar Z. 37–40 sah das früher wie ein FastBill-Fehler aus.

Jeder Aufruf schreibt über `logEintrag()` (Z. 71–78) ein Dokument in die Sammlung `apilog` mit den Feldern `dienst: 'fastbill'`, `service`, `status` (`ok` | `fehler` | `simuliert`), `bezugId` (unsere Dokument-ID: Kunden-, Artikel-, Rechnungs-ID), `fehlerText`, `createdAt`. Der Schreibvorgang ist in `try/catch` gekapselt – „Log darf nie den eigentlichen Aufruf verhindern" (Z. 77). **Nicht protokolliert werden** Request-Body, Antwort-Body, E-Mail-Adresse und API-Key. Anzeige im Reiter FastBill: die 20 jüngsten Einträge, absteigend sortiert (`Einstellungen.jsx:593`, Tabelle Z. 668–688). Es gibt kein automatisches Aufräumen; „Protokoll leeren" löscht in einer Schleife Dokument für Dokument (`Einstellungen.jsx:665`). Leseregel: `firestore.rules:172–175`, nur `darfVerwalten()`.

#### Apps-Script-Proxy (`seed/gabara-fastbill-proxy.gs`)

Einrichtung laut Kopfkommentar Z. 8–14: neues Projekt auf script.google.com anlegen, Code einfügen, `SECRET` ändern, „Bereitstellen → Web-App: Ausführen als *Ich*, Zugriff *Jeder*", dann die `…/exec`-Adresse **inklusive `?secret=…`** in Einstellungen → FastBill eintragen.

`SECRET` steht im Repo auf dem Platzhalter `'HIER-EIGENES-SECRET-EINTRAGEN'` (Z. 34). `doPost` verweigert den Dienst, solange `SECRET` leer, gleich dem Platzhalter oder kürzer als 16 Zeichen ist (Z. 40–42) – „ein voreingestelltes Secret ist dasselbe wie kein Secret" (Z. 24–25).

Ablauf in `doPost` (Z. 38–83): Body als JSON parsen → `secret` aus `umschlag.secret`, ersatzweise `e.parameter.secret` → `auth` analog → die eigentliche Anfrage aus `umschlag.payload`, ersatzweise der ganze Body. Der Query-Weg ist ausdrücklich nur zur Abwärtskompatibilität erhalten (Z. 21–23). Weitergeleitet wird per `UrlFetchApp.fetch` an `https://my.fastbill.com/api/1.0/api.php` mit `contentType: 'application/json'`, Header `Authorization: Basic <auth>` und `muteHttpExceptions: true` (Z. 70–76). Die FastBill-Antwort geht unverändert als JSON zurück (Z. 77–78).

Fehlermeldungen (alle über `fehler_()`, das sie als `{RESPONSE:{ERRORS:[text]}}` verpackt, Z. 106–108):

| Fall | Meldung | Zeile |
|---|---|---|
| Platzhalter-Secret / < 16 Zeichen | „Proxy nicht eingerichtet: SECRET im Skript setzen (mind. 16 Zeichen)." | 41 |
| kein Secret übermittelt | „Proxy: kein Secret uebermittelt – fehlt „?secret=…" am Ende der Proxy-Adresse in den Einstellungen?" | 55 |
| Secret stimmt nicht | „Proxy: falsches Secret – der Wert hinter ?secret= stimmt nicht mit SECRET im Skript ueberein." | 58 |
| kein `auth` | „Proxy: kein FastBill-Zugang übermittelt" | 63 |
| Ausnahme | „Proxy-Fehler beim Weiterleiten" (bewusst ohne Details, Z. 80) | 81 |

Fehlendes und falsches Secret sind bewusst getrennt (Kommentar Z. 50–53): der häufigste Einrichtungsfehler ist das vergessene `?secret=…`. Der Vergleich `gleich_()` (Z. 96–104) läuft über alle Zeichen ohne vorzeitigen Abbruch, damit die Antwortzeit nicht verrät, wie viele Zeichen gestimmt haben. `doGet` beantwortet `?ping=1` mit `{ok:true, dienst:'gabara-fastbill-proxy'}` als Verbindungstest (Z. 87–92). Der Kopfkommentar Z. 28–31 hält fest, dass Apps Script bei `ContentService` keinen HTTP-Status setzen kann (immer 200) und keine Request-Header durchreicht – deshalb die Fehlermeldung im Body im FastBill-Format, das die Verwaltung ohnehin auswertet.

Das Skript speichert nichts und protokolliert keine Zugangsdaten (Z. 26). Es gibt im Ordner `seed/` **keine weitere `.gs`-Datei**; `appsscript.json` liegt daneben und deklariert die Scopes `script.send_mail`, `script.external_request`, `datastore`, `userinfo.email`.

#### Reiter „FastBill" in den Einstellungen

`admin/src/pages/Einstellungen.jsx:542–692`. Drei Felder (Konto-E-Mail, API-Key, Proxy-URL), API-Key und Proxy-URL maskiert. Zwei Validierungshinweise direkt am Proxy-Feld: ungültiges Format (Z. 620–624) und – nur im Produktions-Build – leeres Feld (Z. 627–631, Text `einst.fbProxyNoetig` in `shared/texte.js:517`).

Beim Speichern (Z. 560–578) wird `s.update('integrationen','fastbill', {...werte})` benutzt; ein Fehlschlag wird jetzt im UI angezeigt (Z. 574) – der Kommentar Z. 572–573 hält fest, dass er früher still in die Konsole lief und die Felder trotzdem die eingetippten Werte zeigten. „Verbindung testen" (Z. 580–591) speichert vorher, falls ungespeicherte Änderungen vorliegen; Begründung im Kommentar Z. 583–586: der Test liest den Zugang aus der Datenbank, nicht aus dem Formular, und meldete bei der Ersteinrichtung sonst „kein Zugang hinterlegt". Drei Ergebnisfarben: grün `Verbunden – {n} Kunde(n) gefunden`, amber `Simuliert – kein Zugang hinterlegt`, rot `Fehler: {text}` (Z. 650–658, Texte `shared/texte.js:478–480`).

#### Google Kalender

`shared/googleCalendar.js`, 113 Zeilen. **Nicht eingerichtet.** `GOOGLE_KALENDER.clientId` ist in `shared/firebase-config.js:34` leer, `kalenderId` steht auf `'primary'`. Damit liefert `kalenderKonfiguriert()` (Z. 20–22) `false`, und `admin/src/pages/Kalender.jsx:193–197` zeigt statt des Verbinden-Knopfs den Hinweis `T.googleDemo` an. Termine liegen ausschließlich in Firestore.

Technisch fertig ist: OAuth per Google Identity Services, Scope `calendar.events`, Skript wird zur Laufzeit von `accounts.google.com/gsi/client` nachgeladen (`kalenderVerbinden`, Z. 40–55). Das Access-Token liegt in einer Modul-Variablen (Z. 18) – es gibt **keine Speicherung und keine Erneuerung**, nach jedem Neuladen der Seite muss neu verbunden werden. `eventAnlegen` (Z. 82–96) schreibt bewusst nur Einsatzart plus Kunden-Kürzel („M. R.", `kundenKuerzel` Z. 73–77) in den Titel; die Verknüpfung läuft über `extendedProperties.private.patientId`/`terminId`, die E-Mail über `extendedProperties.shared.patientEmail`. Der Kopfkommentar Z. 8–10 erklärt, warum die Feldnamen `patientId`/`patientEmail` trotz Malerbetrieb stehen bleiben: sie hängen an bereits angelegten Google-Events.

Aufrufer: `Anfragen.jsx:380` und `NeuerTermin.jsx:294` legen an und merken die ID in `appointments.googleEventId`; `TerminModal.jsx:113–114` löscht das Event beim Status „abgesagt". **`eventVerschieben` (Z. 103–112) wird nirgends aufgerufen** – ein verschobener Termin bliebe im Google-Kalender auf der alten Zeit stehen.

#### Mailversand

`shared/mail.js`, 30 Zeilen. **Nicht in Betrieb, und das Gegenstück fehlt.** Der Kopfkommentar Z. 2–4 sagt es selbst: „Das Gegenstück-Skript liegt noch NICHT im Repo und `MAIL_DIENST.url` ist leer -> es wird derzeit nichts versendet." Bestätigt: `shared/firebase-config.js:41–44` setzt `url: ''` und `secret: ''`, und in `seed/` liegt kein Mail-Skript.

`sendeKundenMail(typ, daten)` (Z. 17–30) würde per `fetch` mit `mode:'no-cors'` und `Content-Type: text/plain;charset=utf-8` einen JSON-Body `{...daten, typ, secret}` an `MAIL_DIENST.url` posten. Wegen `no-cors` ist die Antwort nicht lesbar – die Funktion gibt `true` zurück, sobald `fetch` nicht wirft; ein Fehlschlag beim Empfänger bliebe unbemerkt. Unterstützte Typen laut Kommentar Z. 14: `bestaetigung` und `absage`. Einziger Aufrufer ist `admin/src/pages/Anfragen.jsx:68–81` (`mailSenden`), das den Status `keine-email` / `nicht-konfiguriert` / `gesendet` / `fehler` zurückgibt; die Anzeige „✉ Versand nicht eingerichtet" (`Anfragen.jsx:64`) ist der Zustand, den man heute sieht.

Rechnungsversand läuft davon unabhängig über FastBill selbst (`invoice.sendbyemail`), siehe `shared/fastbill.js:347` und `shared/mail.js:4`.

#### Verhalten ohne Zugang (Simulationsmodus)

| Anbindung | ohne Zugang |
|---|---|
| FastBill, kein `fastbillEmail`/`fastbillApiKey` | `fastbillCall` gibt vor dem Netzwerkzugriff `{simuliert:true}` zurück (`fastbill.js:91–94`), Protokolleintrag `simuliert`. Jeder Wrapper reicht das Flag weiter, jede aufrufende Stelle bricht daraufhin ab und zeigt einen Hinweis: `Abrechnung.jsx:66/71/80/93/108`, `RechnungWizard.jsx:164/172`, `Einstellungen.jsx:296/311`, Testknopf `Einstellungen.jsx:656`. **Nichts wird lokal geschrieben** – `fastbillInvoiceId` und Status bleiben unverändert, weil die `store.update`-Zeile erst nach der `simuliert`-Prüfung kommt. |
| FastBill, ausgeliefert ohne Proxy-Adresse | kein Simulationsmodus, sondern harter Fehler mit Einrichtungsanleitung (`fastbill.js:84–90`) |
| Google Kalender ohne `clientId` | `kalenderKonfiguriert()` false; `eventAnlegen`/`eventLoeschen`/`eventVerschieben` steigen sofort aus (`return null` bzw. `return`), Termine bleiben rein intern |
| Mail ohne `MAIL_DIENST.url` | `mailKonfiguriert()` false, `sendeKundenMail` gibt `false` zurück, UI meldet „Versand nicht eingerichtet" |

Im lokalen Demo-Modus ist die Sammlung `integrationen` leer (`shared/demoData.js:447`), FastBill läuft dort also simuliert – außer man arbeitet im Dev-Betrieb mit gefüllter `admin/.env.local`. `resetDemo` klammert `integrationen` ausdrücklich aus (`shared/store.js:440–443`), weil ein Zurücksetzen den Zugang früher mit leeren Werten überschrieb und „nach jedem Demo-Reset war die Anbindung still tot".

#### Abweichungen zwischen Code und vorhandener Dokumentation

- **`shared/fastbill.js:7`** schreibt „URL in `settings/integrationen.proxyUrl`". Der Code liest sie aus einer **eigenen Top-Level-Sammlung** `integrationen`, Dokument `fastbill` (Z. 22) – genau so, wie es der ausführliche Kommentar 12 Zeilen tiefer (Z. 14–19) begründet. Der Kopfkommentar ist ein Rest des alten Aufbaus.
- **`docs/projekt-dokumentation.md:36`** führt `integrationen` in der Tabellenzeile zu `settings` als deren Unterdokument. Falsch aus demselben Grund; die spätere Stelle derselben Datei (Z. 96–98) beschreibt es dann richtig.
- **`shared/store.js:35–36`** nennt bei `settings` die Dokumente `'global', 'pausen', 'oeffnungszeiten', 'nummernkreis'` – korrekt und im Widerspruch zur Dokumentation oben.
- **Erstanlage des Zugangs-Dokuments:** `Einstellungen.jsx:567` speichert per `s.update(...)`, das im Firebase-Modus auf `updateDoc` abbildet (`shared/store.js:335–337`). `updateDoc` scheitert, wenn das Dokument noch nicht existiert. `integrationen/fastbill` wird von der App nirgends angelegt: `demoData.js:447` liefert eine leere Liste und `resetDemo` überspringt die Sammlung. Bei einer frischen Firestore-Datenbank schlägt das erste Speichern des FastBill-Zugangs also fehl (die Meldung wird seit Z. 574 wenigstens angezeigt). Der Kommentar darüber (Z. 563–566) begründet `update` mit dem Schutz vor Überschreiben – dieser Nebeneffekt ist dort nicht erwähnt.
- **`.claude/skills/gabara/STAND.md` widerspricht sich selbst**: Z. 18–19 „FastBill ist seit 01.08.2026 echt angebunden – online ausschliesslich ueber die Apps-Script-Weiterleitung", während Z. 56–58 derselben Datei das Setzen von `SECRET` und das Bereitstellen der Web-App noch als offenen **Blocker vor dem Go-Live** führt. Im Repo steht `SECRET` unverändert auf dem Platzhalter (`seed/gabara-fastbill-proxy.gs:34`) – ob die tatsächlich bereitgestellte Apps-Script-Kopie einen echten Wert hat, lässt sich aus dem Code nicht feststellen.
- **`STAND.md` Z. 39** listet „Firestore-Regeln nach Rolle: geschrieben, **noch nie deployt**", Z. 15–16 derselben Datei sagt „Regeln in `firestore.rules` sind bereitgestellt".
- **`docs/projekt-dokumentation.md:118`** verspricht für die Rechnungsliste einen Knopf „PDF (FastBill)". `holeRechnungStatus` liefert `dokumentUrl` (`fastbill.js:369`) und `Abrechnung.jsx:83` speichert sie – der Wert kommt aber nur beim Status-Abgleich mit, nicht beim Übertragen.
- **`shared/googleCalendar.js:13`** verweist für die Client-ID auf `shared/firebase-config.js` – das stimmt (Z. 33–36 dort). Die Datei nennt die Anbindung „Hauptsystem für Termine im Produktivbetrieb" (Z. 1), tatsächlich ist sie unkonfiguriert und damit vollständig inaktiv.

---

<a id="oberflaeche-und-querschnittsthemen"></a>

## 5. Oberfläche und Querschnittsthemen

### Zweisprachigkeit (Deutsch / Arabisch)

Der gesamte Sprachmechanismus steckt in `C:\Users\dadah\gabara-baustellen\shared\i18n.js` (110 Zeilen). Es gibt keinen React-Context und keine i18n-Bibliothek, sondern ein Modul-globales `let lang` (Zeile 18) mit einem `Set` von Abonnenten (Zeile 24), an das sich Komponenten über `useSyncExternalStore` hängen.

| Baustein | Ort | Verhalten |
|---|---|---|
| `SPRACHEN` | i18n.js:12–15 | genau zwei Einträge: `de` (Label „DE") und `ar` (Label „ع") |
| Speicherung | i18n.js:17–22 | `localStorage`-Schlüssel **`praxis-sprache`**, in `try/catch` gekapselt |
| `setLang` | i18n.js:32–37 | schreibt, ruft `anwenden()`, benachrichtigt alle Abonnenten |
| `useLang` | i18n.js:43–48 | Hook, liefert den Sprachcode; wird oft nur als Re-Render-Auslöser aufgerufen (`useLang()` ohne Rückgabewert, z. B. `shared/unterschrift.jsx:143`, `admin/src/components/WissenBild.jsx:354`) |
| `tr(obj)` | i18n.js:51–55 | übersetzt Inline-Objekte `{de,ar}`; Strings gehen unverändert durch, `null` wird zu `''`, Fallback `obj.de` |
| `t(key, werte)` | i18n.js:70–77 | Schlüssel-Nachschlag im registrierten Wörterbuch, Platzhalter `{n}` per `split/join`; **unbekannte Schlüssel geben den Schlüssel selbst zurück** |
| `istRtl()` | i18n.js:80–82 | `lang === 'ar'` |
| `lokale()` / `datumLok()` | i18n.js:99–109 | Intl-Formate; `datumLok` hängt `T12:00:00` an, um Zeitzonen-Verschiebungen zu vermeiden |

Das Wörterbuch selbst liegt nicht in `i18n.js`, sondern wird über `registriereTexte()` (i18n.js:60–62) von außen eingespielt – laut Kommentar, um einen Import-Ringschluss zu vermeiden.

**Umfang des Wörterbuchs** (`shared/texte.js`, 916 Zeilen): **837 Schlüssel**, jeder mit `de` und `ar`. Kein einziger `en`-Eintrag. Genau ein Eintrag hat bewusst leeres Arabisch (`'allg.uhr': { de: 'Uhr', ar: '' }`, texte.js:35) – da `t()` mit `??` arbeitet, wird der leere String angezeigt, nicht der deutsche Fallback. Die Schlüssel sind nach Bereichen gruppiert (Kommentarblöcke: Allgemein, Navigation, Monteur-Ansicht, Termin-Kategorien, Berichts-Typen/-Status, Projekt-Status, je Seite, Einstellungen, Dialoge, Wissensdatenbank, Zeichnungs-Beschriftungen, Stundenlisten). Die Datei registriert sich am Ende selbst (`registriereTexte(TEXTE)`, letzte Zeile).

**RTL-Behandlung.** `anwenden()` (i18n.js:26–29) setzt bei jedem Sprachwechsel `document.documentElement.lang` und `dir` (`rtl` bei Arabisch); die Funktion läuft außerdem einmal beim Import des Moduls (Zeile 30). Die Umkehrung des Layouts überlässt der Code danach vollständig CSS-Logik: Tailwind-Logikklassen (`ps-`/`pe-`, `start-`/`end-`, `text-start`) und punktuelle `rtl:`-Varianten. Letztere sind selten – im ganzen Admin nur 9 Stellen: `rtl:rotate-180` an Pfeil-Icons (`Hilfe.jsx:74, 95, 109`, `Kalender.jsx:172, 178`), `rtl:text-right` (`Login.jsx:90`, `Import.jsx:217`), `rtl:mr-0`/`rtl:ml-auto` (`TerminBilder.jsx:99`). In `Hilfe.jsx:92–95` steht die Regel ausdrücklich im Kommentar: nur der zugeklappte Pfeil (`chevronRechts`) wird gespiegelt, der aufgeklappte (`chevronUnten`) nicht.

**Reichweite.** Die Zweisprachigkeit ist praktisch eine Admin-Funktion. `shared/texte.js` wird ausschließlich in `admin/src/main.jsx:6` importiert; `website/src/main.jsx` importiert es nicht. Die Webseite nutzt nur `tr()` mit Inline-Objekten aus `shared/praxis.js` (`website/src/pages/Home.jsx:4, 191–198, 327–330`, `Anfrage.jsx:6`) und enthält weder `useLang` noch `setLang` noch den `SprachSchalter` – die öffentliche Seite hat also keinen Sprachumschalter und rendert nicht neu, wenn die Sprache wechselt.

**Umschalter** (`shared/ui.jsx:55–93`): ein immer sichtbarer Segment-Schalter mit Inline-SVG-Mini-Flaggen (Kommentar Zeile 12–13: Emoji-Flaggen werden unter Windows nur als Buchstabenkürzel dargestellt). Für `ar` wird die syrische Flagge von 2024 gezeichnet (ui.jsx:37–47). Eingebunden ist er dreimal, jeweils mit `dunkel`: `admin/src/App.jsx:172, 198`, `pages/Login.jsx:46`, `pages/monteur/MonteurApp.jsx:315`.

### Hell / Dunkel (`shared/thema.js`)

79 Zeilen, gleiche Bauart wie `i18n.js` (Modul-Variable + Abonnenten-Set + `useSyncExternalStore`).

**Drei Zustände** statt zwei: `WERTE = ['system', 'hell', 'dunkel']` (Zeile 14), Speicherung unter `localStorage`-Schlüssel `gabara-thema` (Zeile 13), Anfangswert `'system'`.

| Funktion | Zeile | Aufgabe |
|---|---|---|
| `aktivesThema()` | 33–35 | löst `'system'` über `matchMedia('(prefers-color-scheme: dark)')` in `hell`/`dunkel` auf |
| `getThema()` / `setThema()` | 37–47 | gespeicherte Wahl lesen/setzen (ungültige Werte werden verworfen) |
| `naechstesThema()` | 50–53 | rotiert `system → hell → dunkel → system` in der Reihenfolge des `WERTE`-Arrays (der Kommentar darüber schreibt „hell → dunkel → System") |
| `anwenden()` | 55–62 | setzt `data-thema` am `<html>` **und** `style.colorScheme` – letzteres, damit Bildlaufleisten und native Datumsauswahl mitziehen |
| `matchMedia`-Horcher | 65–71 | zieht bei Gerätewechsel nach, aber nur solange `wahl === 'system'` |

`anwenden()` wird zusätzlich vor dem ersten Render aufgerufen (`admin/src/main.jsx:7, 11`), laut Kommentar gegen das kurze Aufblitzen des hellen Bildes.

**Farbumschaltung.** Es gibt keine Dunkel-Klassen an Bauteilen. In `admin/src/index.css` stehen alle Farben als Tailwind-v4-`@theme`-Variablen (Zeilen 23–83), und der Block `:root[data-thema='dunkel']` (Zeilen 115–158) färbt dieselben Variablen um: Flächen, Rahmen, vier Schriftstufen, fünf Projekt-Status-Farben und die vier Signalpaare (Ton + Fläche). Jede Ansicht zieht dadurch automatisch mit.

**Sonderregel für die Markenfarbe.** Das Markenrot `--color-praxis-600: #8b1a1a` erfüllt zwei Rollen: Knopf-Hintergrund mit weißer Schrift und Textfarbe. Der Kommentar (index.css:130–135) nennt die Zahlen – 64 Verwendungen als Hintergrund gegen 30 als Textfarbe – und die Begründung: für weiße Schrift darauf bräuchte die Farbe eine Helligkeit unter 0,18, als Text auf dunkler Karte über 0,23; eine einzige Farbe kann beides rechnerisch nicht. Deshalb bleibt `praxis-600` im Dunkelthema dunkel (`#a32222`), und zusätzlich greifen drei nachgelagerte CSS-Regeln:

- `.text-praxis-600`, `.text-praxis-700`, `.hover\:text-praxis-600:hover` werden im Dunkeln auf `#ff9a90` gehoben (index.css:163–167).
- `.bg-praxis-600.text-white` / `.bg-praxis-700.text-white` erzwingen wieder `#ffffff` (index.css:171–174), damit eine Elternregel die Knopfschrift nicht mitnimmt.
- `img[src^='data:image/png']` wird auf `brightness(0.94)` gedämpft (index.css:178–180) – das betrifft genau die auf Weiß gespeicherten Unterschriften.

`--color-praxis-800` wird im Dunkeln umgedreht (`#f0dada`, index.css:144) mit der Begründung „nur als Textfarbe im Einsatz".

**Der Schalter** (`shared/ui.jsx:195–229`): ein einziger runder Knopf, der reihum schaltet und je nach Zustand ein anderes Inline-SVG zeigt – halbgefüllter Kreis (System), Mond (dunkel), Sonne (hell). Der Titel/`aria-label` kommt aus einem festen deutschen Objekt (ui.jsx:198), nicht aus dem Wörterbuch.

Das Dunkelthema gilt nur für die Verwaltung: `website/src/index.css` (49 Zeilen) enthält keine einzige `data-thema`-Regel und eine eigene, marineblaue `praxis`-Skala (`#10346b` als Marke, Zeilen 15–27).

#### Nachtrag: Stand nach der Kontrastprüfung vom 01.08.2026

Die obige Beschreibung gibt den Stand vor einem Messlauf wieder. Anschließend wurde
mit einem eigenen Prüfer **jedes sichtbare Textelement** der Wissensdatenbank
(437 Elemente) und der Monteur-Ansicht gemessen: tatsächliche Vordergrundfarbe
gegen die tatsächliche, nach oben ermittelte Hintergrundfarbe. Vier Textstellen
lagen bei Kontrast **1,04** – praktisch unsichtbar – und zwei Zeichnungstexte unter 3.

Gemeinsame Ursache: Farbstufen, die als **Fläche** gedacht sind, werden anderswo
als **Schrift** benutzt. Daraus folgten drei Änderungen:

1. **Eigene Variable `--color-marke-text`** (hell `#8b1a1a`, dunkel `#ff9a90`).
   Markenrot als Schrift zieht daraus; Markenrot als Knopffläche bleibt getrennt.
   `admin/src/components/WissenBild.jsx` benutzt dafür die Konstante `MARKE_TEXT`.
2. **`.text-praxis-900` wird im Dunkeln auf `--color-schrift-stark` gehoben.**
   `praxis-900` ist der Hintergrund der Seitenleiste, wird aber an vier Stellen
   als Schrift auf hellen Hinweiskästen benutzt (Hilfe, Import, Projekt-Detail) –
   dort stand vorher Dunkel auf Dunkel.
3. **`praxis-100` und `praxis-200`** sind auf der dunklen Leiste helle **Schrift**
   (`NAV_AUS` in `admin/src/stil.js` ist `text-praxis-100/80`). `praxis-200` bleibt
   deshalb hell; für `praxis-100` – überwiegend Fläche – gibt es eine eigene
   Textregel. Ohne das war die komplette Navigationsliste unlesbar.

Zusätzlich werden die **fest verdrahteten Neutralfarben** gesammelt umgebogen
(`bg-white`, `bg-slate-50/100/200`, `text-slate-300…900`, `border-slate-200/300`).
Im Quelltext stehen 623 feste Tailwind-Farbklassen in 35 Dateien; die farbigen
Paare (`bg-emerald-100` + `text-emerald-700`) bleiben in sich lesbar, die
neutralen nicht. Ein CSS-Block statt 35 Dateien.

**Bewusste Ausnahme:** Die Unterschriftsfläche bleibt weiß (Papier) und setzt das
per Stil-Attribut, damit die Umbiege-Regel sie nicht erwischt – sonst zeichnete
man dunkle Tinte auf dunklem Grund.

Ergebnis des erneuten Messlaufs: 437 Textelemente und 20 Zeichnungstexte,
**null Durchfaller**. Nicht gemessen sind die Seiten hinter der Anmeldung mit
echten Daten.

Die Beschriftung des Umschalters kommt inzwischen aus dem Wörterbuch
(`thema.hell` / `thema.dunkel` / `thema.system`), nicht mehr aus einem festen
deutschen Objekt.

### Unterschrift (`shared/unterschrift.jsx`)

321 Zeilen, drei exportierte bzw. interne Teile: `Zeichenflaeche` (intern), `UnterschriftDialog` (intern), `UnterschriftFeld` (Export) und `unterschriftAlsDataUrl` (Export).

**Vollbild-Dialog.** Im Formular steht nur ein Knopf bzw. die fertige Vorschau (`UnterschriftFeld`, Zeile 214–271). Beim Antippen öffnet ein `createPortal` nach `document.body` (Zeile 177/209) einen `fixed inset-0 z-[100]`-Dialog mit Kopfzeile (Titel + Abbrechen), Zeichenfläche und Fußleiste (Löschen + Übernehmen). Begleitmaßnahmen: `document.body.style.overflow = 'hidden'` solange offen und Escape schließt (Zeile 149–158). Der Dialog-Container trägt fest `dir="ltr"` (Zeile 178) – er bleibt also auch in der arabischen Ansicht links-nach-rechts aufgebaut, während die Beschriftungen aus `t('unterschrift.*')` übersetzt sind (texte.js:883–884, 902–906).

**Zeichnen.** Die Striche werden als Punktlisten in einem `useRef` gehalten (Zeile 145) und bei jeder Änderung komplett neu gemalt (`zeichneAlles`, Zeile 27–51: `lineWidth 2.5`, runde Enden, Farbe `#1e293b`, ein einzelner Tipp wird als Kreis mit Radius 1,25 gezeichnet). Vier Vorkehrungen sind ausdrücklich kommentiert:

- Die Fläche wird über einen `ResizeObserver` bei jeder Größenänderung neu vermessen (Zeile 60–77), inklusive `devicePixelRatio`-Deckelung auf 3.
- `setPointerCapture`/`releasePointerCapture` halten den Strich, wenn der Finger den Rand verlässt (Zeile 88, 111); `onPointerLeave` gibt es nicht mehr.
- `getCoalescedEvents()` holt Zwischenpunkte schneller Bewegungen (Zeile 102).
- `touchAction: 'none'` steht als **fester Inline-Stil** (Zeile 124), mit dem Kommentar, dass diese eine Eigenschaft nicht davon abhängen darf, ob ein Baulauf die Klasse erzeugt.

**Speichern.** „Übernehmen" kopiert das Canvas in ein losgelöstes zweites Canvas (Zeile 166–175) und reicht es nach oben. `unterschriftAlsDataUrl` (Zeile 281–320) liest die Pixel per `getImageData`, sucht das umschließende Rechteck aller Punkte mit Alpha > 10, legt 3 % Luft dazu und zeichnet den Ausschnitt zentriert und proportional in ein **400 × 150 px großes PNG mit weißem Grund** (`toDataURL('image/png')`). Der Kommentar begründet den Zuschnitt: der Dialog ist hochkant, das Ziel querformat – ohne Zuschnitt bliebe die Unterschrift ein schmaler Fussel. Wurde nichts gezeichnet, kommt `''` zurück.

Verwendet wird das ausschließlich im Berichtsformular: `admin/src/components/BerichtForm.jsx:686` (Kunde) und `:704` (Monteur); die Data-URLs landen beim Speichern in `unterschriftKunde` / `unterschriftMonteur` (BerichtForm.jsx:257–258) und von dort in den Ausdruck.

### Formular-Entwürfe (`shared/entwurf.js`)

121 Zeilen. Präfix `gabara-entwurf:` (Zeile 21), Schreib-Bremse 500 ms (Zeile 22), Haltbarkeit **14 Tage** (Zeile 23). Gespeichert wird `{ zeit, daten }` als JSON im `localStorage`; ein abgelaufener Eintrag wird beim Lesen gelöscht und als „nicht vorhanden" behandelt (Zeile 36–39). Alle Zugriffe sind in `try/catch` – bei vollem Speicher oder privatem Modus läuft das Formular unverändert weiter (Zeile 50–53).

Der Hook `useEntwurf(name, daten, aktiv = true)` (Zeile 75–120):

1. sieht **nur einmal beim Öffnen** nach (`useState`-Initialisierer, Zeile 77–78),
2. schreibt nichts, solange die Frage „wiederherstellen oder verwerfen?" offen ist (`entschieden`),
3. sichert danach entprellt alle 500 ms (Zeile 81–86) und zusätzlich bei `pagehide` und `visibilitychange` (Zeile 89–98),
4. gibt `{ gefunden, wiederherstellen, verwerfen, loeschen }` zurück.

Angeschlossen sind drei Formulare: `BerichtForm.jsx:306` (Name `bericht:<typ>:<id|projektId|neu>`, dritter Parameter `!gesperrt`), `NeuerTermin.jsx:92` (`termin:<id|neu>`) und `SpesenForm.jsx:50` (`spesen:<id|projektId|neu>`). `loeschen()` wird jeweils erst nach der Bestätigung des Stores aufgerufen (`BerichtForm.jsx:296` mit dem Kommentar „erst NACH der Bestätigung des Stores", `NeuerTermin.jsx:235, 299`, `SpesenForm.jsx:119`). Die Rückfrage rendert `admin/src/components/EntwurfHinweis.jsx` als gelbe Leiste über dem Formular mit Zeitstempel über `datumLok`. `alleEntwuerfeLoeschen()` (entwurf.js:61–66) wird nur an einer Stelle benutzt: `shared/store.js:257` (Zurücksetzen der Demo-Daten).

### Fehlerschutz (`admin/src/components/Fehlerschutz.jsx`)

61 Zeilen, klassische React-Fehlergrenze (`getDerivedStateFromError` + `componentDidCatch`). Die volle Spur inklusive `componentStack` bleibt in der Konsole (Zeile 28–31). Besonderheit: `componentDidUpdate` (Zeile 34–38) vergisst den Fehler, sobald sich die Prop `schluessel` ändert – aufgerufen wird sie mit `schluessel={location.pathname}`, sodass ein Seitenwechsel die Meldung räumt. Die Ersatzansicht ist eine Karte mit Titel, beruhigendem Text („Ihre Daten sind davon nicht betroffen"), Knopf „Seite neu laden" und einem aufklappbaren `<details>` mit der Fehlermeldung, das fest `dir="ltr"` trägt (Zeile 54).

Die Texte stehen nicht im Wörterbuch, sondern als lokales `{de,en,ar}`-Objekt in der Datei (Zeile 4–13) und werden mit `tr()` übersetzt. Eingesetzt wird die Grenze an vier Stellen in `admin/src/App.jsx` (Zeilen 305, 308, 315–334) – jeweils um den gesamten Routen-Bereich bzw. die Monteur-App; die Webseite hat keinen Fehlerschutz.

### Drucken (`admin/src/drucken.js`)

642 Zeilen. Der Ausdruck ist kein PDF-Renderer, sondern ein per `window.open('', '_blank', 'width=980,height=1200')` geöffnetes Fenster, in das mit `document.write` ein vollständiges HTML-Dokument geschrieben wird (`drucke()`, Zeile 171–199). Wird das Fenster vom Popup-Blocker verhindert, kommt eine deutsche `alert`-Meldung statt eines Absturzes (Zeile 173–175).

- **base-Adresse:** `<base href="${location.origin}/">` (Zeile 193). Der Kommentar darüber begründet es: das Druckfenster ist `about:blank` und hat keine eigene Basis, relative Bildpfade (`/demo/foto-01.jpg`, hochgeladene Dateien) blieben sonst leer. Dadurch dürfen in der Datenbank portable relative Pfade stehen.
- **Druckauslösung:** ein eingebettetes Skript zählt die noch nicht geladenen Bilder, druckt erst danach und bricht spätestens nach 4 Sekunden ab (Zeile 177–185).
- **Absicherung:** `esc()` / `escBr()` (Zeile 18–28) escapen `& < > "` vor jedem Einsetzen in das HTML.

**Layout** (Konstante `STIL`, Zeile 44–127): `@page { size: A4; margin: 12mm 12mm 14mm }`, Grundschrift „Segoe UI" 10,5 pt. Markenfarben sind hier **fest verdrahtet** (`ROT = '#8b1a1a'`, `ROT_DUNKEL = '#701414'`, Zeile 30–31), ebenso das Logo als Inline-SVG (Zeile 35–42) – ohne Bezug auf die CSS-Variablen der Oberfläche. Die im Kopfkommentar (Zeile 4–11) beschriebene Sieben-Teilung findet sich 1:1 im Code wieder: Kopf (`kopf()`, Zeile 143–159) → Beteiligte in zwei Spalten (`beteiligteBlock()`, Zeile 222–245) → Rechtshinweis-Box → Beschreibungsfeld → Tabellen mit Netto-Summe → Fotos getrennt nach „vorher"/„nachher"/„weitere" (`fotoBereiche()`, Zeile 261–270, Raster `33,333 %`, Bildhöhe 5,2 cm) → Fuß mit zwei Unterschriftenfeldern (`unterschriftenBlock()`, Zeile 280–300, Feldhöhe 2,4 cm).

| Export | Zeile | Dokument |
|---|---|---|
| `drucke` | 171 | Rahmen für alle anderen |
| `druckeRegiebericht` | 303 | Regiebericht/Stundenlohnzettel bzw. Reklamationsprotokoll (`bericht.typ === 'reklamation'`), mit §-15-Abs.-3-Anordnung, §-13-Abs.-5-Rügefrist und 6-Werktage-Anerkennungsfiktion |
| `druckeAbnahme` | 395 | Abnahmeprotokoll, Verjährung 48 Monate (VOB, `kunde.typ === 'gu'`) bzw. 60 Monate (BGB), Vorbehalt Vertragsstrafe |
| `druckeArbeitsauftrag` | 448 | Arbeitsauftrag mit Aufgabenliste und leerem Rückmeldefeld |
| `druckeStundenliste` | 524 | ein Monats-Stundenzettel |
| `druckeStundenlistenSammel` | 540 | mehrere Zettel in EINEM Dokument, je Person eine Seite (`break-before:page`) – laut Kommentar, weil Browser pro Klick nur ein `window.open` durchlassen |

Sämtliche Ausdrucke sind **fest deutsch**: Überschriften, Tabellenköpfe, Rechtstexte und Datumsformate (`toLocaleDateString('de-DE')`) sind Literale im Code, `t()`/`tr()` werden in `drucken.js` nirgends aufgerufen. Ab Zeile 492 steht ausdrücklich, dass es keinen Rechnungs-Eigendruck mehr gibt – das Rechnungs-PDF erzeugt FastBill, die Verwaltung verlinkt nur `rechnung.dokumentUrl`.

### Wissensdatenbank

**Inhalt** (`shared/wissen.js`, 818 Zeilen, zwei Exporte):

| Sammlung | Umfang | Aufbau |
|---|---|---|
| `WISSEN` | **9 Bereiche mit 30 Artikeln** – start, kalender, baustellen, berichte, stunden, abrechnung, monteur, stammdaten, daten | `{ id, icon, titel{de,ar}, sub{de,ar}, zu?, artikel[] }`, Artikel `{ id, frage{de,ar}, antwort[], zu? }` |
| `FAELLE` | **6 Anwendungsfälle** – neue-baustelle, woche-planen, regiebericht, stundenliste, abschlag, abnahme | `{ id, zu, titel{de,ar}, ausloeser{de,ar}, antwort[] }` |

Absatzformen im Code: `{ p }`, `{ schritte: [...] }`, `{ merke }`, `{ achtung }` und `{ bild, unterschrift }`. Alle Texte liegen zweisprachig als Inline-Objekte in der Datei selbst – begründet im Kopfkommentar (Zeile 1–21): Struktur und Reihenfolge gehören zum Inhalt und gingen in einer flachen Schlüsselliste verloren.

Die beiden Suchfunktionen `sucheWissen()` (Zeile 783–801) und `sucheFaelle()` (Zeile 804–818) sind bis auf die Datenquelle identisch: kleingeschriebener Teilstring-Vergleich über **alle** Werte jedes Übersetzungsobjekts – dadurch trifft ein deutscher Suchbegriff auch in der arabischen Ansicht. Bereiche bleiben in der Trefferliste, wenn Titel oder Untertitel passen, auch wenn kein Artikel trifft.

**Darstellung** (`admin/src/pages/Hilfe.jsx`, 230 Zeilen): zwei Reiter, Anwendungsfälle zuerst (Zeile 121, Begründung im Kommentar Zeile 144–145), Suchfeld, Trefferzeile, Bereiche als Karten mit aufklappbaren Artikeln. Bei aktiver Suche ist alles aufgeklappt (`istOffen`, Zeile 138). `useMemo` führt `lang` als Abhängigkeit mit (Zeile 124–125), damit ein Sprachwechsel die Liste neu aufbaut.

**Zeichnungen** (`admin/src/components/WissenBild.jsx`, 367 Zeilen): sieben Inline-SVGs, registriert in `ZEICHNUNGEN` (Zeile 343–351), eingebunden über `<WissenBild name unterschrift>` (Zeile 353–367). Keine Screenshots, keine Bilddateien – Begründung im Kopfkommentar: Screenshots veralten, wiegen als Base64 viel und lassen sich nicht übersetzen. Alle Farben sind `var(--color-…)`-Referenzen (Zeile 17–34), damit sie Hell/Dunkel automatisch mitmachen; alle Beschriftungen kommen über `t('bild.…')` aus dem Wörterbuch (texte.js:805–851).

| Zeichnung | Funktion | Inhalt | Einsatz in wissen.js |
|---|---|---|---|
| `ablauf` | Zeile 90 | 8 Stationen Kunde → Rechnung, untereinander | 1× |
| `sollIst` | 128 | drei Säulen: LV-Menge, gemeldet, abgerechnet | 1× |
| `berichtGate` | 159 | 6 Bedingungen, dann Knopf „Einreichen frei" | 2× |
| `freigabe` | 189 | Entwurf → eingereicht → freigegeben (mit Schloss) | 2× |
| `rechnungQuellen` | 225 | LV + Regie + Spesen laufen in einer Rechnung zusammen | 2× |
| `rollen` | 259 | zwei Spalten Büro / Monteur mit je 4 Punkten | 1× |
| `stundenzettel` | 293 | Miniatur des Ausdrucks, bewusst als deutsches Dokument | 2× |

**RTL-Spiegelung.** SVG-Koordinaten kennen keine Leserichtung, `text-anchor="start"` dagegen schon – der Kommentar (Zeile 36–46) beschreibt den Fehler, den das verursacht hat: die Beschriftung wurde im Arabischen von x=58 nach links aus dem Kasten heraus gezeichnet und abgeschnitten. Die Lösung ist der Helfer `spiegel(breite)` (Zeile 47–56) mit zwei Funktionen – `p(x)` für Punkte (Textanker, Kreismittelpunkt) und `r(x, w)` für Rechtecke (Breite abziehen, weil sie an der linken Kante gesetzt werden) – bei unverändertem Anker. Zusätzlich setzt die Textkomponente `Schrift` (Zeile 59–76) `direction={istRtl() ? 'rtl' : 'ltr'}` ausdrücklich. `spiegel()` wird in fünf der sieben Zeichnungen benutzt: `Ablauf` (104), `BerichtGate` (166), `Freigabe` (197), `Rollen` (264, dreht auch die Spaltenreihenfolge, Zeile 270) und punktuell im `Stundenzettel` (Zeile 300, nur die Titelzeile). `SollIst` und `RechnungQuellen` kommen ohne aus, weil sie rein senkrecht bzw. mittig aufgebaut sind.

---

<a id="nachtraege-aus-der-gegenpruefung"></a>

## 6. Nachträge aus der Gegenprüfung

Ein sechster Durchgang hat die fünf Abschnitte gegen den Code geprüft und Folgendes ergänzt.

### Lücken der bestehenden Doku-Abschnitte

Die folgenden Punkte stehen in keinem der fünf Abschnitte, sind aber am Code belegbar und für neue Mitarbeiter bzw. weitere Agenten notwendig.

#### Navigation und Einstiegspunkte der Verwaltung

`admin/src/main.jsx:15` und `website/src/main.jsx:11` nutzen beide **`HashRouter`** – jede Adresse trägt ein `#` (`…/#/projekte/p-iga`). Deshalb funktionieren die SPA-Rewrites in `firebase.json` auch ohne Server-Routing.

Die Navigationsliste `NAV` (`admin/src/App.jsx:28-43`) hat 14 Einträge; die **Startseite der Verwaltung ist der Kalender** (`App.jsx:320`, `/kalender` wird auf `/` umgeleitet, `:321`). Auf Mobil erscheinen nur die ersten fünf Einträge in der unteren Leiste (`App.jsx:208`).

| Pfad | Seite | Datei |
|---|---|---|
| `/` | Kalender (Wochenansicht) | `pages/Kalender.jsx` |
| `/projekte`, `/projekte/:id` | Baustellenliste, Baustellendetail | `pages/Projekte.jsx`, `pages/ProjektDetail.jsx` |
| `/termine` | Terminliste | `pages/Termine.jsx` |
| `/berichte` | Berichte (Freigabe) | `pages/Berichte.jsx` |
| `/kunden` | Kundenstamm | `pages/Kunden.jsx` |
| `/abrechnung` | Rechnungen + FastBill | `pages/Abrechnung.jsx` |
| `/uebersicht` | Tagesübersicht | `pages/Uebersicht.jsx` |
| `/anfragen` | Posteingang Webseite | `pages/Anfragen.jsx` |
| `/dashboard` | Kennzahlen | `pages/Dashboard.jsx` |
| `/stunden` | Stundenlisten | `pages/Stunden.jsx` |
| `/import` | Kunden-CSV-Import | `pages/Import.jsx` |
| `/einstellungen` | Einstellungen + Stammdaten | `pages/Einstellungen.jsx` |
| `/hilfe` | Wissensdatenbank | `pages/Hilfe.jsx` |
| `/monteur…` | Handy-Ansicht | `pages/monteur/MonteurApp.jsx` |

Zwei Zustände vor dem Login, die man kennen muss: `Ladebild` (`App.jsx:228-251`) blendet nach **6 Sekunden** einen Erklärtext plus „Seite neu laden" ein; `StartFehler` (`:253-282`) erscheint, wenn `beobachteAnmeldung` mit `fehler:'start'` (Firebase startet nicht) oder `fehler:'profil'` (Profilabfrage über 8 s, `shared/auth.js:137`) meldet. In beiden Fällen wird die Rolle bewusst **nicht** geraten.

Nur im Dev-Build: `localStorage.setItem('probe','monteur')` bzw. `'hilfe'` rendert die Monteur-Ansicht oder die Wissensdatenbank ohne Anmeldung (`App.jsx:298-300`).

#### Anmeldung, Konten und Mitarbeiteranlage

`shared/auth.js` ist der einzige Anmeldeweg.

- **Lokaler Modus**: feste Demo-Zugänge `buero@gabara-demo.de` / `monteur@gabara-demo.de`, Passwort `demo2026` (`auth.js:9-12`), Sitzung im `sessionStorage` unter `gabara-admin-session` (`:14`). Der Login-Bildschirm zeigt sie zum Anklicken an (`pages/Login.jsx:80-96`) – aber nur im lokalen Modus.
- **Firebase-Modus**: `signInWithEmailAndPassword`. Es gibt in der App **keine Registrierung, keine Passwort-Zurücksetzung und kein Anlegen von Auth-Konten**. Konten entstehen ausschließlich in der Firebase-Konsole.

Daraus folgt der wichtigste Einrichtungsschritt, der in keinem Abschnitt beschrieben ist: **Einstellungen → Mitarbeiter → „Anlegen" verlangt online die Firebase-Auth-UID als Eingabefeld** (`pages/Einstellungen.jsx:227-233`); ohne UID bricht `anlegen()` mit `einst.uidFehlt` ab (`:123`). Die UID wird zur Dokument-ID in `users` (`:127-131`). Ein rot hinterlegter Warnblock listet alle Mitarbeiter, deren Dokument-ID nicht wie eine UID aussieht (`/^[A-Za-z0-9]{20,}$/`, `:112-115`, Anzeige `:139-150`) – für diese greift die Rollenprüfung der Firestore-Regeln nicht.

Ablauf für einen neuen Monteur: Konto in der Firebase-Konsole anlegen → UID kopieren → Einstellungen → Mitarbeiter → UID, Name, E-Mail, Rolle, Team, Qualifikation eintragen.

#### Einstellungen: acht Reiter, nicht zwei

`REITER` in `pages/Einstellungen.jsx:17-26`: **Firmendaten · Mitarbeiter · Artikel · Textbausteine · Sätze · Arbeitszeiten · FastBill · Daten**. Beschrieben waren bisher nur FastBill und Daten.

Die Firmendaten liegen als Dokument `settings/global` mit den Vorgaben aus `shared/einstellungen.js:5-25`:

| Feld | Vorgabe | Wirkung |
|---|---|---|
| `praxisName` / `praxisAnschrift` | Gabara Service GmbH, Münchener Str. 21, 86551 Aichach | Briefkopf im Ausdruck |
| `praxisTelefon` / `praxisEmail` | +49 176 25700609 / Info@gabara-service.de | Ausdruck, Fußzeile |
| `bankName`, `iban` | leer | Ausdruck |
| `ustModusStandard` | `13b` | Vorbelegung Neukunde |
| `zahlungszielTage` / `sicherheitseinbehaltProzent` | 16 / 10 | Vorbelegung Neukunde |
| `regieFacharbeiter` / `regieHelfer` | 35 € / 31 € | Regie-Stundensatz je Qualifikation |
| `kmSatz` | 0,50 €/km | Fahrtkosten in `SpesenForm` |
| `standardSprache`, `waehrung`, `datumsformat` | `de`, `EUR`, `TT.MM.JJJJ` | – |

#### Öffnungszeiten und Pausen sind aktiv – nur nicht über den Store-Weg

Der Architektur-Abschnitt hält fest, dass `subscribeOeffnungszeiten`, `subscribePausen`, `subscribeSlots` und `ladeOeffnungszeiten` keinen Aufrufer haben. Das stimmt wörtlich, führt aber in die Irre: Die Dokumente `settings/oeffnungszeiten` und `settings/pausen` **werden benutzt**, nur über `useCollection('settings')`:

- Gelesen in `pages/Kalender.jsx:102-106` (`fenster`, `telefon`, `urlaub`). Sie steuern das Zeitraster (`:137-152`), ob der **Samstag** überhaupt erscheint (`:117-121`), die Beschriftung „nur telefonisch"/„geschlossen" (`:262`) und die Urlaubsmarkierung.
- Gepflegt im Reiter *Arbeitszeiten* (`pages/Einstellungen.jsx:458-535`), inklusive Urlaubszeiträumen und wiederkehrenden Pausen (`{tag, von, bis, grund}`).

Tot ist damit nur die Slot-Mechanik, nicht die Zeitkonfiguration.

#### `shared/slots.js` – das Datums-/Zeitmodul

Trotz des Namens enthält `shared/slots.js` (124 Zeilen) die **allgemeinen Datums- und Zeithelfer des Projekts** und wird in 14 Admin-Dateien importiert: `toISO`, `heuteISO`, `addTage`, `wochentag`, `fmtDatum`, `fmtDatumVoll`, `zuMinuten`, `zuZeit`, `endeZeit`, `normalisiereFenster`, `fensterFuer`, `imUrlaub`. Der eigentliche Buchungsteil (`tagesSlots`, `freieSlots`, `buchbareTage`, `SLOT_MINUTEN = 30`) stammt aus der Arztpraxis-Vorlage und hat außerhalb der Datei keinen Aufrufer. Wer Datumslogik braucht, nimmt dieses Modul – nicht `new Date()`.

#### Weitere gemeinsame Module ohne Erwähnung

| Datei | Inhalt | Verwendung |
|---|---|---|
| `admin/src/stil.js` (158 Z.) | **Verbindliche Konvention**: „EINZIGE Quelle für die Optik der Büro-Verwaltung. Keine Seite und keine Komponente definiert eigene feld-/knopf-/karte-Klassenstrings" (`:1-8`). Exportiert `SEITE`, `KARTE*`, `BTN_*`, `NAV_*`, `ZAEHLER` … | 18 Dateien unter `admin/src`; ausgenommen ist `pages/monteur/` (große Touch-Ziele) |
| `admin/src/hinweise.js` + `components/InfoHinweis.jsx` | Zentrale Erklärtexte (`HINWEIS.*`) für die Info-Zeichen an Formularfeldern, Regel: „ein bis zwei Sätze, die sagen WOHIN der Wert fließt" | LvEditor, LvImport, NeuerTermin, RechnungWizard, Einstellungen, Projekte, Stunden |
| `admin/src/components/Seite.jsx` | Gemeinsame Bausteine `Seitenkopf`, `Leer`, `ChipReihe`, `Segment`, `Meldung` | alle Hauptseiten |
| `shared/teams.js` (79 Z.) | Team-/Kolonnen-Logik: `TEAM_FARBEN` (12 Farben), `teamsAus` (nur `rolle==='mitarbeiter'` und `aktiv !== false`), `teamFuerTermin` (Farbe = **erster** zugewiesener Monteur), `monteurNamen`, `textAuf` (Luminanz-Heuristik für die Schriftfarbe) | Kalender, Dashboard, Projekte, NeuerTermin, Einstellungen, MonteurApp |
| `shared/format.js` | `euro()` (Intl `de-DE`/EUR), `summe()`, `textZuHtml()` | 10+ Dateien; `euro()` ist die einzige Währungsausgabe |
| `shared/route.js` | `berechneRoute` für die automatische Kilometerermittlung | nur `SpesenForm.jsx` |
| `admin/src/csv.js` | CSV-Erzeugung/-Zerlegung | Import, LvImport |

#### Die öffentliche Webseite

`website/src/main.jsx:12-18` definiert vier Routen: `/` (Home), `/anfrage`, `/impressum`, `/datenschutz`, alles Übrige fällt auf Home zurück. `website/src/components/` ist **leer** – die Seite besteht aus drei Dateien.

Sämtliche Inhalte stehen in `shared/praxis.js` (140 Z.): `PRAXIS` (Name, Anschrift, Telefon, `telefonLink`, E-Mail), `LEISTUNGEN` (mit `bild`-Pfaden nach `/bilder/…`), `ANLIEGEN` (die Auswahlkacheln des Anfrageformulars), `FAQ`, `KARRIERE`, `TEAM`, `OEFFNUNGSZEITEN`. Der Kopfkommentar (`:2-4`) legt fest, dass die Export-Namen der Vorlage bleiben und nur Deutsch gepflegt wird – `en`/`ar` tragen denselben deutschen Text.

Rechtsangaben stehen ausschließlich in `website/src/pages/Recht.jsx:9-22`: Geschäftsführer Salman Haj Hussein, USt-IdNr. DE351189636, Steuernummer 10312700595. **Offener Punkt im Code selbst vermerkt** (`Recht.jsx:16-22`): Registergericht und Registernummer fehlen, obwohl sie für eine GmbH nach § 5 Abs. 1 Nr. 4 DDG Pflichtangaben sind; `REGISTER = { gericht: '', nummer: '' }` – sobald befüllt, erscheint der Block automatisch.

Anders als im Oberflächen-Abschnitt beschrieben nutzt die Webseite `tr()` nur für die Inhalte aus `praxis.js`; die Bedien- und Fehlertexte des Anfrageformulars sind fest deutsche Zeichenketten (`Anfrage.jsx:24-26, 69-80, 104-130`), und `sprache: 'de'` wird hart mitgesendet (`:38`).

#### Live-Meldungen im Büro

`LiveToast` (`admin/src/App.jsx:68-125`) meldet **zwei** Ereignisse, nicht nur Anfragen:

| Auslöser | Bedingung | Ziel des Klicks |
|---|---|---|
| neue Anfrage | `status === 'neu'` und `createdAt > Mount-Zeit` (`:78-79`) | `/anfragen?id=<id>` |
| neu eingereichter Bericht | `status === 'eingereicht'` und `eingereichtAm > Mount-Zeit` (`:89-90`) | `/berichte` |

Beide lösen den Doppelton `piepton()` aus (`:46-61`, WebAudio, kein Audio-Asset). Der Toast verschwindet nach 10 s (`:102`). Die Zeitschranke `seit` ist notwendig, weil `useCollection` mit `[]` startet und sonst beim Mounten alles als neu gälte (Kommentar `:64-67`). Dieselben zwei Zahlen erscheinen als Zähler an den Navigationseinträgen *Anfragen* und *Berichte* (`:136-137, 166-167`), und der Fußbereich der Seitenleiste zeigt den aktiven Ablage-Modus als Chip „Online"/„Lokal" (`:178-183`).

#### Demo-Daten enthalten echte Konten und echte Kundendaten

`shared/demoData.js:53-55` trägt die **echten Firebase-Auth-UIDs des Projekts `gabara-system`** fest im Quelltext (`AHMAD`, `SAMIR`, `BUERO`), `:69` zusätzlich eine echte private Gmail-Adresse als Büro-Login. Der Kommentar (`:61-67`) begründet das: mit erfundenen IDs liefe die Rollenprüfung der Regeln ins Leere. Folge für den Betrieb: `resetDemo({ mitDemodaten: true })` schreibt diese drei `users`-Dokumente in die **Live-Datenbank** – auch dann, wenn `behalteNutzer` ein anderes Konto rettet. Wird das System für einen anderen Betrieb aufgesetzt, müssen diese drei Konstanten ersetzt werden.

Ebenso stammen die Demo-Kunden aus echten Unterlagen (`demoData.js:1-3`, `:76-84`: Bothmer Akustikbau GmbH mit realer Anschrift, Telefonnummer und E-Mail).

#### Stand der Versionsverwaltung

Der Betriebs-Abschnitt nennt nur `.firebaserc` als „noch nicht committet". Tatsächlich ist der **komplette aktuelle Stand uncommittet**: `git status` meldet gegenüber `ef9d5c3` rund 60 geänderte Dateien und darüber hinaus ausschließlich untracked ganze Bausteine – `shared/texte.js`, `shared/thema.js`, `shared/wissen.js`, `shared/entwurf.js`, `admin/src/stil.js`, `admin/src/pages/Hilfe.jsx`, `admin/src/pages/Stunden.jsx`, `admin/src/components/{Fehlerschutz,Seite,EntwurfHinweis,WissenBild}.jsx`, `admin/public/demo/` sowie sieben Bilddateien unter `website/public/bilder/`. `website/public/praesentation.html` ist gelöscht, aber nicht committet.

Praktische Folge: Zweisprachigkeit, Hell/Dunkel, Wissensdatenbank, Stundenlisten und die Stil-Konvention existieren in **keinem** Commit. Ein `git checkout .` oder `git clean -fd` würde sie unwiederbringlich entfernen.

#### Kalender – die Startseite

`pages/Kalender.jsx` (548 Z.) ist eine **Wochenansicht Montag–Freitag**, Samstag nur bei Arbeitszeiten oder vorhandenen Terminen (`:117-121`). Raster `PX_PRO_30MIN = 26` (`:43`), Zeitbereich 8–19 Uhr, erweitert um Öffnungszeiten und tatsächliche Termine (`:137-152`). Überlappende Einsätze werden über `spaltenLayout` (`:56 ff.`) nebeneinander gelegt. Ein Team-Filter (`nurTeam`, `:112`) blendet auf eine Kolonne ein; die Farbe je Karte kommt aus `teamFuerTermin`. Klick auf eine Karte öffnet `TerminModal`, Klick auf freie Fläche `NeuerTermin` mit vorbelegtem Datum/Uhrzeit.

#### Kleinere Korrekturen an den vorliegenden Abschnitten

- `speichereSetting` hat drei Parameter, nicht zwei: `speichereSetting(id, daten, vorhanden)` (`admin/src/hooks.js:54-59`). `vorhanden` entscheidet zwischen `update` und `add` und ist der Grund, warum das Anlegen von `settings`-Dokumenten funktioniert, das von `integrationen/fastbill` aber nicht.
- Die `hasOnly`-Feldliste der `requests`-Regel umfasst **13** Felder – zusätzlich zu den sieben gesendeten auch `status`, `createdAt`, `datum`, `start`, `dauer` (`firestore.rules:50`).
- `shared/projektstatus.js` exportiert außerdem `OFFENE_STATI`, `AKTIVE_STATI` (= dieselbe Liste, „Stati, deren Einsätze Monteure auf dem Handy sehen") und liefert je Stufe neben `label`/`farbe` auch ein `icon` (`:7-13, 41-52`).
- `shared/i18n.js` exportiert zusätzlich `WOCHENTAGE` (`:86 ff.`) als einzige Quelle der Wochentagsnamen für Einstellungen, Kalender und Webseite.

---

<a id="widersprueche-und-offene-punkte"></a>

## 7. Widersprüche und offene Punkte

Stellen, an denen Kommentare, Skill-Dateien oder ältere Dokumentation vom Code abweichen. Sie stehen hier, damit niemand ihnen aufsitzt.

- **[architektur]** docs/projekt-dokumentation.md:36 fuehrt 'integrationen' als Dokument INNERHALB von settings ('settings | global/pausen/oeffnungszeiten/nummernkreis/integrationen'). Im Code ist 'integrationen' eine eigene Top-Level-Sammlung (shared/store.js:50) mit eigener Regel (firestore.rules:217). Auch docs/aenderungsbericht-2026-08-01.md:40 und :44 schreiben durchgaengig 'settings/integrationen'.
- **[architektur]** shared/demoData.js:444-447 behauptet: 'resetDemo laesst die Sammlung integrationen inzwischen komplett unangetastet'. Das gilt NUR fuer die Firebase-Variante (store.js:443). Die lokale Variante (store.js:251-254) baut das Leer-Objekt aus ALLEN COLLECTIONS und ersetzt db vollstaendig durch erzeugeDemoDaten() (das integrationen: [] enthaelt) - im Lokal-Modus wird der FastBill-Zugang beim Zuruecksetzen also sehr wohl geloescht.
- **[architektur]** store.js:241-242 sagt 'Gleiche Signatur wie in der Firebase-Variante, damit der Aufrufer nicht zwischen den Modi unterscheiden muss'. Tatsaechlich nimmt die lokale resetDemo nur { nurWennLeer, mitDemodaten } (store.js:243); die von Einstellungen.jsx:726-733 uebergebenen Parameter 'melde' und 'behalteNutzer' werden lokal stillschweigend ignoriert - kein Fortschritt, keine Kontoschonung.
- **[architektur]** Kopfkommentar store.js:7 'Beide Modi bieten dieselbe API, die Apps merken keinen Unterschied' stimmt nicht: schreibeSlot und loescheSlot existieren nur im Firebase-Modus (store.js:412-424). Deshalb muessen sechs Aufrufstellen explizit s.mode === 'firebase' pruefen (u. a. NeuerTermin.jsx:183,233,291; TerminModal.jsx:99,108).
- **[architektur]** docs/aenderungsbericht-2026-08-01.md:378-390 stellt das Regelwerk als durchgaengig 'nach Rolle getrennt' dar und listet settings gar nicht auf. In firestore.rules:203 steht fuer settings weiterhin 'allow write: if angemeldet()' - jeder Monteur darf settings/global, pausen, oeffnungszeiten und nummernkreis ueberschreiben.
- **[architektur]** Der Kommentarblock firestore.rules:76-83 sagt 'SCHREIBEN ist nach Rolle getrennt'. Bei /photos gilt aber 'allow create, update: if angemeldet()' (rules:158) - ein Monteur kann auch fremde Fotos ueberschreiben; nur das Loeschen ist auf Buero bzw. eigenes vonId begrenzt.
- **[architektur]** store.js:26-27 beschreibt photos als 'je Foto ein Dokument, <1 MB'. Die tatsaechliche Schranke ist eine Zeichenlaengen-Pruefung dataUrl.size() < 980000 in firestore.rules:159; im Lokal-Modus gibt es gar keine Groessenpruefung, nur den QuotaExceeded-Abbruch (store.js:89-98).
- **[architektur]** store.js:364-367 und 208-221 bauen eine komplette Slot-Infrastruktur (subscribeSlots, subscribePausen, subscribeOeffnungszeiten, ladeOeffnungszeiten). In admin/src und website/src gibt es dafuer keinen einzigen Aufrufer - slots wird nur beschrieben, nie gelesen. Die Anfrage-Seite (website/src/pages/Anfrage.jsx:30-38) sendet weder datum noch start, sodass auch die Slot-Reservierung in addPublicRequest (store.js:394-405) nie ausloest.
- **[architektur]** shared/firebase-config.js:12-17 nennt als Umschalt-Reihenfolge u. a. 'users-Dokumente mit der Auth-UID als Dokument-ID anlegen'. In shared/demoData.js:53-55 sind drei echte Auth-UIDs des Projekts gabara-system fest einkompiliert (u. a. der Buero-Zugang nasirdada.98@gmail.com, demoData.js:69) - die Demo-Daten sind damit an genau diese Firebase-Konten gebunden.
- **[architektur]** firestore.rules:71-74 erlaubt 'allow read: if true' auf slots. Da nichts diese Sammlung liest, ist der oeffentliche Lesezugriff derzeit ohne Nutzen, aber vorhanden.
- **[architektur]** shared/teams.js:47 und :67 greifen als Fallback auf das Feld termin.arzt zurueck - ein Rest der Arztpraxis-Vorlage, der in demoData.js:213 noch mit leerem Wert mitgeschrieben wird.
- **[prozesse]** ProjektDetail.jsx:20-25/55-56 – StatusBadge liest s.label, die Status-Tabelle liefert aber nur 'schluessel': der Status-Chip bleibt fuer alle bekannten Berichts-/Spesen-Status leer.
- **[prozesse]** Abrechnung.jsx:85 – dieselbe Verwechslung (STATUS[...]?.label statt .schluessel), die Erfolgsmeldung zeigt den Rohstatus aus FastBill.
- **[prozesse]** Kalender.jsx:484 nutzt den fest deutschen st.label aus shared/projektstatus.js, waehrend Projekte.jsx:102 und Dashboard.jsx:524 denselben Status uebersetzen – Statustext bleibt im Kalender bei Sprachwechsel deutsch.
- **[prozesse]** Anfragen.jsx:353-384 enthaelt den kompletten Wunschtermin-/Terminanlage-Zweig samt Slot und Google-Event; das Webformular (website/src/pages/Anfrage.jsx:31-39) sendet nie datum/start – der Zweig laeuft nie. Die uebersetzten Hinweistexte (Anfragen.jsx:35) behaupten weiterhin, der Termin erscheine sofort im Kalender.
- **[prozesse]** BerichtForm.jsx:12-15 beschreibt das Formular als Regie-Feldprotokoll; tatsaechlich verlangt das Gate (:189) je 1 Vorher- und Nachher-Foto auch bei Reklamation und Abnahme.
- **[prozesse]** RechnungWizard.jsx:134-135 rechnet und speichert den Sicherheitseinbehalt, shared/fastbill.js:320-338 uebertraegt aber nur die Positionen – die FastBill-Rechnung enthaelt keinen Einbehalt.
- **[prozesse]** RechnungWizard.jsx:139-152: schon 'Als Entwurf speichern' setzt Berichte auf 'abgerechnet', Spesen auf 'erstattet' und erhoeht abgerechnetMenge; USt und Brutto werden dagegen gar nicht gespeichert.
- **[prozesse]** Import.jsx:142-147 – Kommentar verspricht 'Abrechnungs-Standards wie bei neuen Kunden', es werden aber nur typ und ustModus gesetzt (zahlungszielTage und sicherheitseinbehaltProzent fehlen, anders als in Anfragen.jsx:338-341).
- **[prozesse]** Import.jsx:191-192 liest z.pflicht, das Feld existiert in ZIELE (:70-79) nicht – die Pflichtmarkierung ist wirkungslos.
- **[prozesse]** LvImport.jsx:501-515 – 'vorhandene Positionen vorher loeschen' entfernt auch Positionen mit abgerechnetMenge > 0; es gibt nur einen Warntext, keine Sperre.
- **[prozesse]** Stunden.jsx:98-99 kommentiert 'je Person eine Zeile pro Kalendertag – auch fuer Tage ohne Einsatz'; die Bildschirmtabelle filtert Tage ohne Stunden aber heraus (:282), nur das PDF enthaelt alle Tage.
- **[prozesse]** firestore.rules:24-30 – solange zur Auth-UID kein users-Dokument existiert, gilt jeder Angemeldete als Buero (keinRollenmodell()); die im Code beschriebene Buero/Monteur-Trennung greift erst nach Pflege der UIDs.
- **[prozesse]** shared/mail.js:1-6 – der Mail-Dienst ist nicht hinterlegt (MAIL_DIENST.url leer), alle Bestaetigungs-/Absage-Mails der Anfragen enden im Status 'nicht-konfiguriert'.
- **[prozesse]** Der LV-'PDF-Import' ist kein Datei-Import: LvImport.jsx:346-365 nimmt nur eingefuegten Text entgegen, der von der Heuristik in admin/src/lvparser.js zerlegt wird.
- **[betrieb]** SKILL.md:33-34 und STAND.md:199-200 nennen die launch.json-Eintraege 'gabara-website'/'gabara-admin'; in .claude/launch.json heissen sie tatsaechlich 'website' und 'admin'.
- **[betrieb]** STAND.md widerspricht sich: Z. 11-17 meldet beide Apps online mit bereitgestellten Firestore-Regeln, Z. 44 sagt 'noch nie deployt' und Z. 48-60 fuehrt 'Firebase-Projekt anlegen' weiterhin als Blocker.
- **[betrieb]** README.md:45-52 beschreibt den Firebase-Go-Live als offenes V2-Vorhaben, obwohl shared/firebase-config.js enabled:true mit echten Projektwerten hat und .firebase/ Deploy-Caches beider Sites enthaelt.
- **[betrieb]** SKILL.md:117-139 (Go-Live-Checkliste) beschreibt bereits erledigte Schritte weiterhin als offen.
- **[betrieb]** .firebaserc ist uncommitted geaendert: Projekt/Sites hiessen im letzten Commit noch gabara-baustellen / gabara-baustellen-admin.
- **[betrieb]** firebase.json Admin-Block: das Catch-all-Muster '**' (Z. 40) ueberschneidet sich mit der drei Zeilen darueber gesetzten immutable-Regel fuer '/assets/**' (Z. 35-36).
- **[betrieb]** Es gibt kein Deploy-npm-Skript; der Deploy laeuft nur ueber den handgetippten npx firebase-tools-Aufruf, und firebase.json hat keine predeploy-Hooks (Build muss manuell vorher laufen).
- **[betrieb]** Wurzel-devDependency 'sharp' wird in keiner Projektdatei ausserhalb node_modules/package-lock.json referenziert.
- **[betrieb]** admin/.env.local enthaelt einen echten FastBill-API-Schluessel im Klartext (korrekt gitignored und nie committet).
- **[betrieb]** STAND.md:157-159 empfiehlt die Build-Reihenfolge admin-dann-website, das Wurzel-Skript baut website-dann-admin.
- **[betrieb]** vite preview hat in beiden Arbeitsbereichen keinen gesetzten Port (Vite-Standard 4173) - zwei Vorschauen gleichzeitig kollidieren.
- **[integrationen]** shared/fastbill.js:7 behauptet, die Proxy-URL liege in 'settings/integrationen.proxyUrl'. Der Code liest sie aus einer eigenen Top-Level-Sammlung 'integrationen', Dokument 'fastbill' (Z. 22) - so, wie es der Kommentar Z. 14-19 selbst begruendet. Kopfkommentar ist ein Rest des alten Aufbaus.
- **[integrationen]** docs/projekt-dokumentation.md:36 fuehrt 'integrationen' als Unterdokument von 'settings'. Falsch; Z. 96-98 derselben Datei beschreibt es dann korrekt als eigene Sammlung.
- **[integrationen]** Einstellungen.jsx:567 legt den FastBill-Zugang per s.update() an, was im Firebase-Modus auf updateDoc abbildet (store.js:335). updateDoc scheitert bei nicht existierendem Dokument. integrationen/fastbill wird nirgends angelegt (demoData.js:447 leer, resetDemo ueberspringt die Sammlung, store.js:440-443) - das erste Speichern auf einer frischen Datenbank schlaegt daher fehl.
- **[integrationen]** .claude/skills/gabara/STAND.md widerspricht sich: Z. 18-19 'FastBill ist seit 01.08.2026 echt angebunden - online ausschliesslich ueber die Apps-Script-Weiterleitung', Z. 56-58 fuehrt SECRET setzen + Web-App bereitstellen weiter als offenen Go-Live-Blocker. SECRET steht im Repo unveraendert auf dem Platzhalter (seed/gabara-fastbill-proxy.gs:34).
- **[integrationen]** STAND.md Z. 39 sagt 'Firestore-Regeln nach Rolle: geschrieben, noch nie deployt', Z. 15-16 derselben Datei sagt 'Regeln in firestore.rules sind bereitgestellt'.
- **[integrationen]** shared/googleCalendar.js:1 nennt Google Kalender das 'Hauptsystem fuer Termine im Produktivbetrieb'. Tatsaechlich ist GOOGLE_KALENDER.clientId in firebase-config.js:34 leer, die Anbindung also vollstaendig inaktiv.
- **[integrationen]** shared/googleCalendar.js exportiert eventVerschieben (Z. 103-112), das nirgends im Projekt aufgerufen wird - ein verschobener Termin bliebe im Google-Kalender auf der alten Zeit.
- **[integrationen]** shared/mail.js:2-4 dokumentiert selbst, dass das Gegenstueck-Apps-Script fehlt und nichts versendet wird - bestaetigt: MAIL_DIENST.url = '' (firebase-config.js:42), kein Mail-.gs in seed/.
- **[integrationen]** sendeKundenMail nutzt mode:'no-cors' (mail.js:21) und gibt 'true' zurueck, sobald fetch nicht wirft. Ein Fehlschlag beim Empfaenger bleibt unbemerkt - das Wort 'gesendet' in der Oberflaeche ist also nicht belegt.
- **[integrationen]** syncArtikel setzt fuer JEDEN Artikel fest VAT_PERCENT: 19 (fastbill.js:273), obwohl Rechnungspositionen bei ustModus '13b' mit 0 % laufen (Z. 321).
- **[querschnitt]** shared/i18n.js:1 nennt im Kopfkommentar "Webseite, Verwaltung und Monteur-App". Tatsaechlich wird das Woerterbuch shared/texte.js nur in admin/src/main.jsx:6 importiert; website/src/main.jsx importiert es nicht, und in website/src gibt es weder useLang noch setLang noch den SprachSchalter. Auf der oeffentlichen Seite laesst sich die Sprache also gar nicht umstellen, und tr() rendert dort nie neu.
- **[querschnitt]** shared/i18n.js:12-15 kennt nur noch de und ar, aber Englisch lebt an mehreren Stellen als toter Zweig weiter: ui.jsx:8 (SPRACHE_META.en) und ui.jsx:26-36 (komplette britische Flagge), i18n.js:87-94 (WOCHENTAGE mit en), i18n.js:99 (LOCALES.en) sowie admin/src/components/Fehlerschutz.jsx:4-13 (alle vier Texte dreisprachig de/en/ar).
- **[querschnitt]** shared/ui.jsx:79: der aktive Knopf des Sprachumschalters nutzt im dunklen Kopfbereich 'bg-white text-praxis-800'. Im Dunkelthema wird --color-praxis-800 laut admin/src/index.css:144 auf #f0dada aufgehellt ("nur als Textfarbe im Einsatz") - dadurch steht sehr helle Schrift auf weisser Pille. Alle uebrigen praxis-800-Verwendungen kombinieren die Farbe mit bg-praxis-100 oder bg-praxis-50 und sind davon nicht betroffen.
- **[querschnitt]** admin/src/components/WissenBild.jsx:10-12 behauptet, alle Ablaeufe liefen von oben nach unten "ohne Spiegelung". Tatsaechlich existiert der Spiegel-Helfer spiegel() (Zeile 47-56) und wird in fuenf der sieben Zeichnungen fuer die x-Koordinaten eingesetzt (Zeilen 104, 166, 197, 264/270, 300).
- **[querschnitt]** shared/wissen.js:15 listet als Absatzformen "[Absatz|Schritte|Merke|Tabelle]" bzw. im Detail nur p/schritte/merke/achtung. Eine Tabellen-Form gibt es weder in wissen.js noch in Hilfe.jsx; umgekehrt ist die tatsaechlich 11-mal verwendete Form { bild, unterschrift } im Kommentar nicht aufgefuehrt.
- **[querschnitt]** shared/texte.js enthaelt den Schluessel 'hilfe.trefferFaelle' ("{n} von {gesamt} Faellen passen"), aber admin/src/pages/Hilfe.jsx:172 benutzt in beiden Reitern 'hilfe.treffer'. Im Reiter "Anwendungsfaelle" steht deshalb "... von ... Artikeln passen".
- **[querschnitt]** shared/thema.js:49 kommentiert die Reihenfolge als "hell -> dunkel -> System -> hell". naechstesThema() (Zeile 50-53) rotiert aber ueber WERTE = ['system','hell','dunkel'], also system -> hell -> dunkel -> system.
- **[querschnitt]** Der localStorage-Schluessel der Sprache heisst noch 'praxis-sprache' (shared/i18n.js:17) - Erbe der Zahnarzt-Vorlage -, waehrend Thema ('gabara-thema') und Entwuerfe ('gabara-entwurf:') bereits auf Gabara umbenannt sind. Auch der Logo-Export heisst weiterhin ZahnLogo (shared/ui.jsx:96, dort ausdruecklich als Vorlagen-Regel kommentiert).
- **[querschnitt]** shared/unterschrift.jsx:178 setzt am Vollbild-Dialog fest dir="ltr"; ebenso admin/src/components/Fehlerschutz.jsx:54 am Detail-Block. Beide Bereiche bleiben in der arabischen Ansicht links-nach-rechts aufgebaut.
- **[querschnitt]** admin/src/drucken.js verwendet ausschliesslich deutsche Literale und feste Hex-Farben (#8b1a1a / #701414, Zeile 30-31) statt der CSS-Variablen; t()/tr() kommen dort nicht vor. Eine Farbaenderung im Design-Fundament wirkt sich auf die Ausdrucke nicht aus.
- **[querschnitt]** shared/entwurf.js:61 alleEntwuerfeLoeschen() wird nirgends in der Oberflaeche aufgerufen, sondern nur in shared/store.js:257 beim Zuruecksetzen der Demo-Daten.

### In der Erfassung selbst korrigiert

- Der Abschnitt "Arbeitsablaeufe" behauptet, LiveToast melde neue Anfragen. Der Code meldet ZWEI Ereignisse: neue Anfragen (admin/src/App.jsx:77-86) UND neu eingereichte Berichte mit Ziel /berichte (App.jsx:88-98). Die Berichts-Meldung fehlt vollstaendig.
- Der Abschnitt "Architektur" listet unter "Bekannte Grenzen", dass subscribeSlots/subscribePausen/subscribeOeffnungszeiten/ladeOeffnungszeiten keinen Aufrufer haben, und erweckt damit den Eindruck, Oeffnungszeiten und Pausen waeren ungenutzt. Tatsaechlich werden settings/oeffnungszeiten und settings/pausen ueber useCollection('settings') gelesen (admin/src/pages/Kalender.jsx:102-106) und steuern Zeitraster, Samstags-Anzeige, Telefon-/Urlaubsmarkierung; gepflegt werden sie im Reiter Arbeitszeiten (admin/src/pages/Einstellungen.jsx:458-535).
- Der Abschnitt "Betrieb" sagt, nur .firebaserc sei gegenueber dem letzten Commit geaendert. git status meldet rund 60 geaenderte Dateien und ausserdem komplett untracked: shared/texte.js, shared/thema.js, shared/wissen.js, shared/entwurf.js, admin/src/stil.js, admin/src/pages/Hilfe.jsx, admin/src/pages/Stunden.jsx, admin/src/components/{Fehlerschutz,Seite,EntwurfHinweis,WissenBild}.jsx, admin/public/demo/ sowie sieben Bilder unter website/public/bilder/. Der gesamte aktuelle Stand ist uncommittet.
- Der Abschnitt "Oberflaeche" schreibt, die Webseite nutze nur tr() mit Inline-Objekten aus shared/praxis.js. Die Bedien-, Pflicht- und Fehlertexte des Anfrageformulars sind feste deutsche Zeichenketten ohne tr() (website/src/pages/Anfrage.jsx:24-26, 69-80, 104-130); auch website/src/pages/Recht.jsx ist durchgehend fest deutsch.
- Der Abschnitt "Architektur" nennt speichereSetting (admin/src/hooks.js:54-59) mit zwei Parametern. Die Funktion hat drei: speichereSetting(id, daten, vorhanden); nur ueber 'vorhanden' entscheidet sie zwischen s.update und s.add.
- Der Abschnitt "Architektur" gibt fuer die requests-Regel eine feste Feldliste an, die die tatsaechliche hasOnly-Liste verkuerzt. firestore.rules:50 erlaubt 13 Felder einschliesslich status, createdAt, datum, start, dauer.
- Der Abschnitt "Oberflaeche" gibt Zeilenzahlen an, die um eins danebenliegen: shared/i18n.js hat 109 statt 110 Zeilen, shared/unterschrift.jsx 324 statt 321, shared/entwurf.js 120 statt 121, shared/googleCalendar.js 112 statt 113.

### Am 01.08.2026 daraus behoben

- `admin/src/pages/ProjektDetail.jsx` – der Status-Chip las `s.label`, die Tabelle liefert aber
  `schluessel`: der Chip war für **jeden** bekannten Berichtsstatus leer. Behoben.
- `admin/src/pages/Abrechnung.jsx` – dieselbe Verwechslung, die Erfolgsmeldung zeigte den
  Rohstatus aus FastBill. Behoben.
- `admin/src/pages/Einstellungen.jsx` – der FastBill-Zugang wurde per `update()` geschrieben.
  `updateDoc` scheitert bei nicht vorhandenem Dokument, also genau bei der Ersteinrichtung und
  nach „Alle Daten löschen". Zurück auf `add()` (Upsert). Behoben.
- `shared/store.js` – die **lokale** Variante von `resetDemo` löschte den FastBill-Zugang weiter,
  obwohl der Kommentar das Gegenteil behauptete. Behoben.

### Weiterhin offen

- `website/src/pages/Recht.jsx` – Registergericht und Registernummer fehlen im Impressum.
  Für eine GmbH sind sie Pflicht (§ 5 TMG).
- `shared/demoData.js` trägt echte Firebase-Auth-UIDs und eine private Gmail-Adresse im
  Quelltext. Vor einer Veröffentlichung des Quellcodes ersetzen.
- `admin/src/pages/Kalender.jsx` nutzt den fest deutschen `st.label` aus `shared/projektstatus.js`;
  der Statustext bleibt dort beim Sprachwechsel deutsch.
- Englisch lebt als toter Zweig weiter (`shared/ui.jsx`, `shared/i18n.js`), obwohl nur noch
  Deutsch und Arabisch gepflegt werden.
- Echte Bildschirmfotos für die Wissensdatenbank (vom Nutzer auf später verschoben).
- Der durchgehende Test über alle Stufen steht noch aus.
