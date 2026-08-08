// Versionskennung der laufenden Auslieferung (AP 3).
//
// Beide vite.config.js schreiben beim Bauen die globale Konstante
// __GABARA_VERSION__ in das Paket (scripts/versionskennung.mjs:
// Bau-Datum + kurzer Git-Hash). Die Kennung steht in der Fußzeile beider
// Apps und an jedem Fehlerprotokoll-Eintrag – "bei mir geht X nicht"
// wird damit einem exakten Programmstand zuordenbar.

export function versionsKennung() {
  try {
    // typeof-Wächter: Läuft der Code außerhalb von Vite (Tests, Node),
    // existiert die Konstante nicht – dann ehrlich 'entwicklung' sagen.
    // eslint-disable-next-line no-undef
    return typeof __GABARA_VERSION__ === 'string' ? __GABARA_VERSION__ : 'entwicklung'
  } catch (e) {
    return 'entwicklung'
  }
}
