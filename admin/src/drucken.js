// Druck-/PDF-Ausgabe: öffnet ein Druckfenster (Chrome: "Als PDF speichern").
// ALLE PDFs entstehen hier im Web-Admin (User-Entscheidung – nie auf dem Handy).
//
// Aufbau (Vorgabe 08/2026):
//   1 Kopf       – Logo, Firmendaten, Dokumentart + Nummer + Erstellungszeitpunkt
//   2 Beteiligte – 2 Spalten: Auftraggeber | Projekt/Baustelle (+ Datum, Monteur)
//   3 Hinweis    – § 15 Abs. 3 VOB/B (Anordnung der Stundenlohnarbeiten)
//   4 Arbeiten   – Beschreibungsfeld
//   5 Tabellen   – Arbeitszeiten und Material, jeweils mit Netto-Summe
//   6 Fotos      – getrennte Sektionen VORHER und NACHHER (Grid + Zeitstempel)
//   7 Fuß        – VOB/B-Einwendungsfrist + zwei Unterschriftenfelder

import { PRAXIS } from '@shared/praxis.js'
import { euro } from '@shared/format.js'

// Nutzereingaben IMMER escapen, bevor sie in document.write-HTML landen –
// sonst zerreißt ein '<' oder '</script>' in einer Beschreibung das Dokument.
function esc(wert) {
  return String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escBr(wert) {
  return esc(wert).replace(/\n/g, '<br>')
}

const ROT = '#8b1a1a'
const ROT_DUNKEL = '#701414'

// Gabara-Logo (Farbrolle) als Inline-SVG – funktioniert im about:blank-Druckfenster,
// wo relative Bildpfade nicht auflösen würden.
const LOGO_SVG = `<svg viewBox="0 0 48 48" fill="none" width="42" height="42" style="flex:none">
  <rect x="5" y="7" width="27" height="12" rx="4" fill="${ROT}" opacity="0.15"/>
  <rect x="5" y="7" width="27" height="12" rx="4" stroke="${ROT}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M32 13h8v9H26v4" stroke="${ROT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="23" y="26" width="6" height="15" rx="2" fill="${ROT}" opacity="0.15"/>
  <rect x="23" y="26" width="6" height="15" rx="2" stroke="${ROT}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M9 24c0 2-1.8 2.6-1.8 4.2a1.8 1.8 0 003.6 0C10.8 26.6 9 26 9 24z" fill="${ROT}" opacity="0.6"/>
</svg>`

const STIL = `
  @page { size: A4; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; font-size: 10.5pt; line-height: 1.45; }

  /* 1 Kopf */
  .kopf { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
          border-bottom: 3px solid ${ROT}; padding-bottom: 10px; margin-bottom: 14px; }
  .marke { display: flex; align-items: center; gap: 10px; }
  .marke .firma { font-size: 13pt; font-weight: 700; color: ${ROT_DUNKEL}; line-height: 1.15; }
  .marke .zusatz { font-size: 8pt; color: #64748b; }
  .kopf .dokument { text-align: right; }
  .kopf .dokument h1 { font-size: 15pt; color: ${ROT_DUNKEL}; line-height: 1.2; }
  .kopf .dokument .nummer { display: inline-block; margin-top: 3px; font-size: 10pt; font-weight: 700;
                            background: ${ROT}; color: #fff; border-radius: 4px; padding: 2px 9px; }
  .kopf .dokument .stempel { font-size: 8pt; color: #64748b; margin-top: 4px; }

  /* 2 Beteiligte */
  .spalten { display: flex; gap: 12px; margin-bottom: 12px; }
  .spalten > * { flex: 1 1 0; }
  .block { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 11px; break-inside: avoid; }
  .block h3 { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: ${ROT}; margin-bottom: 4px; }
  .block .zeile { display: flex; gap: 6px; font-size: 9.5pt; }
  .block .zeile span:first-child { color: #64748b; min-width: 74px; }
  .block strong { font-size: 10.5pt; }

  h2 { font-size: 11pt; color: ${ROT_DUNKEL}; margin: 14px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0; }

  .feld { border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 11px; min-height: 46px;
          background: #fcfcfd; white-space: pre-wrap; break-inside: avoid; }

  /* 5 Tabellen */
  table { width: 100%; border-collapse: collapse; margin-top: 4px; break-inside: avoid; }
  th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; color: #fff;
       background: ${ROT}; padding: 5px 7px; font-weight: 700; }
  td { padding: 5px 7px; border-bottom: 1px solid #eef2f7; vertical-align: top; font-size: 9.5pt; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  td.r, th.r { text-align: right; }
  tr.summe td { font-weight: 700; font-size: 10.5pt; background: #f6ecec !important;
                border-top: 2px solid ${ROT}; border-bottom: none; }
  .gesamt { margin-top: 8px; text-align: right; font-size: 12pt; font-weight: 700; color: ${ROT_DUNKEL};
            border: 2px solid ${ROT}; border-radius: 6px; padding: 7px 12px; break-inside: avoid; }

  .box { background: #fbf7f6; border: 1px solid #e6cdc9; border-radius: 6px; padding: 8px 11px; margin: 8px 0;
         font-size: 9.5pt; break-inside: avoid; }
  .box.warn { background: #fefce8; border-color: #fde68a; }
  .box.recht { background: #f8fafc; border-color: #e2e8f0; color: #334155; }
  .meta { color: #64748b; font-size: 8.5pt; }

  /* 6 Fotos */
  .fotoblock { break-inside: avoid; margin-top: 6px; }
  .fotoblock h3 { font-size: 9pt; margin-bottom: 4px; padding: 3px 8px; border-radius: 4px; display: inline-block; color: #fff; }
  .fotoblock h3.vorher { background: #475569; }
  .fotoblock h3.nachher { background: #059669; }
  .gitter { display: flex; flex-wrap: wrap; gap: 8px; }
  .gitter figure { width: calc(33.333% - 6px); break-inside: avoid; }
  .gitter img { width: 100%; height: 5.2cm; object-fit: cover; border-radius: 5px; border: 1px solid #e2e8f0; background: #f1f5f9; }
  .gitter figcaption { font-size: 7.5pt; color: #64748b; margin-top: 2px; line-height: 1.25; }

  ul { padding-left: 16px; }

  /* Stundenzettel: eine Zeile je Kalendertag, Tage ohne Einsatz bleiben blass */
  table.stunden { break-inside: auto; }
  table.stunden td { font-size: 9pt; padding: 3.5px 7px; }
  table.stunden tr.leer td { color: #cbd5e1; }
  /* Unstimmiger Tag: faellt auch auf dem Ausdruck auf, nicht nur am Bildschirm */
  table.stunden tr.pruefen td { background: #fefce8 !important; }
  table.stunden tr.pruefen td strong { color: #b45309; }
  table.stunden tr.leer td:nth-child(-n+2) { color: #94a3b8; }
  table.stunden tfoot tr.summe td { border-top: 2px solid ${ROT}; }

  /* 7 Unterschriften */
  .unterschriften { display: flex; gap: 22px; margin-top: 18px; break-inside: avoid; }
  .unterschriften > div { flex: 1 1 0; }
  .unterschriften .art { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: ${ROT}; margin-bottom: 2px; }
  .unterschriften .flaeche { height: 2.4cm; display: flex; align-items: flex-end; }
  .unterschriften .flaeche img { max-height: 2.3cm; max-width: 100%; }
  .unterschriften .linie { border-top: 1px solid #334155; padding-top: 3px; font-size: 9pt; }
  .unterschriften .klar { font-weight: 700; }
  .unterschriften .rolle { color: #64748b; font-size: 8.5pt; }

  footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #94a3b8;
           display: flex; justify-content: space-between; gap: 12px; }
`

function firma(einst = {}) {
  return {
    name: einst.praxisName || PRAXIS.name,
    anschrift: einst.praxisAnschrift || `${PRAXIS.strasse}, ${PRAXIS.plzOrt}`,
    telefon: einst.praxisTelefon || PRAXIS.telefon,
    email: einst.praxisEmail || PRAXIS.email,
  }
}

function jetztText() {
  const d = new Date()
  return `${d.toLocaleDateString('de-DE')} um ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}

function kopf({ titel, nummer, einst }) {
  const f = firma(einst)
  return `<header class="kopf">
    <div class="marke">
      ${LOGO_SVG}
      <div>
        <div class="firma">${esc(f.name)}</div>
        <div class="zusatz">Maler &amp; Lackierer · ${esc(f.anschrift)}<br>Tel. ${esc(f.telefon)} · ${esc(f.email)}</div>
      </div>
    </div>
    <div class="dokument">
      <h1>${esc(titel)}</h1>
      ${nummer ? `<div class="nummer">Nr. ${esc(nummer)}</div>` : ''}
      <div class="stempel">Erstellt am ${esc(jetztText())}</div>
    </div>
  </header>`
}

function fuss(einst, extra = '') {
  const f = firma(einst)
  return `<footer>
    <span>${esc(f.name)} · ${esc(f.anschrift)} · Tel. ${esc(f.telefon)}</span>
    <span>${esc(extra)}</span>
  </footer>`
}

// Öffnet das Druckfenster und startet den Druck, sobald alle Bilder geladen sind.
// window.open kann null liefern (Popup-Blocker) – dann klare Meldung statt Absturz.
export function drucke({ titel, nummer = '', body, einst = {}, fussExtra = '' }) {
  const fenster = window.open('', '_blank', 'width=980,height=1200')
  if (!fenster) {
    alert('Das Druckfenster wurde vom Browser blockiert.\nBitte Pop-ups für diese Seite erlauben und erneut auf PDF klicken.')
    return
  }
  const wartenUndDrucken = `(function(){
    var bilder = Array.prototype.slice.call(document.images);
    var offen = bilder.filter(function(b){ return !b.complete }).length;
    function los(){ setTimeout(function(){ window.focus(); window.print(); }, 200) }
    if (!offen) { los(); return }
    function fertig(){ offen--; if (offen <= 0) los() }
    bilder.forEach(function(b){ if (!b.complete) { b.addEventListener('load', fertig); b.addEventListener('error', fertig) } });
    setTimeout(los, 4000);
  })()`
  fenster.document.write(
    `<!doctype html><html lang="de"><head><meta charset="utf-8">` +
    // Das Druckfenster ist about:blank und hat von sich aus KEINE Basis-Adresse:
    // relative Bildpfade (/demo/foto-01.jpg, hochgeladene Dateien) blieben darin
    // leer. Mit <base> loesen sie gegen die laufende Anwendung auf – egal ob
    // localhost oder die veroeffentlichte Adresse. Damit duerfen in der Datenbank
    // portable, relative Pfade stehen statt fest verdrahteter Hostnamen.
    `<base href="${location.origin}/">` +
    `<title>${esc(titel)}${nummer ? ` ${esc(nummer)}` : ''}</title><style>${STIL}</style></head><body>` +
    kopf({ titel, nummer, einst }) + body + fuss(einst, fussExtra) +
    `<script>${wartenUndDrucken}</${'script'}></body></html>`
  )
  fenster.document.close()
}

// Gefahrene Kilometer: Tachostaende gewinnen gegen die getippte Strecke.
// Gleiche Regel wie in shared/fahrten.js - hier eigenstaendig, weil drucken.js
// bewusst ohne Abhaengigkeiten zum Datenmodell auskommt.
function kmDerFahrt(f) {
  const start = Number(f?.kmStart) || 0
  const ende = Number(f?.kmEnde) || 0
  if (start > 0 && ende > start) return Math.round((ende - start) * 100) / 100
  return Math.round(Math.max(0, Number(f?.km) || 0) * 100) / 100
}

function datumDe(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

function zeitpunktDe(ms) {
  if (!ms) return '–'
  return new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function kundenName(kunde) {
  if (!kunde) return '–'
  return kunde.firma || [kunde.vorname, kunde.nachname].filter(Boolean).join(' ') || kunde.ansprechpartner || '–'
}

function zeile(bezeichnung, wert) {
  if (wert === undefined || wert === null || wert === '') return ''
  return `<div class="zeile"><span>${esc(bezeichnung)}</span><span>${wert}</span></div>`
}

// ---------- 2 Beteiligte: Auftraggeber | Projekt/Baustelle ----------
function beteiligteBlock({ projekt, kunde, datum, monteur, datumLabel = 'Berichtsdatum' }) {
  const kundenBlock = `<div class="block">
    <h3>Auftraggeber / Kunde</h3>
    <strong>${esc(kundenName(kunde))}</strong>
    ${kunde?.ansprechpartner && kunde?.firma ? `<div class="meta">z. Hd. ${esc(kunde.ansprechpartner)}</div>` : ''}
    <div style="margin-top:3px">
      ${esc(kunde?.strasse || '')}${kunde?.strasse ? '<br>' : ''}${esc(kunde?.plzOrt || '')}
    </div>
    ${kunde?.telefon ? `<div class="meta" style="margin-top:3px">Tel. ${esc(kunde.telefon)}</div>` : ''}
    ${kunde?.email ? `<div class="meta">${esc(kunde.email)}</div>` : ''}
  </div>`

  const projektBlock = `<div class="block">
    <h3>Projekt / Baustelle</h3>
    <strong>${esc(projekt?.name || 'Projekt')}</strong>
    ${zeile('Projekt-Nr.', esc(projekt?.nummer || '–'))}
    ${zeile('Baustelle', `${esc(projekt?.anschrift?.strasse || '–')}${projekt?.anschrift?.plzOrt ? `, ${esc(projekt.anschrift.plzOrt)}` : ''}`)}
    ${zeile(datumLabel, `<strong>${datumDe(datum)}</strong>`)}
    ${zeile('Monteur', esc(monteur || '–'))}
    ${projekt?.gewerk ? zeile('Gewerk', esc(projekt.gewerk)) : ''}
  </div>`

  return `<div class="spalten">${kundenBlock}${projektBlock}</div>`
}

// ---------- 6 Fotos: getrennte Sektionen ----------
function fotoSektion(titel, klasse, fotos) {
  if (!fotos?.length) return ''
  return `<div class="fotoblock">
    <h3 class="${klasse}">${esc(titel)} (${fotos.length})</h3>
    <div class="gitter">
      ${fotos.map((f) => `<figure>
        <img src="${esc(f.dataUrl)}" alt="">
        <figcaption>${zeitpunktDe(f.createdAt)}${f.von ? `<br>erfasst von ${esc(f.von)}` : ''}</figcaption>
      </figure>`).join('')}
    </div>
  </div>`
}

function fotoBereiche(fotos = []) {
  const vorher = fotos.filter((f) => f.phase === 'vorher')
  const nachher = fotos.filter((f) => f.phase === 'nachher')
  const sonstige = fotos.filter((f) => f.phase !== 'vorher' && f.phase !== 'nachher')
  if (!fotos.length) return ''
  return `<h2>Fotodokumentation</h2>
    ${fotoSektion('Vorher-Bilder', 'vorher', vorher)}
    ${fotoSektion('Nachher-Bilder', 'nachher', nachher)}
    ${fotoSektion('Weitere Bilder / Belege', 'vorher', sonstige)}`
}

// Beweis-Zeitstempel des Berichts (Erfassung/Einreichung/Freigabe – NICHT der Druckzeitpunkt)
function zeitstempelZeile(bericht) {
  return `<p class="meta" style="margin-top:6px">Erfasst am ${zeitpunktDe(bericht.createdAt)}${
    bericht.eingereichtAm ? ` · eingereicht am ${zeitpunktDe(bericht.eingereichtAm)}${bericht.eingereichtVon ? ` durch ${esc(bericht.eingereichtVon)}` : ''}` : ''}${
    bericht.freigegebenAm ? ` · freigegeben am ${zeitpunktDe(bericht.freigegebenAm)}${bericht.freigegebenVon ? ` durch ${esc(bericht.freigegebenVon)}` : ''}` : ''}</p>`
}

// ---------- 7 Unterschriften: zwei Felder nebeneinander ----------
function unterschriftenBlock(bericht, einst) {
  const f = firma(einst)
  const kundeKlar = bericht?.unterschriftName || ''
  const kundeRolle = [bericht?.unterschriftFunktion, bericht?.unterschriftFirma].filter(Boolean).map(esc).join(' · ')
  const datum = datumDe(bericht?.datum)

  const feld = (art, bild, klar, rolle) => `<div>
    <div class="art">${esc(art)}</div>
    <div class="flaeche">${bild ? `<img src="${esc(bild)}" alt="">` : ''}</div>
    <div class="linie">
      <div class="klar">${klar ? esc(klar) : '&nbsp;'}</div>
      <div class="rolle">${rolle || 'Name in Klarschrift'}</div>
      <div class="rolle">Datum: ${datum}</div>
    </div>
  </div>`

  return `<div class="unterschriften">
    ${feld('Auftraggeber / Bauleitung', bericht?.unterschriftKunde, kundeKlar, kundeRolle)}
    ${feld('Auftragnehmer / Monteur', bericht?.unterschriftMonteur, bericht?.mitarbeiterName || '', esc(f.name))}
  </div>`
}

// ---------- Regiebericht (Stundenlohnzettel VOB/B § 15) / Reklamationsprotokoll ----------
export function druckeRegiebericht({ bericht, projekt, kunde, fotos = [], einst = {} }) {
  const istReklamation = bericht.typ === 'reklamation'
  const titel = istReklamation ? 'Reklamations- / Schadensprotokoll' : 'Regiebericht / Stundenlohnzettel'
  const stunden = bericht.stunden || []
  const material = bericht.material || []
  const stundenSumme = stunden.reduce((s, z) => s + (z.anzahl || 0) * (z.satz || 0), 0)
  const materialSumme = material.reduce((s, z) => s + (z.menge || 0) * (z.preis || 0), 0)

  // VOB/B § 15 Abs. 3: Namen der Arbeitskräfte + Stunden je Person und Tag
  const stundenTabelle = stunden.length ? `<h2>Arbeitszeiten</h2><table>
    <thead><tr>
      <th>Name</th><th>Datum</th><th>Qualifikation</th><th>Von–Bis</th>
      <th class="r">Std.</th><th class="r">Satz</th><th class="r">Betrag</th>
    </tr></thead>
    <tbody>
    ${stunden.map((z) => `<tr>
      <td>${esc(z.name || '–')}</td>
      <td>${datumDe(z.datum)}</td>
      <td>${z.art === 'helfer' ? 'Helfer / Azubi' : 'Facharbeiter Malerhandwerk'}</td>
      <td>${z.von && z.bis ? `${esc(z.von)} – ${esc(z.bis)}` : '–'}</td>
      <td class="r">${esc(z.anzahl)}</td>
      <td class="r">${euro(z.satz)}</td>
      <td class="r">${euro((z.anzahl || 0) * (z.satz || 0))}</td>
    </tr>`).join('')}
    <tr class="summe"><td colspan="6">Summe Arbeitszeit (netto)</td><td class="r">${euro(stundenSumme)}</td></tr>
    </tbody>
  </table>` : ''

  const materialTabelle = material.length ? `<h2>Materialverbrauch</h2><table>
    <thead><tr>
      <th>Material / Artikel</th><th class="r">Menge</th><th>Einheit</th><th class="r">EP</th><th class="r">Betrag</th>
    </tr></thead>
    <tbody>
    ${material.map((z) => `<tr>
      <td>${esc(z.name)}</td>
      <td class="r">${esc(z.menge)}</td>
      <td>${esc(z.einheit || '')}</td>
      <td class="r">${euro(z.preis)}</td>
      <td class="r">${euro((z.menge || 0) * (z.preis || 0))}</td>
    </tr>`).join('')}
    <tr class="summe"><td colspan="4">Summe Material (netto)</td><td class="r">${euro(materialSumme)}</td></tr>
    </tbody>
  </table>` : ''

  // Fahrzeugeinsatz.
  //
  // Ohne Kennzeichen und Strecke ist eine Fahrtkostenposition im Streitfall
  // wertlos - und steuerlich ist ein Fahrtenbuch ohne diese Angaben keines.
  // Freie Fahrten stehen mit 0,00 EUR drin: dokumentiert, nicht berechnet.
  const fahrten = bericht.fahrten || []
  const fahrtSummeBetrag = fahrten.reduce(
    (s, f) => s + (f.berechnen === false ? 0 : kmDerFahrt(f) * (Number(f.satz) || 0)), 0)
  const fahrtKm = fahrten.reduce((s, f) => s + kmDerFahrt(f), 0)
  const fahrtTabelle = fahrten.length ? `<h2>Fahrzeugeinsatz</h2><table>
    <thead><tr>
      <th>Datum</th><th>Kennzeichen</th><th>Fahrer</th><th>Von</th><th>Nach</th>
      <th class="r">km</th><th class="r">Satz</th><th class="r">Betrag</th>
    </tr></thead>
    <tbody>
    ${fahrten.map((f) => {
      const km = kmDerFahrt(f)
      const frei = f.berechnen === false
      // Rückfahrten als solche kennzeichnen: Auf dem Papier stehen sonst zwei
      // Zeilen mit vertauschten Adressen, und der Prüfer fragt sich, ob da
      // jemand dieselbe Fahrt zweimal eingetragen hat.
      const richtung = f.ausFahrt ? '<span class="meta">Rückfahrt</span><br>' : ''
      // Tachostände werden nicht mehr erfasst; Altbestände zeigen sie weiter.
      const tacho = (Number(f.kmStart) || 0) > 0 && (Number(f.kmEnde) || 0) > 0
        ? `<span class="meta"><br>${Number(f.kmStart).toLocaleString('de-DE')} \u2013 ${Number(f.kmEnde).toLocaleString('de-DE')}</span>`
        : ''
      return `<tr>
        <td>${datumDe(f.datum)}</td>
        <td><strong>${esc(f.kennzeichen || '\u2013')}</strong>${f.fahrzeug ? `<span class="meta"><br>${esc(f.fahrzeug)}</span>` : ''}</td>
        <td>${esc(f.fahrer || '\u2013')}</td>
        <td>${richtung}${esc(f.von || '\u2013')}</td>
        <td>${esc(f.nach || '\u2013')}${f.zweck ? `<span class="meta"><br>${esc(f.zweck)}</span>` : ''}</td>
        <td class="r">${km.toLocaleString('de-DE')}${tacho}</td>
        <td class="r">${frei ? '\u2013' : euro(f.satz)}</td>
        <td class="r">${frei ? '<span class="meta">nicht berechnet</span>' : euro(km * (Number(f.satz) || 0))}</td>
      </tr>`
    }).join('')}
    <tr class="summe">
      <td colspan="5">Summe Fahrzeugeinsatz (${fahrtKm.toLocaleString('de-DE')} km gefahren)</td>
      <td class="r">${fahrtKm.toLocaleString('de-DE')}</td><td></td>
      <td class="r">${euro(fahrtSummeBetrag)}</td>
    </tr>
    </tbody>
  </table>` : ''

  const gesamt = (stunden.length || material.length || fahrten.length)
    ? `<div class="gesamt">Gesamtsumme netto: ${euro(stundenSumme + materialSumme + fahrtSummeBetrag)}</div>`
    : ''

  // Anordnung/Anzeige der Stundenlohnarbeiten (VOB/B § 15 Abs. 3 Satz 1)
  const anordnung = !istReklamation && bericht.angeordnetDurch
    ? `<div class="box">Die Stundenlohnarbeiten wurden am <strong>${datumDe(bericht.angeordnetAm)}</strong>
       durch <strong>${esc(bericht.angeordnetDurch)}</strong>
       ${bericht.anzeigeArt === 'schriftlich' ? 'schriftlich' : bericht.anzeigeArt === 'mail' ? 'per E-Mail' : 'mündlich vor Ort'}
       angeordnet bzw. angezeigt – <strong>§ 15 Abs. 3 VOB/B</strong>.</div>`
    : ''

  // Fristen-Block bei Reklamationen (§ 13 Abs. 5 VOB/B)
  const ruege = istReklamation && (bericht.geruegtDurch || bericht.ruegeZugangAm || bericht.fristBis)
    ? `<div class="box warn">Mängelrüge${bericht.ruegeZugangAm ? ` zugegangen am <strong>${datumDe(bericht.ruegeZugangAm)}</strong>` : ''}${bericht.geruegtDurch ? ` durch <strong>${esc(bericht.geruegtDurch)}</strong>` : ''}${bericht.fristBis ? ` · Frist zur Beseitigung: <strong>${datumDe(bericht.fristBis)}</strong>` : ''} (§ 13 Abs. 5 VOB/B).</div>`
    : ''

  // Anerkennungsfiktion (§ 15 Abs. 3 VOB/B: 6 Werktage)
  const fiktion = !istReklamation
    ? `<div class="box recht"><strong>Rechtlicher Hinweis:</strong> Einwendungen gegen diesen Stundenlohnnachweis
       sind innerhalb von <strong>6 Werktagen</strong> nach Zugang geltend zu machen; andernfalls gilt der
       Nachweis gemäß § 15 Abs. 3 VOB/B als anerkannt.</div>`
    : ''

  drucke({
    titel,
    nummer: bericht.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: bericht.datum, monteur: bericht.mitarbeiterName })}
      ${anordnung}
      ${ruege}
      <h2>${istReklamation ? 'Beschreibung des Mangels / Schadens' : 'Ausgeführte Arbeiten'}</h2>
      <div class="feld">${escBr(bericht.beschreibung || '–')}</div>
      ${istReklamation && bericht.ursache ? `<h2>Ursache</h2><div class="feld">${escBr(bericht.ursache)}</div>` : ''}
      ${istReklamation && bericht.massnahme ? `<h2>Maßnahme zur Nachbesserung</h2><div class="feld">${escBr(bericht.massnahme)}</div>` : ''}
      ${stundenTabelle}
      ${materialTabelle}
      ${fahrtTabelle}
      ${gesamt}
      ${fotoBereiche(fotos)}
      ${fiktion}
      ${zeitstempelZeile(bericht)}
      ${unterschriftenBlock(bericht, einst)}`,
  })
}

// ---------- Abnahmeprotokoll ----------
//
// AP 9 (Plan Kapitel 7): das Protokoll baut sich aus dem Fotobestand von
// selbst. `seiten` (aus shared/abnahme.js abnahmeSeiten) liefert je Raum
// beide Bildpaare Auftrag + Regie samt Beweiszeile (Aufnahmezeit mit Quelle,
// Servereingang, Prüfsumme – nie der Druckzeitpunkt), `ausgenommen` die
// unvollständigen Räume fürs Deckblatt (Teilabnahme statt Alles-oder-nichts).
// Ohne `seiten` druckt die Funktion wie bisher nur das Deckblatt (V1-Daten).

// Beweiszeile unter einem Raumbild (Plan 7.4: macht aus einem bestreitbaren
// Bild ein Dokument). `beleg` kommt aus fotoBeleg (shared/abnahme.js).
function raumBild(titel, beleg) {
  if (!beleg || !beleg.bild) {
    return `<div style="flex:1 1 0" class="block"><strong>${esc(titel)}</strong>
      <p class="meta" style="margin-top:4px">Kein Bild vorhanden.</p></div>`
  }
  return `<figure style="flex:1 1 0; margin:0" class="block">
    <figcaption style="font-size:8.5pt; margin-bottom:3px"><strong>${esc(titel)}</strong>
      · ${zeitpunktDe(beleg.aufgenommenAm)} (${esc(beleg.quelle)})</figcaption>
    <img src="${esc(beleg.bild)}" alt="" style="width:100%; height:6.2cm; object-fit:cover; border-radius:5px; border:1px solid #e2e8f0; background:#f1f5f9">
    <figcaption class="meta" style="margin-top:2px">
      Server ${beleg.hochgeladenAm ? zeitpunktDe(beleg.hochgeladenAm) : 'noch nicht eingegangen'}
      · Prüfsumme ${esc(beleg.pruefsumme || '–')}
    </figcaption>
  </figure>`
}

function raumSeite(seite, { projekt, bericht }) {
  const raum = seite.raum || {}
  const flaeche = Number(raum.grundflaeche) || 0
  const stand = raum.aufmassStand === 'geschaetzt' ? 'geschätzt'
    : raum.aufmassStand === 'bestaetigt' ? 'bestätigt' : raum.aufmassStand === 'gemessen' ? 'gemessen' : ''

  const mengenZeilen = (seite.auftrag?.zeilen || []).map((z) => `<tr>
    <td>${esc(z.schritt)}${z.fertig ? '' : ' <span class="meta">(offen)</span>'}</td>
    <td class="r">${z.menge ? esc(z.menge.toLocaleString('de-DE', { maximumFractionDigits: 3 })) : '–'}</td>
    <td>${esc(z.einheit || '')}</td>
    <td>${esc(z.oz || '')}</td>
  </tr>`).join('')

  const regie = seite.regie
  const regieBlock = regie ? `
    <h2>Regie (zusätzlich angeordnet)</h2>
    <div class="box">
      Anordnung: <strong>${esc(regie.angeordnetDurch || '–')}</strong>, ${datumDe(regie.angeordnetAm)}, ${esc(regie.anzeigeText)}
      ${regie.titel ? ` – ${esc(regie.titel)}` : ''}<br>
      ${regie.vorgelegtAm
        ? `Stundenzettel vorgelegt ${datumDe(regie.vorgelegtAm)}${regie.bestritten
            ? ' · <strong>bestritten</strong>'
            : ` · gilt seit <strong>${datumDe(regie.anerkanntAb)}</strong> als anerkannt (§ 15 Abs. 3 VOB/B)`}`
        : '<span class="meta">Stundenzettel noch nicht vorgelegt (§ 15 Abs. 3 VOB/B).</span>'}
    </div>
    <div style="display:flex; gap:10px" class="fotoblock">
      ${raumBild('VORHER', regie.vorher)}
      ${raumBild('NACHHER', regie.nachher)}
    </div>
    ${regie.stunden || regie.beschreibung ? `<p style="margin-top:5px">
      Ausgeführt: ${esc(regie.beschreibung || regie.titel || '–')}${regie.stunden ? ` · <strong>${regie.stunden.toLocaleString('de-DE')} Std.</strong>` : ''}
    </p>` : ''}` : ''

  return `<section style="break-before:page">
    <h2>Raum ${esc(raum.nummer || '')} ${esc(raum.name ? `„${raum.name}“` : '')}
      ${flaeche ? `· ${flaeche.toLocaleString('de-DE')} m²` : ''}${stand ? ` (${stand})` : ''}</h2>
    <p class="meta">Abnahme vom ${datumDe(bericht.datum)}${projekt?.vertragNummer || projekt?.vertragDatum
      ? ` · Vertragsgrundlage: ${esc(projekt.vertragNummer || 'NU-Vertrag')}${projekt.vertragDatum ? ` vom ${datumDe(projekt.vertragDatum)}` : ''}` : ''}</p>
    <h2>Auftrag (Vertragsleistung)</h2>
    ${mengenZeilen ? `<table>
      <thead><tr><th>Leistung</th><th class="r">Menge</th><th>Einh.</th><th>Pos.</th></tr></thead>
      <tbody>${mengenZeilen}</tbody>
    </table>` : '<p class="meta">Keine Aufgaben zu diesem Raum erfasst.</p>'}
    <div style="display:flex; gap:10px; margin-top:8px" class="fotoblock">
      ${raumBild('VORHER', seite.auftrag?.vorher)}
      ${raumBild('NACHHER', seite.auftrag?.nachher)}
    </div>
    ${seite.auftrag?.ausgefuehrt ? `<p style="margin-top:5px">Ausgeführt: ${esc(seite.auftrag.ausgefuehrt)}</p>` : ''}
    ${regieBlock}
  </section>`
}

export function druckeAbnahme({ bericht, projekt, kunde, fotos = [], seiten = [], ausgenommen = [], bereitsAbgenommen = [], grundText = null, einst = {} }) {
  const maengel = bericht.maengel || []
  const ergebnis = bericht.ohneMaengel
    ? '<div class="box"><strong>Die Leistungen wurden ohne Mängel abgenommen.</strong></div>'
    : `<div class="box warn"><strong>Abnahme mit folgenden Mängeln / Restarbeiten:</strong>${
        bericht.ruegeZugangAm
          ? ` Mängelrüge zugegangen am <strong>${datumDe(bericht.ruegeZugangAm)}</strong> (maßgeblich ist der Zugang, nicht die Erstellung).`
          : ''}</div>
       <table><thead><tr><th>Mangel / Restarbeit</th><th>Frist zur Beseitigung</th></tr></thead><tbody>
       ${maengel.map((m) => `<tr><td>${esc(m.text || '')}</td><td>${datumDe(m.frist)}</td></tr>`).join('') || '<tr><td colspan="2" class="meta">Keine Einzelmängel erfasst.</td></tr>'}
       </tbody></table>`

  // Verjährung: VOB 4 Jahre / BGB 5 Jahre – abgeleitet aus dem Kundentyp
  const istVob = (kunde?.typ || 'gu') === 'gu'
  const monate = istVob ? 48 : 60
  const ende = (() => {
    if (!bericht.datum) return null
    const d = new Date(bericht.datum + 'T12:00:00')
    d.setMonth(d.getMonth() + monate)
    return d.toLocaleDateString('de-DE')
  })()

  // Vertragsstrafen-Vorbehalt mit genau ZWEI Zuständen (Plan 7.7): Nach
  // § 11 Abs. 4 VOB/B verfällt die Vertragsstrafe ohne Vorbehalt bei der
  // Abnahme. „keine Angabe" wäre eine Einladung, später einen mündlichen
  // Vorbehalt zu behaupten – deshalb druckt „nein" den ausdrücklichen Satz.
  const strafeText = bericht.vorbehaltVertragsstrafe === true
    ? 'Vertragsstrafe gemäß § 11 VOB/B vorbehalten: <strong>JA</strong>'
    : bericht.vorbehaltVertragsstrafe === false
      ? '<strong>Ein Vorbehalt der Vertragsstrafe (§ 11 VOB/B) wurde bei der Abnahme nicht erklärt.</strong>'
      : 'Vertragsstrafe gemäß § 11 VOB/B vorbehalten: <strong>keine Angabe</strong> <span class="meta">(Altbestand – Pflichtfeld seit V2)</span>'
  const sonstigeText = bericht.vorbehalteSonstigeKeine === true && !bericht.vorbehalteSonstige
    ? '<strong>Sonstige Vorbehalte wurden bei der Abnahme nicht erklärt.</strong>'
    : `Sonstige Vorbehalte (bekannte Mängel / Restleistungen): ${esc(bericht.vorbehalteSonstige || 'keine Angabe')}`
  const vorbehalte = `<h2>Vorbehalte des Auftraggebers</h2>
    <div class="box${bericht.vorbehaltVertragsstrafe ? ' warn' : ''}">
      ${strafeText}<br>
      ${sonstigeText}
    </div>`

  // Teilabnahme (Plan 7.5): unvollständige Räume stehen NAMENTLICH mit Grund
  // auf dem Deckblatt – sie sind nicht Gegenstand dieser Abnahme, für sie
  // läuft keine Frist und startet keine Gewährleistung.
  const grund = (g) => (grundText ? grundText(g) : g)
  const teilabnahmeBlock = ausgenommen.length || bereitsAbgenommen.length ? `
    ${ausgenommen.length ? `<div class="box warn">
      <strong>Nicht Gegenstand dieser Abnahme (${ausgenommen.length} Raum/Räume):</strong>
      <ul>${ausgenommen.map(({ raum, gruende }) => `<li>${esc([raum.nummer, raum.name].filter(Boolean).join(' '))}
        – ${gruende.map((g) => esc(grund(g))).join(', ')}</li>`).join('')}</ul>
      <span class="meta">Für diese Räume läuft keine Abnahmefrist und beginnt keine Verjährung;
      sie werden gesondert abgenommen.</span>
    </div>` : ''}
    ${bereitsAbgenommen.length ? `<div class="box recht">
      Bereits früher abgenommen: ${bereitsAbgenommen.map((r) => `${esc([r.nummer, r.name].filter(Boolean).join(' '))} (${datumDe(r.abnahmeAm)})`).join(', ')}.
    </div>` : ''}` : ''

  const abnahmeUmfang = seiten.length
    ? `<div class="box">Gegenstand: <strong>${seiten.length} Raum/Räume</strong> gemäß den folgenden Raumseiten
       (je Raum Vorher-/Nachher-Bildpaar Auftrag und – soweit angeordnet – Regie). Die Gewährleistungsfrist
       beginnt RAUMWEISE mit dieser Abnahme.</div>`
    : ''

  drucke({
    titel: `Abnahmeprotokoll${bericht.abnahmeArt === 'teil' || ausgenommen.length ? ' (Teilabnahme)' : ''}`,
    nummer: bericht.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: bericht.datum, monteur: bericht.mitarbeiterName, datumLabel: 'Abnahmedatum' })}
      ${bericht.ort ? `<div class="box">Ort der Abnahme: <strong>${esc(bericht.ort)}</strong></div>` : ''}
      <h2>Gegenstand der Abnahme (${bericht.abnahmeArt === 'teil' || ausgenommen.length ? 'Teilabnahme' : 'Gesamtabnahme'})</h2>
      <div class="feld">${escBr(bericht.leistungsumfang || 'Vertraglich geschuldete Maler- und Lackierarbeiten gemäß Leistungsverzeichnis.')}</div>
      ${abnahmeUmfang}
      ${teilabnahmeBlock}
      <h2>Ergebnis der Abnahme</h2>
      ${ergebnis}
      ${vorbehalte}
      ${bericht.beschreibung ? `<h2>Bemerkungen</h2><div class="feld">${escBr(bericht.beschreibung)}</div>` : ''}
      ${fotoBereiche(fotos)}
      <div class="box recht">
        Die Abnahme erfolgt gemäß § 12 VOB/B. Mit der Abnahme geht die Gefahr auf den Auftraggeber über
        (§ 12 Abs. 6 VOB/B). Die Verjährungsfrist für Mängelansprüche beträgt
        <strong>${istVob ? '4 Jahre gemäß § 13 Abs. 4 VOB/B' : '5 Jahre gemäß § 634a BGB'}</strong>,
        beginnt mit der Abnahme am ${datumDe(bericht.datum)}${ende ? ` und endet am <strong>${ende}</strong>` : ''}${seiten.length ? ' (je abgenommenem Raum)' : ''}.
      </div>
      ${zeitstempelZeile(bericht)}
      ${unterschriftenBlock(bericht, einst)}
      ${seiten.map((s) => raumSeite(s, { projekt, bericht })).join('')}`,
  })
}

// ---------- Arbeitsauftrag für die Baustelle ----------
export function druckeArbeitsauftrag({ termin, projekt, kunde, positionen = [], mitarbeiter = [], einst = {} }) {
  const aufgaben = positionen.length ? `<h2>Aufgaben / Leistungen</h2><table>
    <thead><tr><th>OZ</th><th>Leistung</th><th class="r">Menge</th><th>ME</th><th class="r">erledigt</th></tr></thead>
    <tbody>
    ${positionen.map((p) => `<tr>
      <td>${esc(p.oz || '')}</td>
      <td>${esc(p.kurztext || '')}</td>
      <td class="r">${esc(p.menge ?? '')}</td>
      <td>${esc(p.einheit || '')}</td>
      <td class="r">☐</td>
    </tr>`).join('')}
    </tbody></table>` : ''

  drucke({
    titel: 'Arbeitsauftrag',
    nummer: projekt?.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: termin?.datum, monteur: mitarbeiter.join(', '), datumLabel: 'Einsatzdatum' })}
      <div class="box">
        <strong>${esc(termin?.titel || termin?.behandlung || 'Einsatz')}</strong><br>
        Zeit: <strong>${esc(termin?.start || '')} – ${esc(termin?.ende || '')} Uhr</strong>
      </div>
      <h2>Hinweise für das Team</h2>
      <div class="feld">${escBr(termin?.beschreibung || '–')}</div>
      ${aufgaben}
      <h2>Rückmeldung von der Baustelle</h2>
      <div class="feld" style="min-height:2.6cm"></div>
      <div class="unterschriften">
        <div>
          <div class="art">Auftraggeber / Bauleitung</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">&nbsp;</div><div class="rolle">Name in Klarschrift</div><div class="rolle">Datum:</div></div>
        </div>
        <div>
          <div class="art">Auftragnehmer / Monteur</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">${esc(mitarbeiter.join(', ') || '')}</div><div class="rolle">${esc(firma(einst).name)}</div><div class="rolle">Datum:</div></div>
        </div>
      </div>`,
  })
}

// Hinweis: Es gibt bewusst KEINEN Rechnungs-Eigendruck mehr.
// Das Rechnungs-PDF (inkl. E-Rechnung) erzeugt ausschliesslich FastBill;
// die Verwaltung verlinkt es ueber rechnung.dokumentUrl (Abrechnung -> PDF (FastBill)).

// ---------------------------------------------------------------------------
// Monats-Stundenliste je Mitarbeiter (BG-Bau-tauglicher Stundenzettel)
//
// Aufbau nach der Blanko-Vorlage von bautagebuch.org, auf einen MONAT umgebaut:
//   Kopfdaten (Mitarbeiter/Firma, Zeitraum) -> Arbeitszeiten-Tabelle mit einer
//   Zeile je Tag -> Summe & Bemerkungen -> zwei Unterschriftszeilen.
//
// Datengrundlage sind die Stundenzeilen aus den Regieberichten (§ 15 Abs. 3
// VOB/B). Die Pause ergibt sich aus der Differenz zwischen Anwesenheit
// (Von–Bis) und den gemeldeten Arbeitsstunden – genau so, wie ein
// Stundenzettel gelesen wird.
//
// Bewusst deutsch: Das Blatt geht an Auftraggeber, Lohnbüro, Berufsgenossen-
// schaft und im Streitfall ans Gericht.
// ---------------------------------------------------------------------------

const WOCHENTAG_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function stundenText(n) {
  return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * @param mitarbeiter  { name, qualifikation }
 * @param tage         [{ datum, wochentag, beginn, ende, pauseMin, stunden, taetigkeit }]
 * @param zeitraum     { von, bis, titel }   z. B. { titel: 'August 2026' }
 * @param summe        Gesamtstunden des Zeitraums
 */
export function druckeStundenliste(daten) {
  drucke({
    titel: 'Stundenzettel',
    einst: daten.einst || {},
    fussExtra: `Zeitraum ${daten.zeitraum?.titel || ''}`,
    body: stundenBlatt(daten),
  })
}

/**
 * Mehrere Stundenzettel in EINEM Dokument, je Person eine Seite.
 *
 * Warum nicht einfach druckeStundenliste() in einer Schleife: Browser lassen
 * pro Klick nur EIN window.open durch. Ab dem zweiten Blatt kam bisher nur die
 * Popup-Blocker-Meldung – wer zehn Monteure hat, bekam einen Zettel.
 */
export function druckeStundenlistenSammel(blaetter = [], einst = {}) {
  if (!blaetter.length) return
  const body = blaetter
    .map((b, i) => `<section${i > 0 ? ' style="break-before:page"' : ''}>${stundenBlatt(b)}</section>`)
    .join('')
  drucke({
    titel: 'Stundenzettel',
    einst,
    fussExtra: `Zeitraum ${blaetter[0].zeitraum?.titel || ''} · ${blaetter.length} Blätter`,
    body,
  })
}

function stundenBlatt({ mitarbeiter, tage = [], zeitraum, summe, summeAuftrag = 0, summeRegie = 0, regie = [], bemerkungen = '', einst = {} }) {
  const f = firma(einst)
  const unstimmige = tage.filter((t) => t.unstimmig).length
  const zeilen = tage.map((t) => {
    const leer = !t.stunden
    const klassen = [leer ? 'leer' : '', t.unstimmig ? 'pruefen' : ''].filter(Boolean).join(' ')
    return `<tr${klassen ? ` class="${klassen}"` : ''}>
      <td>${esc(t.wochentag)}</td>
      <td>${esc(t.datum)}</td>
      <td class="r">${esc(t.beginn || '')}</td>
      <td class="r">${esc(t.ende || '')}</td>
      <td class="r">${t.unstimmig ? '<strong>!</strong>' : (t.pauseMin ? esc(String(t.pauseMin)) : '')}</td>
      <td class="r">${t.stunden ? esc(stundenText(t.stunden)) : ''}</td>
      <td>${esc(t.art || '')}</td>
      <td>${escBr(t.taetigkeit || '')}</td>
    </tr>`
  }).join('')

  // Regieteil (AP 9, Plan 6.4 Punkt 3): NUR hier stehen Satz und Betrag –
  // er ist Vergütungsnachweis gegenüber dem Auftraggeber. Der Auftragsteil
  // oben bleibt ohne Satz (Innenkalkulation und Lohnnachweis). Jede Zeile
  // nennt ihre Anordnung (§ 15 Abs. 3 VOB/B).
  const regieSummeCent = regie.reduce((s, z) => s + (Number(z.betragCent) || 0), 0)
  const regieTabelle = regie.length ? `
      <h2>Regiestunden (Vergütungsnachweis, § 15 Abs. 3 VOB/B)</h2>
      <table>
        <thead><tr>
          <th>Datum</th><th class="r">Std.</th><th class="r">Satz</th><th class="r">Betrag</th><th>Anordnung</th>
        </tr></thead>
        <tbody>
        ${regie.map((z) => `<tr>
          <td>${datumDe(z.datum)}</td>
          <td class="r">${esc(stundenText(z.stunden))}</td>
          <td class="r">${euro((Number(z.satzCent) || 0) / 100)}</td>
          <td class="r">${euro((Number(z.betragCent) || 0) / 100)}</td>
          <td>${esc(z.anordnung || '–')}</td>
        </tr>`).join('')}
        <tr class="summe"><td>Summe Regie</td><td class="r">${esc(stundenText(summeRegie))}</td><td></td>
          <td class="r">${euro(regieSummeCent / 100)}</td><td></td></tr>
        </tbody>
      </table>` : ''

  return `
      <h2>Kopfdaten</h2>
      <div class="spalten">
        <div class="block">
          <h3>Mitarbeiter/in</h3>
          <strong>${esc(mitarbeiter?.name || '–')}</strong>
          ${mitarbeiter?.qualifikation ? `<div class="meta">${esc(mitarbeiter.qualifikation)}</div>` : ''}
        </div>
        <div class="block">
          <h3>Firma</h3>
          <strong>${esc(f.name)}</strong>
          <div class="meta">${esc(f.anschrift)}</div>
        </div>
      </div>
      <div class="spalten">
        <div class="block">
          <h3>Abrechnungszeitraum</h3>
          <strong>${esc(zeitraum?.titel || '–')}</strong>
          <div class="meta">${esc(zeitraum?.von || '')} bis ${esc(zeitraum?.bis || '')}</div>
        </div>
        <div class="block">
          <h3>Erfasste Arbeitstage</h3>
          <strong>${tage.filter((t) => t.stunden > 0).length}</strong>
          <div class="meta">von ${tage.length} Kalendertagen</div>
        </div>
      </div>

      <h2>Arbeitszeiten</h2>
      <table class="stunden">
        <thead>
          <tr>
            <th>Tag</th><th>Datum</th><th class="r">Beginn</th><th class="r">Ende</th>
            <th class="r">Pause (Min.)</th><th class="r">Stunden</th><th>Art</th><th>Tätigkeit / Baustelle</th>
          </tr>
        </thead>
        <tbody>${zeilen}</tbody>
        <tfoot>
          <tr class="summe">
            <td colspan="5">Auftrag ${esc(stundenText(summeAuftrag))} h · Regie ${esc(stundenText(summeRegie))} h · gesamt</td>
            <td class="r">${esc(stundenText(summe))}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>

      ${unstimmige > 0 ? `<div class="box warn">
        <strong>Bitte prüfen:</strong> An ${unstimmige} mit „!" markierten Tag(en) sind mehr
        Stunden gemeldet, als zwischen Beginn und Ende liegen. Solange das nicht geklärt ist,
        trägt dieses Blatt für diese Tage keinen Nachweis.
      </div>` : ''}
      ${regieTabelle}

      <h2>Summe &amp; Bemerkungen</h2>
      <div class="feld">${escBr(bemerkungen || '')}</div>

      <div class="box recht">
        Grundlage ist die im System geführte Stundensammlung je Person und Tag
        (§ 15 Abs. 3 VOB/B) – Auftrags- und Regiestunden getrennt ausgewiesen.
        Der Auftragsteil dient als Lohnnachweis (ohne Satz); der Regieteil ist
        Vergütungsnachweis mit Anordnung. Die Pausenzeit ergibt sich aus der
        Differenz zwischen Anwesenheit und gemeldeter Arbeitszeit.
      </div>

      <div class="unterschriften">
        <div>
          <div class="art">Mitarbeiter/in</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">${esc(mitarbeiter?.name || '')}</div><div class="rolle">Ort, Datum, Unterschrift</div></div>
        </div>
        <div>
          <div class="art">Arbeitgeber / Bauleitung</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">&nbsp;</div><div class="rolle">Ort, Datum, Unterschrift</div></div>
        </div>
      </div>`
}

// ---------- Aufmaßblatt (§ 14 Abs. 1 VOB/B) ----------
//
// Das Papier, das bisher ganz fehlte: Ohne die Mengenberechnung als Anlage
// ist die Rechnung nicht prüfbar und nach § 14 Abs. 4 nicht fällig.
// Aufbau nach Plan 8.4: Kopf mit Regelwerk im KLARTEXT (die Korrektur um
// 15–19 % mehr Fläche muss auf dem Papier begründet sein, sonst schafft sie
// Streit statt Geld), je Position die Zeilen mit Ort/Ansatz/Faktor/Menge/Art,
// geschätzte Zeilen ⚠ und ausdrücklich GESPERRT, Summe gegen Vertragsmenge
// mit § 2-Abs.-3-Warnung, unten das gemeinsame Aufmaß nach § 14 Abs. 2.
//
// `gruppen` kommt aus positionsUebersicht (shared/abrechnung.js);
// `regelwerk` ist der Schnappschuss { name, klartext } – drucken.js schlägt
// bewusst nichts nach.

function mengeText(n) {
  return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

const AUFMASS_ART = { wand: 'haupt', decke: 'haupt', haupt: 'haupt', leibung: 'Leibung', zulage: 'Zulage', abzug: 'Abzug' }

export function druckeAufmassblatt({ projekt, kunde, gruppen = [], regelwerk = null, einst = {} }) {
  const geschaetztGesamt = gruppen.reduce((s, g) => s + (g.geschaetztAnzahl || 0), 0)

  const regelBlock = `<div class="box recht">
    <strong>Abrechnungsregel:</strong> ${esc(regelwerk?.name || 'nicht festgelegt – bitte am Projekt nachtragen')}<br>
    ${esc(regelwerk?.klartext || '')}
  </div>`

  const positionsBloecke = gruppen.map((g) => {
    const zeilen = g.zeilen.map((z) => {
      const gesperrt = Boolean(z.geschaetzt)
      return `<tr${gesperrt ? ' class="pruefen"' : ''} style="${gesperrt ? 'background:#fefce8' : ''}">
        <td>${esc(z.bauteil || z.raumName || '–')}</td>
        <td dir="ltr">${esc(z.ansatz || '–')}</td>
        <td class="r">${esc(String(z.faktor ?? 1))}</td>
        <td class="r">${mengeText(z.menge)}</td>
        <td>${esc(AUFMASS_ART[z.art] || z.art || 'haupt')}${gesperrt ? ' <strong>⚠ geschätzt</strong>' : ''}</td>
      </tr>`
    }).join('')
    const ab = g.abweichung || {}
    const abText = g.vertrag > 0
      ? `${ab.prozent > 0 ? '+' : ''}${(ab.prozent || 0).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
      : '–'
    return `<h2>Pos. ${esc(g.oz || '–')} · ${esc(g.kurztext || 'ohne LV-Position (§ 2 Abs. 6 VOB/B)')} · Einh. ${esc(g.einheit || 'm²')}</h2>
      <table>
        <thead><tr><th>Ort</th><th>Ansatz</th><th class="r">Fak.</th><th class="r">Menge</th><th>Art</th></tr></thead>
        <tbody>
          ${zeilen}
          <tr class="summe"><td colspan="3">Summe Position</td><td class="r">${mengeText(g.aufmass)}</td><td>${esc(g.einheit || '')}</td></tr>
          <tr><td colspan="3" class="meta">Vertragsmenge</td><td class="r meta">${g.vertrag > 0 ? mengeText(g.vertrag) : '–'}</td><td class="meta">${esc(g.einheit || '')}</td></tr>
          <tr><td colspan="3" class="meta">Abweichung</td><td class="r"><strong>${abText}</strong></td><td></td></tr>
        </tbody>
      </table>
      ${ab.ueberSchwelle ? `<div class="box warn"><strong>§ 2 Abs. 3 VOB/B:</strong> ${esc(ab.hinweis)}</div>` : ''}`
  }).join('')

  drucke({
    titel: 'Aufmaßblatt',
    nummer: projekt?.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: '', datumLabel: 'Aufmaß-Stand', monteur: '' })}
      ${regelBlock}
      ${positionsBloecke || '<p class="meta">Keine Aufmaßzeilen vorhanden.</p>'}
      ${geschaetztGesamt > 0 ? `<div class="box warn"><strong>⚠ ${geschaetztGesamt} Zeile(n) geschätzt</strong> (Umfang oder Bodenaufbau nicht gemessen) –
        für die Rechnung <strong>gesperrt</strong>, bis sie nachgemessen und bestätigt sind.</div>` : ''}
      <div class="box recht"><strong>Gemeinsames Aufmaß nach § 14 Abs. 2 VOB/B.</strong>
        Das Aufmaß wurde gemeinsam vorgenommen bzw. dem Auftraggeber zur gemeinsamen Feststellung angeboten.</div>
      <div class="unterschriften">
        <div>
          <div class="art">für den Auftragnehmer</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">&nbsp;</div><div class="rolle">Datum, Name, Funktion</div></div>
        </div>
        <div>
          <div class="art">für den Auftraggeber</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">&nbsp;</div><div class="rolle">Datum, Name, Funktion</div></div>
        </div>
      </div>`,
  })
}

// ---------- Nachtragsankündigung (§ 2 Abs. 6 VOB/B) ----------
//
// Das Ein-Klick-Dokument: Sobald Leistungen OHNE LV-Position anstehen, muss
// der Vergütungsanspruch VOR Ausführungsbeginn angekündigt werden – sonst ist
// er dem Grunde nach verloren (Plan 8.6). `aufgaben` sind die betroffenen
// Aufgaben (Raum, Schritt, Menge); der Zugang wird handschriftlich vermerkt.

export function druckeNachtragsankuendigung({ projekt, kunde, aufgaben = [], einst = {} }) {
  const zeilen = aufgaben.map((a) => `<tr>
    <td>${esc([a.raumNummer, a.raumName].filter(Boolean).join(' ') || a.raumId || '–')}</td>
    <td>${esc(a.schrittNameDe || a.kurztext || '–')}</td>
    <td class="r">${a.menge ? mengeText(a.menge) : '–'}</td>
    <td>${esc(a.einheit || '')}</td>
  </tr>`).join('')

  drucke({
    titel: 'Nachtragsankündigung',
    nummer: projekt?.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: '', datumLabel: 'Datum', monteur: '' })}
      <div class="box recht"><strong>Ankündigung eines Anspruchs auf besondere Vergütung – § 2 Abs. 6 VOB/B.</strong><br>
        Für die nachfolgend aufgeführten, im Leistungsverzeichnis <strong>nicht vorgesehenen</strong> Leistungen
        wird hiermit <strong>vor Beginn der Ausführung</strong> ein Anspruch auf besondere Vergütung angekündigt.
        Die Höhe der Vergütung wird gemäß § 2 Abs. 6 Nr. 2 VOB/B nach den Grundlagen der Preisermittlung für die
        vertragliche Leistung bestimmt und in einem Nachtragsangebot beziffert.</div>
      <h2>Betroffene Leistungen (ohne LV-Position)</h2>
      <table>
        <thead><tr><th>Ort / Raum</th><th>Leistung</th><th class="r">Menge (vorauss.)</th><th>Einheit</th></tr></thead>
        <tbody>${zeilen || '<tr><td colspan="4" class="meta">–</td></tr>'}</tbody>
      </table>
      <h2>Zugang beim Auftraggeber</h2>
      <div class="box">
        Übergeben am: ____________ &nbsp; an: ______________________________<br><br>
        ☐ persönlich übergeben (Quittung) &nbsp;&nbsp; ☐ per E-Mail &nbsp;&nbsp; ☐ per Post/Bautagebuch
        <br><br><span class="meta">Der Zugang dieser Ankündigung ist nachzuweisen – ohne nachweisbaren Zugang
        vor Ausführungsbeginn besteht der Vergütungsanspruch dem Grunde nach nicht.</span>
      </div>
      <div class="unterschriften">
        <div>
          <div class="art">Auftragnehmer</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">${esc(firma(einst).name)}</div><div class="rolle">Datum, Unterschrift</div></div>
        </div>
        <div>
          <div class="art">Zugang bestätigt (Auftraggeber)</div>
          <div class="flaeche"></div>
          <div class="linie"><div class="klar">&nbsp;</div><div class="rolle">Datum, Name, Unterschrift</div></div>
        </div>
      </div>`,
  })
}

// ---------- Abschlussbericht / Fertigstellungsanzeige ----------
//
// "Wenn die Baustelle fertig ist, kann man anhand der Tätigkeiten einen Bericht
// erstellen." Genau das leistet dieser Ausdruck: Er sammelt, was auf der
// Baustelle tatsächlich abgehakt wurde, und macht daraus ein Dokument.
//
// WARUM AUSGERECHNET DIESES DOKUMENT
// Ein "Abschlussbericht" ist kein Rechtsbegriff. Der Vorgang dahinter schon:
// Nach § 12 Abs. 1 VOB/B zeigt der Auftragnehmer die Fertigstellung an und
// verlangt die Abnahme; der Auftraggeber hat sie binnen 12 Werktagen
// durchzuführen. Erst die Abnahme lässt die Schlussrechnung fällig werden und
// startet die Gewährleistungsfrist. Deshalb ist das Papier so aufgebaut, dass
// es diese Anzeige TRÄGT – und nicht nur eine hübsche Liste ist.
//
// WAS NICHT DRINSTEHT: keine Preise. Der Abschlussbericht weist die LEISTUNG
// nach, die Rechnung stellt das Geld. Wer beides mischt, diskutiert bei der
// Abnahme über Beträge statt über Mängel.
export function druckeAbschluss({ projekt, kunde, raeume = [], positionen = [], berichte = [], einst = {}, fertigAm = '' }) {
  const aktive = raeume.filter((r) => r.aktiv !== false)
  const alleAufgaben = aktive.flatMap((r) => (Array.isArray(r.aufgaben) ? r.aufgaben : []))
  const erledigt = alleAufgaben.filter((a) => a.fertig)
  const flaecheSumme = Math.round(aktive.reduce((s, r) => s + (Number(r.flaeche) || 0), 0) * 100) / 100

  // Räume: was wurde wann und von wem abgehakt
  const raumZeilen = aktive.map((r) => {
    const a = (Array.isArray(r.aufgaben) ? r.aufgaben : []).slice().sort((x, y) => (x.sort || 0) - (y.sort || 0))
    const fertig = a.filter((x) => x.fertig)
    const offen = a.filter((x) => !x.fertig)
    const liste = fertig.length
      ? fertig.map((x) => {
        const wann = x.fertigAm ? new Date(x.fertigAm).toLocaleDateString('de-DE') : ''
        const wer = x.fertigVon ? `, ${esc(x.fertigVon)}` : ''
        return esc(x.text) + (wann ? ` <span class="meta">(${wann}${wer})</span>` : '')
      }).join('<br>')
      : '<span class="meta">noch keine Arbeitsschritte gemeldet</span>'
    // Offenes wird BENANNT, nicht verschwiegen: ein Abschlussbericht, der
    // Restleistungen unterschlägt, fällt bei der Abnahme auf die Füße.
    const rest = offen.length
      ? `<div class="meta" style="margin-top:3px">offen: ${offen.map((x) => esc(x.text)).join(', ')}</div>`
      : ''
    const kopf = `<strong>${esc(r.nummer || '')}</strong>${r.nummer && r.name ? ' · ' : ''}${esc(r.name || '')}`
    const flaeche = r.flaeche ? `${Number(r.flaeche).toLocaleString('de-DE')} m²` : '–'
    return `<tr><td>${kopf}</td><td class="r">${flaeche}</td><td>${liste}${rest}</td>`
      + `<td class="r">${a.length ? `${fertig.length}/${a.length}` : '–'}</td></tr>`
  }).join('')

  const prozent = alleAufgaben.length ? Math.round((erledigt.length / alleAufgaben.length) * 100) : 0
  const raumTabelle = aktive.length ? `<h2>Ausgeführte Arbeiten je Raum</h2><table>
    <thead><tr><th>Raum</th><th class="r">Fläche</th><th>Ausgeführte Arbeitsschritte</th><th class="r">Stand</th></tr></thead>
    <tbody>${raumZeilen}
    <tr class="summe">
      <td>Summe ${aktive.length} Räume</td>
      <td class="r">${flaecheSumme ? `${flaecheSumme.toLocaleString('de-DE')} m²` : '–'}</td>
      <td>${erledigt.length} von ${alleAufgaben.length} Arbeitsschritten erledigt</td>
      <td class="r">${prozent} %</td>
    </tr></tbody></table>` : ''

  // Mengennachweis: Soll aus dem Vertrag, Ist aus den Meldungen
  const mit = positionen.filter((p) => p.typ === 'position' && ((p.istMenge || 0) > 0 || (p.menge || 0) > 0))
  const mengenZeilen = mit.map((p) => {
    const ab = Math.round(((p.istMenge || 0) - (p.menge || 0)) * 1000) / 1000
    const hinweis = Math.abs(ab) > 0.005
      ? ` <span class="meta">(${ab > 0 ? '+' : ''}${ab.toLocaleString('de-DE')})</span>` : ''
    return `<tr><td>${esc(p.oz || '')}</td><td>${esc(p.kurztext || '')}</td>`
      + `<td class="r">${(p.menge || 0).toLocaleString('de-DE')}</td>`
      + `<td class="r"><strong>${(p.istMenge || 0).toLocaleString('de-DE')}</strong>${hinweis}</td>`
      + `<td>${esc(p.einheit || '')}</td></tr>`
  }).join('')

  const mengenTabelle = mit.length ? `<h2>Mengennachweis</h2><table>
    <thead><tr><th>OZ</th><th>Leistung</th><th class="r">Vertrag</th><th class="r">Ausgeführt</th><th>Einheit</th></tr></thead>
    <tbody>${mengenZeilen}</tbody></table>
    <p class="meta">Mehr- und Mindermengen sind gegenüber dem Vertrag ausgewiesen. Weicht die ausgeführte Menge um
    mehr als 10 % ab, kann nach § 2 Abs. 3 VOB/B jede Seite einen neuen Einheitspreis verlangen.</p>` : ''

  // Regie- und Stundenlohnarbeiten nur als Verweis – sie haben eigene Nachweise
  const regie = berichte.filter((b) => b.typ !== 'abnahme')
  const regieZeilen = regie.map((b) => {
    const text = String(b.beschreibung || '')
    return `<tr><td>${datumDe(b.datum)}</td>`
      + `<td>${b.typ === 'reklamation' ? 'Reklamation' : 'Regiebericht'}</td>`
      + `<td>${esc(b.nummer || '–')}</td>`
      + `<td>${esc(text.slice(0, 90))}${text.length > 90 ? '…' : ''}</td>`
      + `<td>${esc(b.status || '')}</td></tr>`
  }).join('')
  const regieTabelle = regie.length ? `<h2>Zusätzlich erfasste Nachweise</h2><table>
    <thead><tr><th>Datum</th><th>Art</th><th>Nr.</th><th>Beschreibung</th><th>Stand</th></tr></thead>
    <tbody>${regieZeilen}</tbody></table>
    <p class="meta">Stundenlohn- und Materialnachweise sind gesondert als Regiebericht beigefügt.</p>` : ''

  const alleFertig = alleAufgaben.length > 0 && erledigt.length === alleAufgaben.length
  // Die Anzeige nach § 12 Abs. 1 VOB/B wird nur ausgesprochen, wenn die Arbeiten
  // tatsächlich vollständig sind. Sonst ist es ein Zwischenstand – und das muss
  // auf dem Papier stehen, sonst läuft eine Frist, die niemand halten kann.
  const anzeige = alleFertig
    ? `<div class="box recht"><strong>Fertigstellungsanzeige:</strong> Die vertraglich geschuldeten Leistungen sind
       vollständig erbracht und fertiggestellt${fertigAm ? ` (Fertigstellung am <strong>${datumDe(fertigAm)}</strong>)` : ''}.
       Hiermit wird gemäß <strong>§ 12 Abs. 1 VOB/B</strong> die Abnahme verlangt. Die Abnahme ist binnen
       <strong>12 Werktagen</strong> nach Zugang dieses Verlangens durchzuführen.</div>`
    : `<div class="box warn"><strong>Zwischenstand – keine Fertigstellungsanzeige.</strong>
       ${alleAufgaben.length - erledigt.length} von ${alleAufgaben.length} Arbeitsschritten sind noch offen.
       Dieser Bericht dokumentiert den Leistungsstand; er löst keine Abnahmefrist aus.</div>`

  const feld = (art, klar) => `<div>
    <div class="art">${esc(art)}</div>
    <div class="flaeche"></div>
    <div class="linie">
      <div class="klar">${klar ? esc(klar) : '&nbsp;'}</div>
      <div class="rolle">Name in Klarschrift</div>
      <div class="rolle">Datum:</div>
    </div>
  </div>`

  drucke({
    titel: alleFertig ? 'Fertigstellungsanzeige und Leistungsnachweis' : 'Leistungsstand (Zwischenbericht)',
    nummer: projekt?.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: fertigAm || '', datumLabel: 'Fertigstellung' })}
      ${anzeige}
      ${raumTabelle}
      ${mengenTabelle}
      ${regieTabelle}
      <div class="unterschriften">
        ${feld('Auftraggeber / Bauleitung', '')}
        ${feld('Auftragnehmer', firma(einst).name || '')}
      </div>`,
  })
}
