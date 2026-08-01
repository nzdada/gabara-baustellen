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

async function zugang() {
  const store = await getStore()
  const settings = await store.list('settings')
  const integ = settings.find((s) => s.id === 'integrationen') || {}
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
  const proxyUrl = /^(https?:\/\/|\/)/i.test(roh) ? roh : '/fastbill-api/api.php'
  return {
    email: integ.fastbillEmail || envEmail,
    key: integ.fastbillApiKey || envKey,
    proxyUrl,
  }
}

export async function fastbillKonfiguriert() {
  const z = await zugang()
  return Boolean(z.email && z.key)
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
  const { email, key, proxyUrl } = await zugang()
  if (!email || !key) {
    await logEintrag(service, 'simuliert', bezugId)
    return { simuliert: true }
  }
  const body = { SERVICE: service }
  if (filter) body.FILTER = filter
  if (limit) body.LIMIT = limit
  if (data) body.DATA = data
  const auth = btoa(`${email}:${key}`)
  // GAS-Web-Apps (V2-Proxy) reichen KEINE Authorization-Header durch ->
  // bei externer Proxy-URL geht der Zugang als ?auth=-Parameter mit
  // (seed/gabara-fastbill-proxy.gs setzt daraus den Basic-Header).
  const istExternerProxy = /^https?:/i.test(proxyUrl)
  const url = istExternerProxy
    ? `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}auth=${encodeURIComponent(auth)}`
    : proxyUrl
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: istExternerProxy
        ? { 'Content-Type': 'text/plain;charset=utf-8' }
        : { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
    })
  } catch (e) {
    await logEintrag(service, 'fehler', bezugId, `Netzwerk: ${e.message}`)
    throw new Error('FastBill nicht erreichbar (Netzwerk/Proxy prüfen).')
  }
  let json = null
  try { json = await res.json() } catch (e) { /* unten behandelt */ }
  const antwort = json?.RESPONSE
  const fehler = antwort?.ERRORS
  if (!res.ok || !antwort || fehler) {
    const text = fehler ? [].concat(fehler).join('; ') : `HTTP ${res.status}`
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
export async function erstelleFastbillRechnung(rechnung, kunde, introText) {
  const vatProzent = kunde.ustModus === '13b' ? 0 : 19
  const daten = {
    CUSTOMER_ID: kunde.fastbillCustomerId,
    INVOICE_TITLE: rechnung.titel || '',
    INTROTEXT: introText || '',
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
