import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t } from '@shared/i18n.js'
import { einzelflaechen, fortschrittGesamt, STANDARD_HOEHE } from '@shared/raumflaeche.js'
import { flaechenZustand, fortschrittAufgaben, fortschrittGesamtAufgaben } from '@shared/raumaufgaben.js'
import { tuerenVon, TUER_HOEHE } from '@shared/tueren.js'

// 3D-Ansicht des Grundrisses.
//
// Vorbild: C:\Users\dadah\ecoflow-3d-haus. Übernommen ist der Ansatz – Szene,
// Orbit-Steuerung, klickbare Flächen. Nicht übernommen ist irgendetwas vom
// Solarhaus: kein Dach, kein Garten, keine Module. Nur Räume.
//
// WOZU: Der Grundriss von oben sagt, WO gearbeitet wird. Erst aufgestellt sagt
// er, WIE WEIT: eine gestrichene Nordwand ist von oben unsichtbar, in der
// Raumansicht sofort erkennbar. Genau darum ging es dem Auftraggeber – der
// Monteur meldet eine einzelne Wand fertig, und man sieht es.
//
// Three.js wird NACHGELADEN, nicht ins Hauptbündel gepackt: Die Bibliothek
// wiegt mehr als der ganze Rest der Verwaltung, und die meisten Seiten
// brauchen sie nie.

// Farbwelt.
//
// Vorher war alles Grau, Orange oder Grün – man sah den Zustand, aber die Räume
// waren nicht auseinanderzuhalten. Jetzt trägt jeder Raum seine eigene Farbe
// (dieselbe wie im Grundriss), und der ZUSTAND liegt als Tönung darüber:
// unbearbeitet blass und entsättigt, in Arbeit warm, fertig grün. So bleibt der
// Raum wiedererkennbar und der Fortschritt trotzdem auf einen Blick lesbar.
const ZUSTAND = {
  offen: 0x8f97a3,
  arbeit: 0xf59e0b,
  fertig: 0x22c55e,
}
const RAUMFARBEN = [0x8b1a1a, 0x0e7490, 0x4d7c0f, 0xa16207, 0x6d28d9, 0xbe185d]

// Teilfortschritt sichtbar machen: Ein Raum, an dem drei von sieben Schritten
// erledigt sind, soll anders aussehen als einer, an dem noch nichts passiert
// ist – und anders als ein fertiger. Deshalb ein Verlauf von Grau über Orange
// nach Grün statt dreier fester Farben.
function mischen(a, b, anteil) {
  const p = Math.max(0, Math.min(1, anteil))
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return ((Math.round(ar + (br - ar) * p) << 16)
    | (Math.round(ag + (bg - ag) * p) << 8)
    | Math.round(ab + (bb - ab) * p))
}

function zustandsfarbe(zustand, prozent) {
  if (zustand === 'fertig') return ZUSTAND.fertig
  if (zustand === 'offen') return ZUSTAND.offen
  const p = Math.max(0, Math.min(100, prozent || 0)) / 100
  return p < 0.5
    ? mischen(ZUSTAND.offen, ZUSTAND.arbeit, p * 2)
    : mischen(ZUSTAND.arbeit, ZUSTAND.fertig, (p - 0.5) * 2)
}

// Wandfarbe: die Raumfarbe bleibt erkennbar, der Zustand legt sich darüber.
function wandfarbe(raum, zustand, prozent, index) {
  const eigen = zahlAusFarbe(raum?.farbe) ?? RAUMFARBEN[index % RAUMFARBEN.length]
  const z = zustandsfarbe(zustand, prozent)
  // Der ZUSTAND muss dominieren, die Raumfarbe nur noch durchschimmern.
  // Mit umgekehrter Gewichtung sah ein unbearbeiteter gruener Raum (#61843b)
  // fast aus wie ein fertiger (#3f954b) – der Fortschritt war nicht ablesbar,
  // und genau dafuer ist die Ansicht da.
  const anteil = zustand === 'fertig' ? 0.82 : zustand === 'offen' ? 0.78 : 0.7
  return mischen(eigen, z, anteil)
}

function zahlAusFarbe(hex) {
  if (typeof hex !== 'string') return null
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i)
  return m ? parseInt(m[1], 16) : null
}

// Beschriftung als Bildmarke (Sprite): eine kleine Leinwand, die immer zur
// Kamera zeigt. Echte 3D-Schrift bräuchte eine Schriftdatei und wäre aus
// flachem Winkel unlesbar.
//
// Die Leinwand ist bewusst gross (1024 px) und das Sprite klein: so bleibt die
// Schrift auch beim Heranzoomen scharf, statt zu verpixeln.
function schildFuer(THREE, raum, fort, flaeche) {
  const nummer = String(raum.nummer || '').trim()
  const name = String(raum.name || '').trim()
  const B = 1024
  const H = 384
  const c = document.createElement('canvas')
  c.width = B
  c.height = H
  const g = c.getContext('2d')

  // Tafel mit weichen Ecken
  g.fillStyle = 'rgba(14, 17, 24, 0.86)'
  const r = 44
  g.beginPath()
  g.moveTo(r, 0); g.lineTo(B - r, 0); g.quadraticCurveTo(B, 0, B, r)
  g.lineTo(B, H - r); g.quadraticCurveTo(B, H, B - r, H)
  g.lineTo(r, H); g.quadraticCurveTo(0, H, 0, H - r)
  g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0)
  g.fill()
  // Farbstreifen links: dieselbe Raumfarbe wie Boden und Grundriss
  g.fillStyle = '#' + (zahlAusFarbe(raum.farbe) ?? 0x64748b).toString(16).padStart(6, '0')
  g.fillRect(0, 0, 14, H)

  let y = 84
  if (nummer) {
    g.fillStyle = '#93c5fd'
    g.font = 'bold 62px "Segoe UI", system-ui, sans-serif'
    g.textAlign = 'left'
    g.fillText(nummer.slice(0, 12), 46, y)
  }
  g.fillStyle = '#ffffff'
  g.font = 'bold 66px "Segoe UI", system-ui, sans-serif'
  g.textAlign = nummer ? 'right' : 'left'
  g.fillText(name.slice(0, 20) || '–', nummer ? B - 46 : 46, y)

  y += 62
  g.textAlign = 'left'
  g.fillStyle = 'rgba(255,255,255,0.72)'
  g.font = '48px "Segoe UI", system-ui, sans-serif'
  g.fillText(flaeche > 0 ? `${flaeche.toLocaleString('de-DE')} m²` : '', 46, y)

  // Fortschritt: Zahl UND Balken. Die Zahl liest man ab, den Balken sieht man
  // aus der Entfernung – aus einer Übersicht heraus zählt der Balken.
  if (fort.hatAufgaben) {
    g.textAlign = 'right'
    g.fillStyle = fort.alleFertig ? '#4ade80' : fort.fertig > 0 ? '#fbbf24' : 'rgba(255,255,255,0.6)'
    g.font = 'bold 52px "Segoe UI", system-ui, sans-serif'
    g.fillText(`${fort.prozent} %  ·  ${fort.fertig}/${fort.gesamt}`, B - 46, y)

    const bx = 46, bw = B - 92, by = H - 74, bh = 30
    g.fillStyle = 'rgba(255,255,255,0.16)'
    g.beginPath(); g.roundRect(bx, by, bw, bh, 15); g.fill()
    g.fillStyle = fort.alleFertig ? '#22c55e' : '#f59e0b'
    const breite = Math.max(bh, bw * (fort.prozent / 100))
    if (fort.prozent > 0) { g.beginPath(); g.roundRect(bx, by, breite, bh, 15); g.fill() }
  } else {
    g.textAlign = 'right'
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.font = '44px "Segoe UI", system-ui, sans-serif'
    g.fillText(t('aufg.keine'), B - 46, y)
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  // Immer obenauf zeichnen: ein Schild, das hinter einer Wand verschwindet,
  // erfüllt seinen Zweck nicht.
  sprite.renderOrder = 999
  sprite.scale.set(3.2, 1.2, 1)
  return sprite
}

// Wandstücke einer Wand mit Türöffnungen.
//
// Eine Wand mit Tür ist keine Wand mit Loch, sondern drei Teile: links vom
// Durchgang, rechts davon und der Sturz darüber. Genau so wird sie gemauert,
// und genau so muss sie hier entstehen – sonst ist die Öffnung entweder gar
// nicht da oder die Wand darüber fehlt.
function wandstuecke(laenge, hoehe, oeffnungen) {
  const sortiert = [...oeffnungen].sort((a, b) => a.von - b.von)
  const stuecke = []
  let kante = 0
  for (const o of sortiert) {
    const von = Math.max(0, Math.min(laenge, o.von))
    const bis = Math.max(von, Math.min(laenge, o.bis))
    if (von - kante > 0.02) stuecke.push({ von: kante, bis: von, unten: 0, hoehe })
    // Sturz über der Öffnung
    const sturz = hoehe - o.hoehe
    if (sturz > 0.02) stuecke.push({ von, bis, unten: o.hoehe, hoehe: sturz })
    kante = bis
  }
  if (laenge - kante > 0.02) stuecke.push({ von: kante, bis: laenge, unten: 0, hoehe })
  return stuecke
}

const SICHTEN = [
  { id: 'iso', schluessel: 'raum.sichtIso', winkel: [0.85, 0.75] },
  { id: 'oben', schluessel: 'raum.sichtOben', winkel: [0, 1.55] },
  { id: 'flach', schluessel: 'raum.sichtFlach', winkel: [0.6, 0.22] },
]

export default function Raum3D({ raeume, hoehe = STANDARD_HOEHE, aufFlaeche, aufRaum }) {
  useLang()
  const halterRef = useRef(null)
  const szeneRef = useRef(null)
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(true)
  const [zeigeDecken, setZeigeDecken] = useState(false)
  const [dreht, setDreht] = useState(false)
  const [voll, setVoll] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(false)
  const [ueber, setUeber] = useState(null)      // was gerade unter dem Zeiger liegt
  // Zwei Fehler, die sich hier trafen:
  //
  // 1. Der Aufbau ist ASYNCHRON (await import('three')). Der Effekt, der die
  //    Räume einfügt, lief sofort und fand noch keine Szene – er brach ab und
  //    wurde nie wieder ausgelöst, weil sich seine Abhängigkeiten nicht mehr
  //    änderten. Ergebnis: eine Leinwand, die für immer leer blieb.
  //    Deshalb `bereit`: es kippt, sobald die Szene steht, und löst den
  //    Aufbau der Räume aus.
  //
  // 2. `aufFlaeche` hing als Abhängigkeit am Aufbau. Das Projekt-Detail
  //    übergibt eine Inline-Funktion, die bei jedem Rendern neu entsteht –
  //    damit wurde die komplette Szene bei jedem Rendern abgerissen und neu
  //    gebaut. Der Rückruf liegt jetzt in einer Referenz.
  const [bereit, setBereit] = useState(false)
  const rueckruf = useRef(aufFlaeche)
  rueckruf.current = aufFlaeche
  const raumRueckruf = useRef(aufRaum)
  raumRueckruf.current = aufRaum
  // Als Referenz, nicht als Abhängigkeit: sonst würde jedes Umschalten die
  // ganze Szene abreißen und neu aufbauen.
  const bearbeitenRef = useRef(false)
  bearbeitenRef.current = bearbeiten

  const sichtbar = useMemo(
    () => (raeume || []).filter((r) => r.aktiv !== false && (Number(r.breite) || 0) > 0 && (Number(r.laenge) || 0) > 0),
    [raeume]
  )
  const ohneMasse = useMemo(
    () => (raeume || []).filter((r) => r.aktiv !== false && !((Number(r.breite) || 0) > 0 && (Number(r.laenge) || 0) > 0)).length,
    [raeume]
  )
  // Aufgaben sind die führende Anzeige. Gibt es in einem Projekt noch keine,
  // fällt sie auf die Flächen zurück – sonst stünde dort "0 % · 0 von 0
  // Schritte", was nach einem Fehler aussieht statt nach "noch nichts geplant".
  const gesamt = useMemo(() => {
    const ausAufgaben = fortschrittGesamtAufgaben(sichtbar)
    // Nur wenn JEDER Raum eine Aufgabenliste hat, ist die Schrittzahl ein Maß
    // für die Baustelle. Sonst meldete ein einziger abgehakter Raum 100 %.
    if (ausAufgaben.gesamt > 0 && ausAufgaben.vollstaendig) return { ...ausAufgaben, einheit: 'schritte' }
    const ausFlaechen = fortschrittGesamt(sichtbar, { hoehe })
    return { ...ausFlaechen, einheit: 'flaeche', ungeplant: ausAufgaben.raeumeGesamt - ausAufgaben.raeumeMitAufgaben }
  }, [sichtbar, hoehe])

  // --- Szene einmalig aufbauen ---
  useEffect(() => {
    let abgebrochen = false
    let aufraeumen = () => {}

    ;(async () => {
      try {
        const THREE = await import('three')
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
        if (abgebrochen || !halterRef.current) return

        const halter = halterRef.current
        const szene = new THREE.Scene()
        szene.background = null
        // Dezenter Dunst in der Tiefe – ohne ihn wirken weit entfernte Räume
        // genauso kräftig wie die vorderen, und das Bild wird flach.
        szene.fog = new THREE.Fog(0xdfe4ec, 60, 260)

        const kamera = new THREE.PerspectiveCamera(48, 1, 0.1, 900)
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap
        // Physikalisch sinnvolle Tonwerte: ohne das wirken gesättigte Farben
        // ausgebrannt, sobald Licht darauf fällt.
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1
        halter.appendChild(renderer.domElement)

        const steuerung = new OrbitControls(kamera, renderer.domElement)
        steuerung.enableDamping = true
        steuerung.dampingFactor = 0.08
        steuerung.maxPolarAngle = Math.PI / 2.05   // nicht unter den Boden schauen
        steuerung.minDistance = 2
        steuerung.maxDistance = 600
        // Verschieben in der Bildebene statt entlang des Bodens: fühlt sich beim
        // Ziehen mit der rechten Maustaste an wie das Schieben eines Plans.
        steuerung.screenSpacePanning = true
        steuerung.zoomSpeed = 1.1
        steuerung.panSpeed = 1.2
        // Ohne feste Zuordnung entscheidet die Voreinstellung der Bibliothek,
        // und die belegt die mittlere Taste mit Zoom – wer die Ansicht schieben
        // will, findet dann keinen Weg dorthin.
        steuerung.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.PAN,
        }
        // Direkteres Drehen: mit der Voreinstellung (1.0) fühlte sich die
        // Bewegung zäh an, weil ein halber Bildschirm nur eine Vierteldrehung
        // ergab.
        steuerung.rotateSpeed = 1.25
        // Das Kontextmenü der rechten Maustaste würde das Schieben abbrechen.
        renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault())
        // Auf dem Tablet: ein Finger dreht, zwei Finger schieben und zoomen.
        steuerung.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
        // Pfeiltasten schieben das Bild – wer keine Maus mag, kommt trotzdem
        // überall hin.
        steuerung.listenToKeyEvents?.(window)
        steuerung.keyPanSpeed = 22
        steuerung.autoRotateSpeed = 0.9

        // Himmel-/Bodenlicht statt flachem Umgebungslicht: Decken bekommen
        // kühles Licht von oben, Böden warmes von unten – dadurch bekommen die
        // Wände überhaupt erst eine Form.
        szene.add(new THREE.HemisphereLight(0xdce7f5, 0x6b6156, 1.15))
        const sonne = new THREE.DirectionalLight(0xfff4e6, 1.5)
        sonne.position.set(14, 26, 10)
        sonne.castShadow = true
        sonne.shadow.mapSize.set(2048, 2048)
        sonne.shadow.camera.near = 1
        sonne.shadow.bias = -0.0015
        szene.add(sonne)
        szene.add(sonne.target)
        // Aufheller von der Gegenseite, damit abgewandte Wände nicht absaufen
        const gegenlicht = new THREE.DirectionalLight(0xc9d8f0, 0.45)
        gegenlicht.position.set(-12, 10, -14)
        szene.add(gegenlicht)

        const gruppe = new THREE.Group()
        szene.add(gruppe)

        const zeiger = new THREE.Vector2()
        const strahl = new THREE.Raycaster()

        function treffer(e) {
          const r = renderer.domElement.getBoundingClientRect()
          zeiger.x = ((e.clientX - r.left) / r.width) * 2 - 1
          zeiger.y = -((e.clientY - r.top) / r.height) * 2 + 1
          strahl.setFromCamera(zeiger, kamera)
          return strahl.intersectObjects(gruppe.children, true)
            .find((x) => x.object.userData?.flaecheId)
        }

        let gezogen = false
        function runter() { gezogen = false }
        function bewegt(e) {
          gezogen = true
          const tr = treffer(e)
          renderer.domElement.style.cursor = tr && bearbeitenRef.current ? 'pointer' : 'grab'
          setUeber(tr ? { raum: tr.object.userData.raumName, flaeche: tr.object.userData.flaecheId } : null)
        }
        function klick(e) {
          // Nach einem Drehen darf kein Klick ausgelöst werden – sonst schaltet
          // jedes Herumschauen versehentlich einen Wandzustand weiter.
          if (gezogen) return
          // ZWEI BETRIEBSARTEN.
          // Voreingestellt ist SCHAUEN: Drehen, Zoomen, Schieben, ohne dass ein
          // einziges Feld beschrieben wird. Erst der Knopf "Bearbeiten" macht
          // aus einem Klick eine Änderung. Vorher schaltete jeder Klick auf eine
          // Wand unsichtbar deren Zustand weiter – man merkte es erst, wenn die
          // Abrechnung nicht mehr stimmte.
          if (!bearbeitenRef.current) return
          const tr = treffer(e)
          if (!tr) return
          const { raumId, flaecheId } = tr.object.userData
          if (flaecheId === 'boden' && raumRueckruf.current) raumRueckruf.current(raumId)
          else rueckruf.current?.(raumId, flaecheId)
        }
        const el = renderer.domElement
        el.addEventListener('pointerdown', runter)
        el.addEventListener('pointermove', bewegt)
        el.addEventListener('click', klick)
        el.addEventListener('pointerleave', () => setUeber(null))

        function groesse() {
          const b = halter.clientWidth || 600
          const h = halter.clientHeight || 380
          renderer.setSize(b, h, false)
          kamera.aspect = b / h
          kamera.updateProjectionMatrix()
        }
        const beobachter = new ResizeObserver(groesse)
        beobachter.observe(halter)
        groesse()

        let laeuft = true
        function schleife() {
          if (!laeuft) return
          steuerung.update()
          renderer.render(szene, kamera)
          requestAnimationFrame(schleife)
        }
        schleife()

        szeneRef.current = { THREE, szene, gruppe, kamera, steuerung, renderer, sonne, rahmen: null }
        // Diagnosehaken NUR im Entwicklungsbetrieb: eine WebGL-Leinwand lässt
        // sich von aussen nicht sinnvoll prüfen (toDataURL und readPixels sind
        // ohne preserveDrawingBuffer leer). Ohne diesen Zugriff ist ein leerer
        // 3D-Bereich nicht von einem kaputten zu unterscheiden.
        if (import.meta.env.DEV) window.__raum3d = szeneRef.current
        setLaedt(false)
        setBereit(true)

        aufraeumen = () => {
          laeuft = false
          beobachter.disconnect()
          el.removeEventListener('pointerdown', runter)
          el.removeEventListener('pointermove', bewegt)
          el.removeEventListener('click', klick)
          steuerung.dispose()
          renderer.dispose()
          halter.removeChild(el)
          szeneRef.current = null
          setBereit(false)
        }
      } catch (e) {
        if (!abgebrochen) { setFehler(e?.message || String(e)); setLaedt(false) }
      }
    })()

    return () => { abgebrochen = true; aufraeumen() }
  }, [])

  // --- Räume neu aufbauen, wenn sich Daten ändern ---
  useEffect(() => {
    const s = szeneRef.current
    if (!s) return
    const { THREE, gruppe, sonne } = s

    // Alte Geometrie sauber freigeben – sonst wächst der Speicher mit jedem
    // Statuswechsel, und auf einem Tablet ist das nach einer Stunde spürbar.
    while (gruppe.children.length) {
      const k = gruppe.children.pop()
      k.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); o.material?.map?.dispose?.() })
      gruppe.remove(k)
    }
    if (!sichtbar.length) { s.rahmen = null; return }

    // DAS BILD MUSS MITTIG STEHEN.
    //
    // Vorher war hier `const mitte = { x: 0, y: 0 }` fest verdrahtet – der
    // Kommentar sprach von Mitte, gerechnet wurde nie eine. Die Räume standen
    // an ihren Rohkoordinaten (alle positiv), Bodenplatte und Kamera aber im
    // Ursprung. Ergebnis: das Modell klebte in einer Ecke, daneben lag eine
    // riesige leere Platte. Jetzt wird der umschliessende Kasten bestimmt und
    // sein Mittelpunkt in den Ursprung geschoben.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const r of sichtbar) {
      const x = Number(r.x) || 0
      const z = Number(r.y) || 0
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + (Number(r.breite) || 0))
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z + (Number(r.laenge) || 0))
    }
    const mitte = { x: (minX + maxX) / 2, y: (minZ + maxZ) / 2 }
    const spanneX = Math.max(maxX - minX, 4)
    const spanneZ = Math.max(maxZ - minZ, 4)
    const radius = Math.max(spanneX, spanneZ) / 2
    s.rahmen = { spanneX, spanneZ, radius }

    // Licht und Nebel auf die tatsächliche Grösse einstellen: bei einem Geschoss
    // mit 40 m Kantenlänge reicht ein Schattenfenster von 40 pt nicht.
    sonne.position.set(radius * 1.1, radius * 1.6 + 12, radius * 0.8)
    const sk = sonne.shadow.camera
    sk.left = -radius * 1.6; sk.right = radius * 1.6
    sk.top = radius * 1.6; sk.bottom = -radius * 1.6
    sk.far = radius * 6 + 60
    sk.updateProjectionMatrix()
    s.szene.fog.near = radius * 2.5
    s.szene.fog.far = radius * 9 + 80

    // Bodenplatte unter allem – gibt der Szene Grund und fängt die Schatten.
    {
      const platte = new THREE.Mesh(
        new THREE.PlaneGeometry(spanneX + 8, spanneZ + 8),
        new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.95, metalness: 0 })
      )
      platte.rotation.x = -Math.PI / 2
      platte.position.set(0, -0.02, 0)
      platte.receiveShadow = true
      gruppe.add(platte)

      // Metergitter: gibt dem Auge einen Massstab. Ohne es weiss man nicht, ob
      // man auf eine Abstellkammer oder eine Halle sieht.
      const gitter = new THREE.GridHelper(
        Math.ceil(Math.max(spanneX, spanneZ)) + 8,
        Math.ceil(Math.max(spanneX, spanneZ)) + 8,
        0xb8c2d0, 0xdbe2ea
      )
      gitter.position.y = 0.005
      gitter.material.transparent = true
      gitter.material.opacity = 0.5
      gruppe.add(gitter)
    }

    sichtbar.forEach((r, index) => {
      const b = Number(r.breite) || 0
      const l = Number(r.laenge) || 0
      const h = Number(r.hoehe) || hoehe
      const x0 = (Number(r.x) || 0) - mitte.x
      const z0 = (Number(r.y) || 0) - mitte.y
      const fort = fortschrittAufgaben(r)
      const D = 0.12                       // Wandstärke in Metern
      const eigen = zahlAusFarbe(r.farbe) ?? RAUMFARBEN[index % RAUMFARBEN.length]

      const mach = (geo, farbe, pos, flaecheId, opts = {}) => {
        const mat = new THREE.MeshStandardMaterial({
          color: farbe,
          roughness: opts.roughness ?? 0.85,
          metalness: 0,
          transparent: Boolean(opts.opacity),
          opacity: opts.opacity ?? 1,
        })
        const m = new THREE.Mesh(geo, mat)
        m.position.set(pos[0], pos[1], pos[2])
        m.castShadow = opts.wirftSchatten !== false
        m.receiveShadow = true
        m.userData = { raumId: r.id, flaecheId, raumName: r.name || r.nummer || '' }
        gruppe.add(m)
        return m
      }

      // Boden des Raums – trägt die Raumfarbe, damit Räume unterscheidbar sind
      mach(
        new THREE.BoxGeometry(b, 0.06, l),
        mischen(eigen, 0xffffff, 0.72),
        [x0 + b / 2, 0.03, z0 + l / 2],
        'boden',
        { wirftSchatten: false, roughness: 0.95 }
      )

      // Türen dieses Raums, nach Wand sortiert
      const tueren = tuerenVon(r)

      // Vier Wände. Papierdünne Flächen sahen aus wie Kulissen – mit Stärke
      // bekommt der Raum Körper, und die Ecken schliessen sauber.
      // Wände mit Tür werden in Stücke zerlegt (siehe wandstuecke).
      const waende = [
        { id: 'wandN', laenge: b + D, achse: 'x', fest: z0 - D / 2, start: x0 - D / 2, tiefe: D },
        { id: 'wandS', laenge: b + D, achse: 'x', fest: z0 + l + D / 2, start: x0 - D / 2, tiefe: D },
        { id: 'wandW', laenge: l + D, achse: 'z', fest: x0 - D / 2, start: z0 - D / 2, tiefe: D },
        { id: 'wandO', laenge: l + D, achse: 'z', fest: x0 + b + D / 2, start: z0 - D / 2, tiefe: D },
      ]
      for (const w of waende) {
        const zustand = flaechenZustand(r, w.id)
        const farbe = wandfarbe(r, zustand, fort.prozent, index)
        const oeffnungen = tueren
          .filter((tu) => tu.wand === w.id)
          .map((tu) => {
            const breite = Math.max(0.5, Math.min(w.laenge - 0.2, Number(tu.breite) || 0.9))
            const mittePos = Math.max(breite / 2, Math.min(w.laenge - breite / 2, (Number(tu.position) || 0.5) * w.laenge))
            return { von: mittePos - breite / 2, bis: mittePos + breite / 2, hoehe: Math.min(h - 0.05, Number(tu.hoehe) || TUER_HOEHE) }
          })
        for (const st of wandstuecke(w.laenge, h, oeffnungen)) {
          const laenge = st.bis - st.von
          if (laenge <= 0.02) continue
          const mittelpunkt = w.start + st.von + laenge / 2
          const geo = w.achse === 'x'
            ? new THREE.BoxGeometry(laenge, st.hoehe, w.tiefe)
            : new THREE.BoxGeometry(w.tiefe, st.hoehe, laenge)
          const pos = w.achse === 'x'
            ? [mittelpunkt, st.unten + st.hoehe / 2, w.fest]
            : [w.fest, st.unten + st.hoehe / 2, mittelpunkt]
          mach(geo, farbe, pos, w.id)
        }
        // Türlaibung sichtbar machen: ein dünner heller Rahmen an der Öffnung.
        // Ohne ihn wirkt die Lücke wie eine fehlende Wand, nicht wie eine Tür.
        for (const o of oeffnungen) {
          const laenge = o.bis - o.von
          const mittelpunkt = w.start + o.von + laenge / 2
          const schwelle = new THREE.Mesh(
            w.achse === 'x'
              ? new THREE.BoxGeometry(laenge, 0.04, w.tiefe + 0.06)
              : new THREE.BoxGeometry(w.tiefe + 0.06, 0.04, laenge),
            new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.7 })
          )
          schwelle.position.set(
            w.achse === 'x' ? mittelpunkt : w.fest,
            0.05,
            w.achse === 'x' ? w.fest : mittelpunkt
          )
          schwelle.receiveShadow = true
          schwelle.userData = { raumId: r.id, flaecheId: w.id, raumName: r.name || '' }
          gruppe.add(schwelle)
        }
      }

      // Decke nur auf Wunsch – sonst sieht man nicht hinein
      const deckeStatus = flaechenZustand(r, 'decke')
      if (zeigeDecken || deckeStatus !== 'offen') {
        mach(
          new THREE.BoxGeometry(b, 0.05, l),
          wandfarbe(r, deckeStatus, fort.prozent, index),
          [x0 + b / 2, h, z0 + l / 2],
          'decke',
          { opacity: zeigeDecken ? 0.75 : 0.4, wirftSchatten: false }
        )
      }

      // Beschriftung als Schild über dem Raum: Nummer, Name, Fläche, Fortschritt.
      // Ohne sie muss man raten, welcher Quader welcher Raum ist.
      const flaeche = Number(r.flaeche) || Math.round(b * l * 100) / 100
      const schild = schildFuer(THREE, r, fort, flaeche)
      if (schild) {
        // Kleine Räume bekommen ein kleineres Schild, damit sich Nachbarn nicht
        // gegenseitig zudecken – aber nie so klein, dass es unlesbar wird.
        const mass = Math.max(1.9, Math.min(4.2, Math.min(b, l) * 1.15))
        schild.scale.set(mass, mass * 0.375, 1)
        schild.position.set(x0 + b / 2, h + mass * 0.32, z0 + l / 2)
        schild.userData = { raumId: r.id, flaecheId: 'decke', raumName: r.name || '' }
        gruppe.add(schild)
      }
    })

    sonne.target.position.set(0, 0, 0)
    sonne.target.updateMatrixWorld()
  }, [sichtbar, hoehe, bereit, zeigeDecken])

  // Kamera auf das gesamte Modell einstellen
  const einpassen = useCallback((sichtId = 'iso') => {
    const s = szeneRef.current
    if (!s || !s.rahmen) return
    const { kamera, steuerung, rahmen } = s
    const sicht = SICHTEN.find((x) => x.id === sichtId) || SICHTEN[0]
    const [drehung, neigung] = sicht.winkel
    // Abstand so wählen, dass der umschliessende Kreis ins Blickfeld passt –
    // mit etwas Luft, damit die Schilder oben nicht abgeschnitten werden.
    const abstand = (rahmen.radius + 2) / Math.tan((kamera.fov * Math.PI) / 360) * 1.35 + 4
    kamera.position.set(
      Math.sin(drehung) * Math.cos(neigung) * abstand,
      Math.max(2.5, Math.sin(neigung) * abstand),
      Math.cos(drehung) * Math.cos(neigung) * abstand
    )
    steuerung.target.set(0, 0.9, 0)
    steuerung.update()
  }, [])

  // Nach jedem Neuaufbau einpassen – aber nur, wenn sich die Räume wirklich
  // geändert haben. Sonst springt die Kamera bei jedem Wandklick zurück, und
  // man verliert die Stelle, die man gerade ansieht.
  const signatur = useMemo(
    () => sichtbar.map((r) => `${r.id}:${r.x}:${r.y}:${r.breite}:${r.laenge}`).join('|'),
    [sichtbar]
  )
  useEffect(() => { if (bereit) einpassen('iso') }, [signatur, bereit, einpassen])

  useEffect(() => {
    const s = szeneRef.current
    if (s) s.steuerung.autoRotate = dreht
  }, [dreht, bereit])

  const zoome = (faktor) => {
    const s = szeneRef.current
    if (!s) return
    const { kamera, steuerung } = s
    const richtung = kamera.position.clone().sub(steuerung.target)
    const laenge = Math.max(steuerung.minDistance, Math.min(steuerung.maxDistance, richtung.length() * faktor))
    kamera.position.copy(steuerung.target).add(richtung.setLength(laenge))
    steuerung.update()
  }

  const knopf = 'px-3 min-h-9 rounded-feld border border-rahmen bg-karte text-[12px] font-semibold text-schrift hover:bg-gedeckt'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <p className="text-sm">
          <span className="text-schrift-leise">{t('raum.fortschritt')}</span>{' '}
          <strong className="text-schrift-stark">{gesamt.prozent} %</strong>
          <span className="text-schrift-zart">
            {gesamt.gesamt > 0
              ? ` · ${gesamt.fertig} ${t('raum.von')} ${gesamt.gesamt} ${gesamt.einheit === 'schritte' ? t('aufg.schritte') : 'm²'}`
              : ` · ${t('aufg.keine')}`}
          </span>
        </p>
        <div className="flex items-center gap-3 ml-auto text-[12px] text-schrift-leise">
          {[['offen', '#9aa0ab'], ['arbeit', '#fb923c'], ['fertig', '#4ade80']].map(([id, farbe]) => (
            <span key={id} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: farbe }} />
              {t(`raum.status.${id}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Steuerung: wer nicht weiss, dass man mit der rechten Maustaste schiebt,
          kommt sonst nie aus der Startansicht heraus. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {SICHTEN.map((v) => (
          <button key={v.id} className={knopf} onClick={() => einpassen(v.id)}>{t(v.schluessel)}</button>
        ))}
        <span className="w-px h-6 bg-rahmen mx-1" />
        <button className={knopf} onClick={() => zoome(0.75)} aria-label={t('raum.naeher')}>+</button>
        <button className={knopf} onClick={() => zoome(1.33)} aria-label={t('raum.weiter')}>−</button>
        <button className={knopf} onClick={() => einpassen('iso')}>{t('raum.allesZeigen')}</button>
        <span className="w-px h-6 bg-rahmen mx-1" />
        <button
          className={`${knopf} ${dreht ? '!bg-praxis-600 !text-white' : ''}`}
          onClick={() => setDreht((d) => !d)}
        >
          {t('raum.drehen')}
        </button>
        <button
          className={`${knopf} ${zeigeDecken ? '!bg-praxis-600 !text-white' : ''}`}
          onClick={() => setZeigeDecken((d) => !d)}
        >
          {t('raum.decken')}
        </button>
        <button
          className={`${knopf} ${bearbeiten ? '!bg-amber-500 !text-white !border-amber-500' : ''}`}
          onClick={() => setBearbeiten((b) => !b)}
        >
          {bearbeiten ? t('raum.bearbeitenAn') : t('raum.bearbeitenAus')}
        </button>
        <button className={`${knopf} ml-auto`} onClick={() => setVoll((v) => !v)}>
          <span className="inline-flex items-center gap-1.5">
            <Icon name={voll ? 'schliessen' : 'suchen'} className="w-3.5 h-3.5" />
            {voll ? t('raum.kleiner') : t('raum.gross')}
          </span>
        </button>
      </div>

      <div
        ref={halterRef}
        className="relative rounded-karte border border-rahmen bg-gedeckt overflow-hidden"
        style={{ height: voll ? 720 : 420 }}
      >
        {laedt && !fehler && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-schrift-leise">
            {t('raum.3dLaedt')}
          </p>
        )}
        {fehler && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm font-semibold text-amber-700">{t('raum.3dFehler')}</p>
            <p className="text-[12px] text-schrift-zart" dir="ltr">{fehler}</p>
          </div>
        )}
        {!laedt && !fehler && !sichtbar.length && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-schrift-leise px-6 text-center">
            {t('raum.3dOhneMasse')}
          </p>
        )}
        {/* Was liegt unter dem Zeiger? Ohne diese Anzeige klickt man blind auf
            eine Fläche und erfährt erst hinterher, welche es war. */}
        {ueber && (
          <div className="absolute left-3 bottom-3 rounded-feld bg-karte/95 border border-rahmen px-3 py-1.5 text-[12px] text-schrift shadow-sm pointer-events-none">
            <strong className="text-schrift-stark">{ueber.raum || '–'}</strong>
            {' · '}{t(`raum.flaeche.${ueber.flaeche}`)}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-schrift-zart">
        {bearbeiten ? t('raum.3dHilfeBearbeiten') : t('raum.3dHilfe')}
      </p>
      {gesamt.ungeplant > 0 && (
        <p className="mt-1 text-[12px] text-schrift-zart">{t('raum.ungeplant', { anzahl: gesamt.ungeplant })}</p>
      )}
      {ohneMasse > 0 && (
        <p className="mt-1 text-[12px] text-amber-700">{t('raum.3dFehlenMasse', { anzahl: ohneMasse })}</p>
      )}
    </div>
  )
}
