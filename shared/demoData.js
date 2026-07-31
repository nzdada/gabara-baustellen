// Demo-Daten für den Lokal-Modus der Gabara-Baustellen-Plattform.
// Realistische Inhalte aus echten Unterlagen (Nachunternehmervertrag Bothmer 05/2026,
// Baustellen-LV S36 / Projekt 25011) – Preise/Namen sind Demo-Werte.
// Schema-Hinweis: appointments behalten die Feldnamen der Vorlage (datum/start/ende/
// behandlung/status/arzt/...) + neue Felder (projektId, kategorie, mitarbeiterIds, ...).

import { EINSTELLUNGEN_DEFAULTS } from './einstellungen.js'

const TEST_EMAIL = 'info@gabara-demo.de'

// ---------- Helfer ----------

function iso(d) {
  return d.toISOString().slice(0, 10)
}

function heutePlus(tage) {
  const d = new Date()
  d.setDate(d.getDate() + tage)
  return iso(d)
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

export function erzeugeDemoDaten() {
  const jetzt = Date.now()

  // --- Mitarbeiter / Logins (E-Mails passend zu DEMO_ZUGAENGE in auth.js) ---
  const users = [
    { id: 'u-buero', email: 'buero@gabara-demo.de', name: 'Büro Gabara', rolle: 'admin', farbe: '#8B1A1A', stundensatzIntern: 0, aktiv: true },
    { id: 'u-ahmad', email: 'monteur@gabara-demo.de', name: 'Ahmad Monteur', rolle: 'mitarbeiter', farbe: '#f97316', stundensatzIntern: 28, aktiv: true },
    { id: 'u-samir', email: 'samir@gabara-demo.de', name: 'Samir Monteur', rolle: 'mitarbeiter', farbe: '#0ea5e9', stundensatzIntern: 25, aktiv: true },
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
      gewerk: 'Malerarbeiten', status: 'inUmsetzung',
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
      gewerk: 'Malerarbeiten', status: 'angebot',
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
      menge: 1150, einheit: 'm²', einheitspreis: 1.65, istMenge: 820, istVon: 'Ahmad Monteur', istAm: heutePlus(-4),
    }),
    pos('p-iga', '2', 'titel', 'Anstrich Wand- und Deckenflächen'),
    pos('p-iga', '2.1', 'position', '1. Wand- und Deckenbeschichtung mit Dispersionsfarbe', {
      langtext: 'Erstbeschichtung einschl. Laibungen, innen. Vorleistung: bauseits gespachtelte Flächen in Q2/Q3. Dispersionsfarbe fungizidfrei „Blauer Engel", Nassabrieb Klasse 3 nach DIN EN 13300 (Caparol, Brillux, STO, Keim o. glw.).',
      menge: 1150, einheit: 'm²', einheitspreis: 2.05, istMenge: 640, istVon: 'Samir Monteur', istAm: heutePlus(-2),
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
      menge: 10, einheit: 'Stck.', einheitspreis: 57.5, istMenge: 6, istVon: 'Ahmad Monteur', istAm: heutePlus(-3),
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
    termin('t-1', 'p-iga', 0, '07:00', '17:00', 'Umsetzung – 1. OG Flure + Büros streichen', 'umsetzung', ['u-ahmad', 'u-samir'], {
      beschreibung: 'Zweitanstrich Flure 1. OG. Material ist vor Ort. Regiebericht schreiben, falls Zusatzarbeiten.',
    }),
    termin('t-2', 'p-iga', 1, '07:00', '15:00', 'Fertigstellung – Zargen EG lackieren', 'fertigstellung', ['u-ahmad'], {
      beschreibung: 'Restliche 4 Zargen Renovierungslackierung, danach Sichtkontrolle mit Bauleitung.',
    }),
    termin('t-3', 'p-huber', 2, '09:00', '10:00', 'Vor-Ort-Termin – Aufmaß EFH Huber', 'umsetzung', ['u-ahmad'], {
      beschreibung: 'Aufmaß und Farbberatung mit Familie Huber.',
    }),
    termin('t-4', 'p-iga', -3, '07:00', '17:00', 'Umsetzung – EG Grundierung + Erstanstrich', 'umsetzung', ['u-ahmad', 'u-samir'], {
      erledigt: true, erledigtAm: heutePlus(-3), status: 'abgeschlossen',
    }),
  ]

  // --- Berichte (Regie / Reklamation / Abnahme) ---
  const berichte = [
    {
      id: 'b-1', typ: 'regie', nummer: 'RB-2026-001', projektId: 'p-iga', terminId: 't-4',
      mitarbeiterId: 'u-ahmad', mitarbeiterName: 'Ahmad Monteur',
      datum: heutePlus(-3), status: 'eingereicht',
      beschreibung: 'Zusätzliche Spachtelarbeiten an Trockenbauwand Flur EG nach Elektro-Schlitzen. Nicht im LV enthalten.',
      // Anordnung VOR Beginn (VOB/B § 15 Abs. 3)
      angeordnetDurch: 'M. Rußbach, Bauleitung', angeordnetAm: heutePlus(-3), anzeigeArt: 'muendlich',
      // Stundenlohnzettel: je Person mit Datum und Von/Bis (wie mam_solar-Protokoll)
      stunden: [
        { name: 'Ahmad Monteur', datum: heutePlus(-3), art: 'facharbeiter', von: '13:00', bis: '16:00', anzahl: 3, satz: 35 },
        { name: 'Samir Monteur', datum: heutePlus(-3), art: 'helfer', von: '15:00', bis: '16:00', anzahl: 1, satz: 31 },
      ],
      material: [
        { artikelId: 'a-005', name: 'Feinspachtel 25 kg', menge: 2, einheit: 'Sack', preis: 18.5 },
        { artikelId: 'a-008', name: 'Malerkrepp 50 m', menge: 3, einheit: 'Rolle', preis: 4.5 },
      ],
      unterschriftKunde: DEMO_UNTERSCHRIFT, unterschriftName: 'M. Rußbach',
      unterschriftFunktion: 'Bauleitung', unterschriftFirma: 'Bothmer Akustikbau GmbH',
      createdAt: jetzt - 3 * 86400000, eingereichtAm: jetzt - 3 * 86400000, eingereichtVon: 'Ahmad Monteur',
    },
    {
      id: 'b-2', typ: 'reklamation', nummer: 'RK-2026-002', projektId: 'p-iga', terminId: '',
      mitarbeiterId: 'u-samir', mitarbeiterName: 'Samir Monteur',
      datum: heutePlus(-1), status: 'entwurf',
      beschreibung: 'Farbabplatzer im Treppenhaus EG, ca. 0,5 m².',
      ursache: 'Untergrund war an dieser Stelle sandend, Grundierung durch Folgegewerk beschädigt.',
      massnahme: 'Stelle anschleifen, neu grundieren und beischichten.',
      geruegtDurch: 'Bothmer Akustikbau (Bauleitung)', ruegeZugangAm: heutePlus(-1), fristBis: heutePlus(6),
      createdAt: jetzt - 1 * 86400000, eingereichtAm: 0,
    },
  ]

  // --- Fotos (Platzhalter-SVGs, Bezug über berichtId/projektId) ---
  const photos = [
    { id: 'ph-1', projektId: 'p-iga', berichtId: 'b-1', terminId: 't-4', phase: 'vorher', dataUrl: svgFoto('VORHER – Wand mit Schlitzen', '#64748b'), name: 'vorher-flur-eg.jpg', von: 'Ahmad Monteur', createdAt: jetzt - 3 * 86400000 },
    { id: 'ph-2', projektId: 'p-iga', berichtId: 'b-1', terminId: 't-4', phase: 'nachher', dataUrl: svgFoto('NACHHER – gespachtelt', '#10b981'), name: 'nachher-flur-eg.jpg', von: 'Ahmad Monteur', createdAt: jetzt - 3 * 86400000 },
    { id: 'ph-3', projektId: 'p-iga', berichtId: 'b-2', terminId: '', phase: 'vorher', dataUrl: svgFoto('Abplatzer Treppenhaus', '#ef4444'), name: 'reklamation-treppenhaus.jpg', von: 'Samir Monteur', createdAt: jetzt - 1 * 86400000 },
  ]

  // --- Spesen ---
  const spesen = [
    {
      id: 's-1', projektId: 'p-iga', mitarbeiterId: 'u-ahmad', typ: 'fahrt',
      datum: heutePlus(-3), betrag: 13.5, belegFotoId: '', kommentar: '',
      fahrt: { von: 'Münchener Str. 21, 86551 Aichach', bis: 'Eserwallstraße 1-3, 86150 Augsburg', km: 27, kmSatz: 0.5, automatisch: true },
      status: 'eingereicht', createdAt: jetzt - 3 * 86400000,
    },
    {
      id: 's-2', projektId: 'p-s36', mitarbeiterId: 'u-ahmad', typ: 'hotel',
      datum: heutePlus(21), betrag: 89, belegFotoId: '', kommentar: 'Übernachtung Montagewoche München (geplant)',
      fahrt: null, status: 'entwurf', createdAt: jetzt,
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
    { id: 'integrationen', fastbillEmail: '', fastbillApiKey: '' },
  ]

  return {
    users, patients, projekte, lvpositionen, appointments, berichte, photos, spesen,
    katalog, bausteine, requests, settings,
    rechnungen: [], apilog: [], plaene: [], feedback: [],
  }
}
