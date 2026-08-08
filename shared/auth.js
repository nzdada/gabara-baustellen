// Anmeldung für die Verwaltung (und später die Mitarbeiter-App).
// Lokaler Modus: Demo-Zugänge (unten). Firebase-Modus: Firebase Authentication.
// Rollen: 'admin' (Büro, alles) | 'vorarbeiter' (Monteur + Kolonnenstunden)
//         | 'mitarbeiter' (Monteur, nur Zugewiesenes).
//
// V2: Die Rolle steht bevorzugt als CUSTOM CLAIM im Anmelde-Token
// (scripts/setze-rolle.mjs) – ein Claim kann vom Client nicht gefälscht
// werden. Das users-Dokument bleibt Übergangs-Fallback, bis das Skript für
// alle Konten gelaufen ist (dann fällt keinRollenmodell() in den Regeln).

import { FIREBASE_CONFIG } from './firebase-config.js'
import { getStore } from './store.js'

// Der Vorarbeiter IST fachlich Monteur (Handy-Ansicht, eigene Baustellen) –
// mit genau einem Zusatzrecht: die Kolonnen-Stundenzeile absenden.
// ALLE Oberflächen-Weichen laufen über diese zwei Helfer, nie über einen
// direkten Vergleich mit 'mitarbeiter' – sonst fällt ein Vorarbeiter
// unbemerkt in die Büro-Ansicht.
export function istMonteurRolle(rolle) {
  return rolle === 'mitarbeiter' || rolle === 'vorarbeiter'
}
export function istVorarbeiterRolle(rolle) {
  return rolle === 'vorarbeiter'
}

export const DEMO_ZUGAENGE = [
  { email: 'buero@gabara-demo.de', passwort: 'demo2026', name: 'Büro Gabara (Demo)', rolle: 'admin' },
  { email: 'monteur@gabara-demo.de', passwort: 'demo2026', name: 'Ahmad Monteur (Demo)', rolle: 'mitarbeiter' },
]

const SESSION_KEY = 'gabara-admin-session'
const listener = new Set()

function aktuelleLokaleSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

// users-Doc nachschlagen -> { profil, leer } .
// Bevorzugt wird das Dokument, dessen ID die Firebase-Auth-UID ist – nur so
// können die Firestore-Regeln die Rolle prüfen (siehe firestore.rules).
// Fallback: Suche über die E-Mail (Demo-/Bestandsdaten mit eigenen IDs).
//
// `leer` = die users-Sammlung wurde ERFOLGREICH gelesen und ist komplett leer.
// Das ist der Zustand einer frisch angelegten Datenbank. Wichtig: Bei einem
// LESEFEHLER ist leer=false – sonst würde eine verweigerte Abfrage wie eine
// leere Datenbank aussehen und Rechte verschenken.
async function nutzerProfil(email, uid = null) {
  try {
    const store = await getStore()
    const alle = await store.list('users')
    const treffer = (uid && alle.find((u) => u.id === uid))
      || alle.find((u) => (u.email || '').toLowerCase() === (email || '').toLowerCase())
      || null
    return { profil: treffer, leer: alle.length === 0 }
  } catch (e) {
    return { profil: null, leer: false }
  }
}

// Rolle aus dem Anmelde-Token (Custom Claim). Liefert '' wenn keiner
// gesetzt ist. `erzwingen` holt ein frisches Token vom Server – nötig beim
// App-Start, damit ein Rollenwechsel (revokeRefreshTokens) sofort wirkt und
// nicht erst nach bis zu einer Stunde. Offline schlägt das Erzwingen fehl;
// dann gilt das zwischengespeicherte Token – besser als gar keine Anmeldung.
async function rolleAusToken(user, erzwingen = false) {
  try {
    const t = await user.getIdTokenResult(erzwingen)
    const rolle = t?.claims?.rolle
    return typeof rolle === 'string' ? rolle : ''
  } catch (e) {
    if (erzwingen) return rolleAusToken(user, false)
    return ''
  }
}

// Welche Rolle gilt für diesen Anmeldevorgang?
//
// Ohne passendes users-Dokument gilt normalerweise 'mitarbeiter' – der
// vorsichtigere Fall. ABER: In einer frisch angelegten Datenbank gibt es noch
// GAR KEINE users-Dokumente. Wer sich dort als Erster anmeldet, käme mit
// 'mitarbeiter' in die Monteur-Ansicht und hätte keine Möglichkeit mehr, die
// Benutzerverwaltung zu erreichen und sich selbst einzutragen – eine Sackgasse.
//
// Deshalb: Ist die users-Sammlung nachweislich leer, gilt der erste Anmeldende
// als Büro. Das entspricht genau der Übergangsregel keinRollenmodell() in
// firestore.rules. Sobald das erste users-Dokument existiert, greift wieder
// ausschließlich die dort eingetragene Rolle.
function rolleAus({ profil, leer }) {
  if (profil?.rolle) return profil.rolle
  return leer ? 'admin' : 'mitarbeiter'
}

export async function anmelden(email, passwort) {
  if (!FIREBASE_CONFIG.enabled) {
    const nutzer = DEMO_ZUGAENGE.find(
      (z) => z.email.toLowerCase() === email.trim().toLowerCase() && z.passwort === passwort
    )
    if (!nutzer) throw new Error('E-Mail oder Passwort falsch.')
    const { profil } = await nutzerProfil(nutzer.email)
    const session = {
      email: nutzer.email,
      name: profil?.name || nutzer.name,
      // Im Demo-Modus gibt der Zugang selbst die Rolle vor
      rolle: profil?.rolle || nutzer.rolle,
      userId: profil?.id || null,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    listener.forEach((cb) => cb(session))
    return session
  }
  const store = await getStore()
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
  const auth = getAuth(store.app)
  const cred = await signInWithEmailAndPassword(auth, email.trim(), passwort)
  const claim = await rolleAusToken(cred.user)
  const gefunden = await nutzerProfil(cred.user.email, cred.user.uid)
  return {
    email: cred.user.email,
    name: gefunden.profil?.name || cred.user.displayName || cred.user.email,
    // Der Claim schlägt das Dokument – er ist fälschungssicher.
    rolle: claim || rolleAus(gefunden),
    userId: gefunden.profil?.id || cred.user.uid,
  }
}

export async function abmelden() {
  if (!FIREBASE_CONFIG.enabled) {
    sessionStorage.removeItem(SESSION_KEY)
    listener.forEach((cb) => cb(null))
    return
  }
  const store = await getStore()
  const { getAuth, signOut } = await import('firebase/auth')
  await signOut(getAuth(store.app))
}

// Wartet höchstens `ms` auf ein Versprechen und liefert sonst `ersatz`.
// Nötig, weil Firestore-Abfragen KEINE eingebaute Frist haben: bei gestörter
// Verbindung versucht der Client es unbegrenzt weiter, ohne je abzubrechen.
function mitFrist(versprechen, ms, ersatz) {
  return Promise.race([
    versprechen,
    new Promise((auf) => setTimeout(() => auf(ersatz), ms)),
  ])
}

// Meldet den aktuellen Anmeldestatus (sofort + bei jeder Änderung)
//
// WICHTIG: Dieser Rückruf MUSS in jedem Fall genau einmal feuern – auch im
// Fehlerfall. Die Verwaltung zeigt bis dahin nur das Ladebild. Vorher fehlte
// hier sowohl ein .catch() als auch eine Frist um die Profilabfrage: eine
// gestörte Firestore-Verbindung führte deshalb zu einem endlosen Ladebild ohne
// Meldung und ohne Ausweg.
export function beobachteAnmeldung(cb) {
  if (!FIREBASE_CONFIG.enabled) {
    cb(aktuelleLokaleSession())
    listener.add(cb)
    return () => listener.delete(cb)
  }
  let unsub = () => {}
  getStore().then(async (store) => {
    const { getAuth, onAuthStateChanged } = await import('firebase/auth')
    const auth = getAuth(store.app)
    unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return cb(null)
      // Beim App-Start EINMAL ein frisches Token erzwingen: Nach einem
      // Rollenwechsel (setze-rolle.mjs widerruft die alten Token) wirkt die
      // neue Rolle so sofort statt erst nach bis zu einer Stunde.
      //
      // FRIST ≠ KEIN CLAIM (Fund der Gegenprüfung 08.08.2026): Läuft das
      // Erzwingen in die Frist (hängende Verbindung), heißt das nicht, dass
      // das Konto keinen Claim hat – dann gilt das ZWISCHENGESPEICHERTE
      // Token. Sonst landete ein Büro-Konto ohne users-Dokument stumm in
      // der Monteur-Ansicht.
      const FRIST_ABGELAUFEN = Symbol('frist')
      let claim = await mitFrist(rolleAusToken(user, true), 8000, FRIST_ABGELAUFEN)
      if (claim === FRIST_ABGELAUFEN) {
        claim = await mitFrist(rolleAusToken(user, false), 3000, '')
      }
      if (claim) {
        // Der Claim genügt für die Rolle; das Profil liefert nur noch den
        // Anzeigenamen und darf deshalb auch scheitern, ohne zu blockieren.
        const { profil } = await mitFrist(nutzerProfil(user.email, user.uid), 8000, { profil: null })
        return cb({
          email: user.email,
          name: profil?.name || user.displayName || user.email,
          rolle: claim,
          userId: profil?.id || user.uid,
        })
      }
      const AUSFALL = { profil: null, leer: false, zeitueberschreitung: true }
      const gefunden = await mitFrist(nutzerProfil(user.email, user.uid), 8000, AUSFALL)
      if (gefunden.zeitueberschreitung) {
        // Die Rolle ist jetzt UNBEKANNT. Sie einfach auf 'mitarbeiter' zu
        // setzen, wäre falsch: das Büro landete stillschweigend in der
        // Monteur-Ansicht. Lieber ehrlich melden und neu laden lassen.
        return cb({ email: user.email, name: user.displayName || user.email, rolle: null, fehler: 'profil' })
      }
      cb({
        email: user.email,
        name: gefunden.profil?.name || user.displayName || user.email,
        rolle: rolleAus(gefunden),
        // Ohne eigenes Dokument gilt die Auth-UID – daran hängen die
        // Firestore-Regeln (eigene Berichte, eigene Spesen)
        userId: gefunden.profil?.id || user.uid,
      })
    })
  }).catch((e) => {
    // Firebase konnte gar nicht erst starten (Netz, Konfiguration, blockierte
    // Skripte). Ohne dieses catch bliebe das Ladebild ewig stehen.
    console.error('Anmeldung konnte nicht initialisiert werden:', e)
    cb({ rolle: null, fehler: 'start', meldung: e?.message || String(e) })
  })
  return () => unsub()
}
