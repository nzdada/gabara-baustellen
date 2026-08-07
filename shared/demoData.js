// Demo-Daten für den Lokal-Modus der Gabara-Baustellen-Plattform.
// Realistische Inhalte aus echten Unterlagen (Nachunternehmervertrag Bothmer 05/2026,
// Baustellen-LV S36 / Projekt 25011) – Preise/Namen sind Demo-Werte.
// Schema-Hinweis: appointments behalten die Feldnamen der Vorlage (datum/start/ende/
// behandlung/status/arzt/...) + neue Felder (projektId, kategorie, mitarbeiterIds, ...).

import { EINSTELLUNGEN_DEFAULTS } from './einstellungen.js'

const TEST_EMAIL = 'info@gabara-demo.de'

// ---------- Helfer ----------

// Lokales Datum – toISOString() rechnet nach UTC und liefert in Deutschland
// abends/nachts das falsche Tagesdatum (Demo-Termine lägen dann einen Tag daneben).
function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function heutePlus(tage) {
  const d = new Date()
  d.setDate(d.getDate() + tage)
  return iso(d)
}

// Echte Baustellenfotos liegen als Dateien in admin/public/demo/.
// ABSOLUTE URL, kein relativer Pfad: Die PDF-Ausgabe schreibt die Bilder in ein
// frisch geöffnetes Fenster ohne eigene Basis-Adresse – ein "/demo/x.jpg" würde
// dort ins Leere zeigen und der Ausdruck bliebe leer.
// BEWUSST relativ. Frueher stand hier location.origin – und dieser absolute
// Wert wurde beim Zuruecksetzen in die Datenbank geschrieben. Wer lokal
// zuruecksetzte, hatte online 15 tote Bildverweise auf http://localhost:5420
// (die eine https-Seite ohnehin nicht laden darf), und umgekehrt. Relativ
// funktioniert an beiden Orten; im Druckfenster loest es der <base>-Eintrag
// aus admin/src/drucken.js auf.
function demoFoto(n) {
  return `/demo/foto-${String(n).padStart(2, '0')}.jpg`
}

// Platzhalter-Foto als kleines SVG (Daten-URL) – hält die Demo-DB klein.
function svgFoto(text, farbe) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${farbe}"/><rect x="12" y="12" width="376" height="276" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="3"/><text x="200" y="160" font-family="Segoe UI, sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">${text}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Demo-Unterschrift (geschwungene Linie) als SVG-Daten-URL
const DEMO_UNTERSCHRIFT = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="150"><path d="M30 100 C 60 40, 90 130, 120 85 S 180 40, 210 90 S 270 130, 300 70 S 350 60, 370 95" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/></svg>'
)}`

// ---------- Demo-Datenbank ----------

// Firebase-Auth-UIDs der angelegten Konten (Projekt gabara-system)
const AHMAD = 'rO3IHM6Nazd1QestDRZQVa0Kgz43'
const SAMIR = 'MI3PQq0ezyUtQePyLiy9J82m7gN2'
const BUERO = 'adgI9BERvuMhvXAWVFx9nbXkqy33'

export function erzeugeDemoDaten() {
  const jetzt = Date.now()

  // --- Mitarbeiter / Logins (E-Mails passend zu DEMO_ZUGAENGE in auth.js) ---
  // team = Kolonne (Farbcodierung im Kalender), qualifikation = Regie-Stundensatz
  // Die IDs sind die echten Firebase-Auth-UIDs (Projekt gabara-system).
  // Das ist Absicht: Die Firestore-Regeln schlagen die Rolle unter
  // users/<Auth-UID> nach. Mit erfundenen IDs würde die Rollenprüfung ins Leere
  // laufen und JEDER Angemeldete bekäme Schreibrechte auf alles.
  // Wird die Datenbank für einen anderen Betrieb neu aufgesetzt, müssen hier
  // dessen UIDs stehen – und alle Verweise unten ziehen automatisch mit.
  const users = [
    { id: BUERO, email: 'nasirdada.98@gmail.com', name: 'Büro Gabara', rolle: 'admin', team: 'Büro', farbe: '#8B1A1A', qualifikation: 'facharbeiter', stundensatzIntern: 0, aktiv: true },
    { id: AHMAD, email: 'monteur@gabara-demo.de', name: 'Ahmad Monteur', rolle: 'mitarbeiter', team: 'Team 1', farbe: '#f97316', qualifikation: 'facharbeiter', stundensatzIntern: 28, aktiv: true },
    { id: SAMIR, email: 'samir@gabara-demo.de', name: 'Samir Monteur', rolle: 'mitarbeiter', team: 'Team 2', farbe: '#0ea5e9', qualifikation: 'helfer', stundensatzIntern: 25, aktiv: true },
  ]

  // --- Kunden (Spiegel; FastBill ist führend, fastbillCustomerId nach Sync) ---
  const patients = [
    {
      id: 'k-bothmer', firma: 'Bothmer Akustikbau GmbH',
      vorname: 'Maximilian', nachname: 'Rußbach', ansprechpartner: 'Maximilian Rußbach',
      telefon: '08151 9796476', email: 'bothmerakustikbau@t-online.de',
      strasse: 'Olympiastr. 1', plzOrt: '82319 Starnberg-Wangen',
      typ: 'gu', ustModus: '13b', zahlungszielTage: 16, sicherheitseinbehaltProzent: 10,
      notizen: 'Generalunternehmer. Abrechnung netto §13b, Aconto mit 10 % Sicherheitseinbehalt, VOB.',
      fastbillCustomerId: null, createdAt: jetzt - 60 * 86400000,
    },
    {
      id: 'k-huber', firma: '',
      vorname: 'Peter', nachname: 'Huber', ansprechpartner: 'Peter Huber',
      telefon: '0821 5551234', email: TEST_EMAIL,
      strasse: 'Bgm.-Aurnhammer-Str. 12', plzOrt: '86199 Augsburg',
      typ: 'privat', ustModus: 'ust19', zahlungszielTage: 14, sicherheitseinbehaltProzent: 0,
      notizen: 'Privatkunde, Empfehlung.',
      fastbillCustomerId: null, createdAt: jetzt - 10 * 86400000,
    },
  ]

  // --- Projekte / Baustellen ---
  const projekte = [
    {
      id: 'p-iga', nummer: 'P-2026-001', name: 'IGA Augsburg – Barmer Büroflächen EG + 1. OG',
      kundeId: 'k-bothmer', anschrift: { strasse: 'Eserwallstraße 1-3', plzOrt: '86150 Augsburg' },
      gewerk: 'Malerarbeiten', status: 'inArbeit',
      startDatum: heutePlus(-14), endeDatum: heutePlus(14), projektvolumen: 7896,
      farbe: '#f97316',
      beschreibung: 'Nachunternehmer-Vertrag Bothmer vom 12.05.2026. Ausführung nach VOB DIN 18363. 2 Arbeitsschritte: Grundierung + Erstanstrich, danach Zweitanstrich; Zargen schleifen und lackieren.',
      createdAt: jetzt - 30 * 86400000,
    },
    {
      id: 'p-s36', nummer: 'P-2026-002', name: 'S36 – Baustellen-LV Malerarbeiten (Projekt 25011)',
      kundeId: 'k-bothmer', anschrift: { strasse: 'Projekt S36', plzOrt: 'München' },
      gewerk: 'Malerarbeiten', status: 'beauftragt',
      startDatum: heutePlus(21), endeDatum: heutePlus(60), projektvolumen: 0,
      farbe: '#6366f1',
      beschreibung: 'Leer-LV vom 22.07.2026 (Unser Zeichen li/lö). GRUNDSÄTZLICH ALLE PREISE OHNE MATERIAL. Einheitspreise in Klärung.',
      createdAt: jetzt - 9 * 86400000,
    },
    {
      id: 'p-huber', nummer: 'P-2026-003', name: 'EFH Huber – Innenanstrich EG',
      kundeId: 'k-huber', anschrift: { strasse: 'Bgm.-Aurnhammer-Str. 12', plzOrt: '86199 Augsburg' },
      gewerk: 'Malerarbeiten', status: 'offen',
      startDatum: heutePlus(30), endeDatum: heutePlus(35), projektvolumen: 2400,
      farbe: '#10b981',
      beschreibung: 'Wohnzimmer, Flur und Küche streichen, ca. 180 m² Wand-/Deckenfläche. Angebot in Arbeit.',
      createdAt: jetzt - 5 * 86400000,
    },
  ]

  // --- LV-Positionen (ein Dokument je Position; Hierarchie über OZ) ---
  let sortNr = 0
  const pos = (projektId, oz, typ, kurztext, felder = {}) => ({
    id: `lv-${projektId}-${oz.replace(/\./g, '-')}`,
    projektId, oz, typ, kurztext,
    langtext: '', menge: 0, einheit: '', einheitspreis: 0,
    flags: {}, istMenge: 0, istVon: '', istAm: '', abgerechnetMenge: 0,
    sort: sortNr++,
    ...felder,
  })

  const lvpositionen = [
    // Projekt IGA (aus dem echten Nachunternehmervertrag)
    pos('p-iga', '1', 'titel', 'Untergrund vorbereiten, reinigen, grundieren'),
    pos('p-iga', '1.1', 'position', 'Wand- und Deckenflächen vorbereiten, reinigen, grundieren', {
      langtext: 'Wand- und Deckenflächen als Vorbereitung für die Malerarbeiten von Staub und losen Verschmutzungen durch Abstauben befreien, mit Haftgrundierung zum System passend einmalig grundieren.',
      menge: 1150, einheit: 'm²', einheitspreis: 1.65, istMenge: 820, istVon: 'Ahmad Monteur', istAm: heutePlus(-4), istQuelle: 'summe',
    }),
    pos('p-iga', '2', 'titel', 'Anstrich Wand- und Deckenflächen'),
    pos('p-iga', '2.1', 'position', '1. Wand- und Deckenbeschichtung mit Dispersionsfarbe', {
      langtext: 'Erstbeschichtung einschl. Laibungen, innen. Vorleistung: bauseits gespachtelte Flächen in Q2/Q3. Dispersionsfarbe fungizidfrei „Blauer Engel", Nassabrieb Klasse 3 nach DIN EN 13300 (Caparol, Brillux, STO, Keim o. glw.).',
      menge: 1150, einheit: 'm²', einheitspreis: 2.05, istMenge: 640, istVon: 'Samir Monteur', istAm: heutePlus(-2), istQuelle: 'summe',
    }),
    pos('p-iga', '2.2', 'position', '2. Wand- und Deckenbeschichtung (endfertig)', {
      langtext: 'Endfertige Beschichtung mit Dispersionsfarbe einschl. Laibungen, innen. Fungizidfrei „Blauer Engel", Nassabrieb Klasse 3 nach DIN EN 13300.',
      menge: 1150, einheit: 'm²', einheitspreis: 1.95,
    }),
    pos('p-iga', '2.3', 'position', 'Zulage farbige Wandbeschichtung nach Vorgabe', {
      langtext: 'Zulage zur Wandbeschichtung mit eingefärbter Dispersionsfarbe nach Vorgabe der Bauherrnvertretung.',
      menge: 150, einheit: 'm²', einheitspreis: 1.65,
    }),
    pos('p-iga', '3', 'titel', 'Lackierung Umfassungszargen'),
    pos('p-iga', '3.1', 'position', 'Renovierungslackierung Umfassungszarge, 1-flg.', {
      langtext: 'Anschleifen und Grundierung der Stahlzarge, oberflächenendfertige Lackierung auf wasserbasiertem Acryl-Lack. Stahlblech, Maulweite 125 mm. Farbe nach Vorgabe. Einbauort: EG + 1. OG.',
      menge: 10, einheit: 'Stck.', einheitspreis: 57.5, istMenge: 6, istVon: 'Ahmad Monteur', istAm: heutePlus(-3), istQuelle: 'summe',
    }),
    pos('p-iga', '3.2', 'position', 'Erstlackierung Umfassungszarge, 1-flg.', {
      langtext: 'Anschleifen der neu montierten, grundiert gelieferten Stahlzarge, oberflächenendfertige Lackierung auf wasserbasiertem Acryl-Lack.',
      menge: 8, einheit: 'Stck.', einheitspreis: 55,
    }),
    pos('p-iga', '4', 'titel', 'Dauerelastische Anschlüsse'),
    pos('p-iga', '4.1', 'position', 'Dauerelastische Anschlüsse mit Acryl', {
      langtext: 'Erstellen von dauerelastischen Anschlüssen mit Acryl an Wand-/Wandinnenecken und Wand-/Deckeninnenecken.',
      menge: 1, einheit: 'lfm', einheitspreis: 1.6, flags: { nep: true },
    }),
    pos('p-iga', '5', 'titel', 'Regiearbeiten auf Stundennachweis'),
    pos('p-iga', '5.1', 'position', 'Regiestunden Facharbeiter im Malerhandwerk', {
      langtext: 'Zusätzliche Kleinarbeiten, die das Angebot nicht berücksichtigt, auf Stundenbasis mit Nachweis.',
      menge: 3, einheit: 'Std.', einheitspreis: 35, flags: { bedarf: true },
    }),
    pos('p-iga', '5.2', 'position', 'Regiestunden Helfer / Auszubildender', {
      menge: 1, einheit: 'Std.', einheitspreis: 31, flags: { bedarf: true },
    }),

    // Projekt S36 (Auszug aus dem Leer-LV; Preise ohne Material, teils offen)
    pos('p-s36', '3.2.6.3', 'titel', 'Lackierarbeiten – Nasslackbeschichtung Zargen'),
    pos('p-s36', '3.2.6.3..2', 'position', 'Nasslackbeschichtung Umfassungszarge', {
      menge: 155.85, einheit: 'lfm', einheitspreis: 3.9,
      langtext: 'Preis ohne Material (Notiz im LV: „GRUNDSÄTZLICH ALLE PREISE OHNE MATERIAL – 3,90 €/lfm").',
    }),
    pos('p-s36', '3.2.6.3..3', 'position', 'Nasslackbeschichtung Blockzargen', {
      menge: 81.155, einheit: 'lfm', einheitspreis: 3.9,
    }),
    pos('p-s36', '4.2.3.7', 'titel', 'Beschichtung Wand- und Deckenflächen – Bürobereiche'),
    pos('p-s36', '4.2.3.7.1.1', 'position', 'Flächen vorbereiten und grundieren', {
      langtext: 'Tiefengrundierung liefern und auftragen, einschl. Reinigen des Untergrundes und Ausbesserungen (Q3). Richtfabrikat StoPrime Plex o. glw.',
      menge: 2582.421, einheit: 'm²', einheitspreis: 0,
    }),
    pos('p-s36', '4.2.3.7.1.2', 'position', 'Dispersionsanstrich Wände (Zwischen- + Schlussbeschichtung)', {
      langtext: 'Hochdeckende, stumpfmatte Beschichtung in zwei Arbeitsgängen, RAL 9010 matt, Nassabriebklasse 2, Deckvermögen Klasse 1 nach EN 13300. Richtfabrikat StoColor Rapid Ultramatt o. glw.',
      menge: 2582.421, einheit: 'm²', einheitspreis: 0,
    }),
    pos('p-s36', '4.2.3.7.1.4', 'position', 'Zulage für mittlere Tönung', {
      menge: 1, einheit: 'm²', einheitspreis: 0, flags: { bedarf: true },
    }),
  ]

  // --- Termine / Einsätze (Woche rund um heute) ---
  const termin = (id, projektId, tagOffset, start, ende, titel, kategorie, mitarbeiterIds, extras = {}) => {
    const projekt = projekte.find((p) => p.id === projektId)
    const kunde = patients.find((k) => k.id === projekt?.kundeId)
    return {
      id, projektId, titel, kategorie, mitarbeiterIds,
      datum: heutePlus(tagOffset), start, ende,
      beschreibung: '', positionsIds: [], erledigt: false, erledigtAm: '',
      // Vorlagen-Felder (alte Seiten lesen sie noch):
      behandlung: titel, status: 'bestaetigt', arzt: '',
      patientId: kunde?.id || '', patientName: kunde ? (kunde.firma || `${kunde.vorname} ${kunde.nachname}`) : '',
      erinnerung: 'offen', summary: { text: '', checks: [], updatedAt: 0, updatedBy: '' },
      befunde: [], leistungen: [], rechnung: 'offen',
      ...extras,
    }
  }

  const appointments = [
    // --- laufende und kommende Woche ---
    termin('t-1', 'p-iga', 0, '07:00', '17:00', 'Umsetzung – 1. OG Flure + Büros streichen', 'umsetzung', [AHMAD, SAMIR], {
      beschreibung: 'Zweitanstrich Flure 1. OG. Material ist vor Ort. Regiebericht schreiben, falls Zusatzarbeiten.',
    }),
    termin('t-2', 'p-iga', 1, '07:00', '15:00', 'Fertigstellung – Zargen EG lackieren', 'fertigstellung', [AHMAD], {
      beschreibung: 'Restliche 4 Zargen Renovierungslackierung, danach Sichtkontrolle mit Bauleitung.',
    }),
    termin('t-3', 'p-huber', 2, '09:00', '10:00', 'Vor-Ort-Termin – Aufmaß EFH Huber', 'umsetzung', [AHMAD], {
      beschreibung: 'Aufmaß und Farbberatung mit Familie Huber.',
    }),
    termin('t-4', 'p-s36', 3, '07:00', '16:00', 'Umsetzung – Treppenhaus grundieren', 'umsetzung', [SAMIR], {
      beschreibung: 'Treppenhaus Haus 2 grundieren, Vorarbeiten für Erstanstrich.',
    }),
    // --- abgeschlossene Einsätze des Vormonats (Grundlage der Stundenzettel) ---
    termin('t-10', 'p-iga', -30, '07:00', '16:00', 'Umsetzung – EG Grundierung + Erstanstrich', 'umsetzung', [AHMAD, SAMIR], { erledigt: true, erledigtAm: heutePlus(-30), status: 'abgeschlossen' }),
    termin('t-11', 'p-iga', -25, '07:00', '17:00', 'Umsetzung – EG Zweitanstrich', 'umsetzung', [AHMAD], { erledigt: true, erledigtAm: heutePlus(-25), status: 'abgeschlossen' }),
    termin('t-12', 'p-s36', -23, '07:00', '16:00', 'Umsetzung – Vorsatzschalen spachteln Q3', 'umsetzung', [AHMAD, SAMIR], { erledigt: true, erledigtAm: heutePlus(-23), status: 'abgeschlossen' }),
    termin('t-13', 'p-iga', -18, '07:00', '16:00', 'Umsetzung – Laibungen 1. OG', 'umsetzung', [SAMIR], { erledigt: true, erledigtAm: heutePlus(-18), status: 'abgeschlossen' }),
    termin('t-14', 'p-huber', -15, '08:00', '16:30', 'Umsetzung – Innenanstrich Wohnzimmer', 'umsetzung', [AHMAD], { erledigt: true, erledigtAm: heutePlus(-15), status: 'abgeschlossen' }),
    termin('t-15', 'p-s36', -10, '07:00', '17:00', 'Umsetzung – Erstanstrich Treppenhaus', 'umsetzung', [AHMAD, SAMIR], { erledigt: true, erledigtAm: heutePlus(-10), status: 'abgeschlossen' }),
    termin('t-16', 'p-iga', -4, '07:00', '15:30', 'Fertigstellung – Zargen 1. OG lackieren', 'fertigstellung', [AHMAD], { erledigt: true, erledigtAm: heutePlus(-4), status: 'abgeschlossen' }),
    termin('t-17', 'p-huber', -2, '08:00', '14:00', 'Fertigstellung – Deckenanstrich', 'fertigstellung', [SAMIR], { erledigt: true, erledigtAm: heutePlus(-2), status: 'abgeschlossen' }),
  ]

  // --- Berichte (Regie / Reklamation / Abnahme) ---
  //
  // Bewusst über den VORMONAT verteilt: nur so haben die Monats-Stundenzettel
  // etwas zu zeigen. Die meisten sind freigegeben – in der Stundenliste zählen
  // voreingestellt nur geprüfte Berichte.
  const regie = (nr, projektId, terminId, tage, wer, beschreibung, stunden, material = [], status = 'freigegeben') => ({
    id: `b-${nr}`, typ: 'regie', nummer: `RB-2026-${String(nr).padStart(3, '0')}`,
    projektId, terminId,
    mitarbeiterId: wer, mitarbeiterName: wer === AHMAD ? 'Ahmad Monteur' : 'Samir Monteur',
    datum: heutePlus(tage), status, beschreibung,
    // Anordnung VOR Beginn (VOB/B § 15 Abs. 3) – ohne das ist der Nachweis wertlos
    angeordnetDurch: 'M. Rußbach, Bauleitung', angeordnetAm: heutePlus(tage), anzeigeArt: 'muendlich',
    stunden, material,
    unterschriftKunde: DEMO_UNTERSCHRIFT, unterschriftName: 'M. Rußbach',
    unterschriftFunktion: 'Bauleitung', unterschriftFirma: 'Bothmer Akustikbau GmbH',
    createdAt: jetzt + tage * 86400000,
    eingereichtAm: jetzt + tage * 86400000,
    eingereichtVon: wer === AHMAD ? 'Ahmad Monteur' : 'Samir Monteur',
    ...(status === 'freigegeben' ? { freigegebenAm: jetzt + (tage + 1) * 86400000, freigegebenVon: 'Büro Gabara' } : {}),
  })

  // Stundenzeile: 60 Minuten Pause sind in Von/Bis enthalten, aber nicht in anzahl
  const std = (wer, tage, von, bis, anzahl) => ({
    userId: wer, name: wer === AHMAD ? 'Ahmad Monteur' : 'Samir Monteur',
    datum: heutePlus(tage), art: wer === AHMAD ? 'facharbeiter' : 'helfer',
    von, bis, anzahl, satz: wer === AHMAD ? 35 : 31,
  })

  const berichte = [
    regie(1, 'p-iga', 't-10', -30, AHMAD, 'Zusätzliche Spachtelarbeiten an Trockenbauwand Flur EG nach Elektro-Schlitzen. Nicht im LV enthalten.',
      [std(AHMAD, -30, '07:00', '16:00', 8), std(SAMIR, -30, '07:00', '16:00', 8)],
      [{ artikelId: 'a-005', name: 'Feinspachtel 25 kg', menge: 2, einheit: 'Sack', preis: 18.5 },
       { artikelId: 'a-008', name: 'Malerkrepp 50 m', menge: 3, einheit: 'Rolle', preis: 4.5 }]),

    regie(2, 'p-iga', 't-11', -25, AHMAD, 'Zweitanstrich EG. Zusätzlich Ausbesserung nach Beschädigung durch Folgegewerk.',
      [std(AHMAD, -25, '07:00', '17:00', 9)],
      [{ artikelId: 'a-001', name: 'Dispersionsfarbe weiß matt, 12,5 l', menge: 2, einheit: 'Eimer', preis: 42.9 }]),

    regie(3, 'p-s36', 't-12', -23, AHMAD, 'Vorsatzschalen Q3 gespachtelt, Armierungsstreifen eingelegt. Mehraufwand durch unebenen Untergrund.',
      [std(AHMAD, -23, '07:00', '16:00', 8), std(SAMIR, -23, '07:00', '16:00', 8)],
      [{ artikelId: 'a-005', name: 'Feinspachtel 25 kg', menge: 4, einheit: 'Sack', preis: 18.5 }]),

    regie(4, 'p-iga', 't-13', -18, SAMIR, 'Laibungen 1. OG nachgearbeitet – im LV nicht gesondert ausgewiesen.',
      [std(SAMIR, -18, '07:00', '16:00', 8)],
      [{ artikelId: 'a-011', name: 'Schleifpapier K120', menge: 12, einheit: 'Bogen', preis: 0.8 }]),

    regie(5, 'p-huber', 't-14', -15, AHMAD, 'Innenanstrich Wohnzimmer. Zusätzlich Risse im Altputz verspachtelt.',
      [std(AHMAD, -15, '08:00', '16:30', 7.5)],
      [{ artikelId: 'a-003', name: 'Tiefengrund LF, 10 l', menge: 1, einheit: 'Kanister', preis: 24.9 }]),

    regie(6, 'p-s36', 't-15', -10, AHMAD, 'Erstanstrich Treppenhaus. Gerüststellung durch AG verzögert, Wartezeit dokumentiert.',
      [std(AHMAD, -10, '07:00', '17:00', 9), std(SAMIR, -10, '07:00', '17:00', 9)],
      [{ artikelId: 'a-002', name: 'Latexfarbe weiß, scheuerbeständig, 12,5 l', menge: 3, einheit: 'Eimer', preis: 54.9 }]),

    regie(7, 'p-iga', 't-16', -4, AHMAD, 'Renovierungslackierung Zargen 1. OG, zusätzlich 3 Türblätter nachlackiert.',
      [std(AHMAD, -4, '07:00', '15:30', 7.5)],
      [{ artikelId: 'a-004', name: 'Acryl-Lack weiß seidenmatt, 2,5 l', menge: 2, einheit: 'Dose', preis: 39.9 }]),

    // Noch nicht freigegeben – zeigt den Unterschied in der Stundenliste
    regie(8, 'p-huber', 't-17', -2, SAMIR, 'Deckenanstrich Wohnzimmer und Flur, zweiter Auftrag.',
      [std(SAMIR, -2, '08:00', '14:00', 5.5)],
      [{ artikelId: 'a-001', name: 'Dispersionsfarbe weiß matt, 12,5 l', menge: 1, einheit: 'Eimer', preis: 42.9 }],
      'eingereicht'),

    {
      id: 'b-9', typ: 'reklamation', nummer: 'RK-2026-001', projektId: 'p-iga', terminId: '',
      mitarbeiterId: SAMIR, mitarbeiterName: 'Samir Monteur',
      datum: heutePlus(-1), status: 'entwurf',
      beschreibung: 'Farbabplatzer im Treppenhaus EG, ca. 0,5 m².',
      ursache: 'Untergrund war an dieser Stelle sandend, Grundierung durch Folgegewerk beschädigt.',
      massnahme: 'Stelle anschleifen, neu grundieren und beischichten.',
      geruegtDurch: 'Bothmer Akustikbau (Bauleitung)', ruegeZugangAm: heutePlus(-1), fristBis: heutePlus(6),
      createdAt: jetzt - 86400000, eingereichtAm: 0,
    },
    {
      id: 'b-10', typ: 'abnahme', nummer: 'AB-2026-001', projektId: 'p-huber', terminId: '',
      mitarbeiterId: AHMAD, mitarbeiterName: 'Ahmad Monteur',
      datum: heutePlus(-2), status: 'freigegeben',
      abnahmeArt: 'gesamt', ort: '86199 Augsburg',
      leistungsumfang: 'Innenanstrich Wohnzimmer, Flur und Decken gemäß Angebot.',
      beschreibung: 'Gemeinsame Begehung mit Herrn Huber. Alle Flächen abgenommen.',
      ohneMaengel: false,
      maengel: [{ text: 'Übergang Decke/Wand im Flur nachziehen', frist: heutePlus(12) }],
      vorbehaltVertragsstrafe: false, vorbehalteSonstige: '',
      unterschriftKunde: DEMO_UNTERSCHRIFT, unterschriftName: 'Peter Huber',
      unterschriftFunktion: 'Auftraggeber', unterschriftFirma: '',
      unterschriftMonteur: DEMO_UNTERSCHRIFT,
      createdAt: jetzt - 2 * 86400000, eingereichtAm: jetzt - 2 * 86400000, eingereichtVon: 'Ahmad Monteur',
      freigegebenAm: jetzt - 86400000, freigegebenVon: 'Büro Gabara',
    },
  ]

  // --- Fotos: echte Baustellenbilder, je Bericht ein Paar vorher/nachher ---
  const foto = (n, berichtId, projektId, phase, name, tage, wer) => ({
    id: `ph-${n}`, projektId, berichtId, terminId: '',
    phase, dataUrl: demoFoto(n), name,
    von: wer === AHMAD ? 'Ahmad Monteur' : 'Samir Monteur', vonId: wer,
    createdAt: jetzt + tage * 86400000,
  })

  const photos = [
    foto(1, 'b-1', 'p-iga', 'vorher', 'vorher-flur-eg.jpg', -30, AHMAD),
    foto(2, 'b-1', 'p-iga', 'nachher', 'nachher-flur-eg.jpg', -30, AHMAD),
    foto(3, 'b-2', 'p-iga', 'vorher', 'vorher-eg-zweitanstrich.jpg', -25, AHMAD),
    foto(4, 'b-2', 'p-iga', 'nachher', 'nachher-eg-zweitanstrich.jpg', -25, AHMAD),
    foto(5, 'b-3', 'p-s36', 'vorher', 'vorher-vorsatzschale.jpg', -23, AHMAD),
    foto(6, 'b-3', 'p-s36', 'nachher', 'nachher-vorsatzschale-q3.jpg', -23, AHMAD),
    foto(7, 'b-4', 'p-iga', 'vorher', 'vorher-laibungen.jpg', -18, SAMIR),
    foto(8, 'b-4', 'p-iga', 'nachher', 'nachher-laibungen.jpg', -18, SAMIR),
    foto(9, 'b-5', 'p-huber', 'vorher', 'vorher-wohnzimmer.jpg', -15, AHMAD),
    foto(10, 'b-5', 'p-huber', 'nachher', 'nachher-wohnzimmer.jpg', -15, AHMAD),
    foto(11, 'b-6', 'p-s36', 'vorher', 'vorher-treppenhaus.jpg', -10, AHMAD),
    foto(12, 'b-6', 'p-s36', 'nachher', 'nachher-treppenhaus.jpg', -10, AHMAD),
    foto(13, 'b-7', 'p-iga', 'vorher', 'vorher-zargen-og.jpg', -4, AHMAD),
    foto(14, 'b-7', 'p-iga', 'nachher', 'nachher-zargen-og.jpg', -4, AHMAD),
    foto(15, 'b-9', 'p-iga', 'vorher', 'reklamation-treppenhaus.jpg', -1, SAMIR),
  ]

  // --- Spesen ---
  const fahrt = (n, projektId, wer, tage, km, status) => ({
    id: `s-${n}`, projektId, mitarbeiterId: wer,
    mitarbeiterName: wer === AHMAD ? 'Ahmad Monteur' : 'Samir Monteur',
    typ: 'fahrt', datum: heutePlus(tage), betrag: Math.round(km * 0.5 * 100) / 100,
    belegFotoId: '', kommentar: '',
    fahrt: { von: 'Münchener Str. 21, 86551 Aichach', bis: projektId === 'p-iga' ? 'Eserwallstraße 1-3, 86150 Augsburg' : 'München', km, kmSatz: 0.5, automatisch: true },
    status, createdAt: jetzt + tage * 86400000,
  })

  const spesen = [
    fahrt(1, 'p-iga', AHMAD, -30, 27, 'erstattet'),
    fahrt(2, 'p-iga', SAMIR, -23, 27, 'erstattet'),
    fahrt(3, 'p-s36', AHMAD, -10, 84, 'eingereicht'),
    fahrt(4, 'p-huber', AHMAD, -15, 18, 'eingereicht'),
    {
      id: 's-5', projektId: 'p-s36', mitarbeiterId: AHMAD, mitarbeiterName: 'Ahmad Monteur',
      typ: 'hotel', datum: heutePlus(-10), betrag: 89, belegFotoId: '',
      kommentar: 'Übernachtung Montagewoche München',
      fahrt: null, status: 'eingereicht', createdAt: jetzt - 10 * 86400000,
    },
  ]

  // --- Artikel / Dienstleistungen (Spiegel; FastBill führend) ---
  const art = (id, code, name, einheit, preis, ekPreis, kategorie) =>
    ({ id, code, name, einheit, preis, ekPreis, kategorie, lieferant: '', fastbillArticleId: null })

  const katalog = [
    art('a-001', 'A-001', 'Dispersionsfarbe weiß matt, 12,5 l', 'Eimer', 42.9, 29.9, 'Farben'),
    art('a-002', 'A-002', 'Latexfarbe weiß, scheuerbeständig, 12,5 l', 'Eimer', 54.9, 39.9, 'Farben'),
    art('a-003', 'A-003', 'Tiefengrund LF, 10 l', 'Kanister', 24.9, 16.5, 'Grundierung'),
    art('a-004', 'A-004', 'Acryl-Lack weiß seidenmatt, 2,5 l', 'Dose', 39.9, 27.5, 'Lacke'),
    art('a-005', 'A-005', 'Feinspachtel 25 kg', 'Sack', 18.5, 12.9, 'Spachtel'),
    art('a-006', 'A-006', 'Reparaturmörtel R2 25 kg', 'Sack', 32.0, 23.5, 'Spachtel'),
    art('a-007', 'A-007', 'Acryl-Dichtstoff 310 ml', 'Kartusche', 3.2, 1.9, 'Dichtstoffe'),
    art('a-008', 'A-008', 'Malerkrepp 50 m', 'Rolle', 4.5, 2.6, 'Abdeckung'),
    art('a-009', 'A-009', 'Abdeckvlies 1 × 25 m', 'Rolle', 24.0, 16.0, 'Abdeckung'),
    art('a-010', 'A-010', 'Abdeckfolie 4 × 5 m', 'Stück', 2.9, 1.4, 'Abdeckung'),
    art('a-011', 'A-011', 'Schleifpapier K120', 'Bogen', 0.8, 0.4, 'Werkzeug'),
    art('a-012', 'A-012', 'Farbrolle 25 cm inkl. Bügel', 'Stück', 6.9, 4.2, 'Werkzeug'),
    art('a-013', 'A-013', 'Flachpinsel 50 mm', 'Stück', 4.9, 2.8, 'Werkzeug'),
    art('d-001', 'D-001', 'Facharbeiterstunde Malerhandwerk', 'Std.', 35.0, 0, 'Dienstleistung'),
    art('d-002', 'D-002', 'Helferstunde', 'Std.', 31.0, 0, 'Dienstleistung'),
    art('d-003', 'D-003', 'An-/Abfahrt (pauschal)', 'Pauschale', 25.0, 0, 'Dienstleistung'),
  ]

  // --- Textbausteine ---
  const bausteine = [
    { id: 'bs-13b', titel: '§13b-Hinweis', text: 'Der Rechnungsbetrag versteht sich netto. Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.' },
    { id: 'bs-vob', titel: 'VOB-Hinweis', text: 'Die Arbeiten wurden gemäß VOB DIN 18363 (Maler- und Lackierarbeiten) ausgeführt.' },
    { id: 'bs-zahlung', titel: 'Zahlungsziel', text: 'Zahlbar innerhalb von 16 Tagen nach Erhalt der Rechnung rein netto.' },
    { id: 'bs-einbehalt', titel: 'Sicherheitseinbehalt', text: 'Aconto-Rechnung mit 10 % Sicherheitseinbehalt gemäß Nachunternehmervertrag.' },
  ]

  // --- Webseiten-Anfragen ---
  const requests = [
    {
      id: 'r-1', name: 'Familie Kaiser', telefon: '0821 555123', email: TEST_EMAIL,
      anliegen: 'Innenanstrich', nachricht: '3-Zimmer-Wohnung in Augsburg-Göggingen streichen, ca. 85 m² Wohnfläche. Gerne Termin für Besichtigung.',
      datum: heutePlus(7), start: '09:00', dauer: 60,
      status: 'neu', sprache: 'de', createdAt: jetzt - 2 * 3600000,
    },
  ]

  // --- Einstellungen ---
  const settings = [
    { ...EINSTELLUNGEN_DEFAULTS },
    { id: 'pausen', eintraege: [] },
    {
      id: 'oeffnungszeiten',
      fenster: { 1: [{ von: '07:00', bis: '17:00' }], 2: [{ von: '07:00', bis: '17:00' }], 3: [{ von: '07:00', bis: '17:00' }], 4: [{ von: '07:00', bis: '17:00' }], 5: [{ von: '07:00', bis: '17:00' }] },
      telefon: [], urlaub: [],
    },
    { id: 'nummernkreis', rechnung: { jahr: new Date().getFullYear(), laufend: 0 }, bericht: { jahr: new Date().getFullYear(), laufend: 2 } },
  ]

  // --- Leistungsmeldungen (Tagesprotokoll) ---
  // Die Summen MUESSEN exakt den istMengen der Positionen entsprechen:
  // 1.1 = 820, 2.1 = 640, 3.1 = 6. Weicht hier etwas ab, wandern in der Demo
  // sofort Fortschrittsbalken UND die vorbelegten Rechnungsmengen.
  let meldungNr = 0
  const meldung = (positionId, oz, einheit, menge, tage, wer, raumName = '') => ({
    id: `lm-${++meldungNr}`,
    projektId: 'p-iga', positionId, oz, einheit,
    raumId: '', raumName,
    menge, datum: heutePlus(tage),
    mitarbeiterId: wer,
    mitarbeiterName: wer === AHMAD ? 'Ahmad Monteur' : 'Samir Monteur',
    terminId: '', notiz: '',
    storniert: false, storniertAm: 0, storniertVon: '',
    quelle: 'monteur', erfasstAm: jetzt + tage * 86400000,
  })
  const leistungen = [
    // 1.1 Untergrund vorbereiten: 320 + 260 + 240 = 820
    meldung('lv-p-iga-1-1', '1.1', 'm²', 320, -6, AHMAD, 'Treppenhaus'),
    meldung('lv-p-iga-1-1', '1.1', 'm²', 260, -5, AHMAD, 'Flur EG'),
    meldung('lv-p-iga-1-1', '1.1', 'm²', 240, -4, AHMAD, 'Flur 1. OG'),
    // 2.1 Erstbeschichtung: 300 + 340 = 640
    meldung('lv-p-iga-2-1', '2.1', 'm²', 300, -3, SAMIR, 'Treppenhaus'),
    meldung('lv-p-iga-2-1', '2.1', 'm²', 340, -2, SAMIR, 'Flur EG'),
    // 3.1 Zargen: 4 + 2 = 6
    meldung('lv-p-iga-3-1', '3.1', 'Stck.', 4, -4, AHMAD, 'Flur 1. OG'),
    meldung('lv-p-iga-3-1', '3.1', 'Stck.', 2, -3, AHMAD, 'Büro 1.01'),
  ]

  return {
    users, patients, projekte, lvpositionen, appointments, berichte, photos, spesen, leistungen,
    katalog, bausteine, requests, settings,
    rechnungen: [], apilog: [],
    // BEWUSST leer: hier liegt der FastBill-Zugang. Ein Beispieldatensatz mit
    // leeren Feldern hat ihn beim Zuruecksetzen ueberschrieben. resetDemo laesst
    // die Sammlung 'integrationen' inzwischen komplett unangetastet.
    integrationen: [],
    // Raeume und ihre Sollmengen bleiben leer: sie entstehen aus dem Bauplan
    // oder von Hand. Ohne diese Schluessel wuerde resetDemo an der fehlenden
    // Sammlung scheitern.
    raeume: [],
    raumsoll: [],
    // --- V2-Sammlungen (Plan vom 07.08.2026). Vorerst leer registriert,
    // damit resetDemo und der lokale Modus sie kennen. Echte Beispieldaten
    // kommen mit den jeweiligen Arbeitspaketen (AP 4 ff.) – eine fehlende
    // Sammlung hier scheitert STILL (Fuenf-Eintragungen-Regel).
    aufgaben: [],
    einsaetze: [],
    buchungen: [],
    // Startvorlage Maler: die sieben Schritte, zweisprachig. bezug steuert,
    // welche Flaeche des Raums die Menge liefert (shared/aufmass.js).
    arbeitsschritte: [
      { id: 'as-abkleben', nameDe: 'Abkleben und abdecken', nameAr: 'لصق الشريط والتغطية', kuerzel: 'AB', sort: 1, bezug: 'stueck', aktiv: true },
      { id: 'as-spachteln', nameDe: 'Spachteln Q2', nameAr: 'المعجون Q2', kuerzel: 'SP', sort: 2, bezug: 'wanddecke', aktiv: true },
      { id: 'as-schleifen', nameDe: 'Schleifen', nameAr: 'الصنفرة', kuerzel: 'SCH', sort: 3, bezug: 'wanddecke', aktiv: true },
      { id: 'as-grundieren', nameDe: 'Grundieren', nameAr: 'التأسيس', kuerzel: 'GR', sort: 4, bezug: 'wanddecke', aktiv: true },
      { id: 'as-anstrich1', nameDe: '1. Anstrich', nameAr: 'الطلاء الأول', kuerzel: 'A1', sort: 5, bezug: 'wanddecke', aktiv: true },
      { id: 'as-anstrich2', nameDe: '2. Anstrich', nameAr: 'الطلاء الثاني', kuerzel: 'A2', sort: 6, bezug: 'wanddecke', aktiv: true },
      { id: 'as-endreinigung', nameDe: 'Endreinigung', nameAr: 'التنظيف النهائي', kuerzel: 'ER', sort: 7, bezug: 'stueck', aktiv: true },
    ],
    aufmasszeilen: [],
    regieanordnungen: [],
    fotos: [],
    stunden: [],
    einbehalte: [],
    abwesenheiten: [],
    geraete: [],
    pruefspur: [],
    tagesstand: [],
    rechnungslaeufe: [],
  }
}
