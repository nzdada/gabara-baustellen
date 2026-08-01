// Anmeldung für die Verwaltung (und später die Mitarbeiter-App).
// Lokaler Modus: Demo-Zugänge (unten). Firebase-Modus: Firebase Authentication.
// Rollen: 'admin' (Büro, alles) | 'mitarbeiter' (Monteur, nur Zugewiesenes).
// Die Rolle kommt aus der users-Collection (Lookup per E-Mail); Fallback 'mitarbeiter'.

import { FIREBASE_CONFIG } from './firebase-config.js'
import { getStore } from './store.js'

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

// users-Doc nachschlagen -> {name, rolle, id} oder null.
// Bevorzugt wird das Dokument, dessen ID die Firebase-Auth-UID ist – nur so
// können die Firestore-Regeln die Rolle prüfen (siehe firestore.rules).
// Fallback: Suche über die E-Mail (Demo-/Bestandsdaten mit eigenen IDs).
async function nutzerProfil(email, uid = null) {
  try {
    const store = await getStore()
    const alle = await store.list('users')
    if (uid) {
      const perUid = alle.find((u) => u.id === uid)
      if (perUid) return perUid
    }
    return alle.find((u) => (u.email || '').toLowerCase() === (email || '').toLowerCase()) || null
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
    const profil = await nutzerProfil(nutzer.email)
    const session = {
      email: nutzer.email,
      name: profil?.name || nutzer.name,
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
  const profil = await nutzerProfil(cred.user.email, cred.user.uid)
  return {
    email: cred.user.email,
    name: profil?.name || cred.user.displayName || cred.user.email,
    rolle: profil?.rolle || 'mitarbeiter',
    userId: profil?.id || null,
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
    unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return cb(null)
      const profil = await nutzerProfil(user.email, user.uid)
      cb({
        email: user.email,
        name: profil?.name || user.displayName || user.email,
        rolle: profil?.rolle || 'mitarbeiter',
        userId: profil?.id || null,
      })
    })
  })
  return () => unsub()
}
