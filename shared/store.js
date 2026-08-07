// ============================================================
// Zentrale Datenhaltung mit zwei Modi:
//  - 'lokal'   : localStorage + BroadcastChannel
//                (Demo ohne Firebase; Live-Updates zwischen Tabs eines Geräts)
//  - 'firebase': Firestore in europe-west3
//                (Live-Updates zwischen ALLEN Geräten – Tablet, Handy, PC)
// Beide Modi bieten dieselbe API, die Apps merken keinen Unterschied.
// ============================================================

import { FIREBASE_CONFIG } from './firebase-config.js'
import { erzeugeDemoDaten } from './demoData.js'
import { alleEntwuerfeLoeschen } from './entwurf.js'
import { normalisiereFenster } from './slots.js'

// Öffnungszeiten-Dokument (settings/oeffnungszeiten) in kanonischer Form:
// { fenster: {1..6: [{von,bis}]}, telefon: [Wochentage, die ohne Fenster
//   telefonisch erreichbar sind] } – oder null, wenn nichts konfiguriert ist.
function oeffnungszeitenDoc(roh) {
  if (!roh?.fenster) return null
  return { fenster: normalisiereFenster(roh.fenster), telefon: roh.telefon || [5], urlaub: roh.urlaub || [] }
}

// patients:     Kunden-Spiegel (FastBill führend; UI-Label "Kunden")
// appointments: Termine/Arbeitsaufträge (UI-Label "Termine/Einsätze")
// requests:     Anfragen von der öffentlichen Webseite
// photos:       Baustellenfotos als komprimierte Daten-URLs (je Foto ein Dokument, <1 MB,
//               phase: 'vorher'|'nachher'|'beleg'|'sonstig', Bezug über projektId/berichtId)
// katalog:      Artikel-/Dienstleistungs-Spiegel (FastBill führend)
// bausteine:    Textbausteine (z. B. §13b-Block)
// users:        Mitarbeiter/Logins {email, name, rolle:'admin'|'mitarbeiter', farbe, aktiv}
// projekte:     Baustellen mit Status-Pipeline (shared/projektstatus.js)
// lvpositionen: LV-Positionen, EIN Dokument je Position (projektId, oz, menge, ep, istMenge, ...)
// berichte:     Regieberichte/Reklamationen/Abnahmen (typ, status entwurf->eingereicht->freigegeben->abgerechnet)
// spesen:       Hotel-/Fahrtkosten der Monteure
// rechnungen:   Spiegel der FastBill-Rechnungen (fastbillInvoiceId, status, Positionen)
// apilog:       Protokoll der FastBill-API-Aufrufe (simuliert/ok/fehler)
// settings:     globale Einstellungen ('global', 'pausen', 'oeffnungszeiten', 'nummernkreis')
//               -> wird als GANZE Liste gelesen, darf deshalb nichts Geheimes enthalten
// integrationen: Zugangsdaten (Dokument 'fastbill') – eigene Sammlung mit eigener,
//               strengerer Regel, damit settings als Liste lesbar bleibt
// Jede Sammlung hier braucht eine passende Regel in firestore.rules – sonst
// greift die Catch-all-Regel und JEDER Zugriff scheitert mit
// "Missing or insufficient permissions". Das trifft auch resetDemo, das alle
// Sammlungen der Reihe nach liest.
// 'plaene' und 'feedback' standen hier als Reste der Ursprungs-Vorlage und
// wurden nirgends verwendet – entfernt am 01.08.2026.
// raumsoll:   Sollmenge je Raum UND LV-Position – die Bruecke zwischen beiden.
//             Quadratmeter kommen aus dem Raum, der Preis aus dem LV.
// raeume:     Raeume/Bereiche einer Baustelle (Grundriss). Ein Maler arbeitet
//             raumweise; leistungen.raumId zeigt hierher.
// leistungen: Tagesprotokoll der gemeldeten Mengen (eine Zeile je Meldung).
//             lvpositionen.istMenge bleibt und wird daraus fortgeschrieben –
//             siehe shared/leistungen.js.
const COLLECTIONS = [
  'patients', 'appointments', 'requests', 'photos', 'katalog', 'bausteine', 'settings',
  'users', 'projekte', 'lvpositionen', 'berichte', 'spesen', 'rechnungen', 'apilog',
  'integrationen', 'leistungen', 'raeume', 'raumsoll',
  // --- V2 (Umbau nach Plan vom 07.08.2026). Jede neue Sammlung braucht
  // FÜNF Eintragungen: Regel in firestore.rules VOR der Sperr-Regel, diesen
  // Eintrag hier, Demodaten in demoData.js, Anhang-Löschung in Projekte.jsx
  // (ANHAENGE) und – bei zusammengesetzten Abfragen – einen Verbundindex in
  // firestore.indexes.json. Fehlt eine, scheitert es STILL.
  'aufgaben',         // Raum × Arbeitsschritt – die Arbeitseinheit
  'einsaetze',        // Kolonne × Baustelle × tage[] – die einzige Zuweisung
  'buchungen',        // Idempotenzschutz je Meldung, update NIE erlaubt
  'arbeitsschritte',  // Stammdaten je Betrieb, zweisprachig DE/AR
  'aufmasszeilen',    // das Geldatom: Ansatz-Formeltext + abgerechnetIn
  'regieanordnungen', // Anordnung + Anerkennungsuhr (§ 15 Abs. 3 VOB/B)
  'fotos',            // V2-Fotos: nur Verweise auf Storage, nie dataUrl
  'stunden',          // je Person und Tag, art auftrag|regie
  'einbehalte',       // Sicherheitseinbehalte mit Fälligkeit
  'abwesenheiten',    // Urlaub/Krank für die Wochentafel
  'geraete',          // Lebenszeichen je Handy (wartende Fotos)
  'pruefspur',        // wer hat wann was geändert – nie löschen
  'tagesstand',       // EIN Dokument je Tag (Nachtlauf, Archiv)
  'rechnungslaeufe',  // macht den Rechnungslauf wiederaufnehmbar
]

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ---------- Lokaler Modus ----------

const LS_KEY = 'gabara-baustellen-demo-db'

function lokalLaden() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* zerstörte Daten -> neu seeden */ }
  return null
}

function lokalerStore() {
  let db = lokalLaden()
  if (!db) {
    db = { ...erzeugeDemoDaten(), seededAt: new Date().toISOString() }
    localStorage.setItem(LS_KEY, JSON.stringify(db))
  }
  const listener = Object.fromEntries(COLLECTIONS.map((c) => [c, new Set()]))
  for (const coll of COLLECTIONS) if (!db[coll]) db[coll] = []
  // Katalog + Textbausteine nachrüsten, falls die Demo-DB älter ist
  if (db.katalog.length === 0 || db.bausteine.length === 0) {
    const frisch = erzeugeDemoDaten()
    if (db.katalog.length === 0) db.katalog = frisch.katalog
    if (db.bausteine.length === 0) db.bausteine = frisch.bausteine
  }
  const kanal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(LS_KEY) : null

  let quotaGemeldet = false
  function speichern() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db))
    } catch (e) {
      // Browser-Speicher voll (typisch: viele Foto-Daten-URLs im Lokal-Modus).
      // Laut melden statt still Daten verlieren – und den Fehler weiterreichen,
      // damit Formulare ihn anzeigen können.
      if (!quotaGemeldet) {
        quotaGemeldet = true
        alert('Browser-Speicher ist voll – Änderungen können NICHT gespeichert werden!\nBitte alte Fotos/Berichte löschen oder auf den Firebase-Modus umstellen.')
      }
      throw new Error('Browser-Speicher voll – Änderung wurde nicht gespeichert.')
    }
    if (kanal) kanal.postMessage({ type: 'changed' })
    COLLECTIONS.forEach(benachrichtigen)
  }

  function benachrichtigen(coll) {
    listener[coll].forEach((cb) => cb([...db[coll]]))
  }

  function neuLaden() {
    const neu = lokalLaden()
    if (neu) {
      db = neu
      COLLECTIONS.forEach(benachrichtigen)
    }
  }

  if (kanal) kanal.onmessage = neuLaden
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => { if (e.key === LS_KEY) neuLaden() })
  }

  return {
    mode: 'lokal',
    async init() {},
    subscribe(coll, cb) {
      listener[coll].add(cb)
      cb([...db[coll]])
      return () => listener[coll].delete(cb)
    },
    // Gefiltertes Live-Abo (z. B. nur Fotos eines Berichts) – vermeidet Vollabos
    // großer Collections. Gleiche API wie im Firebase-Modus (dort echte where-Query).
    subscribeWhere(coll, feld, wert, cb) {
      const gefiltert = (rows) => cb(rows.filter((r) => r[feld] === wert))
      listener[coll].add(gefiltert)
      gefiltert([...db[coll]])
      return () => listener[coll].delete(gefiltert)
    },
    async list(coll) {
      return [...db[coll]]
    },
    // EIN Dokument gezielt lesen. Wichtig für Sammlungen, die als Ganzes nicht
    // gelesen werden dürfen (z. B. Zugangsdaten): ein get auf ein bekanntes
    // Dokument erlaubt Firestore auch dann, wenn die Liste gesperrt ist.
    async get(coll, id) {
      return db[coll].find((d) => d.id === id) || null
    },
    // Einmaliger gefilterter Zugriff (kein Abo) – z. B. Fotos EINES Berichts
    // für den PDF-Druck, ohne die ganze Collection dauerhaft zu abonnieren.
    async listWhere(coll, feld, wert) {
      return db[coll].filter((d) => d[feld] === wert)
    },
    async add(coll, data) {
      const id = data.id || uuid()
      // Upsert wie im Firebase-Modus (setDoc): existiert die id schon, wird
      // ERSETZT statt angehängt – sonst entstehen Duplikate (z. B. Bericht
      // erst als Foto-Entwurf angelegt, dann eingereicht).
      const vorhanden = db[coll].some((d) => d.id === id)
      db[coll] = vorhanden
        ? db[coll].map((d) => (d.id === id ? { ...data, id } : d))
        : [...db[coll], { ...data, id }]
      speichern()
      return id
    },
    // Viele Dokumente in EINEM Schreibvorgang (LV-Import, Massen-Import):
    // sonst wird im Lokal-Modus je Zeile die komplette DB serialisiert (O(n²)).
    async addMany(coll, rows) {
      const ids = []
      for (const data of rows) {
        const id = data.id || uuid()
        ids.push(id)
        const vorhanden = db[coll].some((d) => d.id === id)
        db[coll] = vorhanden
          ? db[coll].map((d) => (d.id === id ? { ...data, id } : d))
          : [...db[coll], { ...data, id }]
      }
      speichern()
      return ids
    },
    async update(coll, id, patch) {
      db[coll] = db[coll].map((d) => (d.id === id ? { ...d, ...patch } : d))
      speichern()
    },
    // Zahlenfelder um einen Betrag VERSCHIEBEN statt zu setzen. Gleiche Signatur
    // wie im Firebase-Modus; dort ist es serverseitig atomar, hier reicht
    // Lesen-Rechnen-Schreiben, weil im lokalen Modus nur ein Gerät schreibt.
    async updateInkrement(coll, id, deltas, felder = {}) {
      db[coll] = db[coll].map((d) => {
        if (d.id !== id) return d
        const neu = { ...d, ...felder }
        for (const [feld, betrag] of Object.entries(deltas)) {
          const summe = (Number(d[feld]) || 0) + (Number(betrag) || 0)
          neu[feld] = Math.round(summe * 1000) / 1000
        }
        return neu
      })
      speichern()
    },
    async meldeLeistungen(zeilen, { istFelder = {}, altbestand = [] } = {}) {
      const ids = []
      for (const z of altbestand) {
        db.leistungen = [...db.leistungen, { ...z, id: z.id || uuid() }]
      }
      for (const z of zeilen) {
        const id = z.id || uuid()
        ids.push(id)
        db.leistungen = [...db.leistungen, { ...z, id }]
        db.lvpositionen = db.lvpositionen.map((p) => {
          if (p.id !== z.positionId) return p
          const summe = (Number(p.istMenge) || 0) + (Number(z.menge) || 0)
          return { ...p, ...istFelder, istMenge: Math.round(summe * 1000) / 1000 }
        })
      }
      speichern()
      return { ids, bestaetigt: true }
    },
    async storniereLeistung(zeile, { von = '' } = {}) {
      db.leistungen = db.leistungen.map((l) => (l.id === zeile.id
        ? { ...l, storniert: true, storniertAm: Date.now(), storniertVon: von } : l))
      db.lvpositionen = db.lvpositionen.map((p) => {
        if (p.id !== zeile.positionId) return p
        const summe = (Number(p.istMenge) || 0) - (Number(zeile.menge) || 0)
        return { ...p, istMenge: Math.round(summe * 1000) / 1000, istAktualisiertAm: Date.now() }
      })
      speichern()
    },
    // Gegenstueck im lokalen Betrieb. Ein Browser-Vorgang laeuft ohnehin ohne
    // Unterbrechung durch; die gleiche Schnittstelle haelt beide Betriebsarten
    // deckungsgleich, damit der Aufrufer nicht unterscheiden muss.
    async speichereRechnung(rechnung, { lvDeltas = [], berichtIds = [], spesenIds = [] } = {}) {
      await this.add('rechnungen', rechnung)
      for (const d of lvDeltas) await this.updateInkrement('lvpositionen', d.id, { abgerechnetMenge: d.menge })
      for (const bid of berichtIds) await this.update('berichte', bid, { status: 'abgerechnet' })
      for (const sid of spesenIds) await this.update('spesen', sid, { status: 'erstattet' })
      return rechnung.id
    },
    async remove(coll, id) {
      db[coll] = db[coll].filter((d) => d.id !== id)
      speichern()
    },
    // Mehrere Dokumente auf einmal löschen (Projekt inkl. Anhängen)
    async removeMany(coll, ids) {
      const weg = new Set(ids)
      db[coll] = db[coll].filter((d) => !weg.has(d.id))
      speichern()
    },
    // Fortlaufende Nummer aus settings/nummernkreis ziehen (feld: 'bericht'|'rechnung').
    // Lokal genügt Lesen+Schreiben – ein Browser-Tab arbeitet single-threaded und
    // der BroadcastChannel synchronisiert erst nach dem Speichern.
    async naechsteNummer(feld) {
      const jahr = new Date().getFullYear()
      const vorhanden = db.settings.find((s) => s.id === 'nummernkreis')
      const kreis = vorhanden?.[feld]?.jahr === jahr ? vorhanden[feld] : { jahr, laufend: 0 }
      const laufend = (kreis.laufend || 0) + 1
      const neu = { ...(vorhanden || {}), id: 'nummernkreis', [feld]: { jahr, laufend } }
      db.settings = vorhanden
        ? db.settings.map((s) => (s.id === 'nummernkreis' ? neu : s))
        : [...db.settings, neu]
      speichern()
      return { jahr, laufend }
    },
    // Belegte Zeitfenster für die öffentliche Buchung (KEINE Patientendaten):
    // bestätigte/angefragte Termine + offene Web-Anfragen
    subscribeSlots(cb) {
      const berechne = () => {
        const ausTerminen = db.appointments
          .filter((t) => t.status !== 'abgesagt')
          .map((t) => ({ datum: t.datum, start: t.start, ende: t.ende }))
        const ausAnfragen = db.requests
          .filter((r) => r.status === 'neu' && r.datum && r.start)
          .map((r) => ({ datum: r.datum, start: r.start, ende: endeAus(r.start, r.dauer || 30) }))
        cb([...ausTerminen, ...ausAnfragen])
      }
      const u1 = this.subscribe('appointments', berechne)
      const u2 = this.subscribe('requests', berechne)
      return () => { u1(); u2() }
    },
    async addPublicRequest(data) {
      return this.add('requests', { ...data, status: 'neu', createdAt: Date.now() })
    },
    // Wiederkehrende Pausen/Abwesenheiten (settings/pausen) – öffentlich lesbar
    subscribePausen(cb) {
      return this.subscribe('settings', (rows) => {
        const doc = rows.find((r) => r.id === 'pausen')
        cb(doc?.eintraege || [])
      })
    },
    // Konfigurierbare Öffnungszeiten (settings/oeffnungszeiten) – öffentlich lesbar
    subscribeOeffnungszeiten(cb) {
      return this.subscribe('settings', (rows) => {
        cb(oeffnungszeitenDoc(rows.find((r) => r.id === 'oeffnungszeiten')))
      })
    },
    async ladeOeffnungszeiten() {
      return oeffnungszeitenDoc(db.settings.find((r) => r.id === 'oeffnungszeiten'))
    },
    // Gleiche Signatur wie in der Firebase-Variante, damit der Aufrufer
    // nicht zwischen den Modi unterscheiden muss.
    async resetDemo({ nurWennLeer = false, mitDemodaten = true } = {}) {
      const belegt = COLLECTIONS.reduce((s, c) => s + (db[c]?.length || 0), 0)
      if (nurWennLeer && belegt > 0) {
        throw new Error(`Die Datenbank ist nicht leer (${belegt} Dokumente). Abgebrochen, es wurde nichts geändert.`)
      }
      // mitDemodaten=false: nur leeren. Fuer den Uebergang vom Ausprobieren in
      // den echten Betrieb – sonst holt man sich die Beispielbaustellen mit
      // jedem Zuruecksetzen wieder ins Haus.
      const leer = Object.fromEntries(COLLECTIONS.map((c) => [c, []]))
      // Wie in der Firebase-Variante: der FastBill-Zugang ueberlebt beides.
      const zugang = db.integrationen || []
      db = mitDemodaten
        ? { ...erzeugeDemoDaten(), integrationen: zugang, seededAt: new Date().toISOString() }
        : { ...leer, integrationen: zugang, seededAt: new Date().toISOString() }
      // Formular-Entwürfe gehören zu den alten Daten – sonst bietet die App
      // nach dem Zurücksetzen Entwürfe zu Projekten an, die es nicht mehr gibt
      alleEntwuerfeLoeschen()
      speichern()
      return { geloescht: belegt, geschrieben: COLLECTIONS.reduce((s, c) => s + (db[c]?.length || 0), 0) }
    },
  }
}

function endeAus(start, dauer) {
  const [h, m] = start.split(':').map(Number)
  const gesamt = h * 60 + m + dauer
  return `${String(Math.floor(gesamt / 60)).padStart(2, '0')}:${String(gesamt % 60).padStart(2, '0')}`
}

// ---------- Firebase-Modus ----------

async function firebaseStore() {
  const { initializeApp } = await import('firebase/app')
  const {
    initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, doc, onSnapshot, getDocs, getDoc,
    addDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, where, runTransaction, increment,
  } = await import('firebase/firestore')

  const app = initializeApp(FIREBASE_CONFIG)
  // Offline-Persistenz (IndexedDB): Schreibvorgänge werden bei Verbindungsabbruch
  // in eine Queue gestellt und automatisch nachgereicht – wichtig für Baustellen.
  const dbf = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })

  const mapSnap = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  return {
    mode: 'firebase',
    app,
    async init() {},
    subscribe(coll, cb) {
      return onSnapshot(collection(dbf, coll), (snap) => cb(mapSnap(snap)))
    },
    // Gefiltertes Live-Abo per Firestore-Query (lädt nur passende Dokumente)
    subscribeWhere(coll, feld, wert, cb) {
      return onSnapshot(query(collection(dbf, coll), where(feld, '==', wert)), (snap) => cb(mapSnap(snap)))
    },
    async list(coll) {
      return mapSnap(await getDocs(collection(dbf, coll)))
    },
    async get(coll, id) {
      const snap = await getDoc(doc(dbf, coll, id))
      return snap.exists() ? { id: snap.id, ...snap.data() } : null
    },
    // Einmalige where-Query (kein Abo) – spart bei großen Collections wie
    // 'photos' sehr viele Lesevorgänge gegenüber einem Vollabo.
    async listWhere(coll, feld, wert) {
      return mapSnap(await getDocs(query(collection(dbf, coll), where(feld, '==', wert))))
    },
    async add(coll, data) {
      if (data.id) {
        await setDoc(doc(dbf, coll, data.id), data)
        return data.id
      }
      const ref = await addDoc(collection(dbf, coll), data)
      return ref.id
    },
    // Massen-Anlage per writeBatch (max. 500 Schreibvorgänge je Batch)
    async addMany(coll, rows) {
      const ids = []
      for (let i = 0; i < rows.length; i += 400) {
        const teil = rows.slice(i, i + 400)
        const batch = writeBatch(dbf)
        for (const data of teil) {
          const ref = data.id ? doc(dbf, coll, data.id) : doc(collection(dbf, coll))
          batch.set(ref, data)
          ids.push(ref.id)
        }
        await batch.commit()
      }
      return ids
    },
    async update(coll, id, patch) {
      await updateDoc(doc(dbf, coll, id), patch)
    },
    // Zahlenfelder VERSCHIEBEN statt setzen – der entscheidende Unterschied bei
    // gemeldeten Mengen: increment() wird auf dem SERVER angewandt, nicht auf
    // einem gelesenen Zwischenstand. Melden zwei Monteure gleichzeitig 120 und
    // 80, steht danach +200 in der Datenbank. Mit Lesen-Rechnen-Schreiben wäre
    // eine der beiden Meldungen still verschwunden.
    // Zudem funktioniert increment() OFFLINE: die Änderung wird als Delta in
    // die Warteschlange gelegt und beim nächsten Netz sauber eingerechnet.
    // runTransaction kann das nicht – Transaktionen brauchen Verbindung.
    async updateInkrement(coll, id, deltas, felder = {}) {
      const patch = { ...felder }
      for (const [feld, betrag] of Object.entries(deltas)) {
        patch[feld] = increment(Number(betrag) || 0)
      }
      await updateDoc(doc(dbf, coll, id), patch)
    },
    // Mehrere Leistungsmeldungen in EINEM atomaren Vorgang: je Meldung eine
    // Zeile in 'leistungen' UND die passende Fortschreibung von istMenge.
    //
    // WARUM ATOMAR: In einer Schleife mit einzelnen Schreibvorgaengen bleibt bei
    // einem Abbruch nach Position 1 von 3 ein halber Zustand stehen. Der Monteur
    // sieht nur einen Fehler, drueckt erneut auf Melden - und Position 1 wird ein
    // ZWEITES Mal gebucht. istMenge und Meldungssumme sind dann beide doppelt,
    // also konsistent falsch: die Abweichungspruefung findet nichts, fakturiert
    // wird die doppelte Menge.
    //
    // WARUM OHNE await AUF DEN SERVER: commit() loest erst auf, wenn der Server
    // bestaetigt hat. Im Funkloch - auf der Baustelle der Normalfall - bliebe der
    // Aufruf haengen, der Knopf drehte endlos, und der Monteur tippt alles neu.
    // Firestore schreibt aber sofort in den lokalen Zwischenspeicher, die
    // Oberflaeche aktualisiert sich also augenblicklich, und der Vorgang geht beim
    // naechsten Netz raus. Deshalb: hoechstens fristMs auf die Bestaetigung
    // warten, Fehler getrennt melden.
    // `altbestand`: Zeilen, die NUR ins Protokoll gehoeren, ohne istMenge zu
    // veraendern. Damit laesst sich eine Position, die bisher nur einen
    // Gesamtwert hatte, beim ersten Melden nachtraeglich belegen - sonst meldete
    // die Abweichungspruefung sofort eine Luecke in Hoehe des Altbestands.
    async meldeLeistungen(zeilen, { istFelder = {}, altbestand = [], fristMs = 2500, onFehler } = {}) {
      if (!zeilen.length && !altbestand.length) return { ids: [], bestaetigt: false }
      const batch = writeBatch(dbf)
      const ids = []
      for (const z of altbestand) {
        const { id, ...felder } = z
        batch.set(id ? doc(dbf, 'leistungen', id) : doc(collection(dbf, 'leistungen')), felder)
      }
      for (const z of zeilen) {
        const { id, ...felder } = z
        const ref = id ? doc(dbf, 'leistungen', id) : doc(collection(dbf, 'leistungen'))
        batch.set(ref, felder)
        batch.update(doc(dbf, 'lvpositionen', z.positionId), {
          istMenge: increment(Number(z.menge) || 0),
          ...istFelder,
        })
        ids.push(ref.id)
      }
      const lauf = batch.commit()
      lauf.catch((e) => onFehler?.(e))
      const bestaetigt = await Promise.race([
        lauf.then(() => true, () => false),
        new Promise((auf) => setTimeout(() => auf(false), fristMs)),
      ])
      return { ids, bestaetigt }
    },
    // Gegenstueck: eine Meldung stornieren und den Betrag zurueckrechnen -
    // ebenfalls in einem Vorgang, damit kein halber Storno stehen bleibt.
    async storniereLeistung(zeile, { von = '', onFehler } = {}) {
      const batch = writeBatch(dbf)
      batch.update(doc(dbf, 'leistungen', zeile.id), {
        storniert: true, storniertAm: Date.now(), storniertVon: von,
      })
      batch.update(doc(dbf, 'lvpositionen', zeile.positionId), {
        istMenge: increment(-(Number(zeile.menge) || 0)),
        istAktualisiertAm: Date.now(),
      })
      const lauf = batch.commit()
      lauf.catch((e) => onFehler?.(e))
      await Promise.race([lauf.catch(() => {}), new Promise((auf) => setTimeout(auf, 2500))])
    },
    // Eine Rechnung ANLEGEN und alle Quellen in EINEM Vorgang fortschreiben.
    //
    // WARUM ATOMAR - hier haengt Geld dran:
    // Die alte Schleife schrieb erst die Rechnung, dann Position fuer Position
    // abgerechnetMenge hoch, dann die Berichte. Brach sie in der Mitte ab, war die
    // Rechnung da, ein Teil der Positionen hochgezaehlt, der Rest nicht. Ein
    // zweiter Versuch zaehlte die ersten Positionen ein ZWEITES Mal hoch - sie
    // galten dann als ueberabgerechnet, der Rest blieb unfakturierbar.
    // Entweder alles oder nichts.
    async speichereRechnung(rechnung, { lvDeltas = [], berichtIds = [], spesenIds = [] } = {}) {
      const batch = writeBatch(dbf)
      const { id, ...felder } = rechnung
      batch.set(doc(dbf, 'rechnungen', id), felder)
      for (const d of lvDeltas) {
        batch.update(doc(dbf, 'lvpositionen', d.id), {
          abgerechnetMenge: increment(Number(d.menge) || 0),
        })
      }
      for (const bid of berichtIds) batch.update(doc(dbf, 'berichte', bid), { status: 'abgerechnet' })
      for (const sid of spesenIds) batch.update(doc(dbf, 'spesen', sid), { status: 'erstattet' })
      await batch.commit()
      return id
    },
    async remove(coll, id) {
      await deleteDoc(doc(dbf, coll, id))
    },
    async removeMany(coll, ids) {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(dbf)
        ids.slice(i, i + 400).forEach((id) => batch.delete(doc(dbf, coll, id)))
        await batch.commit()
      }
    },
    // Fortlaufende Nummer ATOMAR ziehen (feld: 'bericht'|'rechnung').
    // runTransaction verhindert doppelte Berichtsnummern, wenn zwei Monteure
    // gleichzeitig einreichen – bei gerichtsfesten Stundennachweisen entscheidend.
    // Firestore wiederholt die Transaktion bei Konflikt automatisch.
    async naechsteNummer(feld) {
      const ref = doc(dbf, 'settings', 'nummernkreis')
      return runTransaction(dbf, async (tx) => {
        const snap = await tx.get(ref)
        const daten = snap.exists() ? snap.data() : {}
        const jahr = new Date().getFullYear()
        const kreis = daten?.[feld]?.jahr === jahr ? daten[feld] : { jahr, laufend: 0 }
        const laufend = (kreis.laufend || 0) + 1
        tx.set(ref, { [feld]: { jahr, laufend } }, { merge: true })
        return { jahr, laufend }
      })
    },
    // Öffentliche Slots-Sammlung: enthält nur Datum/Uhrzeit, öffentlich lesbar
    subscribeSlots(cb) {
      return onSnapshot(collection(dbf, 'slots'), (snap) => cb(mapSnap(snap)))
    },
    // Wiederkehrende Pausen (settings/pausen): einziges settings-Dokument mit
    // öffentlichem Lesezugriff -> anonyme Buchung kann Pausenzeiten ausblenden
    subscribePausen(cb) {
      // Fehler (z. B. Regeln nicht deployt) nicht verschlucken: leerer Fallback + Log
      return onSnapshot(doc(dbf, 'settings', 'pausen'),
        (snap) => cb(snap.data()?.eintraege || []),
        (err) => { console.warn('Pausen nicht lesbar:', err.code); cb([]) })
    },
    subscribeOeffnungszeiten(cb) {
      return onSnapshot(doc(dbf, 'settings', 'oeffnungszeiten'),
        (snap) => cb(oeffnungszeitenDoc(snap.data())),
        (err) => { console.warn('Öffnungszeiten nicht lesbar:', err.code); cb(null) })
    },
    async ladeOeffnungszeiten() {
      try {
        const snap = await getDoc(doc(dbf, 'settings', 'oeffnungszeiten'))
        return oeffnungszeitenDoc(snap.data())
      } catch (e) {
        return null
      }
    },
    async addPublicRequest(data) {
      const anfrage = { ...data, status: 'neu', createdAt: Date.now() }
      const ref = await addDoc(collection(dbf, 'requests'), anfrage)
      // Slot sofort als angefragt reservieren (nur Zeiten, keine Kundendaten!).
      // Darf die Anfrage selbst nicht gefährden – sie ist der eigentliche Zweck.
      if (data.datum && data.start) {
        try {
          await addDoc(collection(dbf, 'slots'), {
            datum: data.datum,
            start: data.start,
            ende: endeAus(data.start, data.dauer || 30),
            status: 'angefragt',
          })
        } catch (e) {
          console.warn('Slot-Reservierung übersprungen:', e.code || e.message)
        }
      }
      return ref.id
    },
    // Slot-Pflege durch den Admin (bei Bestätigen/Absagen von Terminen).
    // Slots sind eine reine NEBENSACHE (öffentliche Belegtzeiten, keine Kundendaten):
    // Schlägt der Schreibvorgang fehl (z. B. Regeln noch nicht deployt), darf das
    // NIEMALS das Anlegen/Ändern des Termins selbst scheitern lassen.
    async schreibeSlot(termin) {
      if (!termin?.id || !termin.datum || !termin.start) return
      try {
        await setDoc(doc(dbf, 'slots', termin.id), {
          datum: termin.datum, start: termin.start, ende: termin.ende || termin.start, status: 'belegt',
        })
      } catch (e) {
        console.warn('Slot konnte nicht geschrieben werden:', e.code || e.message)
      }
    },
    async loescheSlot(idOderZeit) {
      try { await deleteDoc(doc(dbf, 'slots', idOderZeit)) } catch (e) { /* schon weg / keine Rechte */ }
    },
    // Datenbank leeren und die Beispieldaten einspielen.
    //
    // Ein writeBatch fasst höchstens 500 Vorgänge. Bei echtem Datenbestand
    // (Fotos, LV-Positionen, Termine eines Jahres) ist das schnell gesprengt,
    // und der ganze Vorgang scheitert mit "Transaction too big" – nachdem
    // vielleicht schon gelöscht wurde. Deshalb in Blöcken von 400 committen.
    //
    // Der Aufrufer kann eine Rückmeldung mitgeben, um den Fortschritt anzuzeigen;
    // `nurWennLeer` bricht ab, sobald irgendwo schon Daten liegen – die
    // Erstbefüllung einer Produktionsdatenbank darf niemals etwas überschreiben.
    async resetDemo({ melde = () => {}, nurWennLeer = false, behalteNutzer = null, mitDemodaten = true } = {}) {
      // mitDemodaten=false: alles loeschen, aber NICHTS neu schreiben (ausser
      // dem eigenen Konto). Damit laesst sich vom Ausprobieren in den echten
      // Betrieb wechseln, ohne die Beispielbaustellen erneut einzuschleppen.
      const demo = mitDemodaten ? erzeugeDemoDaten() : null
      // 'integrationen' bleibt AUSSEN VOR: dort liegt der FastBill-Zugang.
      // Ein Zuruecksetzen der Beispieldaten hat den frueher mit leeren Werten
      // ueberschrieben - nach jedem Demo-Reset war die Anbindung still tot.
      const ohneZugang = COLLECTIONS.filter((c) => c !== 'integrationen')
      const sammlungen = [...ohneZugang, 'slots']

      // 1. Bestand aufnehmen.
      // Fehler NAMENTLICH melden: ein blankes "Missing or insufficient
      // permissions" sagt nicht, welche Sammlung oder welcher Vorgang gescheitert
      // ist – und ohne das sucht man in 15 Sammlungen und 40 Regelzeilen.
      const vorhanden = []
      for (const coll of sammlungen) {
        try {
          const snap = await getDocs(collection(dbf, coll))
          snap.docs.forEach((d) => vorhanden.push(d.ref))
        } catch (e) {
          throw new Error(`Lesen von "${coll}" nicht erlaubt: ${e.message}`)
        }
      }
      if (nurWennLeer && vorhanden.length > 0) {
        throw new Error(`Die Datenbank ist nicht leer (${vorhanden.length} Dokumente). Abgebrochen, es wurde nichts geändert.`)
      }

      // 2. Zu schreibende Dokumente sammeln.
      // Das id-Feld wird NICHT mitgeschrieben: die Identität ist die Dokument-ID,
      // beim Lesen setzt mapSnap sie ohnehin wieder ein. Wichtig ist das für
      // /requests – dort erlaubt die Regel per hasOnly nur eine feste Feldliste,
      // und ein zusätzliches id würde die ganze Erstbefüllung scheitern lassen.
      const neu = []
      if (demo) {
        for (const coll of ohneZugang) {
          for (const { id, ...felder } of demo[coll]) neu.push([doc(dbf, coll, id), felder])
        }
        for (const t of demo.appointments.filter((a) => a.status !== 'abgesagt')) {
          neu.push([doc(dbf, 'slots', t.id), { datum: t.datum, start: t.start, ende: t.ende, status: 'belegt' }])
        }
      }

      // Das eigene Konto MUSS den Reset überleben.
      // Sonst gilt danach: users ist nicht leer (Demo-Mitarbeiter), aber zur
      // eigenen Auth-UID gibt es kein Dokument -> die Rolle fällt auf
      // 'mitarbeiter' zurück und wer gerade zurückgesetzt hat, sitzt in der
      // Monteur-Ansicht fest, ohne Weg zurück in die Verwaltung.
      if (behalteNutzer?.uid) {
        neu.push([doc(dbf, 'users', behalteNutzer.uid), {
          name: behalteNutzer.name || 'Büro',
          email: behalteNutzer.email || '',
          rolle: 'admin',
          team: behalteNutzer.team || 'Büro',
          farbe: behalteNutzer.farbe || '#8b1a1a',
          qualifikation: 'facharbeiter',
          stundensatzIntern: 0,
          aktiv: true,
        }])
      }

      // 3. In Blöcken abarbeiten
      const BLOCK = 400
      for (let i = 0; i < vorhanden.length; i += BLOCK) {
        const teil = vorhanden.slice(i, i + BLOCK)
        const b = writeBatch(dbf)
        teil.forEach((ref) => b.delete(ref))
        try {
          await b.commit()
        } catch (e) {
          throw new Error(`Löschen fehlgeschlagen (${teil.map((r) => r.parent.id).filter((v, j, a) => a.indexOf(v) === j).join(', ')}): ${e.message}`)
        }
        melde({ schritt: 'loeschen', fertig: Math.min(i + BLOCK, vorhanden.length), gesamt: vorhanden.length })
      }
      // Beim Schreiben einzeln committen wäre zu langsam – aber wenn ein Block
      // scheitert, sagen wir wenigstens, welche Sammlungen darin lagen.
      for (let i = 0; i < neu.length; i += BLOCK) {
        const teil = neu.slice(i, i + BLOCK)
        const b = writeBatch(dbf)
        teil.forEach(([ref, daten]) => b.set(ref, daten))
        try {
          await b.commit()
        } catch (e) {
          throw new Error(`Schreiben fehlgeschlagen (${teil.map(([r]) => r.parent.id).filter((v, j, a) => a.indexOf(v) === j).join(', ')}): ${e.message}`)
        }
        melde({ schritt: 'schreiben', fertig: Math.min(i + BLOCK, neu.length), gesamt: neu.length })
      }
      return { geloescht: vorhanden.length, geschrieben: neu.length }
    },
  }
}

// ---------- Auswahl ----------

let _store = null
let _ready = null

export function getStore() {
  if (!_ready) {
    _ready = (async () => {
      _store = FIREBASE_CONFIG.enabled ? await firebaseStore() : lokalerStore()
      await _store.init()
      return _store
    })()
  }
  return _ready
}

export function storeModus() {
  return FIREBASE_CONFIG.enabled ? 'firebase' : 'lokal'
}
