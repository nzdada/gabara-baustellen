// Globale Praxis-Einstellungen (Firestore: settings/global).
// Alles hier ist über Verwaltung -> Einstellungen pflegbar; die Defaults greifen,
// solange nichts gespeichert wurde. Hinweis: Der Apps-Script-Mail-Dienst hat
// eigene Konstanten am Skriptanfang (SECRET, GEBUEHR, Verzögerung) – bei
// Änderungen dort ebenfalls anpassen.

export const EINSTELLUNGEN_DEFAULTS = {
  id: 'global',
  // Lokalisierung & Standards
  standardSprache: 'de',
  waehrung: 'EUR',
  datumsformat: 'TT.MM.JJJJ',
  // Automatisierung & Fristen
  stornoFristStunden: 24,
  ausfallGebuehr: 50,
  feedbackVerzoegerungStunden: 3,
  // Kataloge & Praxisdaten
  katalogModus: 'GOZ', // GOZ | BEMA
  praxisName: 'Praxis an der Wertachbrücke',
  praxisAnschrift: 'Schöpplerstraße 4, 86154 Augsburg',
  praxisTelefon: '0821 / 42 22 05',
  praxisEmail: 'info@praxis-an-der-wertachbruecke.de',
  bankName: 'Stadtsparkasse Augsburg',
  iban: 'DE12 7205 0000 0000 0000 00',
}
