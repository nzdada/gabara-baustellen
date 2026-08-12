// Der Tag des Monteurs (Plan Kapitel 3.1, AP 5) – reine Rechenfunktionen
// ohne React und ohne Store, damit alles unter node testbar ist.
//
// WAS HIER LIEGT
// - einsatzFuerTag / aufgabenZumEinsatz: welcher Einsatz gilt heute, und
//   welche Aufgaben gehoeren dazu (einsatzId ODER teamId + tage[]).
// - tagesgruppen: die HEUTE-Liste – Gruppen je Arbeitsschritt, je Zeile das
//   Zeichen nach der Plan-Tabelle (☐ ☑ ▸ 📷 ✓ ⚠ ⏸).
// - istLetzterOffenerSchritt: der wichtigste Handgriff – ein Raum auf seinem
//   LETZTEN Schritt zeigt die Kamera (Raumabschluss in 2 Tipps).
// - wartetBauen / weiterBauen / laeuftBauen: Zustandsschaltungen als fertige
//   Batch-Bausteine fuer store.meldeAufgaben – inklusive der Gegenbuchung
//   der Kennzahlen-Zaehler (EIN aggregiertes Increment je Vorgang).
// - Stunden-Kolonnenzeile: deterministische Kennung std-<userId>-<datum>-
//   <projektId>-<art>, Zeitrechnung ohne Fliesskomma-Drift, Taetigkeitstext
//   nach § 15 Abs. 3 VOB/B aus den heute gemeldeten Schritten (deutsch –
//   der Text landet auf dem Stundenzettel-PDF).
//
// GESCHRIEBEN wird woanders (store.meldeAufgaben / store.add). Kein Datum aus
// der Weltzeit: `datum` liefert der Aufrufer ueber heuteISO(), `jetzt` ist
// injizierbar (Tests).

import { parseZahl } from './format.js'
import { istQuadratmeter } from './aufgaben.js'

// ------------------------------------------------------------- Zeichen
// Die sieben Zeichen der Plan-Tabelle. Sie sind KEINE Woerter und brauchen
// deshalb keine Uebersetzung – gleiche Bedeutung in beiden Sprachen.
export const ZEICHEN = {
  offen: '☐',
  gewaehlt: '☑',
  laeuft: '▸',
  kamera: '📷',
  fertig: '✓',
  vorherFehlt: '⚠',
  wartet: '⏸',
  // AP 7: vom Büro zurückgewiesen – landet ROT beim Monteur (Plan 3.2,
  // verbesserungen.md:39). Nach der Nachbesserung normal erneut meldbar,
  // weil die Zurückweisung die Buchung mit der festen Kennung löscht.
  zurueck: '⟲',
}

// Grundliste fuer den Zustand `wartet` (Plan 4.2, raeume.wartetGrund).
// Die Texte dazu liegen als mt.grund.<id> in shared/texte.js (de+ar).
export const WARTET_GRUENDE = ['zugestellt', 'vorgewerkFehlt', 'keinZutritt', 'estrichNass', 'kundeSperrt']

// Zweisprachige Bausteine fuer "Regie melden" (Plan 3.1 Bildschirm 5,
// Schritt 2 "WAS?"). Der deutsche Text ist zugleich der Titel der Anordnung
// und landet spaeter auf Stundenzettel und Regiebericht (deshalb de fuehrend).
export const REGIE_BAUSTEINE = [
  { id: 'altanstrich', de: 'Altanstrich entfernen', ar: 'إزالة الطلاء القديم' },
  { id: 'spachteln', de: 'Untergrund zusätzlich spachteln', ar: 'معجنة إضافية للسطح' },
  { id: 'abdecken', de: 'Zusätzliche Abdeck-/Schutzarbeiten', ar: 'أعمال تغطية وحماية إضافية' },
  { id: 'kleinreparatur', de: 'Kleinreparaturen am Untergrund', ar: 'إصلاحات صغيرة في السطح' },
  { id: 'zusatzanstrich', de: 'Zusätzlicher Anstrich (3. Gang)', ar: 'طلاء إضافي (طبقة ثالثة)' },
  { id: 'reinigung', de: 'Baustelle räumen und reinigen', ar: 'إخلاء موقع العمل وتنظيفه' },
  // Nachtrag 13.08.2026 (docs/regie-taetigkeiten.md, Abschnitt 11): fuenf
  // Taetigkeiten, die bislang nur als Freitext gingen (R2/R4/R5/R6/R9).
  // Heizkoerper BEWUSST als EIN Baustein reinigen+lackieren – getrennt saehe
  // die Reinigung wie eine Doppelabrechnung der Vertragsposition aus (8a).
  { id: 'silikon', de: 'Silikonarbeiten Bad/Sanitär', ar: 'أعمال السيليكون (حمّام/صحّية)' },
  { id: 'acryllack', de: 'Türen/Zargen: Acrylfugen und Lackierung', ar: 'الأبواب والإطارات: فواصل أكريليك وطلاء' },
  { id: 'heizkoerper', de: 'Heizkörper reinigen und lackieren', ar: 'تنظيف المدافئ وطلاؤها' },
  { id: 'fugensanierung', de: 'Fugensanierung (Fugen erneuern)', ar: 'تجديد الفواصل (ترميم الفواصل)' },
  { id: 'stromdeckel', de: 'Stromdeckel/Abdeckungen montieren', ar: 'تركيب أغطية الكهرباء والمآخذ' },
]

const FERTIG_STATUS = new Set(['fertig', 'abgerechnet'])
export function istFertigStatus(status) {
  return FERTIG_STATUS.has(status)
}

// Ein Zeitstempel (ms) als lokales ISO-Datum – NIE ueber toISOString(),
// das waere Weltzeit und nachts der Vortag (STAND.md Regel 3).
export function isoVonMs(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ------------------------------------------------------------- Einsatz des Tages

// Welcher Einsatz gilt fuer diese Person an diesem Tag?
// - Monteur/Vorarbeiter: nur Einsaetze, in deren mitarbeiterIds er steht.
// - Buero-Vorschau (alleSehen): der erste Einsatz des Tages ueberhaupt.
// Bei mehreren gewinnt der frueheste Beginn – der zweite Einsatz des Tages
// ist ueber die RAEUME-Ansicht erreichbar, nicht ueber HEUTE.
export function einsatzFuerTag(einsaetze, user, datum, { alleSehen = false } = {}) {
  const liste = (Array.isArray(einsaetze) ? einsaetze : [])
    .filter((e) => e.status !== 'abgesagt' && Array.isArray(e.tage) && e.tage.includes(datum))
    .sort((a, b) => String(a.von || '').localeCompare(String(b.von || '')))
  const userId = user?.userId || user?.id || ''
  const meiner = liste.find((e) => (e.mitarbeiterIds || []).includes(userId))
  if (meiner) return meiner
  return alleSehen ? liste[0] || null : null
}

// Aufgaben, die zu diesem Einsatz gehoeren: entweder ausdruecklich verknuepft
// (einsatzId) oder ueber Kolonne + Tag (teamId, tage[] – Plan 4.2, der
// Verbundindex (teamId, tage array-contains)).
export function aufgabenZumEinsatz(aufgaben, einsatz, datum) {
  if (!einsatz) return []
  return (Array.isArray(aufgaben) ? aufgaben : []).filter((a) => a.projektId === einsatz.projektId
    && (a.einsatzId === einsatz.id
      || (Boolean(einsatz.teamId) && a.teamId === einsatz.teamId && (a.tage || []).includes(datum))))
}

// ------------------------------------------------------------- Zeichenlogik

// Steht dieser Raum auf seinem LETZTEN offenen Schritt? Dann zeigt die Zeile
// statt des Kreises die Kamera: Antippen -> Kamera -> fertig (2 Tipps).
// Massgeblich ist der GESAMTE Aufgabenstand des Raums (alle Schritte, auch
// die nicht im heutigen Einsatz stecken) – sonst meldete man einen Raum
// "abgeschlossen", dem noch ein spaeterer Schritt fehlt.
export function istLetzterOffenerSchritt(aufgabe, alleAufgaben) {
  if (istFertigStatus(aufgabe.status)) return false
  return (Array.isArray(alleAufgaben) ? alleAufgaben : [])
    .filter((a) => a.projektId === aufgabe.projektId && a.raumId === aufgabe.raumId && a.id !== aufgabe.id)
    .every((a) => istFertigStatus(a.status))
}

// Das Zeichen einer Zeile nach der Plan-Tabelle. `gewaehlt` setzt die
// Oberflaeche selbst (Auswahl ist Bildschirm-Zustand, kein Datenzustand).
export function zeichenFuer(aufgabe, alleAufgaben) {
  if (istFertigStatus(aufgabe.status)) return 'fertig'
  if (aufgabe.status === 'wartet') return 'wartet'
  // 'zurueck' schlägt die Kamera: die rote Zeile mit dem Grund muss auffallen,
  // sonst stellt der Monteur das Melden ein (der Rückweg aus Plan 3.2).
  if (aufgabe.status === 'zurueck') return 'zurueck'
  if (istLetzterOffenerSchritt(aufgabe, alleAufgaben)) return 'kamera'
  if (aufgabe.status === 'laeuft') return 'laeuft'
  return 'offen'
}

// Fehlt dem Raum dieser Aufgabe das Vorher-Bild (Auftrag)? Grundlage ist
// raum.fotoStand (Anzahlen, Plan 4.2) – die ⚠-Spalte der HEUTE-Liste.
export function vorherFehlt(aufgabe, raeume) {
  const raum = (Array.isArray(raeume) ? raeume : []).find((r) => r.id === aufgabe.raumId)
  if (!raum || !raum.fotoStand) return false
  return !parseZahl(raum.fotoStand.auftragVorher)
}

// Die HEUTE-Liste: Gruppen je Arbeitsschritt (nach schrittSort), darin die
// Zeilen des heutigen Einsatzes. Fertige Zeilen bleiben nur sichtbar, wenn
// sie HEUTE fertig wurden (✓ mit Uhrzeit) – Altes verstopft die Liste nicht.
export function tagesgruppen(einsatzAufgaben, alleAufgaben, raeume, datum) {
  const zeilen = (Array.isArray(einsatzAufgaben) ? einsatzAufgaben : [])
    .filter((a) => !istFertigStatus(a.status) || (a.fertigAm && isoVonMs(a.fertigAm) === datum))
  const gruppen = new Map()
  for (const a of zeilen) {
    if (!gruppen.has(a.schrittId)) {
      gruppen.set(a.schrittId, {
        schrittId: a.schrittId,
        nameDe: a.schrittNameDe || '',
        nameAr: a.schrittNameAr || '',
        sort: parseZahl(a.schrittSort),
        zeilen: [],
        offen: 0,
      })
    }
    const g = gruppen.get(a.schrittId)
    const zeichen = zeichenFuer(a, alleAufgaben)
    g.zeilen.push({ aufgabe: a, zeichen, vorherFehlt: zeichen !== 'fertig' && vorherFehlt(a, raeume) })
    if (!istFertigStatus(a.status)) g.offen += 1
  }
  const liste = [...gruppen.values()].sort((a, b) => a.sort - b.sort)
  for (const g of liste) {
    g.zeilen.sort((a, b) => String(a.aufgabe.raumNummer).localeCompare(String(b.aufgabe.raumNummer), 'de', { numeric: true }))
  }
  return liste
}

// Summe der m²-Mengen einer Auswahl – fuer die Quittung ("4 Räume · 160 m²").
export function summeM2(aufgaben) {
  let summe = 0
  for (const a of Array.isArray(aufgaben) ? aufgaben : []) {
    if (istQuadratmeter(a.einheit)) summe += parseZahl(a.menge)
  }
  return Math.round(summe * 1000) / 1000
}

// ------------------------------------------------------------- Zustandsschaltungen
//
// Jede Schaltung liefert das fertige Argument fuer store.meldeAufgaben:
// Aufgaben-Patches (nur Felder, die die Firestore-Regel dem Monteur erlaubt:
// status, anteil, fertig*, wartetGrund, wartetBis, geaendertAm) plus EIN
// aggregiertes Kennzahlen-Increment mit sauberer Gegenbuchung der Zaehler.

function zaehlerDelta(vonStatus, nachStatus) {
  const feld = { laeuft: 'aufgabenLaeuft', wartet: 'aufgabenWartet', zurueck: 'aufgabenZurueck' }
  const deltas = {}
  if (feld[vonStatus]) deltas[feld[vonStatus]] = (deltas[feld[vonStatus]] || 0) - 1
  if (feld[nachStatus]) deltas[feld[nachStatus]] = (deltas[feld[nachStatus]] || 0) + 1
  return deltas
}

function deltasZusammen(ziel, quelle) {
  for (const [feld, betrag] of Object.entries(quelle)) {
    const summe = (ziel[feld] || 0) + betrag
    if (summe === 0) delete ziel[feld]
    else ziel[feld] = summe
  }
}

// [▸] angefangen: 1 Tipp, kein Foto, keine Buchung – nur status 'laeuft'.
// anteil optional aus dem Teilanteil-Regler (Zehntel, 0..1).
export function laeuftBauen(aufgabe, { anteil = null, jetzt = Date.now() } = {}) {
  if (istFertigStatus(aufgabe.status)) return null
  const patch = { status: 'laeuft', geaendertAm: jetzt }
  if (anteil !== null) patch.anteil = Math.min(0.9, Math.max(0.1, Math.round(parseZahl(anteil) * 10) / 10))
  const deltas = {}
  deltasZusammen(deltas, zaehlerDelta(aufgabe.status, 'laeuft'))
  return {
    aufgaben: [{ id: aufgabe.id, patch }],
    kennzahlen: { projektId: aufgabe.projektId, deltas, felder: { letzteMeldungAm: jetzt } },
  }
}

// Raum wartet (Plan: der teuerste Fehler von V1 war aktiv:false): ALLE nicht
// fertigen Aufgaben des Raums bekommen status 'wartet' + Grund + Wiedervorlage.
// Der Raum bleibt im Nenner und taucht am Stichtag von selbst wieder auf.
export function wartetBauen(aufgabenDesRaums, { grund, bis = '', jetzt = Date.now() } = {}) {
  const offene = (Array.isArray(aufgabenDesRaums) ? aufgabenDesRaums : [])
    .filter((a) => !istFertigStatus(a.status) && a.status !== 'wartet')
  if (!offene.length || !grund) return null
  const deltas = {}
  const updates = offene.map((a) => {
    deltasZusammen(deltas, zaehlerDelta(a.status, 'wartet'))
    return { id: a.id, patch: { status: 'wartet', wartetGrund: grund, wartetBis: bis, geaendertAm: jetzt } }
  })
  return {
    aufgaben: updates,
    kennzahlen: { projektId: offene[0].projektId, deltas, felder: { letzteMeldungAm: jetzt } },
  }
}

// Gegenrichtung: der Grund ist weg, der Raum arbeitet weiter. Zurueck in
// 'zugewiesen' (wenn eine Zuweisung existiert), sonst 'offen'.
export function weiterBauen(aufgabenDesRaums, { jetzt = Date.now() } = {}) {
  const wartende = (Array.isArray(aufgabenDesRaums) ? aufgabenDesRaums : [])
    .filter((a) => a.status === 'wartet')
  if (!wartende.length) return null
  const deltas = {}
  const updates = wartende.map((a) => {
    const nach = a.einsatzId || a.teamId ? 'zugewiesen' : 'offen'
    deltasZusammen(deltas, zaehlerDelta('wartet', nach))
    return { id: a.id, patch: { status: nach, wartetGrund: '', wartetBis: '', geaendertAm: jetzt } }
  })
  return {
    aufgaben: updates,
    kennzahlen: { projektId: wartende[0].projektId, deltas, felder: { letzteMeldungAm: jetzt } },
  }
}

// ------------------------------------------------------------- Stunden (Kolonnenzeile)

// Deterministische Kennung (Plan 4.2): der letzte gewinnt BEWUSST und
// SICHTBAR ("zuletzt geändert 16:20 · Samir") – set() statt add().
export function stundenId(userId, datum, projektId, art) {
  return `std-${userId}-${datum}-${projektId}-${art || 'auftrag'}`
}

// "07:00" -> Minuten. Ganzzahlig – Fliesskomma hat hier nichts verloren.
export function minutenVon(hhmm) {
  const teile = String(hhmm || '').split(':')
  if (teile.length !== 2) return 0
  return (parseInt(teile[0], 10) || 0) * 60 + (parseInt(teile[1], 10) || 0)
}

export function zeitText(minuten) {
  const m = Math.max(0, Math.round(minuten))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// Arbeitsstunden aus Von/Bis/Pause, auf 2 Nachkommastellen (8,5 h usw.).
export function stundenAus(von, bis, pauseMin = 0) {
  const minuten = minutenVon(bis) - minutenVon(von) - (parseZahl(pauseMin) || 0)
  if (minuten <= 0) return 0
  return Math.round((minuten / 60) * 100) / 100
}

// Der Pflichttext nach § 15 Abs. 3 VOB/B, erzeugt aus den heute gemeldeten
// Schritten. DEUTSCH und ohne t(): der Text landet auf dem Stundenzettel-PDF
// (Empfaenger: Auftraggeber, Lohnbuero, ggf. Gericht – Hausregel).
export function taetigkeitAusAufgaben(aufgaben, datum) {
  const heutige = (Array.isArray(aufgaben) ? aufgaben : []).filter((a) => a.status === 'laeuft'
    || (istFertigStatus(a.status) && a.fertigAm && isoVonMs(a.fertigAm) === datum))
  const jeSchritt = new Map()
  for (const a of heutige) {
    if (!jeSchritt.has(a.schrittId)) {
      jeSchritt.set(a.schrittId, { name: a.schrittNameDe || a.schrittId, sort: parseZahl(a.schrittSort), raeume: [] })
    }
    jeSchritt.get(a.schrittId).raeume.push(a.raumNummer || a.raumName || a.raumId)
  }
  return [...jeSchritt.values()]
    .sort((a, b) => a.sort - b.sort)
    .map((s) => {
      const raeume = [...new Set(s.raeume)].sort((a, b) => String(a).localeCompare(String(b), 'de', { numeric: true }))
      return `${s.name}: ${raeume.length === 1 ? 'Raum' : 'Räume'} ${raeume.join(', ')}`
    })
    .join(' · ')
}

// Eine Stundenzeile fuer store.add (set()-Verhalten: gleiche Kennung wird
// ersetzt, nie verdoppelt). satzCent als GANZZAHL-Schnappschuss.
export function stundenZeile({ mitglied, datum, projektId, einsatzId = '', teamId = '', von, bis, pauseMin = 0, art = 'auftrag', taetigkeit = '', anordnungId = '', geaendertVon = '', jetzt = Date.now() }) {
  const userId = mitglied?.id || mitglied?.userId || ''
  return {
    id: stundenId(userId, datum, projektId, art),
    projektId,
    einsatzId,
    userId,
    name: mitglied?.name || '',
    qualifikation: mitglied?.qualifikation || '',
    teamId,
    datum,
    von,
    bis,
    pauseMin: Math.round(parseZahl(pauseMin)),
    stundenGesamt: stundenAus(von, bis, pauseMin),
    satzCent: Math.round(parseZahl(mitglied?.stundensatzIntern) * 100),
    art,
    taetigkeit,
    anordnungId,
    status: 'erfasst',
    erfasstAm: jetzt,
    zuletztGeaendertVon: geaendertVon,
    zuletztGeaendertAm: jetzt,
  }
}
