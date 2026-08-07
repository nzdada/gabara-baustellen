import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { useLang, tr, t } from '@shared/i18n.js'
import { WISSEN, FAELLE, sucheWissen, sucheFaelle } from '@shared/wissen.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer } from '../components/Seite.jsx'
import WissenBild from '../components/WissenBild.jsx'

// Wissensdatenbank: erklärt, wie die Verwaltung funktioniert – in beiden Sprachen.
// Inhalte liegen in shared/wissen.js, diese Seite ist nur die Darstellung.

function Absatz({ teil }) {
  if (teil.p) {
    return <p className="text-sm text-schrift leading-relaxed">{tr(teil.p)}</p>
  }
  if (teil.merke) {
    return (
      <p className="flex items-start gap-2.5 text-sm bg-praxis-50 border border-praxis-200 text-praxis-900 rounded-feld px-4 py-3">
        <Icon name="info" className="w-4 h-4 mt-0.5 shrink-0" />
        <span className="leading-relaxed">{tr(teil.merke)}</span>
      </p>
    )
  }
  if (teil.achtung) {
    return (
      <p className="flex items-start gap-2.5 text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-feld px-4 py-3">
        <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
        <span className="leading-relaxed">{tr(teil.achtung)}</span>
      </p>
    )
  }
  if (teil.schritte) {
    return (
      <ol className="space-y-2">
        {teil.schritte.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-schrift leading-relaxed">
            <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-praxis-600 text-white text-[11px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <span>{tr(s)}</span>
          </li>
        ))}
      </ol>
    )
  }
  if (teil.bild) {
    return <WissenBild name={teil.bild} unterschrift={teil.unterschrift ? tr(teil.unterschrift) : ''} />
  }
  return null
}

// Anwendungsfall: eine Alltagssituation und der Weg, den man dafür geht.
// Bewusst anders gerahmt als ein Artikel – wer hierher kommt, sucht keine
// Erklärung, sondern die nächsten Handgriffe.
function Anwendungsfall({ fall }) {
  return (
    <div className="border-b border-rahmen last:border-b-0 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-7 h-7 shrink-0 rounded-feld bg-praxis-600/10 text-praxis-700 flex items-center justify-center">
          <Icon name="regie" className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-bold text-schrift-stark text-sm">{tr(fall.titel)}</p>
            <p className="text-xs text-schrift-leise mt-0.5 italic">„{tr(fall.ausloeser)}"</p>
          </div>
          {fall.antwort.map((teil, i) => <Absatz key={i} teil={teil} />)}
          {fall.zu && (
            <Link
              to={fall.zu}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-praxis-700 hover:underline"
            >
              {t('hilfe.dorthin')} <Icon name="arrowRight" className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function Artikel({ artikel, offen, onWechsel }) {
  return (
    <div className="border-b border-rahmen last:border-b-0">
      <button
        onClick={onWechsel}
        aria-expanded={offen}
        className="w-full flex items-start gap-3 text-start px-5 py-3.5 hover:bg-praxis-50/50 transition"
      >
        {/* Nur der ZUGEKLAPPTE Pfeil zeigt zur Seite und muss im Arabischen
            spiegeln. Der aufgeklappte zeigt nach unten – unten bleibt unten. */}
        <Icon
          name={offen ? 'chevronUnten' : 'chevronRechts'}
          className={`w-4 h-4 mt-0.5 shrink-0 text-praxis-600 ${offen ? '' : 'rtl:rotate-180'}`}
        />
        <span className={`flex-1 text-sm ${offen ? 'font-bold text-schrift-stark' : 'font-medium text-schrift'}`}>
          {tr(artikel.frage)}
        </span>
      </button>
      {offen && (
        <div className="px-5 pb-5 ps-12 space-y-3">
          {artikel.antwort.map((teil, i) => <Absatz key={i} teil={teil} />)}
          {artikel.zu && (
            <Link
              to={artikel.zu}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-praxis-700 hover:underline"
            >
              {t('hilfe.dorthin')} <Icon name="arrowRight" className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default function Hilfe() {
  const lang = useLang()
  const [suche, setSuche] = useState('')
  const [tab, setTab] = useState('faelle')   // faelle | themen
  const [offen, setOffen] = useState({})     // artikelId -> true

  const bereiche = useMemo(() => sucheWissen(suche), [suche, lang])
  const faelle = useMemo(() => sucheFaelle(suche), [suche, lang])
  const trefferZahl = tab === 'themen'
    ? bereiche.reduce((s, b) => s + b.artikel.length, 0)
    : faelle.length
  const gesamtZahl = tab === 'themen'
    ? WISSEN.reduce((s, b) => s + b.artikel.length, 0)
    : FAELLE.length

  function wechsel(id) {
    setOffen((o) => ({ ...o, [id]: !o[id] }))
  }

  // Bei aktiver Suche alles aufklappen – sonst sucht man den Treffer zweimal
  const istOffen = (id) => (suche.trim() ? true : Boolean(offen[id]))

  return (
    <div className={S.SEITE_SCHMAL}>
      <Seitenkopf icon="info" titel={t('hilfe.titel')} sub={t('hilfe.sub')} />

      {/* Anwendungsfälle zuerst: wer die Hilfe öffnet, steckt meist mitten in
          einer Aufgabe und sucht den nächsten Handgriff, nicht eine Erklärung. */}
      <div className="mb-4 flex items-center gap-1 bg-gedeckt-tief rounded-full p-1 w-fit">
        {[['faelle', 'hilfe.tabFaelle', 'regie'], ['themen', 'hilfe.tabThemen', 'doc']].map(([id, k, ikon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition ${
              tab === id ? 'bg-praxis-600 text-white' : 'text-schrift-leise hover:text-schrift'
            }`}
          >
            <Icon name={ikon} className="w-3.5 h-3.5" /> {t(k)}
          </button>
        ))}
      </div>

      <div className="mb-4 relative">
        <Icon name="suche" className="w-4 h-4 absolute start-4 top-1/2 -translate-y-1/2 text-schrift-zart pointer-events-none" />
        <input
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={t('hilfe.suchen')}
          className="w-full rounded-feld border border-rahmen bg-karte ps-11 pe-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
        />
      </div>

      {suche.trim() && (
        <p className="mb-3 text-sm text-schrift-leise">
          {t('hilfe.treffer', { n: trefferZahl, gesamt: gesamtZahl })}
        </p>
      )}

      {tab === 'faelle' ? (
        faelle.length === 0 ? (
          <div className={S.KARTE}>
            <Leer icon="suche" titel={t('hilfe.leerTitel')} text={t('hilfe.leerText')} />
          </div>
        ) : (
          <div className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-hidden">
            <div className="px-5 py-3.5 border-b border-rahmen bg-gedeckt/70">
              <p className="font-bold text-schrift-stark">{t('hilfe.faelleTitel')}</p>
              <p className="text-xs text-schrift-leise">{t('hilfe.faelleSub')}</p>
            </div>
            {faelle.map((f) => <Anwendungsfall key={f.id} fall={f} />)}
          </div>
        )
      ) : bereiche.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="suche" titel={t('hilfe.leerTitel')} text={t('hilfe.leerText')} />
        </div>
      ) : (
        <div className="space-y-4">
          {bereiche.map((b) => (
            <section key={b.id} className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-rahmen bg-gedeckt/70">
                <span className="w-8 h-8 rounded-feld bg-praxis-600 text-white flex items-center justify-center shrink-0">
                  <Icon name={b.icon} className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-schrift-stark">{tr(b.titel)}</p>
                  <p className="text-xs text-schrift-leise">{tr(b.sub)}</p>
                </div>
                {b.zu && (
                  <Link to={b.zu} className="text-xs font-semibold text-praxis-700 hover:underline shrink-0">
                    {t('hilfe.dorthin')}
                  </Link>
                )}
              </div>
              <div>
                {b.artikel.map((a) => (
                  <Artikel
                    key={a.id}
                    artikel={a}
                    offen={istOffen(`${b.id}.${a.id}`)}
                    onWechsel={() => wechsel(`${b.id}.${a.id}`)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-schrift-zart">{t('hilfe.fuss')}</p>
    </div>
  )
}
