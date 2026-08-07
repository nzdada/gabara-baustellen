import { useLang, t, istRtl } from '@shared/i18n.js'

// Zeichnungen für die Wissensdatenbank.
//
// Warum SVG und keine Bildschirmfotos: Screenshots veralten mit jeder
// Oberflächenänderung, wiegen als Base64 hunderte Kilobyte und lassen sich nicht
// übersetzen. Diese Zeichnungen erklären den Ablauf statt das Aussehen, bleiben
// bei jeder Auflösung scharf und tragen ihre Beschriftung in beiden Sprachen.
//
// LESERICHTUNG: Alle Abläufe laufen von OBEN NACH UNTEN, nicht seitlich. Oben
// bleibt oben – damit stimmt jede Zeichnung im Deutschen wie im Arabischen,
// ohne Spiegelung und ohne gedrehte Schrift.
//
// Farben kommen aus den Design-Marken (admin/src/index.css), nicht aus festen
// Hex-Werten – eine Farbänderung dort wirkt hier automatisch mit.

const MARKE = 'var(--color-praxis-600)'
// Markenrot, wenn es SCHRIFT ist (siehe admin/src/index.css). MARKE selbst
// bleibt Flaechenfarbe - darauf steht weisse Schrift.
const MARKE_TEXT = 'var(--color-marke-text)'
const MARKE_HELL = 'var(--color-praxis-50)'
const RAHMEN = 'var(--color-rahmen)'
const FLAECHE = 'var(--color-gedeckt)'
const KARTE = 'var(--color-karte)'
const STARK = 'var(--color-schrift-stark)'
const LEISE = 'var(--color-schrift-leise)'
const ZART = 'var(--color-schrift-zart)'

const ST = {
  offen: 'var(--color-st-offen)',
  arbeit: 'var(--color-st-arbeit)',
  abrechnung: 'var(--color-st-abrechnung)',
  fertig: 'var(--color-st-fertig)',
  ok: 'var(--color-ok)',
  warnung: 'var(--color-warnung)',
  gefahr: 'var(--color-gefahr)',
}

// Spiegel-Helfer fuer arabische Leserichtung.
//
// SVG-Koordinaten kennen kein rechts-nach-links: ein Kasten bei x=8 bleibt
// links, egal welche Sprache eingestellt ist. text-anchor="start" bedeutet
// dagegen SEHR WOHL "Leseanfang" - im Arabischen also die RECHTE Kante. Ohne
// Anpassung wurde die Beschriftung deshalb an x=58 nach LINKS aus dem Kasten
// heraus gezeichnet und abgeschnitten. Genau das war im Wiki zu sehen.
//
// Loesung: die x-Werte an der Mittelachse spiegeln, die Anker-Angabe aber
// unveraendert lassen - "start" bleibt "Leseanfang" und stimmt dann in beiden
// Sprachen. spiegel(BREITE) liefert die beiden noetigen Helfer.
function spiegel(breite) {
  const rtl = istRtl()
  return {
    rtl,
    // Punkt (Text-Ankerpunkt, Kreismittelpunkt, Linie)
    p: (x) => (rtl ? breite - x : x),
    // Rechteck: es wird an seiner linken Kante gesetzt, also Breite abziehen
    r: (x, w) => (rtl ? breite - x - w : x),
  }
}

// Gemeinsame Textbausteine der Zeichnungen
function Schrift({ x, y, children, groesse = 12, farbe = STARK, fett = false, anker = 'middle' }) {
  return (
    <text
      x={x}
      y={y}
      // Leserichtung ausdruecklich setzen: davon haengt ab, welche Kante
      // text-anchor="start" meint.
      direction={istRtl() ? 'rtl' : 'ltr'}
      textAnchor={anker}
      fontSize={groesse}
      fontWeight={fett ? 700 : 400}
      fill={farbe}
      fontFamily="inherit"
    >
      {children}
    </text>
  )
}

// Pfeil nach unten zwischen zwei Stationen
function PfeilAb({ x, y, laenge = 18 }) {
  return (
    <g stroke={ZART} strokeWidth="1.5" fill="none">
      <line x1={x} y1={y} x2={x} y2={y + laenge - 5} />
      <path d={`M${x - 4} ${y + laenge - 7} L${x} ${y + laenge} L${x + 4} ${y + laenge - 7}`} strokeLinejoin="round" />
    </g>
  )
}

// ---------------------------------------------------------------- 1 Ablauf
// Der Weg einer Baustelle durch das System, von oben nach unten.
function Ablauf() {
  const stationen = [
    { k: 'bild.ablauf.kunde', farbe: ST.offen },
    { k: 'bild.ablauf.baustelle', farbe: ST.offen },
    { k: 'bild.ablauf.lv', farbe: MARKE },
    { k: 'bild.ablauf.termin', farbe: ST.arbeit },
    { k: 'bild.ablauf.arbeit', farbe: ST.arbeit },
    { k: 'bild.ablauf.bericht', farbe: ST.arbeit },
    { k: 'bild.ablauf.freigabe', farbe: ST.abrechnung },
    { k: 'bild.ablauf.rechnung', farbe: ST.fertig },
  ]
  const H = 46      // Höhe einer Station
  const L = 22      // Lücke
  const hoehe = stationen.length * (H + L) - L + 8
  const sp = spiegel(320)

  return (
    <svg viewBox={`0 0 320 ${hoehe}`} className="w-full h-auto max-w-[320px] mx-auto block" role="img">
      {stationen.map((s, i) => {
        const y = i * (H + L) + 4
        return (
          <g key={s.k}>
            <rect x="8" y={y} width="304" height={H} rx="10" fill={KARTE} stroke={RAHMEN} />
            <rect x={sp.r(8, 5)} y={y} width="5" height={H} rx="2.5" fill={s.farbe} />
            <circle cx={sp.p(36)} cy={y + H / 2} r="12" fill={s.farbe} opacity="0.14" />
            <Schrift x={sp.p(36)} y={y + H / 2 + 4} groesse={12} fett farbe={s.farbe}>{i + 1}</Schrift>
            <Schrift x={sp.p(58)} y={y + H / 2 + 4} anker="start" groesse={12.5} fett>{t(s.k)}</Schrift>
            {i < stationen.length - 1 && <PfeilAb x={160} y={y + H + 2} laenge={L - 4} />}
          </g>
        )
      })}
    </svg>
  )
}

// ------------------------------------------------------------ 2 Soll/Ist
// Drei Säulen: vertragliche Menge, gemeldete Menge, abgerechnete Menge.
// Säulen statt Balken – die Höhe liest sich in jeder Leserichtung gleich.
function SollIst() {
  const saeulen = [
    { k: 'bild.sollist.soll', anteil: 1.0, farbe: 'var(--color-praxis-300)', textfarbe: MARKE_TEXT, wert: 'bild.sollist.sollWert' },
    { k: 'bild.sollist.ist', anteil: 0.66, farbe: 'var(--color-praxis-500)', textfarbe: MARKE_TEXT, wert: 'bild.sollist.istWert' },
    { k: 'bild.sollist.abg', anteil: 0.4, farbe: 'var(--color-praxis-700)', textfarbe: MARKE_TEXT, wert: 'bild.sollist.abgWert' },
  ]
  const BODEN = 128
  const MAXH = 96
  return (
    <svg viewBox="0 0 320 190" className="w-full h-auto max-w-[320px] mx-auto block" role="img">
      <line x1="16" y1={BODEN} x2="304" y2={BODEN} stroke={RAHMEN} strokeWidth="1.5" />
      {saeulen.map((s, i) => {
        const x = 42 + i * 96
        const h = MAXH * s.anteil
        return (
          <g key={s.k}>
            {/* Spur zeigt, wie viel noch offen ist */}
            <rect x={x} y={BODEN - MAXH} width="56" height={MAXH} rx="4" fill={FLAECHE} />
            <rect x={x} y={BODEN - h} width="56" height={h} rx="4" fill={s.farbe} />
            <Schrift x={x + 28} y={BODEN - h - 8} groesse={12} fett farbe={s.textfarbe || s.farbe}>{t(s.wert)}</Schrift>
            <Schrift x={x + 28} y={BODEN + 20} groesse={11.5} fett>{t(s.k)}</Schrift>
          </g>
        )
      })}
      <Schrift x={160} y={172} groesse={11} farbe={LEISE}>{t('bild.sollist.fuss')}</Schrift>
    </svg>
  )
}

// -------------------------------------------------------- 3 Bericht-Gate
// Was erfüllt sein muss, damit „Einreichen" freigeschaltet wird.
function BerichtGate() {
  const punkte = [
    'bild.gate.projekt', 'bild.gate.anordnung', 'bild.gate.vorher',
    'bild.gate.beschreibung', 'bild.gate.stunden', 'bild.gate.nachher',
  ]
  const H = 30
  const hoehe = punkte.length * H + 74
  const sp = spiegel(320)
  return (
    <svg viewBox={`0 0 320 ${hoehe}`} className="w-full h-auto max-w-[320px] mx-auto block" role="img">
      {punkte.map((k, i) => {
        const y = 6 + i * H
        return (
          <g key={k}>
            <rect x="8" y={y} width="304" height={H - 6} rx="7" fill={KARTE} stroke={RAHMEN} />
            <circle cx={sp.p(28)} cy={y + 12} r="8" fill={ST.ok} opacity="0.15" />
            <path d={`M${sp.p(24)} ${y + 12} l3 3 l6 -6`} stroke={ST.ok} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Schrift x={sp.p(46)} y={y + 16} anker="start" groesse={11.5}>{t(k)}</Schrift>
          </g>
        )
      })}
      <PfeilAb x={160} y={punkte.length * H + 8} laenge={16} />
      <rect x="80" y={punkte.length * H + 28} width="160" height="34" rx="9" fill={MARKE} />
      <Schrift x={160} y={punkte.length * H + 50} groesse={13} fett farbe="#fff">{t('bild.gate.einreichen')}</Schrift>
    </svg>
  )
}

// ------------------------------------------------------------ 4 Freigabe
// Die drei Zustände eines Berichts – der letzte trägt ein Schloss.
function Freigabe() {
  const stufen = [
    { k: 'status.entwurf', farbe: ST.offen, sub: 'bild.freigabe.entwurfSub' },
    { k: 'status.eingereicht', farbe: ST.abrechnung, sub: 'bild.freigabe.eingereichtSub' },
    { k: 'status.freigegeben', farbe: ST.ok, sub: 'bild.freigabe.freigegebenSub', schloss: true },
  ]
  const H = 58
  const L = 20
  const sp = spiegel(320)
  return (
    <svg viewBox={`0 0 320 ${stufen.length * (H + L) - L + 8}`} className="w-full h-auto max-w-[320px] mx-auto block" role="img">
      {stufen.map((s, i) => {
        const y = i * (H + L) + 4
        return (
          <g key={s.k}>
            <rect x="8" y={y} width="304" height={H} rx="10"
              fill={s.schloss ? MARKE_HELL : KARTE} stroke={s.schloss ? 'var(--color-praxis-200)' : RAHMEN} />
            <rect x={sp.r(8, 5)} y={y} width="5" height={H} rx="2.5" fill={s.farbe} />
            <Schrift x={sp.p(26)} y={y + 24} anker="start" groesse={13} fett farbe={s.farbe}>{t(s.k)}</Schrift>
            <Schrift x={sp.p(26)} y={y + 42} anker="start" groesse={11} farbe={LEISE}>{t(s.sub)}</Schrift>
            {s.schloss && (
              <g transform={`translate(${sp.p(280)} ${y + 20})`} stroke={MARKE} strokeWidth="1.8" fill="none" strokeLinecap="round">
                <rect x="-8" y="0" width="16" height="12" rx="2.5" fill={MARKE} stroke="none" />
                <path d="M-4.5 0 v-4 a4.5 4.5 0 0 1 9 0 v4" />
              </g>
            )}
            {i < stufen.length - 1 && <PfeilAb x={160} y={y + H + 2} laenge={L - 4} />}
          </g>
        )
      })}
    </svg>
  )
}

// ------------------------------------------------------- 5 Rechnungsquellen
// Drei Quellen laufen in einer Rechnung zusammen.
function RechnungQuellen() {
  const quellen = [
    { k: 'bild.quellen.lv', farbe: 'var(--color-praxis-600)', textfarbe: MARKE_TEXT },
    { k: 'bild.quellen.regie', farbe: 'var(--color-st-arbeit)' },
    { k: 'bild.quellen.spesen', farbe: 'var(--color-st-abrechnung)' },
  ]
  return (
    <svg viewBox="0 0 320 186" className="w-full h-auto max-w-[320px] mx-auto block" role="img">
      {quellen.map((q, i) => {
        const x = 12 + i * 100
        return (
          <g key={q.k}>
            <rect x={x} y="6" width="96" height="52" rx="9" fill={KARTE} stroke={RAHMEN} />
            <rect x={x} y="6" width="96" height="4" rx="2" fill={q.farbe} />
            <Schrift x={x + 48} y="38" groesse={11.5} fett farbe={q.textfarbe || q.farbe}>{t(q.k)}</Schrift>
            {/* Zusammenführung: senkrecht runter, dann zur Mitte */}
            <path
              d={`M${x + 48} 60 V78 H160 V96`}
              stroke={ZART} strokeWidth="1.5" fill="none" strokeLinejoin="round"
            />
          </g>
        )
      })}
      <path d="M156 92 L160 99 L164 92" stroke={ZART} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <rect x="52" y="104" width="216" height="46" rx="10" fill={MARKE} />
      <Schrift x={160} y="126" groesse={13} fett farbe="#fff">{t('bild.quellen.rechnung')}</Schrift>
      <Schrift x={160} y="142" groesse={10.5} farbe="rgba(255,255,255,.8)">{t('bild.quellen.fastbill')}</Schrift>
      <Schrift x={160} y="172" groesse={11} farbe={LEISE}>{t('bild.quellen.fuss')}</Schrift>
    </svg>
  )
}

// ----------------------------------------------------------- 6 Rollen
// Was das Büro sieht und was der Monteur sieht.
function Rollen() {
  const spalten = [
    { titel: 'bild.rollen.buero', icon: 'firma', farbe: MARKE, punkte: ['bild.rollen.b1', 'bild.rollen.b2', 'bild.rollen.b3', 'bild.rollen.b4'] },
    { titel: 'bild.rollen.monteur', icon: 'tablet', farbe: ST.arbeit, punkte: ['bild.rollen.m1', 'bild.rollen.m2', 'bild.rollen.m3', 'bild.rollen.m4'] },
  ]
  const sp = spiegel(320)
  return (
    <svg viewBox="0 0 320 158" className="w-full h-auto max-w-[320px] mx-auto block" role="img">
      {spalten.map((s, i) => {
        // Spaltenreihenfolge mitdrehen: die erste Spalte gehoert auf die Seite,
        // an der die Lektuere beginnt.
        const x = sp.r(8 + i * 156, 148)
        return (
          <g key={s.titel}>
            <rect x={x} y="6" width="148" height="146" rx="10" fill={KARTE} stroke={RAHMEN} />
            <rect x={x} y="6" width="148" height="30" rx="10" fill={s.farbe} opacity="0.1" />
            <rect x={x} y="30" width="148" height="6" fill={KARTE} />
            <Schrift x={x + 74} y="26" groesse={12.5} fett farbe={s.farbe}>{t(s.titel)}</Schrift>
            {s.punkte.map((p, j) => (
              <g key={p}>
                <circle cx={sp.rtl ? x + 132 : x + 16} cy={52 + j * 24} r="2.5" fill={s.farbe} />
                <Schrift x={sp.rtl ? x + 122 : x + 26} y={56 + j * 24} anker="start" groesse={10.5} farbe={LEISE}>{t(p)}</Schrift>
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ------------------------------------------------------- 7 Stundenzettel
// Miniatur des Ausdrucks. Bewusst als deutsches Dokument gezeichnet – so
// sieht das Blatt aus, das an Lohnbüro und Berufsgenossenschaft geht.
function Stundenzettel() {
  return (
    <svg viewBox="0 0 260 200" className="w-full h-auto max-w-[260px] mx-auto block" role="img">
      <rect x="8" y="4" width="244" height="192" rx="6" fill={KARTE} stroke={RAHMEN} />
      {/* Kopf */}
      <rect x="8" y="4" width="244" height="26" rx="6" fill={MARKE_HELL} />
      <rect x="8" y="28" width="244" height="2" fill={MARKE} />
      <Schrift x={spiegel(260).p(20)} y={21} anker="start" groesse={11} fett farbe={MARKE_TEXT}>{t('bild.stz.titel')}</Schrift>
      {/* Kopfdaten */}
      {[0, 1].map((i) => (
        <g key={i}>
          <rect x={16 + i * 118} y="38" width="110" height="26" rx="4" fill={FLAECHE} stroke={RAHMEN} />
          <rect x={22 + i * 118} y="44" width="42" height="4" rx="2" fill={ZART} />
          <rect x={22 + i * 118} y="53" width="72" height="5" rx="2.5" fill={LEISE} />
        </g>
      ))}
      {/* Tabellenkopf */}
      <rect x="16" y="72" width="228" height="12" rx="3" fill={MARKE} />
      {[0, 1, 2, 3, 4, 5].map((c) => (
        <rect key={c} x={22 + c * 37} y="76" width={c === 5 ? 26 : 22} height="4" rx="2" fill="rgba(255,255,255,.75)" />
      ))}
      {/* Zeilen: ein paar gefüllt, der Rest blass wie leere Kalendertage */}
      {Array.from({ length: 7 }).map((_, r) => (
        <g key={r}>
          <rect x="16" y={88 + r * 12} width="228" height="11" fill={r % 2 ? FLAECHE : KARTE} />
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <rect
              key={c}
              x={22 + c * 37}
              y={92 + r * 12}
              width={c === 5 ? 26 : 20}
              height="4"
              rx="2"
              fill={r < 4 ? (c === 4 ? MARKE : LEISE) : ZART}
              opacity={r < 4 ? (c === 4 ? 0.85 : 0.5) : 0.3}
            />
          ))}
        </g>
      ))}
      {/* Summenzeile */}
      <rect x="16" y="172" width="228" height="12" rx="3" fill={MARKE_HELL} stroke="var(--color-praxis-200)" />
      <rect x="22" y="176" width="60" height="4" rx="2" fill="var(--color-praxis-700)" />
      <rect x="208" y="176" width="30" height="4" rx="2" fill="var(--color-praxis-700)" />
      {/* Unterschriftslinien */}
      <line x1="20" y1="192" x2="112" y2="192" stroke={LEISE} strokeWidth="1" />
      <line x1="148" y1="192" x2="240" y2="192" stroke={LEISE} strokeWidth="1" />
    </svg>
  )
}

const ZEICHNUNGEN = {
  ablauf: Ablauf,
  sollIst: SollIst,
  berichtGate: BerichtGate,
  freigabe: Freigabe,
  rechnungQuellen: RechnungQuellen,
  rollen: Rollen,
  stundenzettel: Stundenzettel,
}

export default function WissenBild({ name, unterschrift }) {
  useLang()
  const Zeichnung = ZEICHNUNGEN[name]
  if (!Zeichnung) return null
  return (
    <figure className="my-1 rounded-feld border border-rahmen bg-gedeckt/60 px-4 py-4">
      <Zeichnung />
      {unterschrift && (
        <figcaption className="mt-3 text-center text-xs text-schrift-leise leading-relaxed">
          {unterschrift}
        </figcaption>
      )}
    </figure>
  )
}
