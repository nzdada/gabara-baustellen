// Versionskennung für die Auslieferung (AP 3).
//
// Wird von BEIDEN vite.config.js beim Bauen aufgerufen und als globale
// Konstante __GABARA_VERSION__ in das Programmpaket geschrieben. Die Apps
// zeigen sie in der Fußzeile und hängen sie an jeden Fehlerprotokoll-Eintrag –
// so ist bei jeder Fehlermeldung klar, WELCHER Stand sie erzeugt hat.
//
// Form: 2026-08-08-a1b2c3d  (Datum des Baus + kurzer Git-Stand).
// Das Deploy-Skript (scripts/ausliefern.mjs) erzwingt vorher `git status`
// leer – der Hash bezeichnet damit exakt den ausgelieferten Stand.

import { execSync } from 'node:child_process'

export function ermittleVersionskennung() {
  const datum = new Date().toISOString().slice(0, 10)
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return `${datum}-${hash}`
  } catch (e) {
    // Kein Git verfügbar (z. B. Bau aus einem Archiv) – lieber eine ehrliche
    // Kennung als gar keine.
    return `${datum}-ohne-git`
  }
}
