// Druck-/PDF-Ausgabe: öffnet ein Druckfenster (Chrome: "Als PDF speichern").
// Vorlagen: Behandlungsbericht (inkl. Bilder), Privatrechnung (GOZ-Stil),
// Behandlungsplan / Heil- und Kostenplan (HKP).

import { PRAXIS } from '@shared/praxis.js'
import { textZuHtml, summe, euro } from '@shared/format.js'
import { fmtDatumVoll } from '@shared/slots.js'
import { fmtGeburtstag } from './hooks.js'

const STIL = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; padding: 32px 40px; font-size: 13px; line-height: 1.5; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 14px; margin-bottom: 20px; }
  header h1 { font-size: 20px; color: #065f46; }
  header .praxis { text-align: right; font-size: 11px; color: #475569; }
  h2 { font-size: 15px; color: #065f46; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  td.r, th.r { text-align: right; }
  .summe td { font-weight: bold; border-top: 2px solid #059669; font-size: 14px; }
  .box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin: 10px 0; }
  .warn { background: #fefce8; border-color: #fde68a; }
  .meta { color: #64748b; font-size: 11px; }
  .fotos { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
  .fotos figure { width: 180px; }
  .fotos img { width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; }
  .fotos figcaption { font-size: 10px; color: #64748b; margin-top: 2px; }
  ul { padding-left: 18px; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; }
  .unterschrift { margin-top: 40px; display: flex; gap: 60px; }
  .unterschrift div { border-top: 1px solid #64748b; padding-top: 4px; width: 220px; font-size: 11px; color: #475569; }
  @media print { body { padding: 10px 14px; } }
`

function kopf(titel) {
  return `<header>
    <div>
      <h1>${titel}</h1>
      <p class="meta">Erstellt am ${new Date().toLocaleDateString('de-DE')} um ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
    </div>
    <div class="praxis">
      <strong>${PRAXIS.name}</strong><br>${PRAXIS.untertitel}<br>
      ${PRAXIS.strasse} · ${PRAXIS.plzOrt}<br>Tel. ${PRAXIS.telefon} · ${PRAXIS.email}
    </div>
  </header>`
}

function fuss() {
  return `<footer>${PRAXIS.name} · ${PRAXIS.strasse}, ${PRAXIS.plzOrt} · Dieses Dokument wurde digital in der Praxis-Verwaltung erstellt (Demo).</footer>`
}

export function drucke(titel, body) {
  const fenster = window.open('', '_blank', 'width=900,height=1100')
  fenster.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${titel}</title><style>${STIL}</style></head><body>${kopf(titel)}${body}${fuss()}<script>setTimeout(() => window.print(), 400)</${'script'}></body></html>`)
  fenster.document.close()
}

function patientenBlock(patient) {
  if (!patient) return ''
  return `<div class="box">
    <strong>${patient.vorname} ${patient.nachname}</strong> · geb. ${fmtGeburtstag(patient.geburtsdatum)} ·
    ${patient.versicherung || 'Versicherung unbekannt'}
    ${patient.zusatzversicherung ? ` · <strong>Zahnzusatzversicherung: ${patient.zusatzversicherung}${patient.zusatzversicherungNr ? ` (Vers.-Nr. ${patient.zusatzversicherungNr})` : ''}</strong>` : ''}<br>
    <span class="meta">Tel. ${patient.telefon || '–'}${patient.email ? ` · ${patient.email}` : ''}</span>
    ${patient.notizen ? `<br><span style="color:#b91c1c"><strong>Hinweis:</strong> ${patient.notizen}</span>` : ''}
  </div>`
}

function leistungsTabelle(leistungen) {
  if (!leistungen?.length) return '<p class="meta">Keine Abrechnungspositionen erfasst.</p>'
  const zeilen = leistungen.map((l) => `<tr>
      <td>${l.code || ''}</td><td>${l.name}</td>
      <td class="r">${l.anzahl || 1}×</td><td class="r">${euro(l.preis)}</td>
      <td class="r">${euro((l.preis || 0) * (l.anzahl || 1))}</td>
    </tr>`).join('')
  return `<table>
    <tr><th>Nr.</th><th>Leistung</th><th class="r">Anzahl</th><th class="r">Einzelpreis</th><th class="r">Betrag</th></tr>
    ${zeilen}
    <tr class="summe"><td colspan="4">Gesamtbetrag</td><td class="r">${euro(summe(leistungen))}</td></tr>
  </table>`
}

// ---------- Behandlungsbericht (für Überweisung / neue Ärzte / Versicherung) ----------
export function druckeBericht(patient, termine, photos) {
  const bloecke = termine.map((t) => {
    const fotos = (photos || []).filter((p) => p.terminId === t.id)
    return `<h2>${fmtDatumVoll(t.datum)} · ${t.start} Uhr — ${t.behandlung} (${t.arzt})</h2>
      ${t.summary?.checks?.length ? `<p class="meta">Durchgeführt: ${t.summary.checks.join(' · ')}</p>` : ''}
      ${t.befunde?.length ? `<table><tr><th>Zahn</th><th>Befund</th><th>Erfasst von</th></tr>${t.befunde.map((b) => `<tr><td><strong>${b.zahn}</strong></td><td>${b.text}</td><td>${b.von || ''}</td></tr>`).join('')}</table>` : ''}
      ${t.summary?.text ? textZuHtml(t.summary.text) : '<p class="meta">Keine Notizen dokumentiert.</p>'}
      ${t.leistungen?.length ? leistungsTabelle(t.leistungen) : ''}
      ${fotos.length ? `<div class="fotos">${fotos.map((f) => `<figure><img src="${f.dataUrl}"><figcaption>${new Date(f.createdAt).toLocaleString('de-DE')} · ${f.von}</figcaption></figure>`).join('')}</div>` : ''}`
  }).join('')
  drucke('Behandlungsbericht', `${patientenBlock(patient)}${bloecke}
    <div class="unterschrift"><div>Datum, Unterschrift Behandler</div><div>Praxisstempel</div></div>`)
}

// ---------- Privatrechnung (GOZ-/BEMA-Stil) ----------
export function druckeRechnung(patient, termin, einst = {}) {
  const nr = `${new Date().getFullYear()}-${String(termin.id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`
  const katalog = einst.katalogModus || 'GOZ'
  drucke(`Rechnung Nr. ${nr}`, `
    ${patientenBlock(patient)}
    <p>Behandlung am <strong>${fmtDatumVoll(termin.datum)}</strong> (${termin.behandlung}, Behandler: ${termin.arzt}).<br>
    Liquidation gemäß ${katalog === 'BEMA' ? 'Bewertungsmaßstab zahnärztlicher Leistungen (BEMA)' : 'Gebührenordnung für Zahnärzte (GOZ), Steigerungsfaktor 2,3 soweit nicht anders vermerkt'}.</p>
    ${leistungsTabelle(termin.leistungen)}
    ${patient?.zusatzversicherung ? `<div class="box"><strong>Hinweis Zahnzusatzversicherung (${patient.zusatzversicherung}${patient.zusatzversicherungNr ? `, Vers.-Nr. ${patient.zusatzversicherungNr}` : ''}):</strong>
      Diese Rechnung ist zur Einreichung bei Ihrer Zahnzusatzversicherung geeignet. Reichen Sie die Rechnung im Original ein –
      die Erstattung richtet sich nach Ihrem Tarif. Geben Sie bei der Einreichung Ihre Versicherungsnummer an.</div>`
      : '<div class="box warn"><strong>Hinweis:</strong> Keine Zahnzusatzversicherung hinterlegt – der Rechnungsbetrag ist vom Patienten selbst zu tragen.</div>'}
    <p>Bitte überweisen Sie den Gesamtbetrag innerhalb von 14 Tagen${einst.bankName ? ` auf folgendes Konto:<br>
    <strong>${einst.bankName}</strong> · IBAN <strong>${einst.iban || ''}</strong> · Verwendungszweck: Rechnung ${nr}` : '.'}</p>
    <div class="unterschrift"><div>Datum, Unterschrift</div></div>`)
}

// ---------- Behandlungsplan / Heil- und Kostenplan ----------
const HKP_STATUS = { entwurf: 'Erstellt', eingereicht: 'Eingereicht', genehmigt: 'Genehmigt', abgelehnt: 'Abgelehnt' }

export function druckeHKP(patient, plan) {
  drucke(`Behandlungsplan / Heil- und Kostenplan — ${plan.titel}`, `
    ${patientenBlock(patient)}
    <p class="meta">Status: <strong>${HKP_STATUS[plan.status] || 'Erstellt'}</strong>${
      plan.status === 'genehmigt' && plan.gueltigBis ? ` · gültig bis ${new Date(plan.gueltigBis).toLocaleDateString('de-DE')}` : ''
    }</p>
    <h2>1. Befund</h2>
    <p>${plan.befund || '–'}</p>
    <h2>2. Geplante Therapie</h2>
    <p>${plan.therapie || '–'}</p>
    <h2>3. Voraussichtliche Kosten</h2>
    ${leistungsTabelle(plan.positionen)}
    <div class="box">
      <strong>Hinweise zur Einreichung:</strong>
      <ul>
        <li>Bitte reichen Sie diesen Plan <strong>vor Behandlungsbeginn</strong> bei Ihrer Krankenkasse bzw. Zahnzusatzversicherung ein${patient?.zusatzversicherung ? ` (${patient.zusatzversicherung})` : ''}.</li>
        <li>Nach Genehmigung ist der Plan in der Regel <strong>6 Monate gültig</strong>.</li>
        <li>Die tatsächlichen Kosten können je nach Befund während der Behandlung abweichen; wesentliche Abweichungen werden vorher besprochen.</li>
      </ul>
    </div>
    <div class="unterschrift"><div>Datum, Unterschrift Zahnarzt</div><div>Datum, Unterschrift Patient</div></div>`)
}
