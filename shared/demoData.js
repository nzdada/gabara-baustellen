// Fiktive Demo-Daten für die Vorstellung — KEINE echten Personen!
// Termine werden relativ zum heutigen Datum erzeugt, damit die Demo
// an jedem Tag "live" aussieht (heutige Termine im Arzt-Cockpit).

import { heuteISO, addTage, endeZeit } from './slots.js'
import { EINSTELLUNGEN_DEFAULTS } from './einstellungen.js'

const VORNAMEN = ['Anna', 'Mehmet', 'Sofia', 'Lukas', 'Fatima', 'Jonas', 'Elif', 'Maria', 'Ali', 'Laura', 'Omar', 'Emma', 'Yusuf', 'Katharina', 'Leon', 'Aylin', 'Peter', 'Zeynep', 'Hanna', 'David']
const NACHNAMEN = ['Bergmann', 'Yilmaz', 'Petrova', 'Huber', 'El-Amin', 'Schneider', 'Kaya', 'Fischer', 'Hassan', 'Weber', 'Farouk', 'Maier', 'Demir', 'Schuster', 'Brandl', 'Öztürk', 'Grimm', 'Arslan', 'Vogel', 'Stein']
const VERSICHERUNGEN = ['AOK Bayern', 'TK', 'BARMER', 'DAK', 'Privat (Allianz)', 'IKK classic', 'Privat (Debeka)']

// Für Testzwecke: ALLE Demo-Patienten nutzen diese Adresse -> sämtliche
// Bestätigungs-/Erinnerungs-/Gebühren-Mails landen in einem Postfach.
const TEST_EMAIL = 'nasirdada.98@gmail.com'

function pseudoTelefon(i) {
  return `0821 / 5${String(10000 + i * 137).slice(0, 5)}`
}

function geburtsdatum(i) {
  const jahr = 1950 + ((i * 7) % 55)
  const monat = String(1 + (i % 12)).padStart(2, '0')
  const tag = String(1 + ((i * 3) % 28)).padStart(2, '0')
  return `${jahr}-${monat}-${tag}`
}

// Zahnzusatzversicherungen (nicht jeder Patient hat eine)
const ZUSATZ = ['', 'ERGO Dental-Schutz', '', 'Allianz DentalPlus', '', '', 'DA Direkt Zahnschutz', '', 'ottonova dental', '']

// Leistungskatalog nach GOZ-Vorbild (Punktwert 5,62421 Cent, Standard-Faktor 2,3).
// Preise = marktübliche 2,3-fach-Sätze; in der Verwaltung frei pflegbar.
export const DEMO_KATALOG = [
  { id: 'kat-0010', code: 'GOZ 0010', name: 'Eingehende Untersuchung', preis: 30, faktor: 2.3 },
  { id: 'kat-0030', code: 'GOZ Ä935', name: 'Röntgen Einzelaufnahme', preis: 18, faktor: 2.3 },
  { id: 'kat-0080', code: 'GOZ 0090', name: 'Infiltrationsanästhesie', preis: 24, faktor: 2.3 },
  { id: 'kat-1000', code: 'GOZ 1000', name: 'Fluoridierung / Kariesprophylaxe', preis: 22, faktor: 2.3 },
  { id: 'kat-1040', code: 'GOZ 1040', name: 'Professionelle Zahnreinigung (PZR), Sitzung', preis: 120, faktor: 2.3 },
  { id: 'kat-2080', code: 'GOZ 2080', name: 'Kompositfüllung einflächig', preis: 90, faktor: 2.3 },
  { id: 'kat-2100', code: 'GOZ 2100', name: 'Kompositfüllung zweiflächig', preis: 130, faktor: 2.3 },
  { id: 'kat-2440', code: 'GOZ 2440', name: 'Wurzelkanalbehandlung je Kanal', preis: 220, faktor: 2.3 },
  { id: 'kat-4005', code: 'GOZ 4005', name: 'PA-Behandlung je Zahn', preis: 28, faktor: 2.3 },
  { id: 'kat-5000', code: 'GOZ 5000', name: 'Vollkeramikkrone', preis: 750, faktor: 2.3 },
  { id: 'kat-9010', code: 'GOZ 9010', name: 'Implantat inkl. Aufbau', preis: 1400, faktor: 2.3 },
  { id: 'kat-blch', code: 'GOZ 2310a', name: 'Bleaching je Kiefer', preis: 250, faktor: 2.3 },
  { id: 'kat-schiene', code: 'GOZ 7010', name: 'Schnarch-/Aufbissschiene', preis: 390, faktor: 2.3 },
]

// Textbausteine für die Behandlungs-Zusammenfassung (in der Verwaltung pflegbar)
export const DEMO_BAUSTEINE = [
  {
    id: 'bs-kontrolle',
    katalogIds: ['kat-0010'],
    titel: 'Kontrolle o.B.',
    text: '**Kontrolluntersuchung:** Befund ohne Besonderheiten.\n- Zahnstatus stabil\n- Zahnfleisch reizfrei\n- Nächste Kontrolle in 6 Monaten',
  },
  {
    id: 'bs-pzr',
    katalogIds: ['kat-1040'],
    titel: 'PZR',
    text: '**Professionelle Zahnreinigung (PZR)** vollständig durchgeführt.\n- Beläge und Zahnstein entfernt\n- Politur + Fluoridierung\n- Mundhygiene besprochen, Interdentalbürsten empfohlen',
  },
  {
    id: 'bs-fuellung',
    katalogIds: ['kat-2080', 'kat-0080'],
    titel: 'Füllung',
    text: '**Füllungstherapie:** Zahn __ mit Kompositfüllung versorgt.\n- Karies vollständig entfernt\n- Anästhesie komplikationslos\n- Okklusion geprüft',
  },
  {
    id: 'bs-wurzel',
    katalogIds: ['kat-2440', 'kat-0080'],
    titel: 'Wurzel',
    text: '**Wurzelkanalbehandlung** Zahn __, Sitzung __.\n- Kanäle aufbereitet und gespült\n- Medikamentöse Einlage\n- Provisorischer Verschluss, Folgetermin vereinbart',
  },
  {
    id: 'bs-implantat',
    katalogIds: ['kat-0010', 'kat-0030'],
    titel: 'Implantat-Beratung',
    text: '**Implantat-Beratung** Region __.\n- Befund + Röntgen ausgewertet\n- Behandlungsablauf und Alternativen erklärt\n- Heil- und Kostenplan wird erstellt',
  },
]

export function erzeugeDemoDaten() {
  const heute = heuteISO()
  const patients = VORNAMEN.map((vorname, i) => ({
    id: `pat-${String(i + 1).padStart(3, '0')}`,
    vorname,
    nachname: NACHNAMEN[i],
    geburtsdatum: geburtsdatum(i),
    telefon: pseudoTelefon(i),
    email: TEST_EMAIL,
    versicherung: VERSICHERUNGEN[i % VERSICHERUNGEN.length],
    zusatzversicherung: ZUSATZ[i % ZUSATZ.length],
    zusatzversicherungNr: ZUSATZ[i % ZUSATZ.length] ? `ZV-${String(7300000 + i * 4211)}` : '',
    notizen: i === 4 ? 'Penicillin-Allergie!' : i === 9 ? 'Angstpatientin – bitte Martha dazu holen' : '',
    createdAt: Date.now() - i * 86400000,
  }))

  // ===== Test-Szenarien: klar erkennbare Beispiel-Patienten für die Vorführung =====
  patients.push(
    {
      // SZENARIO 1: Stammpatient (alt) – lange Behandlungshistorie mit alten Berichten
      id: 'pat-sz-alt',
      vorname: 'Werner', nachname: 'Altmann',
      geburtsdatum: '1958-04-12',
      telefon: '0821 / 445566',
      email: TEST_EMAIL,
      versicherung: 'AOK Bayern',
      zusatzversicherung: 'ERGO Dental-Schutz', zusatzversicherungNr: 'ZV-1958042',
      notizen: 'Stammpatient seit 2024 – bevorzugt Termine bei Frau Steidle.',
      createdAt: Date.now() - 730 * 86400000,
    },
    {
      // SZENARIO 2: Angstpatientin – rote Warnung im Cockpit, Termin heute
      id: 'pat-sz-angst',
      vorname: 'Selma', nachname: 'Karim',
      geburtsdatum: '1990-09-03',
      telefon: '0176 / 778899',
      email: TEST_EMAIL,
      versicherung: 'TK',
      zusatzversicherung: '', zusatzversicherungNr: '',
      notizen: 'ANGSTPATIENTIN! Langsam erklären, Martha dabei, Pausen anbieten.',
      createdAt: Date.now() - 60 * 86400000,
    },
    {
      // SZENARIO 3: Kind – Behandlung mit Therapiehündin Martha
      id: 'pat-sz-kind',
      vorname: 'Lina', nachname: 'Klein',
      geburtsdatum: '2018-06-20',
      telefon: '0170 / 334455',
      email: TEST_EMAIL,
      versicherung: 'AOK Bayern (familienversichert)',
      zusatzversicherung: '', zusatzversicherungNr: '',
      notizen: 'Kind (8 J.) – Termin immer mit Martha, Belohnungs-Sticker nicht vergessen!',
      createdAt: Date.now() - 180 * 86400000,
    }
  )
  const SZ_ALT = patients.length - 3
  const SZ_ANGST = patients.length - 2
  const SZ_KIND = patients.length - 1

  const pos = (katalogId, anzahl = 1) => {
    const k = DEMO_KATALOG.find((k) => k.id === katalogId)
    return { katalogId, code: k.code, name: k.name, preis: k.preis, anzahl }
  }

  const termin = (id, patIdx, tagOffset, start, dauer, behandlung, status, extras = {}) => {
    const p = patients[patIdx]
    return {
      id: `ter-${id}`,
      patientId: p.id,
      patientName: `${p.vorname} ${p.nachname}`,
      datum: addTage(heute, tagOffset),
      start,
      ende: endeZeit(start, dauer),
      behandlung,
      status, // bestaetigt | abgeschlossen | abgesagt
      erinnerung: 'offen', // offen | gesendet | telefonisch
      arzt: extras.arzt || 'J. Strötz',
      summary: extras.summary || { text: '', checks: [], updatedAt: null, updatedBy: '' },
      befunde: extras.befunde || [], // Zahnschema-Befunde [{zahn, text, von, at}]
      leistungen: extras.leistungen || [], // Abrechnungspositionen aus dem Katalog
      rechnung: extras.rechnung || 'offen', // offen | gestellt | bezahlt
      googleEventId: null,
      patientEmail: p.email || '',
      sprache: 'de',
      stornoToken: `demo-tok-${id}`,
      feedbackToken: `demo-fb-${id}`,
    }
  }

  const appointments = [
    // Vergangene Termine (Historie mit fertigen Zusammenfassungen)
    termin('h01', 0, -21, '09:00', 30, 'Kontrolluntersuchung', 'abgeschlossen', {
      summary: { text: 'Befund unauffällig, Zahnstein leicht. Nächste Kontrolle in 6 Monaten empfohlen.', checks: ['Kontrolle / 01', 'Zahnstein entfernt'], updatedAt: Date.now() - 21 * 86400000, updatedBy: 'I. Steidle' },
      leistungen: [pos('kat-0010'), pos('kat-1000')],
      rechnung: 'bezahlt',
    }),
    termin('h02', 1, -14, '10:30', 60, 'Professionelle Zahnreinigung', 'abgeschlossen', {
      summary: { text: 'PZR vollständig, Zahnfleischbluten reduziert. Empfehlung: Interdentalbürsten Gr. 2.', checks: ['Professionelle Zahnreinigung'], updatedAt: Date.now() - 14 * 86400000, updatedBy: 'Prophylaxe-Team' },
      leistungen: [pos('kat-1040')],
      rechnung: 'bezahlt',
    }),
    termin('h03', 4, -10, '14:00', 30, 'Füllung Zahn 36', 'abgeschlossen', {
      summary: { text: 'Kompositfüllung 36 okklusal. ACHTUNG Penicillin-Allergie beachtet, keine Komplikationen.', checks: ['Füllung', 'Anästhesie'], updatedAt: Date.now() - 10 * 86400000, updatedBy: 'J. Strötz' },
      leistungen: [pos('kat-0010'), pos('kat-0080'), pos('kat-2080')],
      rechnung: 'gestellt',
    }),
    termin('h04', 2, -7, '11:00', 30, 'Beratung Implantat', 'abgeschlossen', {
      summary: { text: 'Beratung Implantat Regio 46. Patientin wünscht Kostenvoranschlag, DVT geplant.', checks: ['Beratung', 'Röntgen'], updatedAt: Date.now() - 7 * 86400000, updatedBy: 'J. Strötz' },
      leistungen: [pos('kat-0010'), pos('kat-0030', 2)],
      rechnung: 'offen',
    }),

    // HEUTE – für das Arzt-Cockpit in der Demo
    termin('t01', 5, 0, '08:30', 30, 'Kontrolluntersuchung', 'abgeschlossen', {
      summary: { text: 'Kontrolle o.B., kleine Verfärbung 21 beobachten.', checks: ['Kontrolle / 01'], updatedAt: Date.now() - 3600000, updatedBy: 'I. Steidle' },
      leistungen: [pos('kat-0010')],
    }),
    termin('t02', 6, 0, '09:30', 60, 'Professionelle Zahnreinigung', 'bestaetigt'),
    termin('t03', 9, 0, '11:00', 30, 'Kontrolle + Beratung', 'bestaetigt', { arzt: 'I. Steidle' }),
    termin('t04', 7, 0, '14:30', 30, 'Füllung Zahn 25', 'bestaetigt', {
      befunde: [{ zahn: '25', text: 'Karies okklusal, Füllung geplant', von: 'J. Strötz', at: Date.now() - 7 * 86400000 }],
    }),
    termin('t05', 12, 0, '16:00', 30, 'Schmerzbehandlung', 'bestaetigt', { arzt: 'E. Erben' }),

    // Nächste Tage
    termin('m01', 3, 1, '09:00', 30, 'Kontrolluntersuchung', 'bestaetigt'),
    termin('m02', 8, 1, '10:00', 60, 'Professionelle Zahnreinigung', 'bestaetigt'),
    termin('m03', 10, 2, '13:30', 30, 'Wurzelbehandlung Sitzung 2', 'bestaetigt', { arzt: 'E. Erben' }),
    termin('m04', 11, 3, '15:00', 30, 'Beratung Zahnersatz', 'bestaetigt', { arzt: 'I. Steidle' }),
    termin('m05', 13, 4, '09:30', 30, 'Kontrolluntersuchung', 'bestaetigt'),
  ]

  // ===== Szenario-Termine für die Test-Dokumentation =====
  const ausfallPos = { katalogId: 'ausfall', code: '§ 615 BGB', name: 'Ausfallhonorar – kurzfristige Absage', preis: 50, anzahl: 1 }
  appointments.push(
    // SZENARIO 1: Werner Altmann – 2 Jahre Historie mit alten Berichten
    termin('sz-a1', SZ_ALT, -730, '09:00', 30, 'Kontrolluntersuchung', 'abgeschlossen', {
      arzt: 'I. Steidle',
      summary: { text: '**Erstuntersuchung:** Gebiss altersentsprechend.\n- Zahnstein Unterkiefer\n- Füllung 46 randundicht, beobachten', checks: ['Kontrolle / 01', 'Röntgen'], updatedAt: Date.now() - 730 * 86400000, updatedBy: 'I. Steidle' },
      leistungen: [pos('kat-0010'), pos('kat-0030')], rechnung: 'bezahlt',
    }),
    termin('sz-a2', SZ_ALT, -540, '10:00', 60, 'Professionelle Zahnreinigung (PZR)', 'abgeschlossen', {
      arzt: 'I. Steidle',
      summary: { text: '**PZR** vollständig.\n- Beläge entfernt, Politur, Fluoridierung', checks: ['Professionelle Zahnreinigung'], updatedAt: Date.now() - 540 * 86400000, updatedBy: 'Prophylaxe-Team' },
      leistungen: [pos('kat-1040')], rechnung: 'bezahlt',
    }),
    termin('sz-a3', SZ_ALT, -365, '14:00', 30, 'Füllung Zahn 46', 'abgeschlossen', {
      arzt: 'I. Steidle',
      summary: { text: '**Füllungstherapie:** Zahn 46 erneuert (Komposit).\n- Karies entfernt\n- Okklusion geprüft', checks: ['Füllung', 'Anästhesie'], updatedAt: Date.now() - 365 * 86400000, updatedBy: 'I. Steidle' },
      befunde: [{ zahn: '46', text: 'Sekundärkaries unter alter Füllung, erneuert', von: 'I. Steidle', at: Date.now() - 365 * 86400000 }],
      leistungen: [pos('kat-2080'), pos('kat-0080')], rechnung: 'bezahlt',
    }),
    termin('sz-a4', SZ_ALT, -200, '11:00', 60, 'Vollkeramikkrone Zahn 36', 'abgeschlossen', {
      arzt: 'I. Steidle',
      summary: { text: '**Kronenversorgung Zahn 36** eingesetzt.\n- Digitaler Abdruck (3Shape)\n- Farbbestimmung A3\n- Sitz und Okklusion einwandfrei', checks: ['Abdruck / Scan', 'Anästhesie'], updatedAt: Date.now() - 200 * 86400000, updatedBy: 'I. Steidle' },
      befunde: [{ zahn: '36', text: 'Vollkeramikkrone eingesetzt', von: 'I. Steidle', at: Date.now() - 200 * 86400000 }],
      leistungen: [pos('kat-5000'), pos('kat-0080')], rechnung: 'bezahlt',
    }),
    termin('sz-a5', SZ_ALT, -90, '09:30', 30, 'Kontrolluntersuchung', 'abgeschlossen', {
      arzt: 'I. Steidle',
      summary: { text: '**Kontrolle:** Krone 36 reizlos, Befund stabil.', checks: ['Kontrolle / 01'], updatedAt: Date.now() - 90 * 86400000, updatedBy: 'I. Steidle' },
      leistungen: [pos('kat-0010')], rechnung: 'bezahlt',
    }),
    termin('sz-a6', SZ_ALT, -30, '10:30', 60, 'Professionelle Zahnreinigung (PZR)', 'abgeschlossen', {
      arzt: 'I. Steidle',
      summary: { text: '**PZR** vollständig, sehr gute Mundhygiene.', checks: ['Professionelle Zahnreinigung'], updatedAt: Date.now() - 30 * 86400000, updatedBy: 'Prophylaxe-Team' },
      leistungen: [pos('kat-1040')], rechnung: 'gestellt',
    }),
    // Termin MORGEN früh -> Testfall 24h-Gebühr (Absage-Link in der Mail heute Abend klicken)
    termin('sz-a7', SZ_ALT, 1, '08:30', 60, 'Professionelle Zahnreinigung (PZR)', 'bestaetigt', { arzt: 'I. Steidle' }),

    // SZENARIO 2: Selma Karim – Angstpatientin, Termin HEUTE (Cockpit-Tags)
    termin('sz-b1', SZ_ANGST, -60, '16:00', 30, 'Erstgespräch (Angstpatientin)', 'abgeschlossen', {
      summary: { text: '**Erstgespräch:** Nur Kennenlernen + Sitzprobe, KEINE Behandlung.\n- Vertrauen aufgebaut, Martha dabei\n- Nächster Schritt: kleine Kontrolle', checks: ['Beratung'], updatedAt: Date.now() - 60 * 86400000, updatedBy: 'J. Strötz' },
      leistungen: [pos('kat-0010')], rechnung: 'bezahlt',
    }),
    termin('sz-b2', SZ_ANGST, 0, '12:00', 30, 'Füllung Zahn 26 (Angstpatientin)', 'bestaetigt', {
      befunde: [{ zahn: '26', text: 'Karies okklusal, Füllung geplant', von: 'J. Strötz', at: Date.now() - 60 * 86400000 }],
    }),

    // SZENARIO 3: Lina Klein (Kind) – Termin HEUTE mit Martha
    termin('sz-c1', SZ_KIND, -180, '15:00', 30, 'Kinderprophylaxe', 'abgeschlossen', {
      summary: { text: '**Kinderprophylaxe:** Putztraining + Fluoridierung.\n- Sehr tapfer, Sticker bekommen\n- Martha war dabei', checks: ['Kontrolle / 01'], updatedAt: Date.now() - 180 * 86400000, updatedBy: 'J. Strötz' },
      leistungen: [pos('kat-1000')], rechnung: 'bezahlt',
    }),
    termin('sz-c2', SZ_KIND, 0, '15:00', 30, 'Kinder-Kontrolle mit Martha', 'bestaetigt'),

    // SZENARIO 4: Peter Grimm – 2 kurzfristige Absagen -> Blacklist im Dashboard
    termin('sz-d1', 16, -12, '09:00', 30, 'Kontrolluntersuchung', 'abgesagt', {
      leistungen: [ausfallPos], rechnung: 'pruefen',
    }),
    termin('sz-d2', 16, -5, '10:00', 60, 'Professionelle Zahnreinigung (PZR)', 'abgesagt', {
      leistungen: [ausfallPos], rechnung: 'pruefen',
    })
  )
  // Kurzfristig-Kennzeichnung für die Blacklist-Szenarien
  for (const t of appointments) {
    if (t.id === 'ter-sz-d1' || t.id === 'ter-sz-d2') {
      t.kurzfristig = true
      t.ausfallgebuehr = 'ausstehend'
      t.abgesagtAm = new Date(Date.now() - 3 * 86400000).toISOString()
    }
  }

  const requests = [
    {
      id: 'req-001',
      name: 'Sabine Renner',
      telefon: '0176 / 4455 8899',
      email: TEST_EMAIL,
      anliegen: 'Professionelle Zahnreinigung',
      anliegenId: 'pzr',
      dauer: 60,
      datum: addTage(heute, 2),
      start: '10:00',
      status: 'neu',
      nachricht: 'Gerne vormittags, bin Neupatientin.',
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'req-002',
      name: 'Karim Nasser',
      telefon: '0151 / 2233 4455',
      email: TEST_EMAIL,
      anliegen: 'Kontrolluntersuchung',
      anliegenId: 'kontrolle',
      dauer: 30,
      datum: addTage(heute, 3),
      start: '16:30',
      status: 'neu',
      nachricht: '',
      createdAt: Date.now() - 1800000,
    },
  ]

  // Szenario-Anfragen: Neupatientin (unbekannt) + Stammpatient (Telefon-Wiedererkennung)
  requests.push(
    {
      id: 'req-sz-neu',
      name: 'Nora Neumann',
      telefon: '0175 / 991122',
      email: TEST_EMAIL,
      anliegen: 'Kontrolluntersuchung',
      anliegenId: 'kontrolle',
      dauer: 30,
      datum: addTage(heute, 3),
      start: '11:30',
      status: 'neu',
      nachricht: 'Ich bin Neupatientin und komme auf Empfehlung von Familie Altmann.',
      sprache: 'de',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'req-sz-alt',
      name: 'Werner Altmann', // gleiche Telefonnummer wie Patient -> automatische Zuordnung
      telefon: '0821 / 445566',
      email: TEST_EMAIL,
      anliegen: 'Kontrolluntersuchung',
      anliegenId: 'kontrolle',
      dauer: 30,
      datum: addTage(heute, 5),
      start: '10:00',
      status: 'neu',
      nachricht: 'Bitte wieder bei Frau Steidle.',
      sprache: 'de',
      createdAt: Date.now() - 1800000,
    }
  )

  // Feedback-Beispiele: 5 Sterne (erledigt) + 2 Sterne (neu -> ALARM im Admin)
  const feedback = [
    {
      id: 'fb-demo-1',
      terminId: 'ter-h01', token: 'demo-fb-h01',
      sterne: 5, tags: ['team-freundlich', 'schmerzfrei'],
      text: 'Sehr einfühlsame Behandlung, gerne wieder!',
      createdAt: Date.now() - 20 * 86400000, status: 'erledigt',
    },
    {
      id: 'fb-demo-2',
      terminId: 'ter-h02', token: 'demo-fb-h02',
      sterne: 2, tags: ['wartezeit-lang'],
      text: 'Ich musste über 40 Minuten warten, das war zu lang.',
      createdAt: Date.now() - 86400000, status: 'neu',
    },
  ]

  // Beispiel-Behandlungsplan (Heil- und Kostenplan) für die Implantat-Patientin
  const plaene = [
    {
      id: 'hkp-001',
      patientId: patients[2].id,
      patientName: `${patients[2].vorname} ${patients[2].nachname}`,
      titel: 'Implantat Regio 46',
      befund: 'Zahn 46 nicht erhaltungswürdig (tiefe Karies, Längsfraktur). Nachbarzähne 45/47 gesund. Knochenangebot laut Röntgen ausreichend.',
      therapie: 'Extraktion 46, Einheilung 8 Wochen, Implantation mit Aufbau, Versorgung mit Vollkeramikkrone.',
      positionen: [pos('kat-9010'), pos('kat-5000'), pos('kat-0030', 2), pos('kat-0080')],
      status: 'eingereicht', // entwurf | eingereicht | genehmigt | abgelehnt
      createdAt: Date.now() - 5 * 86400000,
    },
    {
      // GENEHMIGTER Plan für Werner -> Cockpit-Warnung greift bei ihm NICHT (Krone)
      id: 'hkp-sz-genehmigt',
      patientId: 'pat-sz-alt',
      patientName: 'Werner Altmann',
      titel: 'Krone Zahn 36',
      befund: 'Zahn 36 stark zerstört, erhaltungswürdig.',
      therapie: 'Versorgung mit Vollkeramikkrone.',
      positionen: [pos('kat-5000'), pos('kat-0080')],
      status: 'genehmigt',
      gueltigBis: addTage(heute, 120),
      createdAt: Date.now() - 220 * 86400000,
    },
    {
      // ABGELEHNTER Plan (Status-Tracker-Demo)
      id: 'hkp-sz-abgelehnt',
      patientId: 'pat-sz-alt',
      patientName: 'Werner Altmann',
      titel: 'Bleaching (Zusatzversicherung)',
      befund: 'Verfärbungen Oberkiefer-Front.',
      therapie: 'Professionelles Bleaching, ein Kiefer.',
      positionen: [pos('kat-blch')],
      status: 'abgelehnt',
      createdAt: Date.now() - 40 * 86400000,
    },
  ]

  return {
    patients,
    appointments,
    requests,
    photos: [],
    feedback,
    settings: [
      { ...EINSTELLUNGEN_DEFAULTS },
      // Wiederkehrende Pausen: Mittwoch durchgehend geöffnet -> Mittagspause blocken
      { id: 'pausen', eintraege: [{ tag: 3, von: '12:30', bis: '13:30', grund: 'Mittagspause' }] },
      // Öffnungszeiten (in den Einstellungen pflegbar; Firestore-Form: Objekte statt Arrays)
      {
        id: 'oeffnungszeiten',
        fenster: {
          1: [{ von: '08:00', bis: '12:00' }, { von: '13:00', bis: '18:00' }],
          2: [{ von: '08:00', bis: '12:00' }, { von: '13:00', bis: '18:00' }],
          3: [{ von: '08:00', bis: '17:00' }],
          4: [{ von: '08:00', bis: '12:00' }, { von: '14:00', bis: '19:00' }],
          5: [],
          6: [],
        },
        // Tage ohne Zeitfenster, die trotzdem telefonisch erreichbar sind
        telefon: [5],
        // Urlaub/Betriebsferien: [{von:'JJJJ-MM-TT', bis:'JJJJ-MM-TT'}] – blockt die Online-Buchung
        urlaub: [],
      },
    ],
    katalog: DEMO_KATALOG.map((k) => ({ ...k })),
    bausteine: DEMO_BAUSTEINE.map((b) => ({ ...b })),
    plaene,
  }
}
