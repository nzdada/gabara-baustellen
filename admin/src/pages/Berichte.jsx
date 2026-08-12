import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { anerkennungsStand, anerkanntAbIso } from '@shared/fristen.js'
import { abnahmeSeiten, abnahmePatches, grundText } from '@shared/abnahme.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import BerichtForm from '../components/BerichtForm.jsx'
import SpesenForm from '../components/SpesenForm.jsx'
import Modal from '../components/Modal.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { druckeRegiebericht, druckeAbnahme, druckeRegieFrei } from '../drucken.js'

// Berichte-Eingang: alle Regieberichte/Reklamationen/Abnahmen + Spesen.
// Manuelle Erfassung im Büro (Übergang bis zur Flutter-App), Freigabe, PDF-Druck.
//
// AP 9 dazu:
//  - REGIEANORDNUNGEN mit Anerkennungsuhr (§ 15 Abs. 3 VOB/B): Vorlegen mit
//    Zugangsdatum + Zugangsnachweis; 6 Werktage (bayerische Feiertage,
//    Samstag zählt) später gilt der Zettel als anerkannt. Gerechnet wird ab
//    dem EINGETRAGENEN Zugang – der Warnhinweis steht im Dialog.
//  - Abnahme-PDF baut sich aus dem Fotobestand (shared/abnahme.js): je Raum
//    beide Bildpaare Auftrag + Regie, Teilabnahme aufs Deckblatt.
//  - Freigabe einer Abnahme setzt raumweise abnahmeAm (Teilabnahme).

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
  // Freie Regieberichte (frei: true) kennen nur entwurf | abgeschlossen.
  abgeschlossen: { schluessel: 'status.abgeschlossen', farbe: 'bg-emerald-100 text-emerald-700' },
}

const SPESEN_TYP = { fahrt: 'spesen.fahrt', hotel: 'spesen.hotel', sonstig: 'spesen.sonstig' }

const ZUGANGSNACHWEISE = ['quittung', 'mail', 'uebergabe', 'unbekannt']
const ANZEIGE_SYMBOL = { muendlich: '💬', schriftlich: '📄', mail: '✉' }

export default function Berichte({ user }) {
  useLang()
  const berichte = useCollection('berichte')
  const spesen = useCollection('spesen')
  const projekte = useCollection('projekte')
  const patients = useCollection('patients')
  const anordnungen = useCollection('regieanordnungen')
  const einst = useEinstellungen()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('eingereicht')
  const [neuTyp, setNeuTyp] = useState(null)       // 'regie'|'reklamation'|'abnahme'
  const [bearbeite, setBearbeite] = useState(null) // bericht-Objekt
  const [spesenModal, setSpesenModal] = useState(false)
  const [bearbeiteSpesen, setBearbeiteSpesen] = useState(null)
  const [vorlegen, setVorlegen] = useState(null)   // Anordnung für den Vorlegen-Dialog
  const [widerspruch, setWiderspruch] = useState(null)
  const [meldung, setMeldung] = useState('')

  const projektVon = (id) => projekte.find((p) => p.id === id)
  const kundeVon = (projekt) => patients.find((k) => k.id === projekt?.kundeId)
  const heute = heuteISO()

  // Fotos erst beim Drucken laden (gefiltert!) statt alle Fotos dauerhaft zu
  // abonnieren – im Firebase-Modus spart das sehr viele Lesevorgänge.
  async function drucken(b) {
    const projekt = projektVon(b.projektId)
    const kunde = kundeVon(projekt)
    const fotos = await withStore((s) => (s.listWhere
      ? s.listWhere('photos', 'berichtId', b.id)
      : s.list('photos').then((alle) => alle.filter((p) => p.berichtId === b.id))))
    // Freie Regieberichte (ohne Projektbindung) haben ihr eigenes PDF.
    if (b.frei === true) {
      druckeRegieFrei({ bericht: b, fotos, einst })
      return
    }
    if (b.typ === 'abnahme') {
      // AP 9: die Raumseiten (beide Bildpaare je Raum) bauen sich aus dem
      // Bestand – Räume, Aufgaben, V2-Fotometadaten, Vorschaubilder,
      // Anordnungen und Stunden, alles NUR für dieses Projekt geladen.
      const lade = (coll) => withStore((s) => s.listWhere(coll, 'projektId', b.projektId))
      const [raeume, aufgaben, fotosV2, photosV2, stunden] = await Promise.all([
        lade('raeume'), lade('aufgaben'), lade('fotos'), lade('photos'), lade('stunden'),
      ])
      const projektAnordnungen = anordnungen.filter((a) => a.projektId === b.projektId)
      const { aufteilung, seiten } = abnahmeSeiten({
        raeume, aufgaben, fotos: fotosV2, photos: photosV2,
        anordnungen: projektAnordnungen, stunden,
      })
      druckeAbnahme({
        bericht: b, projekt, kunde, fotos, einst, seiten,
        ausgenommen: aufteilung.ausgenommen,
        bereitsAbgenommen: aufteilung.bereitsAbgenommen,
        grundText,
      })
    } else {
      druckeRegiebericht({ bericht: b, projekt, kunde, fotos, einst })
    }
  }

  async function freigeben(b) {
    if (b.typ === 'abnahme') {
      // Teilabnahme (Plan 7.5): vollständige Räume bekommen raumweise
      // abnahmeAm/abnahmeVon/abnahmeBerichtId – EIN Vorgang zusammen mit
      // der Berichts-Freigabe (schreibeVorgang, beide Store-Modi gleich).
      const lade = (coll) => withStore((s) => s.listWhere(coll, 'projektId', b.projektId))
      const [raeume, aufgaben] = await Promise.all([lade('raeume'), lade('aufgaben')])
      const { aufteilung } = abnahmeSeiten({ raeume, aufgaben })
      if (aufteilung.ausgenommen.length
        && !confirm(t('abn.freigabeFrage', { voll: aufteilung.abzunehmen.length, fehlt: aufteilung.ausgenommen.length }))) return
      const patches = [
        ...abnahmePatches(aufteilung, { berichtId: b.id, datum: b.datum || heute, von: user?.name || '' }),
        { coll: 'berichte', id: b.id, patch: { status: 'freigegeben', freigegebenAm: Date.now(), freigegebenVon: user?.name || '' } },
      ]
      await withStore((s) => s.schreibeVorgang({ patches }))
      setMeldung(t('abn.freigabeOk', { voll: aufteilung.abzunehmen.length }))
      return
    }
    // Zeitstempel + Person dokumentieren (Beweiswert auf dem Ausdruck)
    await withStore((s) => s.update('berichte', b.id, {
      status: 'freigegeben', freigegebenAm: Date.now(), freigegebenVon: user?.name || '',
    }))
  }

  // Vorlegen sichern: Zugang + Nachweis + errechnetes Anerkennungsdatum.
  // anerkanntAb wird beim Speichern EINGEFROREN – ändert sich später die
  // Feiertagsliste, bleibt die damals getroffene Rechtsaussage stehen.
  async function vorlegenSichern() {
    const a = vorlegen
    if (!a?.datum) return
    await withStore((s) => s.update('regieanordnungen', a.id, {
      vorgelegtAm: a.datum,
      zugangsnachweis: a.zugangsnachweis || 'unbekannt',
      anerkanntAb: anerkanntAbIso(a.datum),
      status: 'vorgelegt',
    }))
    setVorlegen(null)
  }

  async function widerspruchSichern() {
    const a = widerspruch
    if (!a?.datum) return
    await withStore((s) => s.update('regieanordnungen', a.id, {
      widersprochenAm: a.datum,
      widerspruchText: a.text || '',
      status: 'bestritten',
    }))
    setWiderspruch(null)
  }

  const gefiltert = filter === 'spesen' || filter === 'anordnungen'
    ? []
    : berichte
        .filter((b) => (filter === 'alle' ? true : b.status === filter))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const spesenListe = [...spesen].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  const anordnungenListe = [...anordnungen].sort((a, b) => (b.erstelltAm || 0) - (a.erstelltAm || 0))
  const anordnungenOffen = anordnungen.filter((a) => !a.vorgelegtAm && a.status !== 'bestritten').length

  // Anzeige der Anerkennungsuhr je Anordnung
  function uhrBadge(a) {
    const uhr = anerkennungsStand(a, heute)
    if (uhr.stand === 'bestritten') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{t('ra.statusBestritten')}</span>
    }
    if (uhr.stand === 'anerkannt') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">{t('ra.statusAnerkannt', { datum: datumLok(uhr.anerkanntAb, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}</span>
    }
    if (uhr.stand === 'laeuft') {
      return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700">{t('ra.statusLaeuft', { datum: datumLok(uhr.anerkanntAb, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}</span>
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{t('ra.statusOffen')}</span>
  }

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
          { id: 'anordnungen', label: t('ra.chip'), icon: 'regie', anzahl: anordnungenOffen },
        ]}
      />

      {meldung && <div className="mb-3"><Meldung art="ok">{meldung}</Meldung></div>}

      {filter === 'anordnungen' ? (
        anordnungenListe.length === 0 ? (
          <div className={S.KARTE}>
            <Leer icon="regie" titel={t('ra.keine')} text={t('ra.keineText')} />
          </div>
        ) : (
          <div className="space-y-2.5">
            {/* Der Warnhinweis der Anerkennungsuhr – die Rechtsaussage hängt
                am EINGETRAGENEN Zugang, nicht am Kalender des Büros. */}
            <Meldung art="warnung">{t('ra.warnZugang')}</Meldung>
            {anordnungenListe.map((a) => {
              const uhr = anerkennungsStand(a, heute)
              return (
                <div key={a.id} className="bg-karte rounded-karte border border-rahmen shadow-karte p-4 flex flex-wrap items-center gap-3">
                  <span className="text-xl leading-none" title={a.anzeigeArt}>{ANZEIGE_SYMBOL[a.anzeigeArt] || '💬'}</span>
                  <div className="flex-1 min-w-[220px]">
                    <p className="font-semibold text-schrift-stark truncate">{a.titel || t('bericht.regie')}</p>
                    <p className="text-sm text-schrift-leise truncate">
                      {projektVon(a.projektId)?.name || '–'} · {a.angeordnetDurch || '–'}
                      {a.angeordnetAm ? ` · ${datumLok(a.angeordnetAm, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
                      {a.vorgelegtAm ? ` · ${t('ra.vorgelegtAm')}: ${datumLok(a.vorgelegtAm, { day: '2-digit', month: '2-digit', year: 'numeric' })} (${t(`ra.zn_${a.zugangsnachweis || 'unbekannt'}`)})` : ''}
                    </p>
                  </div>
                  {uhrBadge(a)}
                  <div className="flex gap-1.5">
                    {!a.vorgelegtAm && uhr.stand !== 'bestritten' && (
                      <button
                        onClick={() => setVorlegen({ id: a.id, titel: a.titel, datum: heute, zugangsnachweis: 'quittung' })}
                        className="px-3 py-1.5 rounded-feld bg-praxis-600 text-white text-xs font-bold hover:bg-praxis-700"
                      >
                        {t('ra.vorlegen')}
                      </button>
                    )}
                    {a.vorgelegtAm && uhr.stand !== 'bestritten' && (
                      <button
                        onClick={() => setWiderspruch({ id: a.id, titel: a.titel, datum: heute, text: '' })}
                        className="px-3 py-1.5 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium"
                      >
                        {t('ra.widerspruch')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : filter === 'spesen' ? (
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
              {/* Freie Regieberichte (frei: true) haben KEIN Projekt – sie
                  tragen das Kennzeichen „frei" und führen zur eigenen Seite. */}
              {b.frei === true && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">{t('rf.kennzeichen')}</span>
              )}
              <button
                onClick={() => navigate(b.frei === true ? '/regie-frei' : `/projekte/${b.projektId}`)}
                className="flex-1 min-w-[200px] text-left"
              >
                <p className="font-semibold text-schrift-stark truncate">
                  {b.frei === true ? (b.baustelleFrei?.name || t('nav.regieFrei')) : (projektVon(b.projektId)?.name || '–')}
                </p>
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
                {/* Freie Regieberichte werden NUR auf ihrer eigenen Seite
                    bearbeitet – das Projekt-Formular würde an projektId:'' brechen. */}
                {b.frei === true ? (
                  <button onClick={() => navigate('/regie-frei')} className="px-3 py-1.5 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium">{t('allg.ansehen')}</button>
                ) : ['entwurf', 'eingereicht'].includes(b.status) ? (
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

      {/* Vorlegen: Zugang + Nachweis. Ab HIER tickt die Anerkennungsuhr. */}
      {vorlegen && (
        <Modal
          titel={t('ra.titelVorlegen')}
          icon="regie"
          onClose={() => setVorlegen(null)}
          fuss={(
            <>
              <button onClick={() => setVorlegen(null)} className={S.BTN_ZWEIT}>{t('allg.abbrechen')}</button>
              <button onClick={vorlegenSichern} disabled={!vorlegen.datum} className={S.BTN_PRIMAER}>
                {t('allg.speichern')}
              </button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-sm font-semibold text-schrift-stark">{vorlegen.titel || t('bericht.regie')}</p>
            <label className="block">
              <span className="block text-xs font-semibold text-schrift-leise mb-1">{t('ra.vorgelegtAm')} *</span>
              <input
                type="date" dir="ltr" className={S.FELD} value={vorlegen.datum}
                onChange={(e) => setVorlegen((v) => ({ ...v, datum: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-schrift-leise mb-1">{t('ra.zugangsnachweis')}</span>
              <select
                className={S.FELD} value={vorlegen.zugangsnachweis}
                onChange={(e) => setVorlegen((v) => ({ ...v, zugangsnachweis: e.target.value }))}
              >
                {ZUGANGSNACHWEISE.map((z) => <option key={z} value={z}>{t(`ra.zn_${z}`)}</option>)}
              </select>
            </label>
            <Meldung art="warnung">{t('ra.warnZugang')}</Meldung>
            {vorlegen.datum && (
              <p className="text-sm text-schrift-leise">
                {t('ra.wirdAnerkannt', { datum: datumLok(anerkanntAbIso(vorlegen.datum), { day: '2-digit', month: '2-digit', year: 'numeric' }) })}
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Widerspruch des Auftraggebers: stoppt die Uhr, Status 'bestritten'. */}
      {widerspruch && (
        <Modal
          titel={t('ra.widerspruch')}
          icon="alert"
          onClose={() => setWiderspruch(null)}
          fuss={(
            <>
              <button onClick={() => setWiderspruch(null)} className={S.BTN_ZWEIT}>{t('allg.abbrechen')}</button>
              <button onClick={widerspruchSichern} disabled={!widerspruch.datum} className={S.BTN_PRIMAER}>
                {t('allg.speichern')}
              </button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-sm font-semibold text-schrift-stark">{widerspruch.titel || t('bericht.regie')}</p>
            <label className="block">
              <span className="block text-xs font-semibold text-schrift-leise mb-1">{t('ra.widersprochenAm')} *</span>
              <input
                type="date" dir="ltr" className={S.FELD} value={widerspruch.datum}
                onChange={(e) => setWiderspruch((v) => ({ ...v, datum: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-schrift-leise mb-1">{t('ra.widerspruchText')}</span>
              <textarea
                rows={3} className={S.FELD} value={widerspruch.text}
                onChange={(e) => setWiderspruch((v) => ({ ...v, text: e.target.value }))}
              />
            </label>
          </div>
        </Modal>
      )}

      {neuTyp && <BerichtForm typ={neuTyp} user={user} onClose={() => setNeuTyp(null)} />}
      {bearbeite && <BerichtForm typ={bearbeite.typ} bericht={bearbeite} user={user} onClose={() => setBearbeite(null)} />}
      {spesenModal && <SpesenForm user={user} onClose={() => setSpesenModal(false)} />}
      {bearbeiteSpesen && <SpesenForm spesen={bearbeiteSpesen} user={user} onClose={() => setBearbeiteSpesen(null)} />}
    </div>
  )
}
