// Firmendaten der Gabara Service GmbH (übernommen von https://gabara-service.de/, Stand Juli 2026).
// WICHTIG (Vorlagen-Regel): Export-Namen bleiben wie in der Vorlage (PRAXIS, TEAM, LEISTUNGEN, ...),
// nur die WERTE sind neu. Übersetzbare Felder sind {de,en,ar}-Objekte -> Anzeige über tr() aus ./i18n.js.
// Es wird nur Deutsch gepflegt; en/ar tragen den deutschen Text (i18n-Struktur bleibt funktionsfähig).

const t = (de) => ({ de, en: de, ar: de })

export const PRAXIS = {
  name: 'Gabara Service GmbH',
  untertitel: 'Maler & Lackierer in Augsburg und Umgebung',
  strasse: 'Münchener Str. 21',
  plzOrt: '86551 Aichach',
  telefon: '+49 176 25700609',
  telefonLink: 'tel:+4917625700609',
  email: 'Info@gabara-service.de',
  webseite: 'www.gabara-service.de',
  hinweisNachfolge: t('Saubere Arbeit zum fairen Preis – für Privat und Gewerbe.'),
  sprachen: t('Deutsch, Arabisch, Englisch'),
  stornoHinweis: t(''),
}

export const TEAM = [
  {
    name: 'Gabara Service GmbH',
    rolle: t('Meister- und Montageteam'),
    info: t('Erfahrenes Team für Maler- und Lackierarbeiten – Innenräume, Fassaden und Objekte.'),
    kuerzel: 'GS',
  },
]

// Leistungen (von gabara-service.de/#leistungen), Bilder folgen in AP3.
export const LEISTUNGEN = [
  {
    id: 'innenmalerei', icon: 'roller',
    titel: t('Innenmalerei'),
    text: t('Professionelle Wand- und Deckenanstriche für Wohnungen und Häuser.'),
    details: t('Wände und Decken werden fachgerecht vorbereitet (reinigen, spachteln, grundieren) und in hochwertiger Qualität gestrichen – Dispersion, Latex oder nach Wunsch abgetönt. Sauberes Abkleben und Abdecken ist bei uns selbstverständlich.'),
    bild: '/bilder/innenmalerei.jpg',
    bilder: [],
  },
  {
    id: 'aussenarbeiten', icon: 'home',
    titel: t('Außenarbeiten'),
    text: t('Fassadenanstriche und Schutzbeschichtungen.'),
    details: t('Fassaden reinigen, ausbessern und mit witterungsbeständigen Beschichtungen schützen – für ein gepflegtes Erscheinungsbild und langfristigen Werterhalt Ihrer Immobilie.'),
    bild: '/bilder/aussenarbeiten.jpg',
    bilder: [],
  },
  {
    id: 'lackierarbeiten', icon: 'brush',
    titel: t('Lackierarbeiten'),
    text: t('Hochwertige Lackierungen von Türen, Zargen, Fenstern und Holzoberflächen.'),
    details: t('Erst- und Renovierungslackierungen von Türzargen, Türen, Fenstern, Heizkörpern und Holzflächen – sauber geschliffen, grundiert und mit wasserbasierten Acryl-Lacken endlackiert.'),
    bild: '/bilder/lackierarbeiten.jpg',
    bilder: [],
  },
  {
    id: 'gewerbe', icon: 'users',
    titel: t('Privat & Gewerbe'),
    text: t('Flexible Lösungen für alle Projektgrößen – vom Wohnzimmer bis zum Bürokomplex.'),
    details: t('Als zuverlässiger Nachunternehmer übernehmen wir Malerarbeiten auf Baustellen jeder Größe – nach Leistungsverzeichnis, VOB-konform und termintreu. Privatkunden betreuen wir vom Angebot bis zur besenreinen Übergabe.'),
    bild: '/bilder/privat-gewerbe.jpg',
    bilder: [],
  },
]

export const BILD_QUELLE = t('Fotos: Gabara Service GmbH')

// Arbeitszeiten: je Wochentag (0=So … 6=Sa) Liste von [von, bis]
// (Mo–Fr 07:00–17:00, wie auf Baustellen üblich / vgl. Nachunternehmervertrag)
export const OEFFNUNGSZEITEN = {
  1: [['07:00', '17:00']],
  2: [['07:00', '17:00']],
  3: [['07:00', '17:00']],
  4: [['07:00', '17:00']],
  5: [['07:00', '17:00']],
}

export const OEFFNUNGSZEITEN_TEXT = [
  { tag: t('Montag – Freitag'), zeit: t('07:00 – 17:00 Uhr') },
  { tag: t('Samstag / Sonntag'), zeit: t('nach Vereinbarung') },
]

// Anliegen für das Anfrage-Formular der Webseite (Dauer ohne Bedeutung, Struktur der Vorlage).
// Gespeichert wird immer titel.de (kanonisch).
export const ANLIEGEN = [
  { id: 'innen', dauer: 60, icon: 'roller',
    titel: t('Innenanstrich'), text: t('Wände und Decken streichen – Wohnung, Haus oder Büro') },
  { id: 'fassade', dauer: 60, icon: 'home',
    titel: t('Fassade / Außenanstrich'), text: t('Fassadenanstrich und Schutzbeschichtung') },
  { id: 'lack', dauer: 60, icon: 'brush',
    titel: t('Lackierarbeiten'), text: t('Türen, Zargen, Fenster, Heizkörper') },
  { id: 'gewerbe', dauer: 60, icon: 'users',
    titel: t('Gewerbe / Baustelle'), text: t('Objekt- und Baustellenarbeiten nach Leistungsverzeichnis') },
  { id: 'eigen', dauer: 60, icon: 'chat', freitext: true,
    titel: t('Anderes Anliegen'), text: t('Beschreiben Sie Ihr Vorhaben einfach selbst') },
]

export const BILDER = {}

export const RUNDGANG = []

export const FAQ = [
  {
    frage: t('Wie schnell bekomme ich ein Angebot?'),
    antwort: t('Nach Ihrer Anfrage melden wir uns kurzfristig, vereinbaren bei Bedarf einen Vor-Ort-Termin und erstellen Ihnen ein transparentes Festpreis-Angebot.'),
  },
  {
    frage: t('Arbeiten Sie auch für Firmen und Generalunternehmer?'),
    antwort: t('Ja. Wir arbeiten als Nachunternehmer nach Leistungsverzeichnis (VOB, §13b UStG) – zuverlässig, dokumentiert und termintreu.'),
  },
  {
    frage: t('Wird bei Ihnen sauber gearbeitet?'),
    antwort: t('Abdecken, Abkleben und eine besenreine Übergabe gehören bei uns immer dazu – saubere Arbeit zum fairen Preis ist unser Anspruch.'),
  },
  {
    frage: t('In welchem Umkreis sind Sie tätig?'),
    antwort: t('Rund um Aichach und Augsburg – für Baustellenprojekte auch überregional nach Absprache.'),
  },
]

export const KARRIERE = {
  titel: t('Karriere bei Gabara'),
  text: t('Wir suchen Verstärkung: Maler und Lackierer (m/w/d) sowie Helfer mit Erfahrung. Es erwarten dich abwechslungsreiche Baustellen, pünktliche Bezahlung und ein kollegiales Team.'),
  hinweis: t('Bewerbung ganz unkompliziert per E-Mail oder Telefon.'),
}

// Checkliste je Einsatz/Bericht (Vorlagen-Name bleibt: BEHANDLUNGS_CHECKS)
export const BEHANDLUNGS_CHECKS = [
  'Untergrund geprüft',
  'Abgeklebt / abgedeckt',
  'Grundierung aufgetragen',
  'Zwischenanstrich fertig',
  'Schlussanstrich fertig',
  'Kanten / Leibungen sauber',
  'Material dokumentiert',
  'Fotos gemacht (vorher/nachher)',
  'Baustelle gereinigt',
  'Mängel notiert',
]
