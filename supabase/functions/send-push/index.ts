import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VAPID-Schlüssel (Public Key muss mit dem in app.js übereinstimmen)
const VAPID_PUBLIC  = 'BPp1ZDfFrJXJ9dIq4H4_2or4nRdTCere6_EchSDS7hn40zUaWpiuDH1SDT1YBL7OTkkdX4ZdGIjOgq-NQu-jsfg'
const VAPID_SUBJECT = 'mailto:admin@chormanager.de'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { title, body, url, badgeCount } = await req.json()

    // Service-Role-Key → umgeht RLS, liest alle Subscriptions
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: subs, error: dbErr } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (dbErr) throw new Error('DB-Fehler: ' + dbErr.message)
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'Keine Subscriptions in DB' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!VAPID_PRIVATE) throw new Error('VAPID_PRIVATE_KEY fehlt in Environment-Variablen')

    const payload = JSON.stringify({ title, body, url: url || '/', badgeCount: badgeCount || 1 })
    const results: { endpoint: string; success: boolean; error?: string }[] = []

    for (const sub of subs) {
      try {
        await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, VAPID_PRIVATE)
        results.push({ endpoint: sub.endpoint, success: true })
      } catch (e) {
        results.push({ endpoint: sub.endpoint, success: false, error: String(e) })
      }
    }

    const sent = results.filter(r => r.success).length
    return new Response(JSON.stringify({ sent, total: subs.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('send-push error:', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ===== Web Push / VAPID Signierung =====
async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPrivateKey: string
) {
  const audience = new URL(sub.endpoint).origin

  // VAPID JWT bauen
  const header  = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims  = b64url(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: VAPID_SUBJECT }))
  const unsigned = `${header}.${claims}`

  const privKey  = await importVapidPrivateKey(vapidPrivateKey)
  const sigBytes = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privKey, te(unsigned))
  const jwt = `${unsigned}.${b64urlBuf(sigBytes)}`

  // Inhalt verschlüsseln (RFC 8291 aes128gcm)
  const encrypted = await encryptPayload(sub, payload)

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: encrypted,
  })

  if (!res.ok && res.status !== 201) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Push endpoint ${res.status}: ${txt.slice(0, 200)}`)
  }
}

// ===== Hilfsfunktionen =====
const te = (s: string) => new TextEncoder().encode(s)
const b64url = (s: string) => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const b64urlBuf = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  bytes.forEach(b => s += String.fromCharCode(b))
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
const fromB64url = (s: string) => {
  const b64 = s.replace(/-/g,'+').replace(/_/g,'/')
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf
}

async function importVapidPrivateKey(b64: string) {
  const raw = fromB64url(b64)
  return crypto.subtle.importKey('pkcs8', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

async function encryptPayload(sub: { p256dh: string; auth: string }, payload: string) {
  const plaintext   = te(payload)
  const authSecret  = fromB64url(sub.auth)
  const receiverPub = fromB64url(sub.p256dh)

  const senderKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const senderPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', (senderKeys as CryptoKeyPair).publicKey))

  const receiverKey = await crypto.subtle.importKey('raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedBits  = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, (senderKeys as CryptoKeyPair).privateKey, 256))

  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF: pseudorandom key
  const ikm    = await hkdf(authSecret, concat(sharedBits, new Uint8Array(1)), concat(te('Content-Encoding: auth\0'), new Uint8Array(1)), 32)
  const keyInfo = concat(te('Content-Encoding: aes128gcm\0'), new Uint8Array(1))
  const nonceInfo = concat(te('Content-Encoding: nonce\0'), new Uint8Array(1))
  const cek   = await hkdf(salt, ikm, keyInfo, 16)
  const nonce = await hkdf(salt, ikm, nonceInfo, 12)

  const aesKey  = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const padded  = concat(plaintext, new Uint8Array([2])) // padding delimiter
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded))

  // aes128gcm record: salt(16) + rs(4) + keyid_len(1) + sender_pub(65) + ciphertext
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([65]), senderPubRaw, encrypted)
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key    = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits'])
  const bits   = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

function concat(...arrays: Uint8Array[]) {
  const total = arrays.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}
