import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import BerichtForm from '../components/BerichtForm.jsx'
import SpesenForm from '../components/SpesenForm.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { druckeRegiebericht, druckeAbnahme } from '../drucken.js'

// Berichte-Eingang: alle Regieberichte/Reklamationen/Abnahmen + Spesen.
// Manuelle Erfassung im Büro (Übergang bis zur Flutter-App), Freigabe, PDF-Druck.

const TYP = {
  regie: { schluessel: 'bericht.regie', farbe: 'bg-amber-100 text-amber-700' },
  reklamation: { schluessel: 'bericht.reklamation', farbe: 'bg-red-100 text-red-700' },
  abnahme: { schluessel: 'bericht.abnahme', farbe: 'bg-emerald-100 text-emerald-700' },
}

const STATUS = {
  entwurf: { schluessel: 'status.entwurf', farbe: 'bg-gedeckt-tief text-schrift' },
  eingereicht: { schluessel: 'status.eingereicht', farbe: 'bg-sky-100 text-sky-700' },
  freigegeben: { schluessel: 'status.freigegeben', farbe: 'bg-emerald-100 text-emerald-700' },
  abgerechnet: { schluessel: 'status.abgerechnet', farbe: 'bg-violet-100 text-violet-700' },
  erstattet: { schluessel: 'status.erstattet', farbe: 'bg-violet-100 text-violet-700' },
}

const SPESEN_TYP = { fahrt: 'spesen.fahrt', hotel: 'spesen.hotel', sonstig: 'spesen.sonstig' }

export default function Berichte({ user }) {
  useLang()
  const berichte = useCollection('berichte')
  const spesen = useCollection('spesen')
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const einst = useEinstellungen()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('eingereicht')
  const [neuTyp, setNeuTyp] = useState(null)       // 'regie'|'reklamation'|'abnahme'
  const [bearbeite, setBearbeite] = useState(null) // bericht-Objekt
  const [spesenModal, setSpesenModal] = useState(false)
  const [bearbeiteSpesen, setBearbeiteSpesen] = useState(null)

  const projektVon = (id) => projekte.find((p) => p.id === id)
  const kundeVon = (projekt) => patients.find((k) => k.id === projekt?.kundeId)

  // Fotos erst beim Drucken laden (gefiltert!) statt alle Fotos dauerhaft zu
  // abonnieren – im Firebase-Modus spart das sehr viele Lesevorgänge.
  async function drucken(b) {
    const projekt = projektVon(b.projektId)
    const kunde = kundeVon(projekt)
    const fotos = await withStore((s) => (s.listWhere
      ? s.listWhere('photos', 'berichtId', b.id)
      : s.list('photos').then((alle) => alle.filter((p) => p.berichtId === b.id))))
    if (b.typ === 'abnahme') druckeAbnahme({ bericht: b, projekt, kunde, fotos, einst })
    else druckeRegiebericht({ bericht: b, projekt, kunde, fotos, einst })
  }

  async function freigeben(b) {
    // Zeitstempel + Person dokumentieren (Beweiswert auf dem Ausdruck)
    await withStore((s) => s.update('berichte', b.id, {
      status: 'freigegeben', freigegebenAm: Date.now(), freigegebenVon: user?.name || '',
    }))
  }

  const gefiltert = filter === 'spesen'
    ? []
    : berichte
        .filter((b) => (filter === 'alle' ? true : b.status === filter))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const spesenListe = [...spesen].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  return (
    <div className={S.SEITE_SCHMAL}>
      <Seitenkopf icon="bericht" titel={t('nav.berichte')} sub={t('berichte.sub')}>
        <button onClick={() => setNeuTyp('regie')} className={S.BTN_PRIMAER}>
          <Icon name="regie" groesse="s" /> {t('bericht.regie')}
        </button>
        <button onClick={() => setNeuTyp('reklamation')} className={S.BTN_ZWEIT}>
          <Icon name="reklamation" groesse="s" /> {t('bericht.reklamation')}
        </button>
        <button onClick={() => setNeuTyp('abnahme')} className={S.BTN_ZWEIT}>
          <Icon name="abnahme" groesse="s" /> {t('bericht.abnahme')}
        </button>
        <button onClick={() => setSpesenModal(true)} className={S.BTN_ZWEIT}>
          <Icon name="spesen" groesse="s" /> {t('monteur.spesen')}
        </button>
      </Seitenkopf>

      <ChipReihe
        aktiv={filter}
        onWahl={setFilter}
        chips={[
          { id: 'eingereicht', label: t('status.eingereicht'), icon: 'inbox', anzahl: berichte.filter((b) => b.status === 'eingereicht').length },
          { id: 'entwurf', label: t('berichte.entwuerfe'), icon: 'stift', anzahl: berichte.filter((b) => b.status === 'entwurf').length },
          { id: 'freigegeben', label: t('status.freigegeben'), icon: 'erfolg', anzahl: berichte.filter((b) => b.status === 'freigegeben').length },
          { id: 'abgerechnet', label: t('status.abgerechnet'), icon: 'euro', anzahl: berichte.filter((b) => b.status === 'abgerechnet').length },
          { id: 'alle', label: t('berichte.alle'), icon: 'list', anzahl: berichte.length },
          { id: 'spesen', label: t('monteur.spesen'), icon: 'spesen', anzahl: spesen.length },
        ]}
      />

      {filter === 'spesen' ? (
        spesenListe.length === 0 ? (
          <div className={S.KARTE}>
            <Leer icon="spesen" titel={t('berichte.spesenLeerTitel')} text={t('berichte.spesenLeerText')} />
          </div>
        ) : (
          <div className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs uppercase text-schrift-zart border-b border-rahmen">
                  <th className="px-4 py-3">{t('allg.datum')}</th><th className="px-4 py-3">{t('berichte.projekt')}</th><th className="px-4 py-3">{t('berichte.mitarbeiter')}</th>
                  <th className="px-4 py-3">{t('berichte.typ')}</th><th className="px-4 py-3">{t('berichte.details')}</th><th className="px-4 py-3 text-right">{t('allg.betrag')}</th><th className="px-4 py-3">{t('allg.status')}</th>
                </tr>
              </thead>
              <tbody>
                {spesenListe.map((s) => (
                  <tr key={s.id} onClick={() => setBearbeiteSpesen(s)} className="border-b border-rahmen hover:bg-praxis-50/40 cursor-pointer">
                    <td className="px-4 py-3">{s.datum ? datumLok(s.datum, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'}</td>
                    <td className="px-4 py-3">{projektVon(s.projektId)?.name || '–'}</td>
                    <td className="px-4 py-3">{s.mitarbeiterName || '–'}</td>
                    <td className="px-4 py-3">{SPESEN_TYP[s.typ] ? t(SPESEN_TYP[s.typ]) : s.typ}</td>
                    <td className="px-4 py-3 text-schrift-leise">
                      {s.typ === 'fahrt' && s.fahrt ? `${s.fahrt.km} km × ${euro(s.fahrt.kmSatz)}${s.fahrt.automatisch ? ' (auto)' : ''}` : (s.kommentar || '–')}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{euro(s.betrag)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS[s.status]?.farbe || 'bg-gedeckt-tief'}`}>{STATUS[s.status] ? t(STATUS[s.status].schluessel) : s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : gefiltert.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="bericht" titel={t('berichte.leerTitel')} text={t('berichte.leerText')} />
        </div>
      ) : (
        <div className="space-y-2.5">
          {gefiltert.map((b) => (
            <div key={b.id} className="bg-karte rounded-karte border border-rahmen shadow-karte p-4 flex flex-wrap items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${TYP[b.typ]?.farbe || 'bg-gedeckt-tief'}`}>
                {TYP[b.typ] ? t(TYP[b.typ].schluessel) : b.typ}
              </span>
              <button
                onClick={() => navigate(`/projekte/${b.projektId}`)}
                className="flex-1 min-w-[200px] text-left"
              >
                <p className="font-semibold text-schrift-stark truncate">{projektVon(b.projektId)?.name || '–'}</p>
                <p className="text-sm text-schrift-leise truncate">
                  {b.datum ? datumLok(b.datum, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'} · {b.mitarbeiterName || '–'}
                  {b.beschreibung ? ` · ${b.beschreibung}` : ''}
                </p>
              </button>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${STATUS[b.status]?.farbe || 'bg-gedeckt-tief'}`}>
                {STATUS[b.status] ? t(STATUS[b.status].schluessel) : b.status}
              </span>
              <div className="flex gap-1.5">
                {b.status === 'eingereicht' && (
                  <button onClick={() => freigeben(b)} className="px-3 py-1.5 rounded-feld bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">{t('berichte.freigeben')}</button>
                )}
                {['entwurf', 'eingereicht'].includes(b.status) ? (
                  <button onClick={() => setBearbeite(b)} className="px-3 py-1.5 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium hover:bg-gedeckt-tief">{t('allg.bearbeiten')}</button>
                ) : (
                  <button onClick={() => setBearbeite(b)} className="px-3 py-1.5 rounded-feld bg-gedeckt text-schrift-zart text-xs font-medium" title={t('berichte.nurAnsicht')}>{t('allg.ansehen')}</button>
                )}
                <button onClick={() => drucken(b)} className="px-3 py-1.5 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium hover:bg-gedeckt-tief flex items-center gap-1">
                  <Icon name="doc" className="w-3.5 h-3.5" /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {neuTyp && <BerichtForm typ={neuTyp} user={user} onClose={() => setNeuTyp(null)} />}
      {bearbeite && <BerichtForm typ={bearbeite.typ} bericht={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
      {spesenModal && <SpesenForm user={user} onClose={() => setSpesenModal(false)} />}
      {bearbeiteSpesen && <SpesenForm spesen={bearbeiteSpesen} user={user} onClose={() => setBearbeiteSpesen(null)} />}
    </div>
  )
}
