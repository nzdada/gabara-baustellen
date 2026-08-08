// FastBill-Anbindung (FastBill ist führend für Kunden, Artikel und Rechnungen).
// API: POST https://my.fastbill.com/api/1.0/api.php, HTTP Basic Auth (E-Mail + API-Key),
// JSON-Body { SERVICE, FILTER?, DATA?, LIMIT? }.
//
// CORS: Der Browser darf my.fastbill.com nicht direkt aufrufen.
//  - Dev: Vite-Proxy '/fastbill-api' (admin/vite.config.js) leitet weiter.
//  - Prod (V2): GAS-Proxy-Web-App, URL in settings/integrationen.proxyUrl.
// Ohne hinterlegten Zugang laufen alle Aufrufe als 'simuliert' (nur apilog).
//
// Rate-Limit (Solo-Tarif): 50 Calls/Stunde -> Sync NUR auf Knopfdruck.

import { getStore } from './store.js'
import { euro } from './format.js'

// Der FastBill-Zugang liegt BEWUSST in einer eigenen Sammlung, nicht in
// settings. Grund: settings wird von der ganzen Verwaltung als komplette Liste
// gelesen (useCollection). Firestore erlaubt so eine Sammlungs-Abfrage nur,
// wenn JEDES Dokument darin lesbar ist – ein Dokument mit dem API-Key hätte
// also entweder die ganze Liste blockiert oder den Key für jeden Monteur
// geöffnet. Getrennte Sammlung = getrennte Regel.
async function zugang() {
  const store = await getStore()
  const integ = (await store.get('integrationen', 'fastbill')) || {}
  // .env.local-Fallback NUR im Dev-Modus: Vite kompiliert VITE_-Variablen als
  // Klartext ins Bundle – im Produktions-Build darf der API-Key deshalb NICHT
  // aus der Env kommen (dort: Einstellungen -> FastBill, liegt in Firestore).
  let envEmail = ''
  let envKey = ''
  if (import.meta.env.DEV) {
    envEmail = import.meta.env.VITE_FASTBILL_EMAIL || ''
    envKey = import.meta.env.VITE_FASTBILL_API_KEY || ''
  }
  // Nur GÜLTIGE Proxy-URLs übernehmen (https://… für den GAS-Proxy oder /… für
  // einen eigenen Pfad). Alles andere (z. B. versehentlich eingetragene Hinweise
  // wie "admin/.env.local") wird ignoriert -> eingebauter Dev-Proxy greift.
  const roh = (integ.proxyUrl || '').trim()
  const eigenerProxy = /^(https?:\/\/|\/)/i.test(roh)
  // Der Pfad /fastbill-api existiert NUR im Entwicklungsbetrieb (Vite-Proxy in
  // admin/vite.config.js). In der ausgelieferten App gibt es ihn nicht – dort
  // fängt die SPA-Umleitung den Aufruf ab und liefert die index.html zurück:
  // HTTP 200, aber HTML statt JSON. Das sah bisher aus wie ein FastBill-Fehler.
  const proxyUrl = eigenerProxy ? roh : '/fastbill-api/api.php'
  return {
    email: integ.fastbillEmail || envEmail,
    key: integ.fastbillApiKey || envKey,
    proxyUrl,
    // true = wir laufen ausgeliefert, aber ohne eingetragene Proxy-Adresse
    proxyFehlt: !import.meta.env.DEV && !eigenerProxy,
  }
}

export async function fastbillKonfiguriert() {
  const z = await zugang()
  return Boolean(z.email && z.key)
}

// Basic-Auth-Kodierung, die auch Umlaute vertraegt.
function base64(text) {
  const bytes = new TextEncoder().encode(text)
  let roh = ''
  for (const b of bytes) roh += String.fromCharCode(b)
  return btoa(roh)
}

// Adresse fuer Anzeige und Protokoll entschaerfen: alles ab dem ersten '?'
// faellt weg. Sonst stuende das Proxy-Secret im Klartext in der Fehlermeldung
// UND dauerhaft in der Firestore-Sammlung 'apilog'.
function ohneGeheimnis(adresse) {
  return String(adresse || '').split('?')[0]
}

async function logEintrag(service, status, bezugId = '', fehlerText = '') {
  try {
    const store = await getStore()
    await store.add('apilog', {
      dienst: 'fastbill', service, status, bezugId, fehlerText, createdAt: Date.now(),
    })
  } catch (e) { /* Log darf nie den eigentlichen Aufruf verhindern */ }
}

// Basis-Aufruf. Wirft bei Fehlern; liefert das RESPONSE-Objekt von FastBill.
// Ohne Zugang: { simuliert: true } (und apilog-Eintrag 'simuliert').
export async function fastbillCall(service, { data, filter, limit, bezugId } = {}) {
  const { email, key, proxyUrl, proxyFehlt } = await zugang()
  if (proxyFehlt) {
    const text = 'Keine Proxy-Adresse hinterlegt. Im Online-Betrieb kann der Browser FastBill '
      + 'nicht direkt erreichen (CORS). Bitte den Weiterleitungs-Dienst einrichten '
      + '(seed/gabara-fastbill-proxy.gs) und seine Adresse unter Einstellungen → FastBill eintragen.'
    await logEintrag(service, 'fehler', bezugId, text)
    throw new Error(text)
  }
  if (!email || !key) {
    await logEintrag(service, 'simuliert', bezugId)
    return { simuliert: true }
  }
  const body = { SERVICE: service }
  if (filter) body.FILTER = filter
  if (limit) body.LIMIT = limit
  if (data) body.DATA = data
  // btoa() kennt nur Latin-1 und wirft bei allem darueber (z. B. ein Umlaut in
  // der Konto-Mail). Vorher nach UTF-8 wandeln – sonst bricht der Aufruf mit
  // einem InvalidCharacterError ab, der nichts mit FastBill zu tun zu haben scheint.
  const auth = base64(`${email}:${key}`)
  // GAS-Web-Apps (V2-Proxy) reichen KEINE Authorization-Header durch. Zugang und
  // Secret gehen deshalb im BODY mit – NICHT in der URL: URLs stehen im
  // Browser-Verlauf, in Referrern und in den Server-Logs von Google, und der
  // FastBill-API-Key hat dort nichts verloren. Das ?secret= aus der eingetragenen
  // Proxy-URL wird herausgeschnitten und ebenfalls in den Body gelegt.
  // Gegenstück: seed/gabara-fastbill-proxy.gs
  const istExternerProxy = /^https?:/i.test(proxyUrl)
  let url = proxyUrl
  let nutzlast = body
  if (istExternerProxy) {
    let secret = ''
    try {
      const u = new URL(proxyUrl)
      // BEWUSST nicht searchParams.get(): das dekodiert nach x-www-form-urlencoded
      // und macht aus einem '+' im Secret ein Leerzeichen. Ein Zufalls-Secret mit
      // '+' (Base64 enthält das regelmäßig) käme so dauerhaft falsch beim Proxy an,
      // mit der irreführenden Meldung "falsches Secret". Deshalb roh auslesen und
      // nur die Prozent-Kodierung auflösen.
      const roheSuche = u.search.replace(/^\?/, '')
      for (const teil of roheSuche.split('&')) {
        const [k, ...rest] = teil.split('=')
        if (k === 'secret') {
          try { secret = decodeURIComponent(rest.join('=')) } catch (e) { secret = rest.join('=') }
        }
      }
      u.searchParams.delete('secret')
      u.searchParams.delete('auth')
      url = u.toString()
    } catch (e) { /* unparsbare URL: unverändert lassen, Proxy meldet den Fehler */ }
    nutzlast = { secret, auth, payload: body }
  }
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      // text/plain vermeidet den CORS-Preflight – GAS beantwortet kein OPTIONS
      headers: istExternerProxy
        ? { 'Content-Type': 'text/plain;charset=utf-8' }
        : { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(nutzlast),
    })
  } catch (e) {
    await logEintrag(service, 'fehler', bezugId, `Netzwerk: ${e.message}`)
    throw new Error('FastBill nicht erreichbar (Netzwerk/Proxy prüfen).')
  }
  let json = null
  let keinJson = false
  try {
    json = await res.json()
  } catch (e) {
    // Antwort war kein JSON – fast immer die zurückgelieferte index.html,
    // weil die Adresse gar nicht beim Proxy gelandet ist.
    keinJson = true
  }
  const antwort = json?.RESPONSE
  const fehler = antwort?.ERRORS
  if (!res.ok || !antwort || fehler) {
    const text = fehler
      ? [].concat(fehler).join('; ')
      : keinJson
        ? `Die Adresse ${ohneGeheimnis(url)} hat keine FastBill-Antwort geliefert (HTTP ${res.status}, kein JSON). Proxy-Adresse unter Einstellungen → FastBill prüfen.`
        : `Unerwartete Antwort von FastBill (HTTP ${res.status}).`
    await logEintrag(service, 'fehler', bezugId, text)
    throw new Error(`FastBill ${service}: ${text}`)
  }
  await logEintrag(service, 'ok', bezugId)
  return antwort
}

// Verbindungstest für die Einstellungen: liest 1 Kunden.
// Liefert { ok, simuliert?, anzahl?, fehler? } – wirft nie.
export async function pruefeVerbindung() {
  try {
    const antwort = await fastbillCall('customer.get', { limit: 1 })
    if (antwort.simuliert) return { ok: false, simuliert: true }
    return { ok: true, anzahl: (antwort.CUSTOMERS || []).length }
  } catch (e) {
    return { ok: false, fehler: e.message }
  }
}

// ---------- Kunden (patients-Spiegel <-> FastBill customer) ----------

function kundeAlsFastbill(kunde) {
  const [plz, ...ortTeile] = String(kunde.plzOrt || '').split(' ')
  return {
    CUSTOMER_TYPE: kunde.typ === 'privat' ? 'consumer' : 'business',
    ORGANIZATION: kunde.firma || '',
    FIRST_NAME: kunde.vorname || '',
    LAST_NAME: kunde.nachname || kunde.ansprechpartner || kunde.firma || '–',
    ADDRESS: kunde.strasse || '',
    ZIPCODE: /^\d{4,5}$/.test(plz) ? plz : '',
    CITY: /^\d{4,5}$/.test(plz) ? ortTeile.join(' ') : (kunde.plzOrt || ''),
    COUNTRY_CODE: 'DE',
    PHONE: kunde.telefon || '',
    EMAIL: kunde.email || '',
  }
}

// Kunde nach FastBill schreiben (create/update) und fastbillCustomerId im Spiegel merken.
export async function syncKunde(kunde) {
  const daten = kundeAlsFastbill(kunde)
  if (kunde.fastbillCustomerId) {
    const antwort = await fastbillCall('customer.update', {
      data: { CUSTOMER_ID: kunde.fastbillCustomerId, ...daten },
      bezugId: kunde.id,
    })
    if (antwort.simuliert) return { simuliert: true, customerId: kunde.fastbillCustomerId }
    return { customerId: kunde.fastbillCustomerId }
  }
  const antwort = await fastbillCall('customer.create', { data: daten, bezugId: kunde.id })
  if (antwort.simuliert) return { simuliert: true, customerId: null }
  const customerId = antwort.CUSTOMER_ID || antwort.CUSTOMERS?.[0]?.CUSTOMER_ID
  if (customerId) {
    const store = await getStore()
    await store.update('patients', kunde.id, { fastbillCustomerId: String(customerId) })
  }
  return { customerId }
}

// Kunden AUS FastBill in den Spiegel laden (FastBill führend).
// Ordnet über fastbillCustomerId zu; neue Kunden werden angelegt.
export async function ladeKundenVonFastbill() {
  const antwort = await fastbillCall('customer.get', { limit: 100 })
  if (antwort.simuliert) return { simuliert: true, neu: 0, aktualisiert: 0 }
  const store = await getStore()
  const lokal = await store.list('patients')
  let neu = 0
  let aktualisiert = 0
  for (const c of antwort.CUSTOMERS || []) {
    const id = String(c.CUSTOMER_ID)
    const felder = {
      firma: c.ORGANIZATION || '',
      vorname: c.FIRST_NAME || '',
      nachname: c.LAST_NAME || '',
      ansprechpartner: [c.FIRST_NAME, c.LAST_NAME].filter(Boolean).join(' '),
      telefon: c.PHONE || '',
      email: c.EMAIL || '',
      strasse: c.ADDRESS || '',
      plzOrt: [c.ZIPCODE, c.CITY].filter(Boolean).join(' '),
      typ: c.CUSTOMER_TYPE === 'consumer' ? 'privat' : 'gu',
      fastbillCustomerId: id,
    }
    const vorhanden = lokal.find((k) => k.fastbillCustomerId === id)
    if (vorhanden) {
      await store.update('patients', vorhanden.id, felder)
      aktualisiert++
    } else {
      await store.add('patients', {
        ...felder,
        ustModus: felder.typ === 'privat' ? 'ust19' : '13b',
        zahlungszielTage: felder.typ === 'privat' ? 14 : 16,
        sicherheitseinbehaltProzent: felder.typ === 'privat' ? 0 : 10,
        notizen: '', createdAt: Date.now(),
      })
      neu++
    }
  }
  return { neu, aktualisiert }
}

// ---------- Artikel (katalog-Spiegel <-> FastBill article) ----------

export async function syncArtikel(artikel) {
  const daten = {
    ARTICLE_NUMBER: artikel.code || artikel.id,
    TITLE: artikel.name,
    UNIT: artikel.einheit || '',
    UNIT_PRICE: artikel.preis || 0,
    CURRENCY_CODE: 'EUR',
    VAT_PERCENT: 19,
  }
  if (artikel.fastbillArticleId) {
    const antwort = await fastbillCall('article.update', {
      data: { ARTICLE_ID: artikel.fastbillArticleId, ...daten },
      bezugId: artikel.id,
    })
    if (antwort.simuliert) return { simuliert: true }
    return { articleId: artikel.fastbillArticleId }
  }
  const antwort = await fastbillCall('article.create', { data: daten, bezugId: artikel.id })
  if (antwort.simuliert) return { simuliert: true }
  const articleId = antwort.ARTICLE_ID || antwort.ARTICLES?.[0]?.ARTICLE_ID
  if (articleId) {
    const store = await getStore()
    await store.update('katalog', artikel.id, { fastbillArticleId: String(articleId) })
  }
  return { articleId }
}

export async function ladeArtikelVonFastbill() {
  const antwort = await fastbillCall('article.get', { limit: 100 })
  if (antwort.simuliert) return { simuliert: true, neu: 0, aktualisiert: 0 }
  const store = await getStore()
  const lokal = await store.list('katalog')
  let neu = 0
  let aktualisiert = 0
  for (const a of antwort.ARTICLES || []) {
    const id = String(a.ARTICLE_ID)
    const felder = {
      code: a.ARTICLE_NUMBER || '',
      name: a.TITLE || a.DESCRIPTION || '',
      einheit: a.UNIT || '',
      preis: Number(a.UNIT_PRICE) || 0,
      fastbillArticleId: id,
    }
    const vorhanden = lokal.find((k) => k.fastbillArticleId === id)
    if (vorhanden) { await store.update('katalog', vorhanden.id, felder); aktualisiert++ }
    else { await store.add('katalog', { ...felder, ekPreis: 0, kategorie: '', lieferant: '' }); neu++ }
  }
  return { neu, aktualisiert }
}

// ---------- Rechnungen ----------

// Rechnung als ENTWURF in FastBill anlegen. rechnung = unser Spiegel-Doc
// (positionen[{text, menge, einheit, ep}], leistungszeitraum, kunde).
// Sicherheitseinbehalt als TEXT auf die Rechnung, nicht als Abzug.
//
// WARUM NICHT ALS MINUS-POSITION: Der Einbehalt nach § 17 VOB/B mindert nicht die
// Leistung, sondern schiebt einen Teil der ZAHLUNG auf. Die Umsatzsteuer bleibt
// auf den vollen Betrag geschuldet. Eine negative Position wuerde Netto und
// Umsatzsteuer kuerzen - das waere ein Steuerfehler. Die Rechnung lautet also
// weiter ueber den vollen Betrag, der Einbehalt steht als Zahlungsvereinbarung
// darunter. Vorher fehlte er in FastBill vollstaendig: der Assistent zeigte
// "Zahlbetrag 9.000 EUR", beim Kunden kam eine Rechnung ueber 10.000 EUR an.
const NL = String.fromCharCode(10)

export function einbehaltText(rechnung) {
  const proz = Number(rechnung?.einbehaltProzent) || 0
  const betrag = Number(rechnung?.einbehaltBetrag) || 0
  if (proz <= 0 || betrag <= 0) return ''
  return [
    `Sicherheitseinbehalt ${proz.toLocaleString('de-DE')} %: ${euro(betrag)}`,
    `Zahlbetrag nach Abzug des Einbehalts: ${euro(Number(rechnung.zahlbetrag) || 0)}`,
    'Der Einbehalt wird nach mangelfreier Abnahme bzw. nach Ablauf der Gewaehrleistungsfrist zur Zahlung faellig.',
  ].join(NL)
}

export async function erstelleFastbillRechnung(rechnung, kunde, introText) {
  // Steuer-SCHNAPPSCHUSS (Plan 8.8, § 146 Abs. 4 AO): Trägt die Rechnung
  // einen eingefrorenen USt-Modus (V2-Aufmaßrechnungen), gilt AUSSCHLIESSLICH
  // dieser – NIE der Live-Stand des Kunden. Sonst weist die FastBill-Rechnung
  // nach einer späteren Kundenumstellung (13b -> ust19) andere Steuer aus als
  // der App-Datensatz. V1-Rechnungen ohne Schnappschuss rechnen wie bisher
  // live aus dem Kunden.
  const ausSchnappschuss = rechnung.ustModus === '13b' || rechnung.ustModus === 'ust19'
  const vatProzent = ausSchnappschuss
    ? (rechnung.ustModus === '13b' ? 0 : (Number(rechnung.ustSatz) || 19))
    : (kunde.ustModus === '13b' ? 0 : 19)
  const einbehalt = einbehaltText(rechnung)
  const daten = {
    CUSTOMER_ID: kunde.fastbillCustomerId,
    INVOICE_TITLE: rechnung.titel || '',
    INTROTEXT: [introText || '', einbehalt].filter(Boolean).join(NL + NL),
    SERVICE_PERIOD_START: rechnung.leistungszeitraum?.von || '',
    SERVICE_PERIOD_END: rechnung.leistungszeitraum?.bis || '',
    ITEMS: (rechnung.positionen || []).map((p) => ({
      DESCRIPTION: [p.oz, p.text].filter(Boolean).join(' '),
      UNIT_PRICE: p.ep,
      QUANTITY: p.menge,
      VAT_PERCENT: vatProzent,
    })),
  }
  const antwort = await fastbillCall('invoice.create', { data: daten, bezugId: rechnung.id })
  if (antwort.simuliert) return { simuliert: true, invoiceId: null }
  return { invoiceId: String(antwort.INVOICE_ID || '') }
}

// Entwurf abschließen -> FastBill vergibt die offizielle Rechnungsnummer.
export async function schliesseRechnungAb(invoiceId) {
  const antwort = await fastbillCall('invoice.complete', { data: { INVOICE_ID: invoiceId }, bezugId: invoiceId })
  if (antwort.simuliert) return { simuliert: true }
  return { nummer: antwort.INVOICE_NUMBER || '' }
}

export async function sendeRechnungPerMail(invoiceId, empfaenger, betreff, nachricht) {
  const antwort = await fastbillCall('invoice.sendbyemail', {
    data: {
      INVOICE_ID: invoiceId,
      RECIPIENT: { TO: empfaenger },
      SUBJECT: betreff || '',
      MESSAGE: nachricht || '',
    },
    bezugId: invoiceId,
  })
  return { simuliert: Boolean(antwort.simuliert) }
}

// Status + Dokument-Link einer Rechnung abrufen (draft | outgoing/unpaid | paid | canceled)
export async function holeRechnungStatus(invoiceId) {
  const antwort = await fastbillCall('invoice.get', { filter: { INVOICE_ID: invoiceId }, bezugId: invoiceId })
  if (antwort.simuliert) return { simuliert: true }
  const inv = antwort.INVOICES?.[0]
  if (!inv) return { fehler: 'Rechnung in FastBill nicht gefunden' }
  return {
    status: inv.TYPE === 'draft' || inv.IS_CANCELED === '1' ? (inv.IS_CANCELED === '1' ? 'storniert' : 'uebertragen') : (inv.PAID_DATE && inv.PAID_DATE !== '0000-00-00 00:00:00' ? 'bezahlt' : 'gestellt'),
    nummer: inv.INVOICE_NUMBER || '',
    dokumentUrl: inv.DOCUMENT_URL || '',
    brutto: Number(inv.TOTAL) || 0,
  }
}
