import { useState } from 'react'
import Modal from './Modal.jsx'
import TerminBilder from './TerminBilder.jsx'
import SummaryEditor from './SummaryEditor.jsx'
import LeistungenListe from './LeistungenListe.jsx'
import { Icon } from '@shared/ui.jsx'
import { BEHANDLUNGS_CHECKS } from '@shared/praxis.js'
import { withStore, alter, fmtGeburtstag, useEinstellungen } from '../hooks.js'
import { kalenderVerbunden, eventLoeschen } from '@shared/googleCalendar.js'
import { useLang, tr, datumLok } from '@shared/i18n.js'
import { terminAbsagen, istKurzfristig, AUSFALL_GEBUEHR } from '../absage.js'

const STATUS_INFO = {
  bestaetigt: { label: { de: 'Bestätigt', en: 'Confirmed', ar: 'مؤكد' }, farbe: 'bg-praxis-100 text-praxis-800' },
  abgeschlossen: { label: { de: 'Abgeschlossen', en: 'Completed', ar: 'منجز' }, farbe: 'bg-slate-200 text-slate-600' },
  abgesagt: { label: { de: 'Abgesagt', en: 'Cancelled', ar: 'ملغى' }, farbe: 'bg-red-100 text-red-700' },
}

const T = {
  termin: { de: 'Termin', en: 'Appointment', ar: 'الموعد' },
  kasseUnbekannt: { de: 'Versicherung unbekannt', en: 'Insurance unknown', ar: 'التأمين غير معروف' },
  datum: { de: 'Datum:', en: 'Date:', ar: 'التاريخ:' },
  zeit: { de: 'Zeit:', en: 'Time:', ar: 'الوقت:' },
  behandlung: { de: 'Behandlung:', en: 'Treatment:', ar: 'العلاج:' },
  behandler: { de: 'Behandler:', en: 'Practitioner:', ar: 'المعالج:' },
  zusammenfassung: { de: 'Behandlungs-Zusammenfassung', en: 'Treatment summary', ar: 'ملخص العلاج' },
  liveCockpit: { de: 'LIVE im Arzt-Cockpit', en: 'LIVE in doctor cockpit', ar: 'مباشر في شاشة الطبيب' },
  platzhalter: { de: 'Was wurde gemacht? Diese Notiz sieht der Arzt live auf dem Tablet …', en: 'What was done? The doctor sees this note live on the tablet …', ar: 'ماذا تم عمله؟ يرى الطبيب هذه الملاحظة مباشرة على الجهاز اللوحي …' },
  zuletzt: { de: 'Zuletzt:', en: 'Last update:', ar: 'آخر تحديث:' },
  uhr: { de: 'Uhr', en: '', ar: '' },
  abschliessen: { de: 'Behandlung abschließen', en: 'Complete treatment', ar: 'إنهاء العلاج' },
  absagen: { de: 'Termin absagen', en: 'Cancel appointment', ar: 'إلغاء الموعد' },
  aktivieren: { de: 'Wieder aktivieren', en: 'Reactivate', ar: 'إعادة تفعيل' },
  kurzfristigFrage: { de: 'Kurzfristige Absage unter 24 Stunden – Ausfallhonorar nach § 615 BGB berechnen?', en: 'Cancellation under 24 hours – charge the no-show fee (§ 615 BGB)?', ar: 'إلغاء قبل أقل من 24 ساعة – هل تُحتسب رسوم الإلغاء؟' },
  gebuehrJa: { de: 'Gebühr berechnen + Gebühren-Mail an den Patienten', en: 'charge fee + send fee e-mail', ar: 'احتساب الرسوم وإرسال بريد' },
  gebuehrNein: { de: 'ohne Gebühr absagen (Absage durch die Praxis)', en: 'cancel without fee (practice cancelled)', ar: 'إلغاء دون رسوم' },
}

export default function TerminModal({ termin, patient, user, onClose }) {
  useLang()
  const einst = useEinstellungen()
  const [summary, setSummary] = useState(termin.summary || { text: '', checks: [], updatedAt: null, updatedBy: '' })

  async function speichereSummary(neu) {
    setSummary(neu)
    await withStore((s) =>
      s.update('appointments', termin.id, {
        summary: { ...neu, updatedAt: Date.now(), updatedBy: user?.name || 'Team' },
      })
    )
  }

  function toggleCheck(check) {
    const checks = summary.checks.includes(check)
      ? summary.checks.filter((c) => c !== check)
      : [...summary.checks, check]
    speichereSummary({ ...summary, checks })
  }

  async function setzeStatus(status) {
    if (status === 'abgesagt') {
      // 24-Stunden-Regel: bei kurzfristiger Absage entscheidet das Team,
      // ob das Ausfallhonorar berechnet wird (nicht bei Absage durch die Praxis)
      let gebuehr = false
      if (istKurzfristig(termin, einst.stornoFristStunden)) {
        gebuehr = confirm(
          `${tr(T.kurzfristigFrage)} (${einst.ausfallGebuehr} €)\n\nOK = ${tr(T.gebuehrJa)}\nAbbrechen = ${tr(T.gebuehrNein)}`
        )
      }
      await withStore((s) => terminAbsagen(s, termin, { gebuehrBerechnen: gebuehr, gebuehr: einst.ausfallGebuehr }))
      if (termin.googleEventId && kalenderVerbunden()) {
        try { await eventLoeschen(termin.googleEventId) } catch (e) { /* Kalender nicht erreichbar */ }
      }
      onClose()
      return
    }
    await withStore(async (s) => {
      const patch = { status }
      // Abschluss übergibt den Termin an die Abrechnung ("Bereit für Abrechnung")
      if (status === 'abgeschlossen') {
        patch.abgeschlossenAm = new Date().toISOString() // Basis für den Feedback-Versand
        if (!['gestellt', 'bezahlt'].includes(termin.rechnung)) patch.rechnung = 'pruefen'
      }
      await s.update('appointments', termin.id, patch)
      if (s.mode === 'firebase') await s.schreibeSlot(termin)
    })
    onClose()
  }

  const info = STATUS_INFO[termin.status] || STATUS_INFO.bestaetigt

  return (
    <Modal titel={tr(T.termin)} onClose={onClose} breite="max-w-xl">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-900">{termin.patientName}</p>
            {patient && (
              <p className="text-sm text-slate-500">
                {fmtGeburtstag(patient.geburtsdatum)} ({alter(patient.geburtsdatum)} J.) · {patient.versicherung || tr(T.kasseUnbekannt)} · <span dir="ltr">{patient.telefon}</span>
              </p>
            )}
            {patient?.notizen && (
              <p className="mt-1.5 text-sm font-semibold text-red-700 bg-red-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <Icon name="alert" className="w-4 h-4" /> {patient.notizen}
              </p>
            )}
          </div>
          <span className={`shrink-0 text-xs font-bold rounded-full px-3 py-1.5 ${info.farbe}`}>{tr(info.label)}</span>
        </div>

        <div className="bg-praxis-50 rounded-2xl p-4 text-sm grid grid-cols-2 gap-2">
          <p><span className="text-slate-500">{tr(T.datum)}</span> <span className="font-semibold">{datumLok(termin.datum)}</span></p>
          <p><span className="text-slate-500">{tr(T.zeit)}</span> <span className="font-semibold" dir="ltr">{termin.start} – {termin.ende}</span> {tr(T.uhr)}</p>
          <p><span className="text-slate-500">{tr(T.behandlung)}</span> <span className="font-semibold">{termin.behandlung}</span></p>
          <p><span className="text-slate-500">{tr(T.behandler)}</span> <span className="font-semibold">{termin.arzt}</span></p>
        </div>

        {/* Live-Zusammenfassung: erscheint sofort im Arzt-Cockpit */}
        <div>
          <p className="font-semibold text-slate-800 flex items-center gap-2">
            {tr(T.zusammenfassung)}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-praxis-700 bg-praxis-100 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-praxis-500 animate-pulse" /> {tr(T.liveCockpit)}
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {BEHANDLUNGS_CHECKS.map((c) => (
              <button
                key={c}
                onClick={() => toggleCheck(c)}
                className={`text-xs font-medium rounded-full px-3 py-1.5 border transition ${
                  summary.checks.includes(c)
                    ? 'bg-praxis-600 border-praxis-600 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-praxis-400'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <SummaryEditor
              text={summary.text}
              onText={(text) => speichereSummary({ ...summary, text })}
              placeholder={tr(T.platzhalter)}
              rows={3}
            />
          </div>
          {summary.updatedAt && (
            <p className="text-xs text-slate-400 mt-1">
              {tr(T.zuletzt)} {summary.updatedBy} · {new Date(summary.updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {tr(T.uhr)}
            </p>
          )}
        </div>

        {/* Leistungen & Abrechnung (live geteilt mit dem Arzt-Cockpit) */}
        <LeistungenListe termin={termin} />

        {/* Bilder & Scans zum Termin (live geteilt mit dem Arzt-Cockpit) */}
        <TerminBilder termin={termin} user={user} />

        <div className="flex flex-wrap gap-2 pt-1">
          {termin.status !== 'abgeschlossen' && (
            <button onClick={() => setzeStatus('abgeschlossen')} className="flex-1 bg-praxis-600 hover:bg-praxis-700 text-white font-semibold py-3 rounded-xl text-sm">
              {tr(T.abschliessen)}
            </button>
          )}
          {termin.status !== 'abgesagt' && (
            <button onClick={() => setzeStatus('abgesagt')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold py-3 rounded-xl text-sm">
              {tr(T.absagen)}
            </button>
          )}
          {termin.status === 'abgesagt' && (
            <button onClick={() => setzeStatus('bestaetigt')} className="flex-1 bg-white border border-praxis-300 text-praxis-700 hover:bg-praxis-50 font-semibold py-3 rounded-xl text-sm">
              {tr(T.aktivieren)}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
