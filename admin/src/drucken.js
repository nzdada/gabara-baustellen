// Druck-/PDF-Ausgabe: öffnet ein Druckfenster (Chrome: "Als PDF speichern").
// ALLE PDFs entstehen hier im Web-Admin (User-Entscheidung – nie auf dem Handy).
// Vorlagen: Regiebericht/Reklamation, Abnahmeprotokoll, Rechnung (interner
// Fallback-Eigendruck – die offizielle Rechnung erstellt FastBill).

import { PRAXIS } from '@shared/praxis.js'
import { euro } from '@shared/format.js'

// Nutzereingaben IMMER escapen, bevor sie in document.write-HTML landen –
// sonst zerreißt ein '<' oder '</script>' in einer Beschreibung das Dokument
// (bzw. führt eingebettetes Markup aus).
function esc(wert) {
  return String(wert ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Escapen + Zeilenumbrüche als <br>
function escBr(wert) {
  return esc(wert).replace(/\n/g, '<br>')
}

const STIL = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; padding: 32px 40px; font-size: 13px; line-height: 1.5; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8b1a1a; padding-bottom: 14px; margin-bottom: 20px; }
  header h1 { font-size: 20px; color: #701414; }
  header .firma { text-align: right; font-size: 11px; color: #475569; }
  h2 { font-size: 15px; color: #701414; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.r, th.r { text-align: right; }
  tr.titel td { font-weight: bold; background: #f8fafc; }
  .summe td { font-weight: bold; border-top: 2px solid #8b1a1a; font-size: 14px; }
  .box { background: #fbf7f6; border: 1px solid #e6cdc9; border-radius: 8px; padding: 10px 14px; margin: 10px 0; }
  .warn { background: #fefce8; border-color: #fde68a; }
  .meta { color: #64748b; font-size: 11px; }
  .fotos { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  .fotos figure { width: 46%; }
  .fotos img { width: 100%; max-height: 9cm; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
  .fotos figcaption { font-size: 10px; color: #64748b; margin-top: 2px; }
  ul { padding-left: 18px; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  .unterschrift { margin-top: 40px; display: flex; gap: 60px; }
  .unterschrift div { border-top: 1px solid #64748b; padding-top: 4px; width: 220px; font-size: 11px; color: #475569; }
  .signatur img { max-height: 2.5cm; display: block; margin-bottom: 4px; }
  @media print { body { padding: 10px 14px; } }
`

function firma(einst = {}) {
  return {
    name: einst.praxisName || PRAXIS.name,
    anschrift: einst.praxisAnschrift || `${PRAXIS.strasse}, ${PRAXIS.plzOrt}`,
    telefon: einst.praxisTelefon || PRAXIS.telefon,
    email: einst.praxisEmail || PRAXIS.email,
  }
}

function kopf(titel, einst) {
  const f = firma(einst)
  return `<header>
    <div>
      <h1>${esc(titel)}</h1>
      <p class="meta">Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
    </div>
    <div class="firma">
      <strong>${esc(f.name)}</strong><br>Maler &amp; Lackierer<br>
      ${esc(f.anschrift)}<br>Tel. ${esc(f.telefon)} · ${esc(f.email)}
    </div>
  </header>`
}

function fuss(einst, extra = '') {
  const f = firma(einst)
  return `<footer>${esc(f.name)} · ${esc(f.anschrift)}${extra ? ` · ${esc(extra)}` : ''}</footer>`
}

export function drucke(titel, body, einst = {}, fussExtra = '') {
  const fenster = window.open('', '_blank', 'width=900,height=1100')
  fenster.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(titel)}</title><style>${STIL}</style></head><body>${kopf(titel, einst)}${body}${fuss(einst, fussExtra)}<script>setTimeout(() => window.print(), 400)</${'script'}></body></html>`)
  fenster.document.close()
}

function datumDe(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

function kundenName(kunde) {
  if (!kunde) return '–'
  return kunde.firma || [kunde.vorname, kunde.nachname].filter(Boolean).join(' ') || kunde.ansprechpartner || '–'
}

function projektBlock(projekt, kunde) {
  return `<div class="box">
    <strong>${esc(projekt?.nummer || '')} · ${esc(projekt?.name || 'Projekt')}</strong><br>
    Baustelle: ${esc(projekt?.anschrift?.strasse || '')}, ${esc(projekt?.anschrift?.plzOrt || '')}<br>
    <span class="meta">Auftraggeber: ${esc(kundenName(kunde))}${kunde?.telefon ? ` · Tel. ${esc(kunde.telefon)}` : ''}</span>
  </div>`
}

const PHASE_LABEL = { vorher: 'Vorher', nachher: 'Nachher', beleg: 'Beleg', sonstig: 'Foto' }

function zeitpunktDe(ms) {
  if (!ms) return '–'
  return new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fotoGrid(fotos) {
  if (!fotos?.length) return ''
  return `<div class="fotos">${fotos.map((f) => `<figure><img src="${esc(f.dataUrl)}"><figcaption><strong>${PHASE_LABEL[f.phase] || 'Foto'}</strong> · erfasst am ${zeitpunktDe(f.createdAt)} · ${esc(f.von || '')}</figcaption></figure>`).join('')}</div>`
}

// Beweis-Zeitstempel des Berichts (Erfassung/Einreichung/Freigabe – NICHT der Druckzeitpunkt)
function zeitstempelZeile(bericht) {
  return `<p class="meta">Erfasst am ${zeitpunktDe(bericht.createdAt)}${
    bericht.eingereichtAm ? ` · eingereicht am ${zeitpunktDe(bericht.eingereichtAm)}${bericht.eingereichtVon ? ` durch ${esc(bericht.eingereichtVon)}` : ''}` : ''}${
    bericht.freigegebenAm ? ` · freigegeben am ${zeitpunktDe(bericht.freigegebenAm)}${bericht.freigegebenVon ? ` durch ${esc(bericht.freigegebenVon)}` : ''}` : ''}</p>`
}

function unterschriftBlock(bericht) {
  const kundeZeile = [bericht?.unterschriftName, bericht?.unterschriftFunktion, bericht?.unterschriftFirma]
    .filter(Boolean).map(esc).join(' · ')
  const kunde = bericht?.unterschriftKunde
    ? `<div class="signatur"><img src="${esc(bericht.unterschriftKunde)}">${kundeZeile || 'Auftraggeber/Bauleitung'}<br>${datumDe(bericht.datum)}</div>`
    : '<div>Datum, Unterschrift Auftraggeber/Bauleitung<br>(Name, Funktion, Firma in Klarschrift)</div>'
  const monteur = bericht?.unterschriftMonteur
    ? `<div class="signatur"><img src="${esc(bericht.unterschriftMonteur)}">${esc(bericht.mitarbeiterName || 'Monteur')} · Gabara Service GmbH<br>${datumDe(bericht.datum)}</div>`
    : '<div>Datum, Unterschrift Auftragnehmer<br>(Gabara Service GmbH)</div>'
  return `<div class="unterschrift">${kunde}${monteur}</div>`
}

// ---------- Regiebericht (Stundenlohnzettel VOB/B § 15) / Reklamationsprotokoll ----------
export function druckeRegiebericht({ bericht, projekt, kunde, fotos = [], einst = {} }) {
  const titel = `${bericht.typ === 'reklamation' ? 'Reklamations-/Schadensprotokoll' : 'Regiebericht / Stundenlohnzettel'}${bericht.nummer ? ` Nr. ${bericht.nummer}` : ''}`
  const stunden = bericht.stunden || []
  const material = bericht.material || []
  const stundenSumme = stunden.reduce((s, z) => s + (z.anzahl || 0) * (z.satz || 0), 0)
  const materialSumme = material.reduce((s, z) => s + (z.menge || 0) * (z.preis || 0), 0)

  // VOB/B § 15 Abs. 3: Namen der Arbeitskräfte + Stunden je Person und Tag
  const stundenTabelle = stunden.length ? `<h2>Arbeitszeit je Person (Stundenlohnzettel)</h2><table>
    <tr><th>Name</th><th>Datum</th><th>Qualifikation</th><th>Von–Bis</th><th class="r">Std.</th><th class="r">Satz</th><th class="r">Betrag</th></tr>
    ${stunden.map((z) => `<tr><td>${esc(z.name || '–')}</td><td>${datumDe(z.datum)}</td><td>${z.art === 'helfer' ? 'Helfer/Azubi' : 'Facharbeiter Malerhandwerk'}</td><td>${z.von && z.bis ? `${esc(z.von)}–${esc(z.bis)}` : '–'}</td><td class="r">${esc(z.anzahl)}</td><td class="r">${euro(z.satz)}</td><td class="r">${euro((z.anzahl || 0) * (z.satz || 0))}</td></tr>`).join('')}
    <tr class="summe"><td colspan="6">Summe Arbeitszeit (netto)</td><td class="r">${euro(stundenSumme)}</td></tr>
  </table>` : ''

  const materialTabelle = material.length ? `<h2>Materialverbrauch</h2><table>
    <tr><th>Material / Artikel</th><th class="r">Menge</th><th>Einheit</th><th class="r">EP</th><th class="r">Betrag</th></tr>
    ${material.map((z) => `<tr><td>${esc(z.name)}</td><td class="r">${esc(z.menge)}</td><td>${esc(z.einheit || '')}</td><td class="r">${euro(z.preis)}</td><td class="r">${euro((z.menge || 0) * (z.preis || 0))}</td></tr>`).join('')}
    <tr class="summe"><td colspan="4">Summe Material (netto)</td><td class="r">${euro(materialSumme)}</td></tr>
  </table>` : ''

  // Anordnung/Anzeige der Stundenlohnarbeiten (VOB/B § 15 Abs. 3 Satz 1)
  const anordnung = bericht.typ === 'regie' && bericht.angeordnetDurch
    ? `<div class="box">Stundenlohnarbeiten angezeigt/angeordnet am <strong>${datumDe(bericht.angeordnetAm)}</strong>
       durch <strong>${esc(bericht.angeordnetDurch)}</strong>
       (${bericht.anzeigeArt === 'schriftlich' ? 'schriftlich' : bericht.anzeigeArt === 'mail' ? 'per E-Mail' : 'mündlich vor Ort'}) – § 15 Abs. 3 VOB/B.</div>`
    : ''

  // Fristen-Block bei Reklamationen (§ 13 Abs. 5 VOB/B)
  const ruege = bericht.typ === 'reklamation' && (bericht.geruegtDurch || bericht.ruegeZugangAm || bericht.fristBis)
    ? `<div class="box warn">Mängelrüge${bericht.ruegeZugangAm ? ` zugegangen am <strong>${datumDe(bericht.ruegeZugangAm)}</strong>` : ''}${bericht.geruegtDurch ? ` durch <strong>${esc(bericht.geruegtDurch)}</strong>` : ''}${bericht.fristBis ? ` · Frist zur Beseitigung: <strong>${datumDe(bericht.fristBis)}</strong>` : ''} (§ 13 Abs. 5 VOB/B).</div>`
    : ''

  // Anerkennungsfiktion (§ 15 Abs. 3 VOB/B: 6 Werktage)
  const fiktion = bericht.typ === 'regie'
    ? `<div class="box"><strong>Hinweis:</strong> Einwendungen gegen diesen Stundenlohnnachweis sind innerhalb von
       6 Werktagen nach Zugang geltend zu machen; andernfalls gilt er gemäß § 15 Abs. 3 VOB/B als anerkannt.</div>`
    : ''

  drucke(titel, `
    ${projektBlock(projekt, kunde)}
    <p class="meta">Berichtsdatum: <strong>${datumDe(bericht.datum)}</strong> · Monteur: <strong>${esc(bericht.mitarbeiterName || '–')}</strong></p>
    ${zeitstempelZeile(bericht)}
    ${anordnung}
    ${ruege}
    <h2>${bericht.typ === 'reklamation' ? 'Beschreibung des Mangels/Schadens' : 'Ausgeführte Arbeiten (Beschreibung)'}</h2>
    <p>${escBr(bericht.beschreibung || '–')}</p>
    ${bericht.typ === 'reklamation' && bericht.ursache ? `<h2>Ursache</h2><p>${escBr(bericht.ursache)}</p>` : ''}
    ${bericht.typ === 'reklamation' && bericht.massnahme ? `<h2>Maßnahme zur Nachbesserung</h2><p>${escBr(bericht.massnahme)}</p>` : ''}
    ${stundenTabelle}
    ${materialTabelle}
    ${stunden.length && material.length ? `<div class="box"><strong>Gesamtsumme Regie (netto): ${euro(stundenSumme + materialSumme)}</strong></div>` : ''}
    ${fotoGrid(fotos)}
    ${fiktion}
    ${unterschriftBlock(bericht)}`, einst, `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`)
}

// ---------- Abnahmeprotokoll ----------
export function druckeAbnahme({ bericht, projekt, kunde, fotos = [], einst = {} }) {
  const maengel = bericht.maengel || []
  const ergebnis = bericht.ohneMaengel
    ? '<div class="box"><strong>Die Leistungen wurden ohne Mängel abgenommen.</strong></div>'
    : `<div class="box warn"><strong>Abnahme mit folgenden Mängeln / Restarbeiten:</strong></div>
       <table><tr><th>Mangel / Restarbeit</th><th>Frist zur Beseitigung</th></tr>
       ${maengel.map((m) => `<tr><td>${esc(m.text || '')}</td><td>${datumDe(m.frist)}</td></tr>`).join('') || '<tr><td colspan="2" class="meta">Keine Einzelmängel erfasst.</td></tr>'}
       </table>`

  // Verjährung: VOB 4 Jahre / BGB 5 Jahre – abgeleitet aus dem Kundentyp,
  // mit berechnetem Enddatum ab Abnahmedatum
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
      Der Auftraggeber behält sich die Vertragsstrafe gemäß § 11 VOB/B vor:
      <strong>${bericht.vorbehaltVertragsstrafe === true ? 'JA' : bericht.vorbehaltVertragsstrafe === false ? 'nein' : 'keine Angabe'}</strong>.<br>
      Sonstige Vorbehalte (bekannte Mängel / Restleistungen): ${esc(bericht.vorbehalteSonstige || 'keine')}
    </div>`

  drucke(`Abnahmeprotokoll${bericht.abnahmeArt === 'teil' ? ' (Teilabnahme)' : ''}${bericht.nummer ? ` Nr. ${bericht.nummer}` : ''}`, `
    ${projektBlock(projekt, kunde)}
    <p class="meta">Datum der Abnahme: <strong>${datumDe(bericht.datum)}</strong> · Ort: <strong>${esc(bericht.ort || projekt?.anschrift?.plzOrt || '–')}</strong> · Für den Auftragnehmer: <strong>${esc(bericht.mitarbeiterName || '–')}</strong>${bericht.unterschriftName ? ` · Für den Auftraggeber: <strong>${esc(bericht.unterschriftName)}${bericht.unterschriftFunktion ? ` (${esc(bericht.unterschriftFunktion)})` : ''}</strong>` : ''}</p>
    ${zeitstempelZeile(bericht)}
    <h2>Gegenstand der Abnahme (${bericht.abnahmeArt === 'teil' ? 'Teilabnahme' : 'Gesamtabnahme'})</h2>
    <p>${escBr(bericht.leistungsumfang || 'Vertraglich geschuldete Maler- und Lackierarbeiten gemäß Leistungsverzeichnis.')}</p>
    <h2>Ergebnis der Abnahme</h2>
    ${ergebnis}
    ${vorbehalte}
    ${bericht.beschreibung ? `<h2>Bemerkungen</h2><p>${escBr(bericht.beschreibung)}</p>` : ''}
    ${fotoGrid(fotos)}
    <div class="box">
      Die Abnahme erfolgt gemäß § 12 VOB/B. Mit der Abnahme geht die Gefahr auf den Auftraggeber über
      (§ 12 Abs. 6 VOB/B). Die Verjährungsfrist für Mängelansprüche beträgt
      <strong>${istVob ? '4 Jahre gemäß § 13 Abs. 4 VOB/B' : '5 Jahre gemäß § 634a BGB'}</strong>,
      beginnt mit der Abnahme am ${datumDe(bericht.datum)}${ende ? ` und endet am <strong>${ende}</strong>` : ''}.
    </div>
    ${unterschriftBlock(bericht)}`, einst, `Ausdruck vom ${new Date().toLocaleDateString('de-DE')}`)
}

// ---------- Rechnung (interner Fallback-Eigendruck; offiziell macht FastBill) ----------
export function druckeRechnung({ rechnung, projekt, kunde, einst = {} }) {
  const positionen = rechnung.positionen || []
  const netto = positionen.reduce((s, p) => s + (p.menge || 0) * (p.ep || 0), 0)
  const ist13b = (kunde?.ustModus || '13b') === '13b'
  const ust = ist13b ? 0 : netto * 0.19
  const brutto = netto + ust
  const einbehaltProzent = Number(rechnung.einbehaltProzent ?? kunde?.sicherheitseinbehaltProzent ?? 0)
  const einbehalt = brutto * (einbehaltProzent / 100)
  const zahlbetrag = brutto - einbehalt
  const zahlungsziel = kunde?.zahlungszielTage || einst.zahlungszielTage || 16
  const nummer = rechnung.fastbillNummer ? `Rechnung Nr. ${rechnung.fastbillNummer}` : 'Rechnung (ENTWURF – Nummer vergibt FastBill)'

  drucke(nummer, `
    <div class="box">
      <strong>${esc(kundenName(kunde))}</strong><br>
      ${esc(kunde?.strasse || '')}<br>${esc(kunde?.plzOrt || '')}
    </div>
    ${projektBlock(projekt, kunde)}
    <p class="meta">Leistungszeitraum: <strong>${datumDe(rechnung.leistungszeitraum?.von)} – ${datumDe(rechnung.leistungszeitraum?.bis)}</strong>${rechnung.titel ? ` · ${esc(rechnung.titel)}` : ''}</p>
    <table>
      <tr><th>Pos./OZ</th><th>Leistung</th><th class="r">Menge</th><th>Einheit</th><th class="r">EP</th><th class="r">Betrag</th></tr>
      ${positionen.map((p) => `<tr><td>${esc(p.oz || '')}</td><td>${esc(p.text || '')}</td><td class="r">${esc(p.menge)}</td><td>${esc(p.einheit || '')}</td><td class="r">${euro(p.ep)}</td><td class="r">${euro((p.menge || 0) * (p.ep || 0))}</td></tr>`).join('')}
      <tr class="summe"><td colspan="5">Nettobetrag</td><td class="r">${euro(netto)}</td></tr>
    </table>
    ${ist13b
      ? '<div class="box"><strong>Umsatzsteuer: 0,00 €</strong> – Der Rechnungsbetrag versteht sich netto. Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.</div>'
      : `<table><tr><td>zzgl. 19 % Umsatzsteuer</td><td class="r">${euro(ust)}</td></tr><tr class="summe"><td>Bruttobetrag</td><td class="r">${euro(brutto)}</td></tr></table>`}
    ${einbehaltProzent > 0 ? `<table>
      <tr><td>abzgl. Sicherheitseinbehalt (${einbehaltProzent} %)</td><td class="r">− ${euro(einbehalt)}</td></tr>
      <tr class="summe"><td>Zahlbetrag</td><td class="r">${euro(zahlbetrag)}</td></tr>
    </table>` : `<div class="box"><strong>Zahlbetrag: ${euro(zahlbetrag)}</strong></div>`}
    <p>Zahlbar innerhalb von <strong>${esc(zahlungsziel)} Tagen</strong> nach Erhalt der Rechnung rein netto.${einst.bankName ? `<br><strong>${esc(einst.bankName)}</strong>${einst.iban ? ` · IBAN <strong>${esc(einst.iban)}</strong>` : ''}` : ''}</p>
    <p class="meta">Die Arbeiten wurden gemäß VOB DIN 18363 (Maler- und Lackierarbeiten) ausgeführt.</p>`,
    einst,
    'Interner Beleg – die offizielle Rechnung (inkl. E-Rechnung) wird über FastBill erstellt.')
}
