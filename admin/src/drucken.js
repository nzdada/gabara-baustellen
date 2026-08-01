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
    `<title>${esc(titel)}${nummer ? ` ${esc(nummer)}` : ''}</title><style>${STIL}</style></head><body>` +
    kopf({ titel, nummer, einst }) + body + fuss(einst, fussExtra) +
    `<script>${wartenUndDrucken}</${'script'}></body></html>`
  )
  fenster.document.close()
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

  const gesamt = (stunden.length || material.length)
    ? `<div class="gesamt">Gesamtsumme netto: ${euro(stundenSumme + materialSumme)}</div>`
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
      ${gesamt}
      ${fotoBereiche(fotos)}
      ${fiktion}
      ${zeitstempelZeile(bericht)}
      ${unterschriftenBlock(bericht, einst)}`,
  })
}

// ---------- Abnahmeprotokoll ----------
export function druckeAbnahme({ bericht, projekt, kunde, fotos = [], einst = {} }) {
  const maengel = bericht.maengel || []
  const ergebnis = bericht.ohneMaengel
    ? '<div class="box"><strong>Die Leistungen wurden ohne Mängel abgenommen.</strong></div>'
    : `<div class="box warn"><strong>Abnahme mit folgenden Mängeln / Restarbeiten:</strong></div>
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

  const vorbehalte = `<h2>Vorbehalte des Auftraggebers</h2>
    <div class="box${bericht.vorbehaltVertragsstrafe ? ' warn' : ''}">
      Vertragsstrafe gemäß § 11 VOB/B vorbehalten:
      <strong>${bericht.vorbehaltVertragsstrafe === true ? 'JA' : bericht.vorbehaltVertragsstrafe === false ? 'nein' : 'keine Angabe'}</strong><br>
      Sonstige Vorbehalte (bekannte Mängel / Restleistungen): ${esc(bericht.vorbehalteSonstige || 'keine')}
    </div>`

  drucke({
    titel: `Abnahmeprotokoll${bericht.abnahmeArt === 'teil' ? ' (Teilabnahme)' : ''}`,
    nummer: bericht.nummer || '',
    einst,
    fussExtra: `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`,
    body: `
      ${beteiligteBlock({ projekt, kunde, datum: bericht.datum, monteur: bericht.mitarbeiterName, datumLabel: 'Abnahmedatum' })}
      ${bericht.ort ? `<div class="box">Ort der Abnahme: <strong>${esc(bericht.ort)}</strong></div>` : ''}
      <h2>Gegenstand der Abnahme (${bericht.abnahmeArt === 'teil' ? 'Teilabnahme' : 'Gesamtabnahme'})</h2>
      <div class="feld">${escBr(bericht.leistungsumfang || 'Vertraglich geschuldete Maler- und Lackierarbeiten gemäß Leistungsverzeichnis.')}</div>
      <h2>Ergebnis der Abnahme</h2>
      ${ergebnis}
      ${vorbehalte}
      ${bericht.beschreibung ? `<h2>Bemerkungen</h2><div class="feld">${escBr(bericht.beschreibung)}</div>` : ''}
      ${fotoBereiche(fotos)}
      <div class="box recht">
        Die Abnahme erfolgt gemäß § 12 VOB/B. Mit der Abnahme geht die Gefahr auf den Auftraggeber über
        (§ 12 Abs. 6 VOB/B). Die Verjährungsfrist für Mängelansprüche beträgt
        <strong>${istVob ? '4 Jahre gemäß § 13 Abs. 4 VOB/B' : '5 Jahre gemäß § 634a BGB'}</strong>,
        beginnt mit der Abnahme am ${datumDe(bericht.datum)}${ende ? ` und endet am <strong>${ende}</strong>` : ''}.
      </div>
      ${zeitstempelZeile(bericht)}
      ${unterschriftenBlock(bericht, einst)}`,
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
