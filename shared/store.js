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
// plaene/feedback: Altlasten der Vorlage (ungenutzt, bleiben für Kompatibilität)
// settings:     globale Einstellungen (Dokumente 'global', 'pausen', 'oeffnungszeiten', 'nummernkreis', 'integrationen')
const COLLECTIONS = [
  'patients', 'appointments', 'requests', 'photos', 'katalog', 'bausteine', 'plaene', 'feedback', 'settings',
  'users', 'projekte', 'lvpositionen', 'berichte', 'spesen', 'rechnungen', 'apilog',
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
    async update(coll, id, patch) {
      db[coll] = db[coll].map((d) => (d.id === id ? { ...d, ...patch } : d))
      speichern()
    },
    async remove(coll, id) {
      db[coll] = db[coll].filter((d) => d.id !== id)
      speichern()
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
    async resetDemo() {
      db = { ...erzeugeDemoDaten(), seededAt: new Date().toISOString() }
      speichern()
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
    addDoc, setDoc, updateDoc, deleteDoc, writeBatch, query, where,
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
    async add(coll, data) {
      if (data.id) {
        await setDoc(doc(dbf, coll, data.id), data)
        return data.id
      }
      const ref = await addDoc(collection(dbf, coll), data)
      return ref.id
    },
    async update(coll, id, patch) {
      await updateDoc(doc(dbf, coll, id), patch)
    },
    async remove(coll, id) {
      await deleteDoc(doc(dbf, coll, id))
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
      // Slot sofort als angefragt reservieren (nur Zeiten, keine Patientendaten!)
      if (data.datum && data.start) {
        await addDoc(collection(dbf, 'slots'), {
          datum: data.datum,
          start: data.start,
          ende: endeAus(data.start, data.dauer || 30),
          status: 'angefragt',
        })
      }
      return ref.id
    },
    // Slot-Pflege durch den Admin (bei Bestätigen/Absagen von Terminen)
    async schreibeSlot(termin) {
      await setDoc(doc(dbf, 'slots', termin.id), {
        datum: termin.datum, start: termin.start, ende: termin.ende, status: 'belegt',
      })
    },
    async loescheSlot(idOderZeit) {
      try { await deleteDoc(doc(dbf, 'slots', idOderZeit)) } catch (e) { /* schon weg */ }
    },
    async resetDemo() {
      const demo = erzeugeDemoDaten()
      const batch = writeBatch(dbf)
      for (const coll of COLLECTIONS) {
        const alt = await getDocs(collection(dbf, coll))
        alt.docs.forEach((d) => batch.delete(d.ref))
      }
      const altSlots = await getDocs(collection(dbf, 'slots'))
      altSlots.docs.forEach((d) => batch.delete(d.ref))
      for (const coll of COLLECTIONS) {
        demo[coll].forEach((eintrag) => batch.set(doc(dbf, coll, eintrag.id), eintrag))
      }
      demo.appointments
        .filter((t) => t.status !== 'abgesagt')
        .forEach((t) => batch.set(doc(dbf, 'slots', t.id), { datum: t.datum, start: t.start, ende: t.ende, status: 'belegt' }))
      await batch.commit()
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
