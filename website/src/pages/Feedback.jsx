import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PRAXIS } from '@shared/praxis.js'
import { getStore } from '@shared/store.js'
import { ZahnLogo } from '@shared/ui.jsx'
import { useLang, tr, setLang, getLang } from '@shared/i18n.js'

// Internes Patienten-Feedback nach der Behandlung (Qualitätsmanagement).
// Aufruf über den Link aus der Feedback-Mail: #/feedback?id=<terminId>&token=<feedbackToken>
// Bewertungen landen NUR intern in der Praxis-Verwaltung – nie öffentlich.

const T = {
  titel: { de: 'Wie war Ihr Besuch bei uns?', en: 'How was your visit?', ar: 'كيف كانت زيارتك لدينا؟' },
  untertitel: {
    de: 'Ihre Rückmeldung geht direkt und vertraulich an unser Praxisteam – sie hilft uns, jeden Tag besser zu werden.',
    en: 'Your feedback goes directly and confidentially to our team – it helps us improve every day.',
    ar: 'ملاحظاتك تصل مباشرة وبسرية إلى فريقنا – وتساعدنا على التحسن كل يوم.',
  },
  sterneHinweis: [
    { de: 'Sehr unzufrieden', en: 'Very unhappy', ar: 'غير راضٍ إطلاقًا' },
    { de: 'Unzufrieden', en: 'Unhappy', ar: 'غير راضٍ' },
    { de: 'Okay', en: 'Okay', ar: 'مقبول' },
    { de: 'Zufrieden', en: 'Happy', ar: 'راضٍ' },
    { de: 'Begeistert!', en: 'Delighted!', ar: 'سعيد جدًا!' },
  ],
  tagsTitel: { de: 'Was möchten Sie hervorheben?', en: 'What would you like to highlight?', ar: 'ما الذي تود إبرازه؟' },
  freitext: { de: 'Möchten Sie uns noch etwas sagen? (optional)', en: 'Anything else you want to tell us? (optional)', ar: 'هل تود إخبارنا بشيء آخر؟ (اختياري)' },
  senden: { de: 'Feedback absenden', en: 'Send feedback', ar: 'إرسال الملاحظات' },
  sendet: { de: 'Wird gesendet …', en: 'Sending …', ar: 'جارٍ الإرسال …' },
  dankeTitel: { de: 'Vielen Dank!', en: 'Thank you!', ar: 'شكرًا جزيلًا!' },
  danke: {
    de: 'Ihre Rückmeldung ist bei uns angekommen. Wenn etwas nicht gut war, meldet sich unser Team persönlich bei Ihnen.',
    en: 'Your feedback has reached us. If something was not right, our team will contact you personally.',
    ar: 'وصلتنا ملاحظاتك. إذا كان هناك شيء غير جيد، سيتواصل معك فريقنا شخصيًا.',
  },
  fehlerLink: {
    de: 'Dieser Feedback-Link ist ungültig oder wurde bereits verwendet. Bei Fragen rufen Sie uns gerne an.',
    en: 'This feedback link is invalid or has already been used. Feel free to call us if you have questions.',
    ar: 'رابط الملاحظات غير صالح أو استُخدم من قبل. اتصل بنا إذا كانت لديك أسئلة.',
  },
  zurStartseite: { de: 'Zur Startseite', en: 'Back to home', ar: 'إلى الصفحة الرئيسية' },
}

const TAGS = [
  { key: 'wartezeit-kurz', positiv: true, label: { de: 'Kurze Wartezeit', en: 'Short waiting time', ar: 'انتظار قصير' } },
  { key: 'team-freundlich', positiv: true, label: { de: 'Freundliches Team', en: 'Friendly team', ar: 'فريق ودود' } },
  { key: 'gut-erklaert', positiv: true, label: { de: 'Alles gut erklärt', en: 'Everything well explained', ar: 'شرح ممتاز' } },
  { key: 'schmerzfrei', positiv: true, label: { de: 'Schmerzfreie Behandlung', en: 'Pain-free treatment', ar: 'علاج دون ألم' } },
  { key: 'sauber', positiv: true, label: { de: 'Saubere Praxis', en: 'Clean practice', ar: 'عيادة نظيفة' } },
  { key: 'wartezeit-lang', positiv: false, label: { de: 'Lange Wartezeit', en: 'Long waiting time', ar: 'انتظار طويل' } },
  { key: 'schmerzen', positiv: false, label: { de: 'Schmerzen', en: 'Pain', ar: 'ألم' } },
  { key: 'unklar', positiv: false, label: { de: 'Unklar erklärt', en: 'Unclear explanation', ar: 'شرح غير واضح' } },
]

const EMOJIS = ['😠', '🙁', '😐', '🙂', '🤩']

export default function Feedback() {
  useLang()
  const location = useLocation()
  const params = useMemo(() => new URLSearchParams(location.search), [location.search])
  const terminId = params.get('id') || ''
  const token = params.get('token') || ''

  const [sterne, setSterne] = useState(0)
  const [tags, setTags] = useState([])
  const [text, setText] = useState('')
  const [status, setStatus] = useState('offen') // offen | sendet | fertig | fehler

  useEffect(() => {
    const sprache = params.get('sprache')
    if (sprache && sprache !== getLang()) setLang(sprache)
  }, [params])

  async function absenden() {
    if (!sterne) return
    setStatus('sendet')
    try {
      const store = await getStore()
      await store.add('feedback', {
        terminId,
        token,
        sterne,
        tags,
        text: text.trim(),
        createdAt: Date.now(),
        status: 'neu',
      })
      setStatus('fertig')
    } catch (e) {
      setStatus('fehler') // Regeln lehnen ab -> Link ungültig
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-praxis-50 via-white to-white flex flex-col">
      <header className="bg-white/90 border-b border-praxis-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2 text-praxis-700">
          <ZahnLogo className="w-7 h-7" />
          <span className="font-bold text-sm">{PRAXIS.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
        {status === 'fertig' ? (
          <div className="bg-white border border-praxis-100 rounded-3xl shadow-sm p-8 text-center">
            <p className="text-5xl">{EMOJIS[(sterne || 5) - 1]}</p>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">{tr(T.dankeTitel)}</h1>
            <p className="mt-2 text-slate-600 text-sm leading-relaxed">{tr(T.danke)}</p>
            <Link to="/" className="mt-6 inline-block bg-praxis-600 hover:bg-praxis-700 text-white font-semibold px-6 py-3 rounded-full">
              {tr(T.zurStartseite)}
            </Link>
          </div>
        ) : status === 'fehler' ? (
          <div className="bg-white border border-amber-200 rounded-3xl shadow-sm p-8 text-center">
            <p className="text-4xl">🔒</p>
            <p className="mt-4 text-slate-600 leading-relaxed">{tr(T.fehlerLink)}</p>
            <p className="mt-2 font-bold text-praxis-700" dir="ltr">{PRAXIS.telefon}</p>
          </div>
        ) : (
          <div className="bg-white border border-praxis-100 rounded-3xl shadow-sm p-6 sm:p-8">
            <h1 className="text-2xl font-bold text-slate-900 text-center">{tr(T.titel)}</h1>
            <p className="mt-2 text-sm text-slate-500 text-center leading-relaxed">{tr(T.untertitel)}</p>

            {/* Sterne / Emojis */}
            <div className="mt-6 flex justify-center gap-2" dir="ltr">
              {EMOJIS.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setSterne(i + 1)}
                  className={`text-4xl w-14 h-14 rounded-2xl transition ${
                    sterne === i + 1 ? 'bg-praxis-100 scale-110 ring-2 ring-praxis-500' : 'hover:bg-slate-50 opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`${i + 1} / 5`}
                >
                  {e}
                </button>
              ))}
            </div>
            {sterne > 0 && (
              <p className="mt-2 text-center text-sm font-semibold text-praxis-700">
                {'★'.repeat(sterne)}{'☆'.repeat(5 - sterne)} · {tr(T.sterneHinweis[sterne - 1])}
              </p>
            )}

            {/* Schnell-Tags */}
            {sterne > 0 && (
              <>
                <p className="mt-6 text-sm font-medium text-slate-700">{tr(T.tagsTitel)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TAGS.map((t) => {
                    const aktiv = tags.includes(t.key)
                    return (
                      <button
                        key={t.key}
                        onClick={() => setTags(aktiv ? tags.filter((x) => x !== t.key) : [...tags, t.key])}
                        className={`text-sm font-medium rounded-full px-4 py-2 border-2 transition ${
                          aktiv
                            ? t.positiv ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-amber-500 border-amber-500 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {t.positiv ? '👍' : '👎'} {tr(t.label)}
                      </button>
                    )
                  })}
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  placeholder={tr(T.freitext)}
                  className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />

                <button
                  onClick={absenden}
                  disabled={status === 'sendet'}
                  className="mt-4 w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl text-base"
                >
                  {status === 'sendet' ? tr(T.sendet) : tr(T.senden)}
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export { TAGS as FEEDBACK_TAGS }
