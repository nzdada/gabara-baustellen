// Fehlerprotokoll (AP 3): unbehandelte Fehler landen in der Datenbank.
//
// Auf der Baustelle sieht niemand eine Entwicklerkonsole. Wenn dort ein
// Bildschirm weiß bleibt, erfährt das Büro es erst Tage später – oder nie.
// Deshalb fängt dieses Modul window.onerror und unhandledrejection ab und
// schreibt sie in die Sammlung 'apilog' (art 'fehler'), zusammen mit der
// Versionskennung des laufenden Programmstands. Die Einträge erscheinen im
// bestehenden Protokoll unter Einstellungen → FastBill.
//
// Grundsätze:
//  - Das Protokoll darf NIE selbst zum Fehler werden: alles in try/catch,
//    der Schreibweg schluckt jede eigene Störung still.
//  - Kein Endlos-Rauschen: gleiche Meldung nur einmal je Sitzung,
//    höchstens 10 Einträge je Sitzung.
//  - Harte Längengrenzen – firestore.rules verlangt sie (apilog-Regel),
//    damit auch die öffentliche Webseite (ohne Anmeldung) melden darf,
//    ohne dass jemand die Datenbank mit Romanen füllt.

import { getStore } from './store.js'
import { versionsKennung } from './version.js'

const HOECHSTENS_JE_SITZUNG = 10
let anzahl = 0
const schonGemeldet = new Set()

function kuerze(wert, max) {
  const text = String(wert == null ? '' : wert)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

async function eintragSchreiben(eintrag) {
  try {
    const store = await getStore()
    await store.add('apilog', eintrag)
  } catch (e) {
    // Bewusst still: kein Netz / keine Rechte / Store kaputt – ein
    // scheiterndes Protokoll darf die App nicht weiter beschädigen.
  }
}

// app: 'verwaltung' | 'webseite' – wird in beiden main.jsx einmal gestartet.
export function fehlerprotokollStarten(app) {
  if (typeof window === 'undefined' || window.__gabaraFehlerprotokoll) return
  window.__gabaraFehlerprotokoll = true

  const melden = (meldung, stack) => {
    try {
      const text = kuerze(meldung || 'Unbekannter Fehler', 1900)
      // Gleiche Meldung nur einmal: ein Render-Fehler in einer Liste feuert
      // sonst hundertfach und verbrennt Schreibvorgänge.
      const schluessel = text.slice(0, 200)
      if (anzahl >= HOECHSTENS_JE_SITZUNG || schonGemeldet.has(schluessel)) return
      schonGemeldet.add(schluessel)
      anzahl += 1
      eintragSchreiben({
        art: 'fehler',
        dienst: 'app',
        app,
        // 'service' und 'fehlerText' bewusst wie die FastBill-Einträge benannt:
        // so zeigt die vorhandene Protokoll-Tabelle (Einstellungen.jsx) die
        // Fehler ohne eine einzige neue Spalte an.
        service: kuerze(window.location.hash || window.location.pathname, 200),
        status: 'fehler',
        fehlerText: text,
        stack: kuerze(stack, 3900),
        version: versionsKennung(),
        geraet: kuerze(navigator.userAgent, 300),
        createdAt: Date.now(),
      })
    } catch (e) { /* siehe Grundsatz oben */ }
  }

  window.addEventListener('error', (ereignis) => {
    melden(
      ereignis?.message,
      ereignis?.error?.stack || `${ereignis?.filename || ''}:${ereignis?.lineno || 0}`,
    )
  })
  window.addEventListener('unhandledrejection', (ereignis) => {
    const grund = ereignis?.reason
    melden(grund?.message || String(grund), grund?.stack)
  })
}
