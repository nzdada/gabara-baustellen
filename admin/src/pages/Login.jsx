import { useState } from 'react'
import { anmelden, DEMO_ZUGAENGE } from '@shared/auth.js'
import { storeModus } from '@shared/store.js'
import { ZahnLogo, Icon, SprachSchalter } from '@shared/ui.jsx'
import { useLang, tr } from '@shared/i18n.js'

const T = {
  titel: { de: 'Gabara Verwaltung', en: 'Gabara Verwaltung', ar: 'Gabara Verwaltung' },
  untertitel: { de: 'Gabara Service GmbH · nur für das Team', en: 'Gabara Service GmbH · team only', ar: 'Gabara Service GmbH · للفريق فقط' },
  email: { de: 'E-Mail', en: 'E-mail', ar: 'البريد الإلكتروني' },
  passwort: { de: 'Passwort', en: 'Password', ar: 'كلمة المرور' },
  anmelden: { de: 'Anmelden', en: 'Sign in', ar: 'تسجيل الدخول' },
  laedt: { de: 'Anmelden …', en: 'Signing in …', ar: 'جارٍ تسجيل الدخول …' },
  fehler: { de: 'Anmeldung fehlgeschlagen.', en: 'Sign-in failed.', ar: 'فشل تسجيل الدخول.' },
  demoTitel: { de: 'Demo-Zugänge (lokaler Modus)', en: 'Demo accounts (local mode)', ar: 'حسابات تجريبية (وضع محلي)' },
}

export default function Login() {
  useLang()
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)
  const demo = storeModus() === 'lokal'

  async function absenden(e) {
    e.preventDefault()
    setFehler('')
    setLaedt(true)
    try {
      await anmelden(email, passwort)
    } catch (err) {
      setFehler(err.message || tr(T.fehler))
    } finally {
      setLaedt(false)
    }
  }

  return (
    <div className="min-h-screen bg-praxis-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center text-white mb-8">
          <ZahnLogo className="w-14 h-14 mx-auto text-praxis-200" />
          <h1 className="mt-3 text-xl font-bold">{tr(T.titel)}</h1>
          <p className="text-praxis-200/70 text-sm">{tr(T.untertitel)}</p>
          <div className="mt-4 flex justify-center"><SprachSchalter dunkel /></div>
        </div>
        <form onSubmit={absenden} className="bg-white rounded-3xl shadow-xl p-7 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{tr(T.email)}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              dir="ltr"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{tr(T.passwort)}</span>
            <input
              type="password"
              value={passwort}
              onChange={(e) => setPasswort(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
          </label>
          {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{fehler}</p>}
          <button
            type="submit"
            disabled={laedt}
            className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl"
          >
            {laedt ? tr(T.laedt) : tr(T.anmelden)}
          </button>
        </form>
        {demo && (
          <div className="mt-5 bg-white/10 border border-white/15 rounded-2xl p-4 text-praxis-100 text-xs space-y-1.5">
            <p className="font-semibold flex items-center gap-1.5 text-amber-300">
              <Icon name="alert" className="w-4 h-4" /> {tr(T.demoTitel)}
            </p>
            {DEMO_ZUGAENGE.map((z) => (
              <button
                key={z.email}
                type="button"
                onClick={() => { setEmail(z.email); setPasswort(z.passwort) }}
                className="block w-full text-left rtl:text-right hover:text-white"
              >
                {z.name}: <span className="font-mono" dir="ltr">{z.email}</span> / <span className="font-mono">{z.passwort}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
