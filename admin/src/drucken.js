// Druck-/PDF-Ausgabe: öffnet ein Druckfenster (Chrome: "Als PDF speichern").
// ALLE PDFs entstehen hier im Web-Admin (User-Entscheidung – nie auf dem Handy).
// Vorlagen: Regiebericht/Reklamation, Abnahmeprotokoll, Rechnung (interner
// Fallback-Eigendruck – die offizielle Rechnung erstellt FastBill).

import { PRAXIS } from '@shared/praxis.js'
import { euro } from '@shared/format.js'

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
      <h1>${titel}</h1>
      <p class="meta">Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
    </div>
    <div class="firma">
      <strong>${f.name}</strong><br>Maler &amp; Lackierer<br>
      ${f.anschrift}<br>Tel. ${f.telefon} · ${f.email}
    </div>
  </header>`
}

function fuss(einst, extra = '') {
  const f = firma(einst)
  return `<footer>${f.name} · ${f.anschrift}${extra ? ` · ${extra}` : ''}</footer>`
}

export function drucke(titel, body, einst = {}, fussExtra = '') {
  const fenster = window.open('', '_blank', 'width=900,height=1100')
  fenster.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${titel}</title><style>${STIL}</style></head><body>${kopf(titel, einst)}${body}${fuss(einst, fussExtra)}<script>setTimeout(() => window.print(), 400)</${'script'}></body></html>`)
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
    <strong>${projekt?.nummer || ''} · ${projekt?.name || 'Projekt'}</strong><br>
    Baustelle: ${projekt?.anschrift?.strasse || ''}, ${projekt?.anschrift?.plzOrt || ''}<br>
    <span class="meta">Auftraggeber: ${kundenName(kunde)}${kunde?.telefon ? ` · Tel. ${kunde.telefon}` : ''}</span>
  </div>`
}

const PHASE_LABEL = { vorher: 'Vorher', nachher: 'Nachher', beleg: 'Beleg', sonstig: 'Foto' }

function fotoGrid(fotos) {
  if (!fotos?.length) return ''
  return `<div class="fotos">${fotos.map((f) => `<figure><img src="${f.dataUrl}"><figcaption><strong>${PHASE_LABEL[f.phase] || 'Foto'}</strong> · ${f.name || ''} · ${f.von || ''}</figcaption></figure>`).join('')}</div>`
}

function unterschriftBlock(bericht) {
  if (bericht?.unterschriftKunde) {
    return `<div class="unterschrift">
      <div class="signatur"><img src="${bericht.unterschriftKunde}">${bericht.unterschriftName || 'Kunde/Bauleitung'} · ${datumDe(bericht.datum)}</div>
      <div>Datum, Unterschrift Auftragnehmer</div>
    </div>`
  }
  return `<div class="unterschrift"><div>Datum, Unterschrift Kunde/Bauleitung</div><div>Datum, Unterschrift Auftragnehmer</div></div>`
}

// ---------- Regiebericht / Reklamations-/Schadensprotokoll ----------
export function druckeRegiebericht({ bericht, projekt, kunde, fotos = [], einst = {} }) {
  const titel = bericht.typ === 'reklamation' ? 'Reklamations-/Schadensprotokoll' : 'Regiebericht'
  const stunden = bericht.stunden || []
  const material = bericht.material || []
  const stundenSumme = stunden.reduce((s, z) => s + (z.anzahl || 0) * (z.satz || 0), 0)
  const materialSumme = material.reduce((s, z) => s + (z.menge || 0) * (z.preis || 0), 0)

  const stundenTabelle = stunden.length ? `<h2>Arbeitszeit (Regie)</h2><table>
    <tr><th>Art</th><th class="r">Stunden</th><th class="r">Satz</th><th class="r">Betrag</th></tr>
    ${stunden.map((z) => `<tr><td>${z.art === 'helfer' ? 'Helfer / Auszubildender' : 'Facharbeiter im Malerhandwerk'}</td><td class="r">${z.anzahl}</td><td class="r">${euro(z.satz)}</td><td class="r">${euro((z.anzahl || 0) * (z.satz || 0))}</td></tr>`).join('')}
    <tr class="summe"><td colspan="3">Summe Arbeitszeit (netto)</td><td class="r">${euro(stundenSumme)}</td></tr>
  </table>` : ''

  const materialTabelle = material.length ? `<h2>Materialverbrauch</h2><table>
    <tr><th>Material / Artikel</th><th class="r">Menge</th><th>Einheit</th><th class="r">EP</th><th class="r">Betrag</th></tr>
    ${material.map((z) => `<tr><td>${z.name}</td><td class="r">${z.menge}</td><td>${z.einheit || ''}</td><td class="r">${euro(z.preis)}</td><td class="r">${euro((z.menge || 0) * (z.preis || 0))}</td></tr>`).join('')}
    <tr class="summe"><td colspan="4">Summe Material (netto)</td><td class="r">${euro(materialSumme)}</td></tr>
  </table>` : ''

  drucke(titel, `
    ${projektBlock(projekt, kunde)}
    <p class="meta">Datum: <strong>${datumDe(bericht.datum)}</strong> · Monteur: <strong>${bericht.mitarbeiterName || '–'}</strong></p>
    <h2>${bericht.typ === 'reklamation' ? 'Beschreibung des Mangels/Schadens' : 'Ausgeführte Arbeiten (Beschreibung)'}</h2>
    <p>${(bericht.beschreibung || '–').replace(/\n/g, '<br>')}</p>
    ${bericht.typ === 'reklamation' && bericht.ursache ? `<h2>Ursache</h2><p>${bericht.ursache.replace(/\n/g, '<br>')}</p>` : ''}
    ${bericht.typ === 'reklamation' && bericht.massnahme ? `<h2>Maßnahme zur Nachbesserung</h2><p>${bericht.massnahme.replace(/\n/g, '<br>')}</p>` : ''}
    ${stundenTabelle}
    ${materialTabelle}
    ${stunden.length && material.length ? `<div class="box"><strong>Gesamtsumme Regie (netto): ${euro(stundenSumme + materialSumme)}</strong></div>` : ''}
    ${fotoGrid(fotos)}
    ${unterschriftBlock(bericht)}`, einst)
}

// ---------- Abnahmeprotokoll ----------
export function druckeAbnahme({ bericht, projekt, kunde, fotos = [], einst = {} }) {
  const maengel = bericht.maengel || []
  const ergebnis = bericht.ohneMaengel
    ? '<div class="box"><strong>Die Leistungen wurden ohne Mängel abgenommen.</strong></div>'
    : `<div class="box warn"><strong>Abnahme mit folgenden Mängeln / Restarbeiten:</strong></div>
       <table><tr><th>Mangel / Restarbeit</th><th>Frist zur Beseitigung</th></tr>
       ${maengel.map((m) => `<tr><td>${m.text || ''}</td><td>${datumDe(m.frist)}</td></tr>`).join('') || '<tr><td colspan="2" class="meta">Keine Einzelmängel erfasst.</td></tr>'}
       </table>`

  drucke('Abnahmeprotokoll', `
    ${projektBlock(projekt, kunde)}
    <p class="meta">Datum: <strong>${datumDe(bericht.datum)}</strong> · Ort: <strong>${bericht.ort || projekt?.anschrift?.plzOrt || '–'}</strong> · Monteur: <strong>${bericht.mitarbeiterName || '–'}</strong></p>
    <h2>Ergebnis der Abnahme</h2>
    ${ergebnis}
    ${bericht.beschreibung ? `<h2>Bemerkungen</h2><p>${bericht.beschreibung.replace(/\n/g, '<br>')}</p>` : ''}
    ${fotoGrid(fotos)}
    <p class="meta">Die Abnahme erfolgt gemäß VOB/B § 12. Mit der Abnahme beginnt die Verjährungsfrist für Mängelansprüche.</p>
    ${unterschriftBlock(bericht)}`, einst)
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
      <strong>${kundenName(kunde)}</strong><br>
      ${kunde?.strasse || ''}<br>${kunde?.plzOrt || ''}
    </div>
    ${projektBlock(projekt, kunde)}
    <p class="meta">Leistungszeitraum: <strong>${datumDe(rechnung.leistungszeitraum?.von)} – ${datumDe(rechnung.leistungszeitraum?.bis)}</strong>${rechnung.titel ? ` · ${rechnung.titel}` : ''}</p>
    <table>
      <tr><th>Pos./OZ</th><th>Leistung</th><th class="r">Menge</th><th>Einheit</th><th class="r">EP</th><th class="r">Betrag</th></tr>
      ${positionen.map((p) => `<tr><td>${p.oz || ''}</td><td>${p.text || ''}</td><td class="r">${p.menge}</td><td>${p.einheit || ''}</td><td class="r">${euro(p.ep)}</td><td class="r">${euro((p.menge || 0) * (p.ep || 0))}</td></tr>`).join('')}
      <tr class="summe"><td colspan="5">Nettobetrag</td><td class="r">${euro(netto)}</td></tr>
    </table>
    ${ist13b
      ? '<div class="box"><strong>Umsatzsteuer: 0,00 €</strong> – Der Rechnungsbetrag versteht sich netto. Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.</div>'
      : `<table><tr><td>zzgl. 19 % Umsatzsteuer</td><td class="r">${euro(ust)}</td></tr><tr class="summe"><td>Bruttobetrag</td><td class="r">${euro(brutto)}</td></tr></table>`}
    ${einbehaltProzent > 0 ? `<table>
      <tr><td>abzgl. Sicherheitseinbehalt (${einbehaltProzent} %)</td><td class="r">− ${euro(einbehalt)}</td></tr>
      <tr class="summe"><td>Zahlbetrag</td><td class="r">${euro(zahlbetrag)}</td></tr>
    </table>` : `<div class="box"><strong>Zahlbetrag: ${euro(zahlbetrag)}</strong></div>`}
    <p>Zahlbar innerhalb von <strong>${zahlungsziel} Tagen</strong> nach Erhalt der Rechnung rein netto.${einst.bankName ? `<br><strong>${einst.bankName}</strong>${einst.iban ? ` · IBAN <strong>${einst.iban}</strong>` : ''}` : ''}</p>
    <p class="meta">Die Arbeiten wurden gemäß VOB DIN 18363 (Maler- und Lackierarbeiten) ausgeführt.</p>`,
    einst,
    'Interner Beleg – die offizielle Rechnung (inkl. E-Rechnung) wird über FastBill erstellt.')
}
