import { useMemo } from 'react'
import { useCollection, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr, datumLok } from '@shared/i18n.js'

// Internes Feedback-Qualitätsmanagement: 1-2 Sterne mit Status "neu" werden rot
// als "Aktion erforderlich" markiert -> Praxis kontaktiert den Patienten, BEVOR
// daraus eine öffentliche schlechte Google-Bewertung wird.

const T = {
  titel: { de: 'Patienten-Feedback', en: 'Patient feedback', ar: 'ملاحظات المرضى' },
  untertitel: {
    de: 'Interne Bewertungen nach abgeschlossener Behandlung – nicht öffentlich. Bei 1–2 Sternen bitte den Patienten zeitnah anrufen.',
    en: 'Internal ratings after completed treatments – not public. For 1–2 stars please call the patient promptly.',
    ar: 'تقييمات داخلية بعد العلاج – غير علنية. عند نجمة أو نجمتين يرجى الاتصال بالمريض سريعًا.',
  },
  schnitt: { de: 'Durchschnitt', en: 'Average', ar: 'المتوسط' },
  bewertungen: { de: 'Bewertungen', en: 'ratings', ar: 'تقييمات' },
  alarm: { de: 'Aktion erforderlich', en: 'Action required', ar: 'إجراء مطلوب' },
  aktion: { de: 'AKTION ERFORDERLICH', en: 'ACTION REQUIRED', ar: 'إجراء مطلوب' },
  erledigt: { de: 'Erledigt', en: 'Done', ar: 'تم' },
  alsErledigt: { de: 'Als erledigt markieren', en: 'Mark as done', ar: 'وضع علامة تم' },
  leer: { de: 'Noch kein Feedback eingegangen.', en: 'No feedback received yet.', ar: 'لم تصل ملاحظات بعد.' },
  unbekannt: { de: 'Unbekannter Termin', en: 'Unknown appointment', ar: 'موعد غير معروف' },
  tagNamen: {
    'wartezeit-kurz': { de: '👍 Kurze Wartezeit', en: '👍 Short waiting time', ar: '👍 انتظار قصير' },
    'team-freundlich': { de: '👍 Freundliches Team', en: '👍 Friendly team', ar: '👍 فريق ودود' },
    'gut-erklaert': { de: '👍 Gut erklärt', en: '👍 Well explained', ar: '👍 شرح جيد' },
    'schmerzfrei': { de: '👍 Schmerzfrei', en: '👍 Pain-free', ar: '👍 دون ألم' },
    'sauber': { de: '👍 Saubere Praxis', en: '👍 Clean practice', ar: '👍 عيادة نظيفة' },
    'wartezeit-lang': { de: '👎 Lange Wartezeit', en: '👎 Long waiting time', ar: '👎 انتظار طويل' },
    'schmerzen': { de: '👎 Schmerzen', en: '👎 Pain', ar: '👎 ألم' },
    'unklar': { de: '👎 Unklar erklärt', en: '👎 Unclear', ar: '👎 غير واضح' },
  },
}

export default function FeedbackAdmin() {
  useLang()
  const feedback = useCollection('feedback')
  const appointments = useCollection('appointments')

  const sortiert = useMemo(
    () =>
      [...feedback].sort((a, b) => {
        const alarmA = a.status === 'neu' && a.sterne <= 2 ? 0 : 1
        const alarmB = b.status === 'neu' && b.sterne <= 2 ? 0 : 1
        return alarmA - alarmB || (b.createdAt || 0) - (a.createdAt || 0)
      }),
    [feedback]
  )
  const schnitt = feedback.length ? (feedback.reduce((s, f) => s + f.sterne, 0) / feedback.length).toFixed(1) : '–'
  const alarme = feedback.filter((f) => f.status === 'neu' && f.sterne <= 2).length

  async function erledigt(f) {
    await withStore((s) => s.update('feedback', f.id, { status: 'erledigt' }))
  }

  return (
    <div className="p-4 lg:p-6 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-slate-900">{tr(T.titel)}</h1>
        <span className="text-sm font-bold bg-praxis-100 text-praxis-800 rounded-full px-3 py-1">
          ⭐ {schnitt} <span className="font-normal text-praxis-700">({feedback.length} {tr(T.bewertungen)})</span>
        </span>
        {alarme > 0 && (
          <span className="text-sm font-bold bg-red-600 text-white rounded-full px-3 py-1 animate-pulse">
            {alarme} × {tr(T.alarm)}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-5">{tr(T.untertitel)}</p>

      {sortiert.length === 0 ? (
        <p className="bg-white rounded-2xl border border-slate-200 px-5 py-10 text-center text-sm text-slate-400">{tr(T.leer)}</p>
      ) : (
        <div className="space-y-3">
          {sortiert.map((f) => {
            const termin = appointments.find((a) => a.id === f.terminId)
            const alarm = f.status === 'neu' && f.sterne <= 2
            return (
              <div
                key={f.id}
                className={`bg-white rounded-2xl border-2 p-5 ${
                  alarm ? 'border-red-400 bg-red-50/40' : f.status === 'erledigt' ? 'border-slate-100 opacity-70' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xl" dir="ltr">
                    <span className="text-amber-500">{'★'.repeat(f.sterne)}</span>
                    <span className="text-slate-300">{'★'.repeat(5 - f.sterne)}</span>
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{termin ? termin.patientName : tr(T.unbekannt)}</p>
                    <p className="text-xs text-slate-400">
                      {termin ? `${datumLok(termin.datum)} · ${termin.behandlung} · ${termin.arzt}` : f.terminId}
                      {' · '}{new Date(f.createdAt).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  {alarm && (
                    <span className="text-xs font-bold bg-red-600 text-white rounded-full px-3 py-1.5">⚠ {tr(T.aktion)}</span>
                  )}
                  {f.status === 'erledigt' ? (
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 rounded-full px-3 py-1.5">✓ {tr(T.erledigt)}</span>
                  ) : (
                    <button
                      onClick={() => erledigt(f)}
                      className="text-xs font-semibold bg-white border border-slate-200 hover:border-praxis-400 text-slate-600 rounded-full px-3.5 py-2"
                    >
                      {tr(T.alsErledigt)}
                    </button>
                  )}
                </div>
                {(f.tags?.length > 0 || f.text) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(f.tags || []).map((t) => (
                      <span key={t} className="text-xs font-medium bg-slate-100 text-slate-600 rounded-full px-3 py-1">
                        {tr(T.tagNamen[t]) || t}
                      </span>
                    ))}
                  </div>
                )}
                {f.text && <p className="mt-2.5 text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">„{f.text}"</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
