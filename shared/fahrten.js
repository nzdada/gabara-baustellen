// Fahrzeugeinsatz im Regiebericht.
//
// WOZU
// Bei Regiearbeiten wird nicht nur Zeit und Material abgerechnet, sondern auch
// die An- und Abfahrt. Der Auftraggeber verlangt dafür den Nachweis: welches
// Fahrzeug, von wo nach wo, wie viele Kilometer. Ohne Kennzeichen und Adressen
// ist eine Fahrtkostenposition im Streitfall wertlos – und für das Finanzamt
// ist ein Fahrtenbuch ohne diese Angaben kein Fahrtenbuch.
//
// FREIE FAHRTEN
// Nicht jede Fahrt wird berechnet. Eine Nachbesserung fährt der Betrieb auf
// eigene Kosten, eine Materialabholung ist oft im Preis enthalten. Trotzdem
// muss sie in den Unterlagen stehen: für das Fahrtenbuch, für die
// Nachkalkulation und um später belegen zu können, dass man da war.
// Deshalb trägt jede Fahrt ein `berechnen`-Kennzeichen. Steht es auf false,
// erscheint die Fahrt im Bericht und im Ausdruck – mit 0,00 € und dem
// ausdrücklichen Vermerk "nicht berechnet".
//
// KILOMETER
// Eingetragen wird die STRECKE, nicht der Tachostand. Der Tacho war als
// belastbarerer Nachweis gedacht, kostet auf der Baustelle aber zwei zusätzliche
// Zahlen je Fahrt – und wer sie nicht zur Hand hat, lässt die Fahrt lieber weg.
// Ältere Einträge mit Tachoständen werden weiterhin korrekt gerechnet.

// FAHRZEUG
// Das Kennzeichen wird nicht getippt, sondern aus dem Fuhrpark gewählt
// (Einstellungen -> Sätze und Fuhrpark). Frei getippte Kennzeichen liefen in
// drei Schreibweisen auseinander und machten jede Auswertung je Fahrzeug
// unmöglich.

import { parseZahl } from './format.js'

export const KM_SATZ_STANDARD = 0.5

function runde(n) {
  return Math.round(parseZahl(n) * 100) / 100
}

function uuid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function neueFahrt({ datum = '', kennzeichen = '', fahrzeug = '', fahrer = '', von = '', nach = '', km = 0, satz = KM_SATZ_STANDARD, berechnen = true } = {}) {
  return {
    id: uuid(),
    datum,
    kennzeichen: String(kennzeichen || '').toUpperCase(),
    fahrzeug,
    fahrer,
    von,
    nach,
    km: parseZahl(km),
    satz: parseZahl(satz),
    berechnen: Boolean(berechnen),
    zweck: '',
  }
}

// Gefahrene Kilometer. Die eingetragene Strecke gilt; nur bei Altbeständen,
// die noch Tachostände tragen, werden diese herangezogen.
export function kmVon(fahrt) {
  const start = parseZahl(fahrt?.kmStart)
  const ende = parseZahl(fahrt?.kmEnde)
  if (start > 0 && ende > start) return runde(ende - start)
  return runde(Math.max(0, parseZahl(fahrt?.km)))
}

// Rückwärts gezählter Tacho ist ein Tippfehler, keine Fahrt. Er wird gemeldet,
// nicht stillschweigend als 0 verrechnet – sonst fehlt die Fahrt in der
// Rechnung, ohne dass jemand merkt warum.
export function fahrtPruefung(fahrt) {
  const start = parseZahl(fahrt?.kmStart)
  const ende = parseZahl(fahrt?.kmEnde)
  const maengel = []
  if (start > 0 && ende > 0 && ende <= start) maengel.push('tacho')
  if (kmVon(fahrt) <= 0) maengel.push('kmFehlt')
  if (!String(fahrt?.kennzeichen || '').trim()) maengel.push('kennzeichen')
  if (!String(fahrt?.von || '').trim() || !String(fahrt?.nach || '').trim()) maengel.push('strecke')
  return { ok: maengel.length === 0, maengel }
}

// Ist an dieser Fahrt überhaupt schon etwas eingetragen?
//
// Eine frisch angelegte, noch leere Zeile darf nicht sofort drei Mängel melden –
// der Anwender hat ja noch gar nichts tun können. Gemeckert wird erst, wenn er
// begonnen hat.
export function fahrtBegonnen(fahrt) {
  return Boolean(
    String(fahrt?.kennzeichen || '').trim()
    || String(fahrt?.von || '').trim()
    || String(fahrt?.nach || '').trim()
    || kmVon(fahrt) > 0
  )
}

export function betragVon(fahrt) {
  if (!fahrt?.berechnen) return 0
  return runde(kmVon(fahrt) * parseZahl(fahrt?.satz))
}

// Summe über alle Fahrten eines Berichts.
// `km` sind ALLE gefahrenen Kilometer (auch die freien) – das ist die Zahl
// fürs Fahrtenbuch. `kmBerechnet` sind nur die abrechenbaren.
export function summeFahrten(fahrten) {
  let km = 0
  let kmBerechnet = 0
  let betrag = 0
  let frei = 0
  for (const f of fahrten || []) {
    const k = kmVon(f)
    km += k
    if (f.berechnen) { kmBerechnet += k; betrag += betragVon(f) } else { frei++ }
  }
  return { km: runde(km), kmBerechnet: runde(kmBerechnet), betrag: runde(betrag), frei, anzahl: (fahrten || []).length }
}

// Kennzeichen, die im Betrieb schon vorkamen – als Vorschlagsliste.
// Selbstlernend statt gepflegter Fuhrpark: Wer das zweite Mal dasselbe Fahrzeug
// einträgt, bekommt es angeboten, ohne dass jemand vorher eine Liste anlegen
// musste.
export function bekannteKennzeichen(berichte) {
  const zaehler = new Map()
  for (const b of berichte || []) {
    for (const f of b?.fahrten || []) {
      const k = String(f.kennzeichen || '').trim().toUpperCase()
      if (!k) continue
      zaehler.set(k, (zaehler.get(k) || 0) + 1)
    }
  }
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

// ---------------------------------------------------------------- Rückfahrt
//
// "Adressen und Kennzeichen müssen nur einmal eingegeben werden."
//
// Deshalb ist die Rückfahrt keine Kopie, sondern eine ABLEITUNG: Sie merkt sich
// über `ausFahrt` ihre Hinfahrt und holt sich Kennzeichen, Fahrer, Datum und
// die getauschten Adressen von dort. Wer die Hinfahrt später korrigiert, muss
// die Rückfahrt nicht nachziehen – sie kann gar nicht auseinanderlaufen.
//
// EIGEN bleiben nur die Kilometer und der Satz. Der Rückweg ist selten exakt
// gleich lang (Umleitung, Zwischenstopp), und der Tachostand ist ohnehin ein
// anderer – deshalb werden Start und Ende NICHT übernommen, sondern nur die
// Strecke als Vorschlag.
export function rueckfahrtVon(hin) {
  return {
    ...neueFahrt({
      datum: hin.datum,
      kennzeichen: hin.kennzeichen,
      fahrzeug: hin.fahrzeug,
      fahrer: hin.fahrer,
      von: hin.nach,
      nach: hin.von,
      satz: hin.satz,
      berechnen: hin.berechnen !== false,
    }),
    ausFahrt: hin.id,
    km: kmVon(hin),
  }
}

export function istRueckfahrt(f) {
  return Boolean(f?.ausFahrt)
}

// Hat eine Fahrt bereits eine Rückfahrt? Verhindert, dass derselbe Weg zweimal
// angelegt und damit doppelt berechnet wird.
export function hatRueckfahrt(fahrten, id) {
  return (fahrten || []).some((f) => f.ausFahrt === id)
}

// Die abgeleiteten Felder frisch aus der Hinfahrt ziehen.
// Wird beim Anzeigen UND beim Speichern angewandt: So steht in der Datenbank
// nie etwas anderes als auf dem Bildschirm.
export function mitAbleitung(fahrten) {
  const jeId = new Map((fahrten || []).map((f) => [f.id, f]))
  return (fahrten || []).map((f) => {
    if (!f.ausFahrt) return f
    const hin = jeId.get(f.ausFahrt)
    // Hinfahrt gelöscht: Die Rückfahrt steht dann für sich und behält, was sie
    // zuletzt hatte – sonst verlöre sie ihre Adressen und wäre wertlos.
    if (!hin) return { ...f, ausFahrt: '' }
    return {
      ...f,
      kennzeichen: hin.kennzeichen,
      fahrzeug: hin.fahrzeug,
      fahrer: hin.fahrer,
      datum: hin.datum,
      von: hin.nach,
      nach: hin.von,
    }
  })
}
