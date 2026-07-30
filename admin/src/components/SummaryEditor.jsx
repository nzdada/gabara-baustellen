import { useEffect, useRef, useState } from 'react'
import { useCollection } from '../hooks.js'
import { textZuHtml, hatFormatierung } from '@shared/format.js'
import { useLang, tr } from '@shared/i18n.js'
import { Icon } from '@shared/ui.jsx'

// Formatierbarer Editor für Behandlungs-Zusammenfassungen und Bausteine:
// **fett**, Aufzählungslisten, ## Überschrift, Textbausteine, Vorschau
// + "Groß bearbeiten": Vollbild-Editor, der beim Speichern zurück zum Formular führt.
//
// WICHTIG: Der Editor hält den Text LOKAL und speichert erst nach kurzer Tipp-Pause
// (600 ms) bzw. beim Verlassen des Felds. Ohne diese Pufferung würde im Firebase-
// Modus jede Taste erst nach dem Cloud-Echo erscheinen – Tippen wäre unmöglich.

const T = {
  fett: { de: 'Fett', en: 'Bold', ar: 'غامق' },
  liste: { de: 'Liste', en: 'List', ar: 'قائمة' },
  ueberschrift: { de: 'Überschrift', en: 'Heading', ar: 'عنوان' },
  bausteine: { de: 'Bausteine:', en: 'Blocks:', ar: 'قوالب:' },
  vorschau: { de: 'Vorschau', en: 'Preview', ar: 'معاينة' },
  gross: { de: 'Groß bearbeiten', en: 'Edit large', ar: 'تحرير موسّع' },
  speichern: { de: 'Speichern & zurück', en: 'Save & back', ar: 'حفظ ورجوع' },
}

export default function SummaryEditor({ text, onText, placeholder, dunkel = false, rows = 4, mitBausteinen = true }) {
  useLang()
  const ref = useRef(null)
  const grossRef = useRef(null)
  const bausteine = useCollection('bausteine')
  const [zeigeVorschau, setZeigeVorschau] = useState(false)
  const [gross, setGross] = useState(false)

  // Lokaler Puffer: sofortiges Tippen, verzögertes Speichern
  const [wert, setWert] = useState(text || '')
  const fokussiert = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    // Externe Änderungen (z. B. anderes Gerät) nur übernehmen, wenn hier nicht getippt wird
    if (!fokussiert.current) setWert(text || '')
  }, [text])

  useEffect(() => () => clearTimeout(timer.current), [])

  function aendern(neu) {
    setWert(neu)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onText(neu), 600)
  }

  function sofortSpeichern(neu) {
    clearTimeout(timer.current)
    setWert(neu)
    onText(neu)
  }

  function aktivesFeld() {
    return gross ? grossRef.current : ref.current
  }

  function ersetzeAuswahl(fn) {
    const el = aktivesFeld()
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    const neu = fn(wert, a, b)
    aendern(neu.text)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(neu.cursor, neu.cursor)
    })
  }

  function fett() {
    ersetzeAuswahl((v, a, b) => {
      const sel = v.slice(a, b) || 'Text'
      return { text: v.slice(0, a) + `**${sel}**` + v.slice(b), cursor: a + sel.length + 4 }
    })
  }

  function ueberschrift() {
    ersetzeAuswahl((v, a, b) => {
      const sel = v.slice(a, b) || 'Überschrift'
      const vorne = a === 0 || v[a - 1] === '\n' ? '' : '\n'
      const einsatz = `${vorne}**${sel}:**\n`
      return { text: v.slice(0, a) + einsatz + v.slice(b), cursor: a + einsatz.length }
    })
  }

  function liste() {
    ersetzeAuswahl((v, a, b) => {
      const start = v.lastIndexOf('\n', a - 1) + 1
      const zeilen = v.slice(start, Math.max(b, start)).split('\n')
      const neu = zeilen.map((z) => (z.startsWith('- ') ? z : `- ${z}`)).join('\n')
      const textNeu = v.slice(0, start) + (zeilen.join('') === '' ? '- ' : neu) + v.slice(Math.max(b, start))
      return { text: textNeu, cursor: start + neu.length }
    })
  }

  function baustein(b) {
    sofortSpeichern(wert ? `${wert.trimEnd()}\n\n${b.text}` : b.text)
  }

  const knopf = dunkel && !gross
    ? 'bg-white/10 hover:bg-white/20 text-white'
    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'

  const werkzeuge = (
    <div className="flex flex-wrap items-center gap-1.5 mb-2">
      <button type="button" onClick={fett} className={`text-xs font-bold rounded-lg px-3 py-1.5 ${knopf}`} title="**fett**">
        <strong>B</strong> {tr(T.fett)}
      </button>
      <button type="button" onClick={liste} className={`text-xs font-semibold rounded-lg px-3 py-1.5 ${knopf}`} title="- Liste">
        • {tr(T.liste)}
      </button>
      <button type="button" onClick={ueberschrift} className={`text-xs font-semibold rounded-lg px-3 py-1.5 ${knopf}`}>
        H {tr(T.ueberschrift)}
      </button>
      {hatFormatierung(wert) && (
        <button
          type="button"
          onClick={() => setZeigeVorschau(!zeigeVorschau)}
          className={`text-xs font-semibold rounded-lg px-3 py-1.5 ${zeigeVorschau ? 'bg-praxis-600 text-white' : knopf}`}
        >
          {tr(T.vorschau)}
        </button>
      )}
      {!gross && (
        <button
          type="button"
          onClick={() => setGross(true)}
          className={`text-xs font-semibold rounded-lg px-3 py-1.5 inline-flex items-center gap-1 ${knopf}`}
        >
          <Icon name="tablet" className="w-3.5 h-3.5" /> {tr(T.gross)}
        </button>
      )}
      {mitBausteinen && bausteine.length > 0 && (
        <>
          <span className="text-[11px] font-semibold mx-1 text-slate-400">{tr(T.bausteine)}</span>
          {bausteine.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => baustein(b)}
              className={`text-xs font-semibold rounded-lg px-3 py-1.5 border ${
                dunkel && !gross
                  ? 'border-praxis-500/40 text-praxis-300 hover:bg-praxis-500/15'
                  : 'border-praxis-200 text-praxis-700 hover:bg-praxis-50'
              }`}
            >
              + {b.titel}
            </button>
          ))}
        </>
      )}
    </div>
  )

  const vorschauBox = zeigeVorschau && hatFormatierung(wert) && (
    <div
      className={`mt-2 rounded-xl px-4 py-3 text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_p]:mb-1 ${
        dunkel && !gross ? 'bg-white/5 border border-white/10' : 'bg-praxis-50/60 border border-praxis-100'
      }`}
      dangerouslySetInnerHTML={{ __html: textZuHtml(wert) }}
    />
  )

  return (
    <div>
      {werkzeuge}
      <textarea
        ref={ref}
        value={wert}
        onChange={(e) => aendern(e.target.value)}
        onFocus={() => { fokussiert.current = true }}
        onBlur={(e) => { fokussiert.current = false; sofortSpeichern(e.target.value) }}
        rows={rows}
        placeholder={placeholder}
        dir="auto"
        className={
          dunkel
            ? 'w-full bg-slate-950/50 rounded-2xl border border-white/10 px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-praxis-500 placeholder:text-slate-600'
            : 'w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
        }
      />
      {vorschauBox}

      {/* Vollbild-Editor: groß tippen, Speichern führt zurück zum Formular */}
      {gross && (
        <div className="fixed inset-0 z-[80] bg-slate-900/70 flex items-center justify-center p-3 sm:p-8">
          <div className="bg-white w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] rounded-3xl shadow-2xl p-6 flex flex-col">
            {werkzeuge}
            <textarea
              ref={grossRef}
              autoFocus
              value={wert}
              onChange={(e) => aendern(e.target.value)}
              onFocus={() => { fokussiert.current = true }}
              onBlur={() => { fokussiert.current = false }}
              placeholder={placeholder}
              dir="auto"
              className="flex-1 min-h-[45vh] w-full rounded-2xl border border-slate-200 px-5 py-4 text-lg leading-relaxed focus:outline-none focus:ring-2 focus:ring-praxis-500"
            />
            {vorschauBox}
            <button
              type="button"
              onClick={() => { sofortSpeichern(wert); setGross(false) }}
              className="mt-4 w-full bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3.5 rounded-xl"
            >
              ✓ {tr(T.speichern)}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
