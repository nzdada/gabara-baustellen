// Rechenkern des Büro-Leitstands (Plan Kapitel 3.2, AP 7) – reine Funktionen
// ohne React und ohne Store, damit alles unter node prüfbar ist.
//
// WAS HIER LIEGT
// - wochenTage / einsatzTage: die Mo–Fr-Achse der Wochentafel und die
//   Werktagsfolge eines Einsatzes (Wochenende wird übersprungen).
// - parseRaumliste: die Schnellanlage – Raumliste als Text ("1.01 Flur 24").
//   JEDE fehlerhafte Zeile wird mit Zeile, Feld und Originalwert gemeldet,
//   NIE still zu 0 gemacht (Plan AP 7: "nie still 0").
// - schnellanlageBauen: Räume + Aufgaben (Schrittvorlage) als EIN Vorgang
//   für store.schreibeVorgang – inklusive EINEM aggregierten
//   Kennzahlen-Increment (aufgabenGesamt, wertGesamtCent, m2Gesamt,
//   raeumeGesamt, raeumeOhneVorher, aufgabenOhnePosition).
// - zuweisungBauen: die Wochentafel – 1 Einsatz + n Aufgaben-Patches in
//   EINEM Vorgang (Plan 3.2 "Aufgaben erteilen – ein Zug, drei Tipps").
// - zurueckweisungBauen / freigabeBauen: die Freigabe-Ansicht. Die
//   Zurückweisung bucht im SELBEN Vorgang zurück (Plan 14 #22): Aufgabe auf
//   'zurueck' (landet rot beim Monteur), Aufmaßzeile STORNIERT (nie
//   gelöscht – das Geldatom behält seine Historie), Buchung GELÖSCHT
//   (nur so ist die Nachbesserung erneut meldbar – die feste Kennung würde
//   sonst jede zweite Meldung abweisen), Kennzahlen-Gegenbuchung.
//
// GESCHRIEBEN wird woanders: store.schreibeVorgang führt das Ergebnis als
// EINEN writeBatch aus – alles oder nichts. `jetzt` ist injizierbar (Tests),
// Datum liefert der Aufrufer über heuteISO().

import { parseZahl } from './format.js'
import { addTage } from './slots.js'
import {
  neueAufgabenFuerRaum, aufmasszeilenId, buchungsId, istQuadratmeter,
} from './aufgaben.js'
import { istFertigStatus } from './monteurtag.js'

// ------------------------------------------------------------- Wochenachse

function alsDatum(iso) {
  return new Date(`${iso}T12:00:00`)
}

// Mo–Fr der Woche, in der `heute` liegt. Am Wochenende zeigt die Tafel die
// KOMMENDE Woche – Samstagabend plant niemand rückwirkend.
export function wochenTage(heute) {
  const d = alsDatum(heute)
  const wt = d.getDay() // 0 = So, 6 = Sa
  let montagVersatz
  if (wt === 0) montagVersatz = 1
  else if (wt === 6) montagVersatz = 2
  else montagVersatz = 1 - wt
  const montag = addTage(heute, montagVersatz)
  return [0, 1, 2, 3, 4].map((i) => addTage(montag, i))
}

// `dauer` WERKTAGE ab startTag (Sa/So werden übersprungen) – die tage[] des
// Einsatzes. Ein Einsatz Do–Mo ist Do, Fr, Mo: drei Arbeitstage, kein Sonntag.
export function einsatzTage(startTag, dauer) {
  const raus = []
  let tag = startTag
  let schutz = 0
  while (raus.length < Math.max(1, Math.round(parseZahl(dauer) || 1)) && schutz < 30) {
    const wt = alsDatum(tag).getDay()
    if (wt !== 0 && wt !== 6) raus.push(tag)
    tag = addTage(tag, 1)
    schutz += 1
  }
  return raus
}

// ------------------------------------------------------------- Kennungen

function slug(text) {
  return String(text || '').trim().replace(/\//g, '-').replace(/\s+/g, '_')
}

// Deterministisch: derselbe Zug (Team, erster Tag, Baustelle) trifft dieselbe
// Kennung – ein Doppelklick auf ZUWEISEN verdoppelt nichts, er ersetzt.
export function einsatzKennung(teamId, ersterTag, projektId) {
  return `e-${slug(teamId)}-${ersterTag}-${projektId}`
}

export function raumKennung(projektId, nummer) {
  return `r-${projektId}-${slug(nummer)}`
}

// ------------------------------------------------------------- Schnellanlage

// "1.01 Flur 24" je Zeile: Nummer · Name (optional) · Menge in m².
// Ein nachgestelltes m²/m2/qm wird toleriert. Rückgabe:
//   { zeilen: [{ zeile, nummer, name, menge }], fehler: [{ zeile, feld, wert }] }
// feld: 'zeile' (unlesbar) | 'menge' (keine Zahl > 0) | 'nummer' (doppelt/vorhanden).
// Eine fehlerhafte Zeile erscheint NUR in `fehler` – bei Geld und Fläche wird
// nicht geraten.
export function parseRaumliste(text, { vorhandeneNummern = [] } = {}) {
  const zeilen = []
  const fehler = []
  const gesehen = new Set(vorhandeneNummern.map((n) => String(n).trim()))
  const roh = String(text || '').split(/\r?\n/)
  for (let i = 0; i < roh.length; i++) {
    const zeileNr = i + 1
    const zeile = roh[i].trim()
    if (!zeile) continue
    let teile = zeile.split(/\s+/)
    // Einheiten-Anhängsel ("24 m²") vor der Mengenprüfung abwerfen
    if (teile.length > 1 && /^(m²|m2|qm)$/i.test(teile[teile.length - 1])) {
      teile = teile.slice(0, -1)
    }
    if (teile.length < 2) {
      fehler.push({ zeile: zeileNr, feld: 'zeile', wert: zeile })
      continue
    }
    const nummer = teile[0]
    const mengeText = teile[teile.length - 1]
    const name = teile.slice(1, -1).join(' ')
    const menge = parseZahl(mengeText)
    if (!Number.isFinite(menge) || menge <= 0) {
      fehler.push({ zeile: zeileNr, feld: 'menge', wert: mengeText })
      continue
    }
    if (gesehen.has(nummer)) {
      fehler.push({ zeile: zeileNr, feld: 'nummer', wert: nummer })
      continue
    }
    gesehen.add(nummer)
    zeilen.push({ zeile: zeileNr, nummer, name, menge: Math.round(menge * 1000) / 1000 })
  }
  return { zeilen, fehler }
}

// Das V2-Raumdokument der Schnellanlage: Menge als ausdrückliche Vorgabe
// (mengen.wanddecke), Aufmaß-Stand 'geschaetzt' – für die Rechnung gesperrt,
// bis jemand nachmisst (Plan 8.3).
export function raumDokument(projektId, zeile, { bereich = '', sort = 0, jetzt = Date.now() } = {}) {
  return {
    id: raumKennung(projektId, zeile.nummer),
    projektId,
    nummer: zeile.nummer,
    name: zeile.name || '',
    bereich,
    sort,
    art: 'raum',
    laenge: 0, breite: 0, grundflaeche: 0, umfang: 0, umfangGemessen: false,
    hoeheLicht: 0, aufbauBoden: 0, abhaengung: 0,
    mengen: { wanddecke: zeile.menge },
    oeffnungen: [],
    aufmassStand: 'geschaetzt', aufmassVon: '', aufmassAm: '',
    fotoStand: { auftragVorher: 0, auftragNachher: 0, regieVorher: 0, regieNachher: 0 },
    zustand: 'aktiv', wartetGrund: '', wartetBis: '',
    notiz: '', aktiv: true,
    erstelltAm: jetzt,
  }
}

// Räume + Aufgaben aus der Schnellanlage – als EIN Vorgang.
// positionenJeSchritt: { [schrittId]: lvPosition } – ohne Position entsteht
// die Aufgabe OHNE positionId und zählt in aufgabenOhnePosition (der
// § 2-Abs.-6-Hinweis im Band WAS HAKT lebt von genau diesem Zähler).
export function schnellanlageBauen({ projekt, zeilen, schritte, positionenJeSchritt = {}, bereich = '', sortStart = 0, jetzt = Date.now() } = {}) {
  if (!projekt?.id) throw new Error('Schnellanlage braucht eine Baustelle (projekt.id).')
  if (!Array.isArray(zeilen) || !zeilen.length) throw new Error('Keine gültige Raumzeile – nichts anzulegen.')
  if (!Array.isArray(schritte) || !schritte.length) throw new Error('Mindestens ein Arbeitsschritt muss gewählt sein.')
  const raeume = []
  const aufgaben = []
  let sort = sortStart
  for (const zeile of zeilen) {
    const raum = raumDokument(projekt.id, zeile, { bereich, sort: ++sort, jetzt })
    raeume.push(raum)
    for (const schritt of schritte) {
      aufgaben.push(...neueAufgabenFuerRaum(raum, [schritt], positionenJeSchritt[schritt.id] || null, { jetzt }))
    }
  }
  const deltas = {
    raeumeGesamt: raeume.length,
    raeumeOhneVorher: raeume.length,
    aufgabenGesamt: aufgaben.length,
    wertGesamtCent: aufgaben.reduce((s, a) => s + Math.round(parseZahl(a.wertCent)), 0),
    m2Gesamt: Math.round(aufgaben.reduce((s, a) => s + (istQuadratmeter(a.einheit) ? parseZahl(a.menge) : 0), 0) * 1000) / 1000,
  }
  const ohnePosition = aufgaben.filter((a) => !a.positionId).length
  if (ohnePosition > 0) deltas.aufgabenOhnePosition = ohnePosition
  return {
    raeume,
    aufgaben,
    kennzahlen: { projektId: projekt.id, deltas, felder: {} },
  }
}

// ------------------------------------------------------------- Wochentafel

// 1 Einsatz + n Aufgaben-Patches – EIN Vorgang (Plan 3.2 "Aufgaben erteilen").
// `kandidaten` sind die bereits GEFILTERTEN Aufgaben (Bereich + Schritte);
// fertige/abgerechnete werden hier zusätzlich abgewiesen – eine erledigte
// Aufgabe wird nie erneut zugewiesen.
export function zuweisungBauen({ projekt, teamId, teamName = '', farbe = '', mitarbeiterIds = [], tage = [], von = '07:00', bis = '16:00', titel = '', hinweis = '', kandidaten = [], jetzt = Date.now() } = {}) {
  if (!projekt?.id) throw new Error('Zuweisung braucht eine Baustelle (projekt.id).')
  if (!teamId) throw new Error('Zuweisung braucht eine Kolonne (teamId).')
  if (!Array.isArray(tage) || !tage.length) throw new Error('Zuweisung braucht mindestens einen Tag.')
  const offene = (Array.isArray(kandidaten) ? kandidaten : []).filter((a) => !istFertigStatus(a.status))
  const id = einsatzKennung(teamId, tage[0], projekt.id)
  const einsatz = {
    id,
    projektId: projekt.id,
    projektName: projekt.name || '',
    teamId,
    teamName: teamName || teamId,
    farbe,
    mitarbeiterIds,
    tage,
    von,
    bis,
    titel,
    hinweis,
    kategorie: 'umsetzung',
    aufgabenAnzahl: offene.length,
    aufgabenFertig: 0,
    googleEventIds: [],
    status: 'geplant',
    erstelltAm: jetzt,
  }
  const patches = offene.map((a) => ({
    coll: 'aufgaben',
    id: a.id,
    patch: {
      // laeuft/wartet/zurueck behalten ihren Zustand – nur Offenes wird
      // 'zugewiesen'. Die Zuweisung selbst (Team, Tage, Einsatz) bekommt jede.
      status: a.status === 'offen' ? 'zugewiesen' : a.status,
      teamId,
      teamName: teamName || teamId,
      tage,
      einsatzId: id,
      geaendertAm: jetzt,
    },
  }))
  const zusammenfassung = {
    anzahl: offene.length,
    m2: Math.round(offene.reduce((s, a) => s + (istQuadratmeter(a.einheit) ? parseZahl(a.menge) : 0), 0) * 1000) / 1000,
    wertCent: offene.reduce((s, a) => s + Math.round(parseZahl(a.wertCent)), 0),
  }
  return { einsatz, patches, zusammenfassung }
}

// ------------------------------------------------------------- Freigabe

// Zurückweisen mit Grund – der Rückweg, ohne den der Monteur das Melden
// einstellt (Plan 3.2, verbesserungen.md:39). EIN Vorgang:
//   Aufgabe -> 'zurueck' (+ Grund, landet ROT auf dem Handy)
//   Aufmaßzeile -> storniert (Storno statt Löschen – Geldatom behält Historie)
//   Buchung -> GELÖSCHT (die feste Kennung würde die Nachbesserung sonst
//              als "bereits gemeldet" abweisen; die Historie trägt die
//              stornierte Aufmaßzeile und die Aufgabe selbst)
//   Kennzahlen -> Gegenbuchung (fertig-Zähler, Wert, m², ggf. raeumeFertig)
export function zurueckweisungBauen(aufgabe, aufgabenDesRaums, { grund, userId = '', jetzt = Date.now() } = {}) {
  if (aufgabe?.status !== 'fertig') {
    throw new Error('Nur fertig gemeldete Aufgaben können zurückgewiesen werden.')
  }
  if (!String(grund || '').trim()) {
    throw new Error('Eine Zurückweisung braucht einen Grund – der Monteur muss wissen, was nachzubessern ist.')
  }
  const deltas = {
    aufgabenFertig: -1,
    aufgabenZurueck: 1,
    wertFertigCent: -Math.round(parseZahl(aufgabe.wertCent)),
  }
  if (istQuadratmeter(aufgabe.einheit)) {
    deltas.m2Fertig = -(Math.round(parseZahl(aufgabe.menge) * 1000) / 1000)
  }
  if (deltas.wertFertigCent === 0) delete deltas.wertFertigCent
  // War der Raum vor der Zurückweisung KOMPLETT fertig, verliert er den
  // Status – raeumeFertig zählt herunter (der Nenner bleibt unberührt).
  const desRaums = (Array.isArray(aufgabenDesRaums) ? aufgabenDesRaums : [])
    .filter((a) => a.raumId === aufgabe.raumId && a.projektId === aufgabe.projektId)
  if (desRaums.length && desRaums.every((a) => istFertigStatus(a.status))) {
    deltas.raeumeFertig = -1
  }
  return {
    patches: [
      {
        coll: 'aufgaben',
        id: aufgabe.id,
        patch: {
          status: 'zurueck',
          anteil: 0,
          zurueckGrund: String(grund).trim(),
          zurueckAm: jetzt,
          zurueckVon: userId,
          geaendertAm: jetzt,
        },
      },
      {
        coll: 'aufmasszeilen',
        id: aufmasszeilenId(aufgabe.id),
        patch: { storniert: true, storniertAm: jetzt, storniertVon: userId, storniertGrund: String(grund).trim() },
      },
    ],
    loesche: [
      { coll: 'buchungen', id: buchungsId(aufgabe.raumId, aufgabe.schrittId, aufgabe.art || 'auftrag') },
    ],
    kennzahlen: { projektId: aufgabe.projektId, deltas, felder: {} },
  }
}

// ------------------------------------------------------------- Fotoampel

// Ampelstufe eines Raums je Kontext (Plan 3.2, Ansicht Fotoampel):
//   'ok'          ✓ vollständig (Vorher UND Nachher da)
//   'nachherFehlt'⚠ Vorher da, Nachher fehlt – Arbeit läuft ohne Abschlussbeweis
//   'vorherFehlt' ⚠ Nachher OHNE Vorher – der schlimmste Fall: das Nachher-
//                   Bild taugt bei der Abnahme nicht als Beweis
//   'leer'        ○ nicht begonnen
// Grundlage sind NUR die Zähler raum.fotoStand – kein Foto-Vollabo.
export function fotoAmpel(fotoStand, kontext = 'auftrag') {
  const vorher = Math.round(parseZahl(fotoStand?.[`${kontext}Vorher`]))
  const nachher = Math.round(parseZahl(fotoStand?.[`${kontext}Nachher`]))
  if (vorher > 0 && nachher > 0) return 'ok'
  if (vorher > 0) return 'nachherFehlt'
  if (nachher > 0) return 'vorherFehlt'
  return 'leer'
}

// Freigeben: die Meldung ist geprüft. Kein Statuswechsel – 'fertig' bleibt
// wahr –, nur der Vermerk, der die Zeile aus der Freigabe-Liste nimmt.
export function freigabeBauen(aufgabe, { userId = '', jetzt = Date.now() } = {}) {
  if (aufgabe?.status !== 'fertig') {
    throw new Error('Nur fertig gemeldete Aufgaben können freigegeben werden.')
  }
  return {
    patches: [{
      coll: 'aufgaben',
      id: aufgabe.id,
      patch: { freigegebenAm: jetzt, freigegebenVon: userId, geaendertAm: jetzt },
    }],
  }
}
