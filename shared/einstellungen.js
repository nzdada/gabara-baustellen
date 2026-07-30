// Globale Firmen-Einstellungen (settings/global).
// Alles hier ist über Verwaltung -> Einstellungen pflegbar; die Defaults greifen,
// solange nichts gespeichert wurde.

export const EINSTELLUNGEN_DEFAULTS = {
  id: 'global',
  // Lokalisierung & Standards
  standardSprache: 'de',
  waehrung: 'EUR',
  datumsformat: 'TT.MM.JJJJ',
  // Firmendaten (Briefkopf, Webseite, Druck)
  praxisName: 'Gabara Service GmbH',
  praxisAnschrift: 'Münchener Str. 21, 86551 Aichach',
  praxisTelefon: '+49 176 25700609',
  praxisEmail: 'Info@gabara-service.de',
  bankName: '',
  iban: '',
  // Abrechnung (Nachunternehmer-Standard, vgl. Bothmer-Vertrag)
  ustModusStandard: '13b',            // '13b' = netto Reverse-Charge | 'ust19'
  zahlungszielTage: 16,
  sicherheitseinbehaltProzent: 10,
  // Regie- und Spesen-Sätze
  regieFacharbeiter: 35,              // €/Std netto
  regieHelfer: 31,                    // €/Std netto
  kmSatz: 0.5,                        // €/km für Fahrtkosten
  // Altlasten der Vorlage (werden von alten Seiten noch gelesen; ohne Wirkung)
  stornoFristStunden: 24,
  ausfallGebuehr: 0,
  feedbackVerzoegerungStunden: 0,
  katalogModus: 'GOZ',
}
