import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, tr } from '@shared/i18n.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer, Meldung } from '../components/Seite.jsx'
import Modal from '../components/Modal.jsx'
import { useWhere, useCollection, withStore } from '../hooks.js'
import { euro, parseZahl } from '@shared/format.js'
import { zahlText } from '@shared/aufmass.js'
import { freigabeBauen, zurueckweisungBauen } from '@shared/leitstand.js'
import { aufmasszeilenId } from '@shared/aufgaben.js'

// Freigabe der Aufgaben-Meldungen (Plan 3.2, AP 7): je Zeile zwei Knöpfe –
// [Freigeben] und [Zurückweisen mit Grund]. Die Zurückweisung ist EIN Vorgang
// (shared/leitstand.js zurueckweisungBauen): Aufgabe -> 'zurueck' (landet ROT
// auf dem Handy des Monteurs), Aufmaßzeile storniert (nie gelöscht), Buchung
// gelöscht (nur so ist die Nachbesserung erneut meldbar), Kennzahlen-
// Gegenbuchung. Warum der Rückweg Pflicht ist: eine Meldung ohne sichtbare
// Antwort bringt den Monteur dazu, das Melden einzustellen (verbesserungen.md:39).
//
// Geladen wird NUR status == 'fertig' (gefiltertes Abo) – kein Vollabo.

const KURZ = { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }

function zeitpunkt(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('de-DE', KURZ)
}

export default function Freigabe({ user }) {
  useLang()
  const fertige = useWhere('aufgaben', 'status', 'fertig')
  const projekte = useCollection('projekte')
  const [zurueck, setZurueck] = useState(null)   // Aufgabe im Zurückweisen-Dialog
  const [grund, setGrund] = useState('')
  const [meldung, setMeldung] = useState('')
  const [fehler, setFehler] = useState('')

  // Noch nicht freigegebene Meldungen, gruppiert je Baustelle
  const gruppen = useMemo(() => {
    const offen = fertige.filter((a) => !a.freigegebenAm)
    const map = new Map()
    for (const a of offen) {
      if (!map.has(a.projektId)) map.set(a.projektId, [])
      map.get(a.projektId).push(a)
    }
    for (const liste of map.values()) {
      liste.sort((a, b) => (b.fertigAm || 0) - (a.fertigAm || 0))
    }
    return [...map.entries()]
  }, [fertige])

  async function freigeben(aufgabe) {
    setFehler('')
    try {
      const vorgang = freigabeBauen(aufgabe, { userId: user?.userId || user?.id || '' })
      await withStore((s) => s.schreibeVorgang(vorgang, { onFehler: (e) => setFehler(e.message || '') }))
      setMeldung(t('fg.freigegebenOk'))
    } catch (e) {
      setFehler(e.message || '')
    }
  }

  async function zurueckweisen() {
    if (!zurueck || !grund.trim()) return
    setFehler('')
    try {
      // Der komplette Aufgabenstand des Raums entscheidet, ob raeumeFertig
      // heruntergezählt wird – einmalig laden, kein Dauer-Abo. Die Aufmaß-
      // zeile wird MITGELADEN: sie liefert die Storno-Kopie (Historie) und
      // den Abrechnungs-Schutz (bereits fakturierte Zeilen blockieren).
      const desProjekts = await withStore((s) => s.listWhere('aufgaben', 'projektId', zurueck.projektId))
      const zeile = await withStore((s) => s.get('aufmasszeilen', aufmasszeilenId(zurueck.id)))
      const vorgang = zurueckweisungBauen(zurueck, desProjekts, {
        grund,
        userId: user?.userId || user?.id || '',
        zeile,
      })
      await withStore((s) => s.schreibeVorgang(vorgang, { onFehler: (e) => setFehler(e.message || '') }))
      setZurueck(null)
      setGrund('')
      setMeldung(t('fg.zurueckOk'))
    } catch (e) {
      setFehler(e.message || '')
    }
  }

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="check" titel={t('nav.freigabe')} sub={t('fg.sub')} />

      {meldung && <div className="mb-4"><Meldung art="erfolg">{meldung}</Meldung></div>}
      {fehler && <div className="mb-4"><Meldung art="fehler">{fehler}</Meldung></div>}

      {gruppen.length === 0 && (
        <Leer icon="erfolg" titel={t('fg.leer')} text="" />
      )}

      {gruppen.map(([projektId, liste]) => {
        const projekt = projekte.find((p) => p.id === projektId)
        return (
          <div key={projektId} className={`${S.KARTE} mb-4`}>
            <div className={S.KARTE_KOPF}>
              <Icon name="baustelle" groesse="s" className="text-praxis-600" />
              <h2 className={S.KARTE_TITEL}>{projekt?.name || projektId}</h2>
              <span className={`${S.ZAEHLER_STILL} ms-auto`}>{liste.length}</span>
            </div>
            <div className={S.KARTE_LISTE}>
              {liste.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-schrift-stark">
                      {a.raumNummer} {a.raumName} · {tr({ de: a.schrittNameDe, ar: a.schrittNameAr })}
                    </p>
                    <p className="text-[12px] text-schrift-leise mt-0.5">
                      {t('fg.gemeldetVon', { name: a.fertigVonName || '?' })}
                      {a.fertigAm ? ` · ${zeitpunkt(a.fertigAm)}` : ''}
                      {' · '}
                      {a.fertigFotoId
                        ? <span className="text-emerald-700">{t('fg.mitFoto')}</span>
                        : <span className="text-amber-700">{t('fg.ohneFoto')}</span>}
                    </p>
                  </div>
                  {Boolean(parseZahl(a.menge)) && (
                    <span className="text-sm text-schrift shrink-0" dir="ltr">{zahlText(parseZahl(a.menge))} {a.einheit}</span>
                  )}
                  <span className="text-sm font-bold text-schrift-stark shrink-0 zahl" dir="ltr">
                    {euro(Math.round(parseZahl(a.wertCent)) / 100)}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => freigeben(a)} className={S.BTN_PRIMAER_S}>
                      {t('fg.freigeben')}
                    </button>
                    <button onClick={() => { setZurueck(a); setGrund('') }} className={S.BTN_GEFAHR_S}>
                      {t('fg.zurueckweisen')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {zurueck && (
        <Modal
          titel={t('fg.zurueckTitel')}
          icon="alert"
          onClose={() => setZurueck(null)}
          fuss={(
            <div className="flex justify-end gap-2 w-full">
              <button onClick={() => setZurueck(null)} className={S.BTN_ZWEIT}>{t('allg.abbrechen')}</button>
              <button onClick={zurueckweisen} disabled={!grund.trim()} className={S.BTN_GEFAHR}>
                {t('fg.zurueckweisen')}
              </button>
            </div>
          )}
        >
          <p className="text-sm font-bold text-schrift-stark mb-3">
            {zurueck.raumNummer} {zurueck.raumName} · {tr({ de: zurueck.schrittNameDe, ar: zurueck.schrittNameAr })}
          </p>
          <label className={S.LABEL}>{t('fg.grund')}</label>
          <textarea
            className={S.TEXTAREA}
            rows={3}
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            autoFocus
          />
        </Modal>
      )}
    </div>
  )
}
