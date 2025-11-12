// Small helper utilities for client-side encryption using Web Crypto API
// We use PBKDF2 to derive a symmetric AES-GCM key from a passphrase (shared secret between friends)

export async function deriveKeyFromPassphrase(passphrase: string, saltStr = 'turbo-salt') {
  const enc = new TextEncoder();
  const pass = enc.encode(passphrase);
  const salt = enc.encode(saltStr);
  const baseKey = await crypto.subtle.importKey('raw', pass, { name: 'PBKDF2' }, false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
}

export async function encryptWithKey(key: CryptoKey, plaintext: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  const ctArr = new Uint8Array(ct);
  // return base64 encoded iv + ciphertext
  const combined = new Uint8Array(iv.length + ctArr.length);
  combined.set(iv, 0);
  combined.set(ctArr, iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptWithKey(key: CryptoKey, dataB64: string) {
  try {
    const raw = atob(dataB64);
    const rawArr = new Uint8Array(raw.split('').map((c) => c.charCodeAt(0)));
    const iv = rawArr.slice(0, 12);
    const ct = rawArr.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct.buffer);
    const dec = new TextDecoder();
    return dec.decode(pt);
  } catch (e) {
    return null;
  }
}
