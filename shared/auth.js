// Anmeldung für die Admin-Konsole.
// Lokaler Modus: Demo-Zugänge (unten). Firebase-Modus: Firebase Authentication.

import { FIREBASE_CONFIG } from './firebase-config.js'
import { getStore } from './store.js'

export const DEMO_ZUGAENGE = [
  { email: 'empfang@praxis-demo.de', passwort: 'demo2026', name: 'Empfang (Demo)', rolle: 'empfang' },
  { email: 'arzt@praxis-demo.de', passwort: 'demo2026', name: 'Dr. Strötz (Demo)', rolle: 'arzt' },
]

const SESSION_KEY = 'praxis-admin-session'
const listener = new Set()

function aktuelleLokaleSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export async function anmelden(email, passwort) {
  if (!FIREBASE_CONFIG.enabled) {
    const nutzer = DEMO_ZUGAENGE.find(
      (z) => z.email.toLowerCase() === email.trim().toLowerCase() && z.passwort === passwort
    )
    if (!nutzer) throw new Error('E-Mail oder Passwort falsch.')
    const session = { email: nutzer.email, name: nutzer.name, rolle: nutzer.rolle }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    listener.forEach((cb) => cb(session))
    return session
  }
  const store = await getStore()
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth')
  const auth = getAuth(store.app)
  const cred = await signInWithEmailAndPassword(auth, email.trim(), passwort)
  return { email: cred.user.email, name: cred.user.displayName || cred.user.email, rolle: 'team' }
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

// Meldet den aktuellen Anmeldestatus (sofort + bei jeder Änderung)
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
    unsub = onAuthStateChanged(auth, (user) => {
      cb(user ? { email: user.email, name: user.displayName || user.email, rolle: 'team' } : null)
    })
  })
  return () => unsub()
}
