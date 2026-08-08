import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLang, t } from '@shared/i18n.js'
import * as S from '../stil.js'
import { Seitenkopf, ChipReihe, Leer } from '../components/Seite.jsx'
import { useCollection, useWhere } from '../hooks.js'
import { istOffen } from '@shared/projektstatus.js'
import { fotoAmpel } from '@shared/leitstand.js'
import { parseZahl } from '@shared/format.js'

// Fotoampel (Plan 3.2, Büro-Ansichten): je Raum ✓ vollständig / ⚠ Nachher
// fehlt / ○ nicht begonnen – GETRENNT nach Auftrag und Regie. Grundlage sind
// ausschließlich die Zähler raum.fotoStand (AP 6) – kein Foto-Vollabo, die
// Seite lädt nur die Räume EINER Baustelle.

const AMPEL = {
  ok: { zeichen: '✓', klasse: 'text-emerald-600', schluessel: 'fa.ok' },
  nachherFehlt: { zeichen: '⚠', klasse: 'text-amber-600', schluessel: 'fa.nachherFehlt' },
  vorherFehlt: { zeichen: '⚠', klasse: 'text-red-600', schluessel: 'fa.vorherFehlt' },
  leer: { zeichen: '○', klasse: 'text-schrift-zart', schluessel: 'fa.leer' },
}

function Ampel({ stufe, vorher, nachher }) {
  const a = AMPEL[stufe] || AMPEL.leer
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`text-lg leading-none font-bold ${a.klasse}`}>{a.zeichen}</span>
      <span className="text-[12px] text-schrift-leise">{t(a.schluessel)}</span>
      <span className="text-[11px] text-schrift-zart zahl" dir="ltr">{vorher}/{nachher}</span>
    </span>
  )
}

export default function Fotoampel() {
  useLang()
  const [params, setParams] = useSearchParams()
  const projekte = useCollection('projekte')
  const offene = useMemo(() => projekte.filter((p) => istOffen(p.status)), [projekte])
  const [projektId, setProjektId] = useState(params.get('projekt') || '')

  // Ohne Vorwahl: die erste laufende Baustelle
  useEffect(() => {
    if (!projektId && offene.length) setProjektId(offene[0].id)
  }, [offene, projektId])

  const raeume = useWhere('raeume', 'projektId', projektId)
  const anordnungen = useWhere('regieanordnungen', 'projektId', projektId)

  const zeilen = useMemo(() => {
    const regieRaeume = new Set()
    for (const a of anordnungen) for (const rid of a.raumIds || []) regieRaeume.add(rid)
    return raeume
      .filter((r) => r.aktiv !== false)
      .sort((a, b) => String(a.nummer).localeCompare(String(b.nummer), 'de', { numeric: true }))
      .map((r) => {
        const stand = r.fotoStand || {}
        const regieRelevant = regieRaeume.has(r.id)
          || parseZahl(stand.regieVorher) > 0 || parseZahl(stand.regieNachher) > 0
        return {
          raum: r,
          auftrag: fotoAmpel(stand, 'auftrag'),
          regie: regieRelevant ? fotoAmpel(stand, 'regie') : null,
          stand,
        }
      })
  }, [raeume, anordnungen])

  const vollstaendig = zeilen.filter((z) => z.auftrag === 'ok').length

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="foto" titel={t('nav.fotoampel')} sub={t('fa.sub')} />

      <div className="mb-4">
        <ChipReihe
          chips={offene.map((p) => ({ id: p.id, label: p.name }))}
          aktiv={projektId}
          onWahl={(id) => { setProjektId(id); setParams({ projekt: id }, { replace: true }) }}
        />
      </div>

      {zeilen.length === 0 ? (
        <Leer icon="raum" titel={t('fa.keineRaeume')} text="" />
      ) : (
        <div className={S.TAB_HUELLE}>
          <div className={S.TAB_SCROLL}>
            <table className={S.TAB}>
              <thead>
                <tr>
                  <th className={S.TH}>{t('fa.raum')}</th>
                  <th className={S.TH}>{t('fa.auftrag')} ({t('fa.vorher')}/{t('fa.nachher')})</th>
                  <th className={S.TH}>{t('fa.regie')} ({t('fa.vorher')}/{t('fa.nachher')})</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z) => (
                  <tr key={z.raum.id} className="border-b border-rahmen last:border-0">
                    <td className={S.TD_STARK}>
                      {z.raum.nummer} {z.raum.name}
                      {z.raum.bereich && <span className="ms-2 text-[12px] font-normal text-schrift-zart">{z.raum.bereich}</span>}
                    </td>
                    <td className={S.TD}>
                      <Ampel
                        stufe={z.auftrag}
                        vorher={Math.round(parseZahl(z.stand.auftragVorher))}
                        nachher={Math.round(parseZahl(z.stand.auftragNachher))}
                      />
                    </td>
                    <td className={S.TD}>
                      {z.regie ? (
                        <Ampel
                          stufe={z.regie}
                          vorher={Math.round(parseZahl(z.stand.regieVorher))}
                          nachher={Math.round(parseZahl(z.stand.regieNachher))}
                        />
                      ) : (
                        <span className="text-schrift-zart">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 border-t border-rahmen text-[12px] text-schrift-leise">
            {t('fa.stand', { ok: vollstaendig, alle: zeilen.length })}
          </p>
        </div>
      )}
    </div>
  )
}
