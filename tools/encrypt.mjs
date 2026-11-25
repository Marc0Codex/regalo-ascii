// Cifra el wav con AES-256-GCM. Escribe assets/song.bin y src/k.js (clave ofuscada).
import { webcrypto as c } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const wav = readFileSync(process.argv[2]);
const key = c.getRandomValues(new Uint8Array(32));
const iv = c.getRandomValues(new Uint8Array(12));
const k = await c.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt']);
const ct = new Uint8Array(await c.subtle.encrypt({ name: 'AES-GCM', iv }, k, wav));
writeFileSync('assets/song.bin', Buffer.concat([iv, ct]));
const mask = c.getRandomValues(new Uint8Array(32));
const a = [...key].map((b, i) => b ^ mask[i]);
writeFileSync('src/k.js', `export const A=${JSON.stringify(a)};export const B=${JSON.stringify([...mask])};\n`);
console.log('ok', ct.length);
