import { useMemo, useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t } from '@shared/i18n.js'
import { einzelflaechen } from '@shared/raumflaeche.js'
import { flaechenZustand, fortschrittAufgaben } from '@shared/raumaufgaben.js'
import { fortschrittRaum } from '@shared/raumflaeche.js'
import RaumDialog from '../../components/RaumDialog.jsx'
import { fotoAus } from '@shared/bild.js'
import { useWhere, withStore } from '../../hooks.js'

// Räume und ihre Flächen auf dem Handy.
//
// Der Monteur tippt einen Raum an, sieht Decke, vier Wände und Boden mit ihrer
// Größe, und meldet einzeln fertig. Genau so wird gearbeitet: erst die Decke,
// dann drei Wände, die vierte nach dem Möbelrücken.
//
// FOTOPFLICHT BEIM FERTIGMELDEN
// "Fertig" ohne Bild ist eine Behauptung, mit Bild ein Nachweis. Gegenüber
// einem Generalunternehmer ist genau das der Unterschied, wenn später jemand
// die Ausführung bestreitet. Deshalb öffnet "fertig" die Kamera, und der
// Zustand wird erst NACH dem Foto gesetzt – nicht davor. Bricht der Monteur ab,
// bleibt die Fläche offen, statt als fertig ohne Beleg dazustehen.

const FARBE = {
  offen: 'bg-slate-100 text-slate-600 border-slate-200',
  arbeit: 'bg-amber-100 text-amber-800 border-amber-300',
  fertig: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

export default function RaumFlaechen({ projektId, user }) {
  useLang()
  const raeume = useWhere('raeume', 'projektId', projektId)
  const fotos = useWhere('photos', 'projektId', projektId)
  const [offen, setOffen] = useState(null)         // raumId
  const [laeuft, setLaeuft] = useState('')         // raumId:flaecheId
  const [fehler, setFehler] = useState('')
  const kamera = useRef(null)
  const wartet = useRef(null)                      // { raum, flaeche }
  const [dialog, setDialog] = useState(null)       // Raum-Fenster mit Aufgaben

  const sichtbar = useMemo(
    () => raeume.filter((r) => r.aktiv !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [raeume]
  )

  // Wie viele Fotos hängen an einer Fläche? Zeigt dem Monteur, dass der
  // Nachweis wirklich angekommen ist.
  const fotoZahl = useMemo(() => {
    const z = {}
    for (const f of fotos) {
      if (!f.raumId || !f.flaecheId) continue
      const k = `${f.raumId}:${f.flaecheId}`
      z[k] = (z[k] || 0) + 1
    }
    return z
  }, [fotos])

  if (!sichtbar.length) return null

  async function setzeStatus(raum, flaecheId, neu) {
    await withStore((s) => s.update('raeume', raum.id, {
      status: { ...(raum.status || {}), [flaecheId]: neu },
    }))
  }

  // Antippen schaltet weiter. Der Sprung auf "fertig" verlangt ein Foto.
  function tippe(raum, flaeche) {
    setFehler('')
    const jetzt = flaeche.status
    if (jetzt === 'offen') return setzeStatus(raum, flaeche.id, 'arbeit')
    if (jetzt === 'fertig') return setzeStatus(raum, flaeche.id, 'offen')
    // 'arbeit' -> 'fertig': erst das Bild
    wartet.current = { raum, flaeche }
    kamera.current?.click()
  }

  async function fotoGewaehlt(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    const auftrag = wartet.current
    wartet.current = null
    if (!datei || !auftrag) return
    const { raum, flaeche } = auftrag
    setLaeuft(`${raum.id}:${flaeche.id}`)
    setFehler('')
    try {
      const bild = await fotoAus(datei)
      if (!bild.ok) {
        setFehler(t(bild.grund === 'zu-gross' ? 'raum.fotoZuGross' : 'raum.fotoKeinBild'))
        return
      }
      await withStore(async (s) => {
        await s.add('photos', {
          projektId,
          raumId: raum.id,
          flaecheId: flaeche.id,
          // Der Nachweis gehört zur fertigen Leistung -> 'nachher'
          phase: 'nachher',
          berichtId: '', terminId: '',
          dataUrl: bild.dataUrl,
          name: `${raum.nummer || raum.name || 'Raum'}-${t(flaeche.schluessel)}.jpg`,
          von: user?.name || '', vonId: user?.userId || '',
          createdAt: Date.now(),
        })
        // Zustand ERST nach dem Foto – bricht der Upload ab, bleibt die Fläche
        // offen statt als fertig ohne Beleg dazustehen.
        await s.update('raeume', raum.id, {
          status: { ...(raum.status || {}), [flaeche.id]: 'fertig' },
        })
      })
    } catch (err) {
      setFehler(err?.message || String(err))
    } finally {
      setLaeuft('')
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
      <p className="font-bold text-slate-800 mb-3 flex items-center gap-2">
        <Icon name="raum" className="w-5 h-5 text-praxis-600" /> {t('raum.meineRaeume')}
      </p>

      <input
        ref={kamera} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={fotoGewaehlt}
      />

      {fehler && (
        <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>
      )}

      <div className="space-y-2">
        {sichtbar.map((raum) => {
          // Aufgaben sind die fuehrende Anzeige – "Wohnzimmer gespachtelt" sagt
          // mehr als "Wohnzimmer 40 %". Gibt es noch keine, zaehlen die Flaechen.
          const ausAufgaben = fortschrittAufgaben(raum)
          const fort = ausAufgaben.hatAufgaben ? ausAufgaben : fortschrittRaum(raum)
          const auf = offen === raum.id
          return (
            <div key={raum.id} className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOffen(auf ? null : raum.id)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {raum.nummer ? `${raum.nummer} · ` : ''}{raum.name || t('raum.ohneName')}
                  </p>
                  <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${fort.prozent >= 100 ? 'bg-emerald-500' : 'bg-praxis-500'}`}
                      style={{ width: `${fort.prozent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {fort.prozent} % · {fort.fertig} {t('raum.von')} {fort.gesamt}{' '}
                    {ausAufgaben.hatAufgaben ? t('aufg.schritte') : 'm²'}
                    {ausAufgaben.naechste ? ` · ${t('aufg.jetzt')}: ${ausAufgaben.naechste.text}` : ''}
                  </p>
                </div>
                <Icon name={auf ? 'chevronOben' : 'chevronUnten'} className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {auf && (
                <div className="px-3 pb-3 space-y-2">
                  <button
                    onClick={() => setDialog(raum)}
                    className="w-full flex items-center gap-2 justify-center border-2 border-praxis-600 text-praxis-600 rounded-xl min-h-14 font-bold"
                  >
                    <Icon name="check" className="w-5 h-5" /> {t('aufg.oeffnen')}
                  </button>
                  {einzelflaechen(raum).map((f) => {
                    const schluessel = `${raum.id}:${f.id}`
                    const bilder = fotoZahl[schluessel] || 0
                    const beschaeftigt = laeuft === schluessel
                    // ANZEIGE aus flaechenZustand, nicht aus f.status.
                    // Sind alle Arbeitsschritte des Raums abgehakt, gilt der
                    // Raum als fertig – und damit jede Fläche darin. Die
                    // 3D-Ansicht zeigte das bereits grün, diese Kacheln standen
                    // weiter auf "offen". Der Monteur meldete daraufhin jede
                    // Wand ein zweites Mal fertig, mit Fotopflicht.
                    // Der SCHREIBWEG (tippe) bleibt unverändert an f.status –
                    // dort hängt der Einzelnachweis je Wand.
                    const zustand = flaechenZustand(raum, f.id)
                    return (
                      <button
                        key={f.id}
                        onClick={() => !beschaeftigt && tippe(raum, f)}
                        disabled={beschaeftigt}
                        className={`w-full flex items-center gap-3 border rounded-xl px-3 min-h-14 text-left ${FARBE[zustand]} disabled:opacity-60`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">{t(f.schluessel)}</p>
                          <p className="text-[12px] opacity-80">
                            {f.groesse} m²{f.geschaetzt ? ` · ${t('raum.geschaetzt')}` : ''}
                            {bilder > 0 ? ` · ${bilder} ${t('raum.fotos')}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-bold shrink-0">
                          {beschaeftigt ? '…' : t(`raum.status.${zustand}`)}
                        </span>
                      </button>
                    )
                  })}
                  <p className="text-[12px] text-slate-400 px-1">{t('raum.tippHinweis')}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {dialog && (
        <RaumDialog
          raum={sichtbar.find((r) => r.id === dialog.id) || dialog}
          projektId={projektId} user={user} onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
