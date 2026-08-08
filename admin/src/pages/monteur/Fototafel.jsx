import { useMemo, useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { fotoAufnehmen, fotoStandFeld, fotoAmpel } from '@shared/fotoablage.js'
import { useWhere, withStore } from '../../hooks.js'
import { useKameraFrei, KameraGesperrt } from './FotoLeiste.jsx'

// Die Fototafel je Raum (Plan 5.1): VIER feste Plätze –
// Vorher/Nachher × Auftrag/Regie. phase und kontext sind durch die Kachel
// BEIM AUSLÖSEN festgelegt, nie nachträglich zugeordnet. Die Regie-Zeile
// erscheint nur, wenn für den Raum eine Anordnung existiert – keine leeren
// Pflichtfelder. Darunter je Raum die Fehlliste (⚠) und oben die Ampel
// der Baustelle.
//
// Die Zähler leben als raum.fotoStand (auftragVorher …) und werden mit
// EINEM Increment je Aufnahme fortgeschrieben – die HEUTE-Liste liest
// daraus ihr ⚠ Vorher (monteurtag.vorherFehlt).

const FEHLT_SCHLUESSEL = {
  auftragVorher: 'ft.fehltAuftragVorher',
  auftragNachher: 'ft.fehltAuftragNachher',
  regieVorher: 'ft.fehltRegieVorher',
  regieNachher: 'ft.fehltRegieNachher',
}

function Kachel({ platz, beschaeftigt, onAusloesen }) {
  const voll = platz.anzahl > 0
  return (
    <button
      onClick={onAusloesen}
      disabled={beschaeftigt}
      className={`min-h-14 rounded-xl border-2 font-black text-base inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${
        voll ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-dashed border-slate-300 text-slate-400 active:bg-slate-50'
      }`}
    >
      {beschaeftigt ? '…' : voll ? <span dir="ltr">✓ {platz.anzahl}</span> : '📷'}
    </button>
  )
}

export default function Fototafel({ projektId, user }) {
  useLang()
  const raeume = useWhere('raeume', 'projektId', projektId)
  const anordnungen = useWhere('regieanordnungen', 'projektId', projektId)
  const kamera = useKameraFrei(user)
  const [gateOffen, setGateOffen] = useState(false)
  const [fehler, setFehler] = useState('')
  const [hinweis, setHinweis] = useState('')
  const [laeuft, setLaeuft] = useState('')     // `${raumId}:${feld}`
  const kameraRef = useRef(null)
  const ziel = useRef(null)                    // { raum, kontext, phase }

  const sichtbar = useMemo(
    () => raeume.filter((r) => r.aktiv !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [raeume]
  )

  // Eine Anordnung gilt dem Raum, wenn sie ihn nennt – oder gar keine
  // Räume nennt (baustellenweite Anordnung, z. B. aus "Regie melden").
  const anordnungFuer = (raum) => anordnungen.find(
    (a) => a.status !== 'storniert' && (!(a.raumIds || []).length || (a.raumIds || []).includes(raum.id))
  ) || null

  const tafeln = useMemo(() => sichtbar.map((raum) => {
    const anordnung = anordnungFuer(raum)
    return { raum, anordnung, ampel: fotoAmpel(raum, { regieAngeordnet: Boolean(anordnung) }) }
  }), [sichtbar, anordnungen]) // eslint-disable-line react-hooks/exhaustive-deps

  const vollstaendig = tafeln.filter((x) => x.ampel.vollstaendig).length

  if (!sichtbar.length) return null

  function ausloesen(raum, kontext, phase) {
    setFehler('')
    if (kamera.geprueft && !kamera.frei) { setGateOffen(true); return }
    ziel.current = { raum, kontext, phase }
    kameraRef.current?.click()
  }

  async function fotoDa(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    const auftrag = ziel.current
    ziel.current = null
    if (!datei || !auftrag) return
    const { raum, kontext, phase } = auftrag
    const feld = fotoStandFeld(kontext, phase)
    setLaeuft(`${raum.id}:${feld}`)
    try {
      const anordnung = kontext === 'regie' ? anordnungFuer(raum) : null
      const ergebnis = await withStore((s) => fotoAufnehmen(datei, {
        projektId,
        raumId: raum.id,
        anordnungId: anordnung?.id || '',
        phase,
        kontext,
        rolle: 'fototafel',
        datum: heuteISO(),
        von: user?.name || '',
        vonId: user?.userId || '',
      }, s))
      if (!ergebnis.ok) {
        // Plan 5.4: eine fehlgeschlagene Sicherung VERWEIGERT den Auslöser –
        // laut, statt still zu verlieren.
        setFehler(t(ergebnis.grund === 'ablage' ? 'ft.ablageFehler' : 'mt.fotoFehler'))
        return
      }
      if (ergebnis.speicherWarnung) setHinweis(t('ft.speicherVoll'))
      // Der EINE Zähler-Schritt am Raum (Punktpfad, beide Store-Modi gleich)
      await withStore((s) => s.updateInkrement('raeume', raum.id, { [`fotoStand.${feld}`]: 1 }))
    } catch (err) {
      setFehler(err?.message || String(err))
    } finally {
      setLaeuft('')
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-slate-800 flex items-center gap-2">
          <Icon name="foto" className="w-5 h-5 text-praxis-600" /> {t('ft.fototafel')}
        </p>
        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${
          vollstaendig === tafeln.length ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
        }`} dir="ltr">
          {vollstaendig}/{tafeln.length}
        </span>
      </div>

      <input
        ref={kameraRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={fotoDa}
      />

      {fehler && (
        <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{fehler}</p>
      )}
      {hinweis && (
        <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {hinweis}
          <button onClick={() => setHinweis('')} className="ms-2 font-bold underline">{t('allg.ok')}</button>
        </p>
      )}

      <div className="space-y-3">
        {tafeln.map(({ raum, ampel }) => (
          <div key={raum.id} className="border border-slate-200 rounded-2xl p-3">
            <p className="text-sm font-bold text-slate-800 mb-2">
              {raum.nummer ? `${raum.nummer} · ` : ''}{raum.name || t('raum.ohneName')}
            </p>
            {/* Kopfzeile VORHER / NACHHER + eine Zeile je Kontext */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] gap-2 items-center">
              <span />
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-400 text-center">{t('ft.vorher')}</span>
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-400 text-center">{t('ft.nachher')}</span>
              {['auftrag', ...(ampel.plaetze.some((p) => p.kontext === 'regie') ? ['regie'] : [])].map((kontext) => (
                <FototafelZeile
                  key={kontext}
                  kontext={kontext}
                  plaetze={ampel.plaetze.filter((p) => p.kontext === kontext)}
                  laeuft={laeuft}
                  raum={raum}
                  onAusloesen={ausloesen}
                />
              ))}
            </div>
            {ampel.fehlt.length > 0 && (
              <p className="mt-2 text-[12px] font-semibold text-amber-700">
                ⚠ {ampel.fehlt.map((f) => t(FEHLT_SCHLUESSEL[f])).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>

      {gateOffen && <KameraGesperrt grund={kamera.grund} onClose={() => setGateOffen(false)} />}
    </div>
  )
}

// Eine Zeile der Vier-Plätze-Tafel (Auftrag bzw. Regie). Als eigener
// Baustein, damit das Raster oben lesbar bleibt.
function FototafelZeile({ kontext, plaetze, laeuft, raum, onAusloesen }) {
  return (
    <>
      <span className="text-sm font-semibold text-slate-600">
        {t(kontext === 'regie' ? 'ft.regie' : 'ft.auftrag')}
      </span>
      {plaetze.map((platz) => (
        <Kachel
          key={platz.feld}
          platz={platz}
          beschaeftigt={laeuft === `${raum.id}:${platz.feld}`}
          onAusloesen={() => onAusloesen(raum, platz.kontext, platz.phase)}
        />
      ))}
    </>
  )
}
