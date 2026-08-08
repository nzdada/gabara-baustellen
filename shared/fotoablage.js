// ============================================================
// Die Foto-Ablage von V2 (Plan Kapitel 5, AP 6): offline ZUERST.
//
// DER WEG DES FOTOS (Plan 5.3):
//   1. EXIF-Aufnahmezeit aus den ROHBYTES lesen – VOR dem Verkleinern,
//      der Canvas verwirft sie. Fehlt sie: Gerätezeit, gekennzeichnet
//      mit aufgenommenAmQuelle:'geraet'.
//   2. Drei Größen im Browser erzeugen (shared/bild.js dreiGroessen):
//      1600 Beweis · 900 Druck · 400 Vorschau.
//   3. SHA-256 des 1600ers bilden (Beweiskette fürs Abnahmeprotokoll).
//   4. Alle drei Blobs SOFORT nach IndexedDB. Scheitert DAS, wird der
//      ganze Auslöser verweigert – LAUT, nie still verlieren.
//   5. fotos-Dokument mit status 'lokal' schreiben (NUR Verweise, nie
//      dataUrl – die Firestore-Regel erzwingt das). Das Büro sieht
//      sofort "Foto aufgenommen, lädt noch".
//   6. Die Kachel zeigt das Bild augenblicklich aus IndexedDB.
//   7. Die Warteschlange lädt im Hintergrund hoch.
//
// SPEICHERZIEL – der EINE Umschalter:
// Firebase Storage ist noch nicht eingerichtet (Blaze-Tarif nötig seit
// 03.02.2026). Bis dahin fährt die Warteschlange den RÜCKFALLWEG
// 'vorschau': die 400er-Vorschau geht als dataUrl in die photos-Sammlung
// (V1, erlaubt dataUrl < 980 KB), das Original BLEIBT in IndexedDB.
// Sobald Storage steht, wird NUR die Konstante auf 'storage' gestellt –
// dann lädt dieselbe Warteschlange die drei Blobs in die Pfade aus
// storage.rules (400 zuerst, dann 900, dann 1600) und räumt die Blobs
// nach BLOB_HALTEN_TAGE aus IndexedDB.
//
// KEIN React, KEIN Store-Import: der Store wird hereingereicht, damit
// beide Betriebsarten (lokal + Firebase) durch DENSELBEN Code laufen und
// die reinen Rechenteile unter node prüfbar sind (pruefung/fotoablage.test.mjs).
// ============================================================

import { dreiGroessen } from './bild.js'

export const SPEICHER_ZIEL = 'vorschau'   // 'vorschau' | 'storage' – der EINE Umschalter
export const BLOB_HALTEN_TAGE = 7         // gilt erst im Modus 'storage'

// Verfallsregel (Plan 5.4): Vorher-Bilder sind die einzige unwiederholbare
// Datenart – sie gehen IMMER sofort raus, auch einzeln über Mobilfunk.
// Der Rest darf sich sammeln, aber höchstens 4 Stunden oder 10 Bilder.
export const VERFALL = { stunden: 4, bilder: 10 }

const FRIST_MS = 2500        // wie store.meldeLeistungen: nie am Server hängen
const TAKT_MS = 30000        // Prüftakt der Warteschlange
const LEBENSZEICHEN_MS = 60000

// ------------------------------------------------------------- Kennungen

export function lokaleFotoId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `f-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Kennung des Vorschau-Dokuments in der photos-Sammlung (Rückfallweg).
// DETERMINISTISCH aus der Foto-Kennung: ein Wiederholungsversuch trifft
// dasselbe Dokument (Upsert) und kann nie Duplikate erzeugen.
export function vorschauPhotoId(fotoId) {
  return `pv-${fotoId}`
}

// ------------------------------------------------------------- EXIF-Zeit
//
// Minimal-Leser für die JPEG-Aufnahmezeit (Tag 0x9003 DateTimeOriginal im
// Exif-Unterverzeichnis). Bewusst nur dieser eine Wert – mehr braucht der
// Beweiszweck nicht, und jede weitere Deutung wäre ungeprüfter Ballast.
// Liefert Millisekunden LOKALER Zeit oder null.

export function exifAufnahmezeit(puffer) {
  try {
    const sicht = new DataView(puffer)
    if (sicht.byteLength < 4 || sicht.getUint16(0) !== 0xffd8) return null
    let pos = 2
    while (pos + 4 <= sicht.byteLength) {
      if (sicht.getUint8(pos) !== 0xff) return null
      const marker = sicht.getUint8(pos + 1)
      const laenge = sicht.getUint16(pos + 2)
      if (marker === 0xe1 && pos + 4 + laenge <= sicht.byteLength + 2) {
        const zeit = exifAusApp1(sicht, pos + 4, laenge - 2)
        if (zeit !== null) return zeit
      }
      if (marker === 0xda) return null   // Bilddaten beginnen – nichts gefunden
      pos += 2 + laenge
    }
    return null
  } catch (e) {
    return null
  }
}

function exifAusApp1(sicht, start, laenge) {
  // 'Exif\0\0' + TIFF-Kopf
  if (laenge < 14) return null
  if (sicht.getUint32(start) !== 0x45786966 || sicht.getUint16(start + 4) !== 0) return null
  const tiff = start + 6
  const kennung = sicht.getUint16(tiff)
  const klein = kennung === 0x4949            // 'II' = little endian, 'MM' = big
  if (!klein && kennung !== 0x4d4d) return null
  const u16 = (o) => sicht.getUint16(o, klein)
  const u32 = (o) => sicht.getUint32(o, klein)
  if (u16(tiff + 2) !== 0x002a) return null
  const ifd0 = tiff + u32(tiff + 4)
  const grenze = start + laenge

  // IFD0 nach dem Zeiger auf das Exif-Unterverzeichnis (0x8769) absuchen
  let exifIfd = 0
  const anzahl0 = u16(ifd0)
  for (let i = 0; i < anzahl0; i++) {
    const e = ifd0 + 2 + i * 12
    if (e + 12 > grenze) return null
    if (u16(e) === 0x8769) { exifIfd = tiff + u32(e + 8); break }
  }
  if (!exifIfd || exifIfd + 2 > grenze) return null

  // Im Exif-Verzeichnis: 0x9003 DateTimeOriginal (ASCII "JJJJ:MM:TT HH:MM:SS")
  const anzahl = u16(exifIfd)
  for (let i = 0; i < anzahl; i++) {
    const e = exifIfd + 2 + i * 12
    if (e + 12 > grenze) return null
    if (u16(e) !== 0x9003) continue
    const zeichen = u32(e + 4)
    const wo = zeichen <= 4 ? e + 8 : tiff + u32(e + 8)
    if (wo + 19 > grenze) return null
    let text = ''
    for (let z = 0; z < 19; z++) text += String.fromCharCode(sicht.getUint8(wo + z))
    return zeitAusExifText(text)
  }
  return null
}

// "2026:08:08 14:03:21" -> Millisekunden lokaler Zeit. Exportiert für Tests.
export function zeitAusExifText(text) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(text || '').trim())
  if (!m) return null
  const [, j, mo, tg, h, mi, s] = m.map(Number)
  if (!j || !mo || !tg) return null
  const d = new Date(j, mo - 1, tg, h, mi, s)
  return Number.isFinite(d.getTime()) ? d.getTime() : null
}

// ------------------------------------------------------------- Prüfsumme

export async function sha256Hex(puffer) {
  const hash = await crypto.subtle.digest('SHA-256', puffer)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ------------------------------------------------------------- IndexedDB
//
// Ein Objektspeicher 'fotos' (Schlüssel = Foto-Kennung), darin je Eintrag
// die drei Blobs plus alles, was das fotos-Dokument braucht. localStorage
// scheidet aus: dort ist bei ~5 MB Schluss (store.js warnt heute selbst).

const DB_NAME = 'gabara-fotoablage'
let _dbVersprechen = null

function ablageOeffnen() {
  if (_dbVersprechen) return _dbVersprechen
  _dbVersprechen = new Promise((auf, ab) => {
    if (typeof indexedDB === 'undefined') return ab(new Error('IndexedDB nicht verfügbar.'))
    const antrag = indexedDB.open(DB_NAME, 1)
    antrag.onupgradeneeded = () => {
      antrag.result.createObjectStore('fotos', { keyPath: 'id' })
    }
    antrag.onsuccess = () => auf(antrag.result)
    antrag.onerror = () => ab(antrag.error || new Error('IndexedDB verweigert.'))
  })
  // Nach einem Fehlschlag darf der nächste Versuch neu öffnen
  _dbVersprechen.catch(() => { _dbVersprechen = null })
  return _dbVersprechen
}

function imSpeicher(modus, arbeit) {
  return ablageOeffnen().then((db) => new Promise((auf, ab) => {
    const tx = db.transaction('fotos', modus)
    const speicher = tx.objectStore('fotos')
    const antrag = arbeit(speicher)
    tx.oncomplete = () => auf(antrag?.result)
    tx.onerror = () => ab(tx.error || new Error('IndexedDB-Vorgang gescheitert.'))
    tx.onabort = () => ab(tx.error || new Error('IndexedDB-Vorgang abgebrochen.'))
  }))
}

export function ablageSchreiben(eintrag) {
  return imSpeicher('readwrite', (s) => s.put(eintrag))
}
export function ablageLesen(id) {
  return imSpeicher('readonly', (s) => s.get(id))
}
export function ablageLoeschen(id) {
  return imSpeicher('readwrite', (s) => s.delete(id))
}
export function ablageAlle() {
  return imSpeicher('readonly', (s) => s.getAll()).then((liste) => liste || [])
}

// ------------------------------------------------------------- Speicher-Härtung
//
// persist(): Ein nicht als dauerhaft markierter Browser-Speicher darf bei
// Speicherdruck GERÄUMT werden – genau der Absturz der alten Flutter-App
// (Cache weg, Fotos lautlos verschwunden). estimate(): ab 80 % wird laut
// gewarnt, BEVOR ausgelöst wird.

export const SPEICHER_WARNSCHWELLE = 0.8

let _persistiert = null
export async function persistenzSichern() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { persistiert: false, verfuegbar: false }
  }
  if (_persistiert === true) return { persistiert: true, verfuegbar: true }
  try {
    _persistiert = await navigator.storage.persist()
  } catch (e) {
    _persistiert = false
  }
  return { persistiert: _persistiert === true, verfuegbar: true }
}

export async function speicherStand() {
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    const anteil = quota > 0 ? usage / quota : 0
    return { belegt: usage, gesamt: quota, anteil, knapp: anteil >= SPEICHER_WARNSCHWELLE }
  } catch (e) {
    return { belegt: 0, gesamt: 0, anteil: 0, knapp: false }
  }
}

// Läuft die App im installierten Modus (Startbildschirm-Symbol)? In der
// WhatsApp-Ansicht ist der Speicher flüchtig – deshalb das Standalone-Gate.
export function istInstalliert() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true
  if (window.navigator?.standalone === true) return true          // iOS Safari
  return document?.referrer?.startsWith('android-app://') || false
}

// ------------------------------------------------------------- Fototafel-Rechnung
//
// Reine Funktionen für die vier Plätze je Raum (Plan 5.1) – getestet
// unter node, benutzt von Fototafel und HEUTE-Liste.

export function fotoStandFeld(kontext, phase) {
  return `${kontext === 'regie' ? 'regie' : 'auftrag'}${phase === 'vorher' ? 'Vorher' : 'Nachher'}`
}

// Die vier Plätze eines Raums samt Fehlliste. Die Regie-Zeile zählt NUR,
// wenn für den Raum eine Anordnung vorliegt – keine leeren Pflichtfelder.
export function fotoAmpel(raum, { regieAngeordnet = false } = {}) {
  const stand = raum?.fotoStand || {}
  const zahl = (feld) => Math.max(0, Math.round(Number(stand[feld]) || 0))
  const plaetze = []
  for (const kontext of regieAngeordnet ? ['auftrag', 'regie'] : ['auftrag']) {
    for (const phase of ['vorher', 'nachher']) {
      const feld = fotoStandFeld(kontext, phase)
      plaetze.push({ kontext, phase, feld, anzahl: zahl(feld) })
    }
  }
  const fehlt = plaetze.filter((p) => p.anzahl === 0).map((p) => p.feld)
  return { plaetze, fehlt, vollstaendig: fehlt.length === 0 }
}

// ------------------------------------------------------------- Verfallsregel

// Darf/ soll dieser Eintrag JETZT hochgeladen werden? `sparsam` gilt erst im
// Storage-Modus (große Dateien): dort sammelt sich der Rest bis zur Schwelle.
// Im Rückfallweg (30-KB-Vorschauen) wird immer sofort geladen.
export function sollteJetztLaden(eintrag, { online, jetzt = Date.now(), wartend = 0, sparsam = false } = {}) {
  if (!online) return false
  if (!sparsam) return true
  if (eintrag.phase === 'vorher') return true                       // unwiederholbar
  if (wartend >= VERFALL.bilder) return true
  if (jetzt - (eintrag.erstelltAm || 0) > VERFALL.stunden * 3600000) return true
  return false
}

// ------------------------------------------------------------- Dokumente bauen

// Das fotos-Dokument (V2): NUR Verweise und Prüfdaten, NIE Bilddaten.
// Exportiert, damit der Test beweisen kann, dass kein dataUrl-Schlüssel
// hineinrutscht (die Firestore-Regel lehnt ihn ab – der ganze Batch stürbe).
export function fotosDokument(eintrag, status) {
  return {
    id: eintrag.id,
    projektId: eintrag.projektId,
    raumId: eintrag.raumId || '',
    berichtId: eintrag.berichtId || '',
    anordnungId: eintrag.anordnungId || '',
    aufgabeIds: eintrag.aufgabeIds || [],
    phase: eintrag.phase,
    kontext: eintrag.kontext || 'auftrag',
    rolle: eintrag.rolle || 'fototafel',
    sha256: eintrag.sha256,
    aufgenommenAm: eintrag.aufgenommenAm,
    aufgenommenAmQuelle: eintrag.aufgenommenAmQuelle,
    groessen: eintrag.groessen || {},
    speicherZiel: SPEICHER_ZIEL,
    pfade: eintrag.pfade || {},
    vorschauPhotoId: status === 'hochgeladen' && SPEICHER_ZIEL === 'vorschau' ? vorschauPhotoId(eintrag.id) : '',
    status,
    von: eintrag.von || '',
    vonId: eintrag.vonId || '',
    datum: eintrag.datum || '',
    erstelltAm: eintrag.erstelltAm,
    ...(status === 'hochgeladen' ? { hochgeladenAm: Date.now() } : {}),
  }
}

// ------------------------------------------------------------- Hilfen

function mitFrist(versprechen, ms) {
  // Wie überall in V2: der lokale Zwischenspeicher quittiert sofort, der
  // Server irgendwann – NIE unbegrenzt warten (Funkloch = Normalfall).
  versprechen.catch(() => {})   // spätere Ablehnung nicht als unbehandelt melden
  return Promise.race([
    versprechen.then(() => 'ok', () => 'fehler'),
    new Promise((auf) => setTimeout(() => auf('frist'), ms)),
  ])
}

function blobZuDataUrl(blob) {
  return new Promise((auf, ab) => {
    const leser = new FileReader()
    leser.onload = () => auf(leser.result)
    leser.onerror = () => ab(leser.error || new Error('Blob nicht lesbar.'))
    leser.readAsDataURL(blob)
  })
}

// ------------------------------------------------------------- Aufnehmen
//
// DER Auslöser. Liefert { ok:true, id, vorschauUrl, aufgenommenAm,
// speicherWarnung } oder { ok:false, grund } – bei ok:false MUSS der
// Aufrufer den Vorgang verweigern (Plan 5.4: laut scheitern).
//
// meta: { projektId, raumId, berichtId, anordnungId, aufgabeIds, phase,
//         kontext, rolle, datum, von, vonId }

export async function fotoAufnehmen(datei, meta, store, { jetzt = Date.now() } = {}) {
  if (!datei?.type?.startsWith('image/')) return { ok: false, grund: 'kein-bild' }
  if (!meta?.projektId || !meta?.phase) return { ok: false, grund: 'meta' }

  // Speicherstand VOR jedem Auslösen prüfen (Warnung, keine Sperre)
  const stand = await speicherStand()

  // 1. EXIF-Zeit aus den Rohbytes – VOR dem Verkleinern
  let aufgenommenAm = jetzt
  let aufgenommenAmQuelle = 'geraet'
  let rohbytes = null
  try {
    rohbytes = await datei.arrayBuffer()
    const exif = exifAufnahmezeit(rohbytes)
    if (exif) { aufgenommenAm = exif; aufgenommenAmQuelle = 'exif' }
  } catch (e) { /* Gerätezeit bleibt */ }

  // 2.–3. Drei Größen + Prüfsumme des Beweisbilds
  let blobs
  let pruefsumme
  try {
    blobs = await dreiGroessen(datei)
    pruefsumme = await sha256Hex(await blobs.beweis.arrayBuffer())
  } catch (e) {
    return { ok: false, grund: 'verkleinern' }
  }
  rohbytes = null

  // 4. SOFORT nach IndexedDB – scheitert das, scheitert der Auslöser LAUT
  const id = lokaleFotoId()
  const eintrag = {
    id,
    projektId: meta.projektId,
    raumId: meta.raumId || '',
    berichtId: meta.berichtId || '',
    anordnungId: meta.anordnungId || '',
    aufgabeIds: meta.aufgabeIds || [],
    phase: meta.phase,
    kontext: meta.kontext || 'auftrag',
    rolle: meta.rolle || 'fototafel',
    sha256: pruefsumme,
    aufgenommenAm,
    aufgenommenAmQuelle,
    groessen: { beweis: blobs.beweis.size, druck: blobs.druck.size, vorschau: blobs.vorschau.size },
    blobs,
    status: 'lokal',
    versuche: 0,
    fehlerText: '',
    von: meta.von || '',
    vonId: meta.vonId || '',
    datum: meta.datum || '',
    erstelltAm: jetzt,
  }
  try {
    await ablageSchreiben(eintrag)
  } catch (e) {
    return { ok: false, grund: 'ablage' }
  }

  // 5. fotos-Dokument mit status 'lokal' – geht durch die Firestore-
  // Warteschlange, überlebt den Neustart; das Büro sieht "lädt noch".
  // Ein Fehlschlag hier ist NICHT fatal: das Bild ist gesichert, die
  // Warteschlange schreibt das Dokument beim Hochladen erneut (Upsert).
  try {
    const { blobs: _weg, ...ohneBlobs } = eintrag
    await mitFrist(store.add('fotos', fotosDokument(ohneBlobs, 'lokal')), FRIST_MS)
  } catch (e) { /* Warteschlange holt es nach */ }

  melde()
  anstossen()

  return {
    ok: true,
    id,
    vorschauUrl: typeof URL !== 'undefined' ? URL.createObjectURL(blobs.vorschau) : '',
    aufgenommenAm,
    speicherWarnung: stand.knapp,
  }
}

// Rückgängig (Quittung) oder Fehlaufnahme: Blobs + Dokumente entfernen.
export async function fotoVerwerfen(id, store) {
  try { await ablageLoeschen(id) } catch (e) { /* schon weg */ }
  try { await mitFrist(store.remove('fotos', id), FRIST_MS) } catch (e) { /* egal */ }
  try { await mitFrist(store.remove('photos', vorschauPhotoId(id)), FRIST_MS) } catch (e) { /* egal */ }
  melde()
}

// Vorschau eines eigenen Fotos aus der Ablage (Kachel zeigt sofort an)
export async function vorschauAusAblage(id) {
  try {
    const eintrag = await ablageLesen(id)
    if (!eintrag?.blobs?.vorschau || typeof URL === 'undefined') return ''
    return URL.createObjectURL(eintrag.blobs.vorschau)
  } catch (e) {
    return ''
  }
}

// ------------------------------------------------------------- Warteschlange

const beobachter = new Set()
let _stand = { wartend: 0, fehler: 0, laedt: false }
let _laeuft = false
let _uhr = null
let _getStore = null
let _nutzer = null
let _letztesLebenszeichen = 0

export function warteschlangenStand() {
  return _stand
}

export function beobachteWarteschlange(cb) {
  beobachter.add(cb)
  cb(_stand)
  return () => beobachter.delete(cb)
}

async function melde() {
  try {
    const alle = await ablageAlle()
    const offen = alle.filter((e) => e.status !== 'hochgeladen')
    _stand = {
      wartend: offen.length,
      fehler: alle.filter((e) => e.status === 'fehler').length,
      laedt: _laeuft,
      aeltesteWartetSeit: offen.length ? Math.min(...offen.map((e) => e.erstelltAm || 0)) : 0,
    }
  } catch (e) {
    _stand = { wartend: 0, fehler: 0, laedt: false, aeltesteWartetSeit: 0 }
  }
  beobachter.forEach((cb) => cb(_stand))
}

// Rückstands-Lebenszeichen (Plan 5.4: "Rückstand > 1 Arbeitstag -> rote
// Zeile beim Büro"): jedes Gerät schreibt sein eigenes geraete-Dokument
// (id = eigene Konto-Kennung, so verlangt es die Firestore-Regel).
async function lebenszeichen(store) {
  if (!_nutzer?.userId) return
  const jetzt = Date.now()
  if (jetzt - _letztesLebenszeichen < LEBENSZEICHEN_MS) return
  _letztesLebenszeichen = jetzt
  try {
    await mitFrist(store.add('geraete', {
      id: _nutzer.userId,
      name: _nutzer.name || '',
      wartend: _stand.wartend,
      fehler: _stand.fehler,
      aeltesteWartetSeit: _stand.aeltesteWartetSeit || 0,
      zuletztGesehen: jetzt,
      speicherZiel: SPEICHER_ZIEL,
    }), FRIST_MS)
  } catch (e) { /* Lebenszeichen ist Beiwerk */ }
}

// EIN Eintrag: Rückfallweg 'vorschau' – 400er als dataUrl in die photos-
// Sammlung (deterministische Kennung = Upsert, Wiederholung ungefährlich),
// dann das fotos-Dokument auf 'hochgeladen'. Original bleibt in IndexedDB.
async function eintragHochladen(eintrag, store) {
  const { blobs, ...ohneBlobs } = eintrag
  const dataUrl = await blobZuDataUrl(blobs.vorschau)
  const ergebnis = await mitFrist(store.add('photos', {
    id: vorschauPhotoId(eintrag.id),
    projektId: eintrag.projektId,
    raumId: eintrag.raumId || '',
    berichtId: eintrag.berichtId || '',
    anordnungId: eintrag.anordnungId || '',
    aufgabeIds: eintrag.aufgabeIds || [],
    fotoId: eintrag.id,
    phase: eintrag.phase,
    kontext: eintrag.kontext || 'auftrag',
    rolle: 'vorschau',
    dataUrl,
    name: `${eintrag.raumId || eintrag.projektId}-${eintrag.phase}.jpg`,
    von: eintrag.von || '',
    vonId: eintrag.vonId || '',
    datum: eintrag.datum || '',
    createdAt: eintrag.erstelltAm,
  }), FRIST_MS)
  if (ergebnis === 'fehler') throw new Error('Vorschau abgelehnt.')
  if (ergebnis === 'frist') return false      // Funkloch: später erneut
  await mitFrist(store.add('fotos', fotosDokument(ohneBlobs, 'hochgeladen')), FRIST_MS)
  return true
}

async function verarbeite() {
  if (_laeuft || !_getStore) return
  if (typeof indexedDB === 'undefined') return
  _laeuft = true
  try {
    const store = await _getStore()
    const alle = await ablageAlle()
    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false
    const offen = alle
      .filter((e) => e.status !== 'hochgeladen')
      // Vorher-Bilder ZUERST (unwiederholbar), dann nach Alter
      .sort((a, b) => (a.phase === 'vorher' ? 0 : 1) - (b.phase === 'vorher' ? 0 : 1)
        || (a.erstelltAm || 0) - (b.erstelltAm || 0))
    const sparsam = SPEICHER_ZIEL === 'storage'
    for (const eintrag of offen) {
      if (!sollteJetztLaden(eintrag, { online, wartend: offen.length, sparsam })) continue
      try {
        eintrag.status = 'laedt'
        await ablageSchreiben(eintrag)
        const fertig = await eintragHochladen(eintrag, store)
        eintrag.status = fertig ? 'hochgeladen' : 'lokal'
        if (fertig) { eintrag.hochgeladenAm = Date.now(); eintrag.fehlerText = '' }
        await ablageSchreiben(eintrag)
      } catch (e) {
        eintrag.status = 'fehler'
        eintrag.versuche = (eintrag.versuche || 0) + 1
        eintrag.fehlerText = e?.message || String(e)
        await ablageSchreiben(eintrag).catch(() => {})
      }
    }
    await melde()
    await lebenszeichen(store)
  } catch (e) {
    /* nächster Takt versucht es erneut */
  } finally {
    _laeuft = false
  }
}

// Manuell anstoßen – der Knopf "jetzt versuchen" am Balken.
export function anstossen() {
  // absichtlich ohne await: der Aufrufer soll nie hängen
  verarbeite()
}

// Einmal je App-Lauf starten (Monteur-Ansicht). Mehrfachaufruf ist
// ungefährlich, der Nutzer wird aktualisiert (Anmeldungswechsel).
export function warteschlangeStarten({ getStore, user } = {}) {
  if (getStore) _getStore = getStore
  if (user) _nutzer = { userId: user.userId || '', name: user.name || '' }
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return
  if (!_uhr) {
    _uhr = setInterval(verarbeite, TAKT_MS)
    window.addEventListener('online', () => { melde(); verarbeite() })
  }
  melde()
  verarbeite()
}
