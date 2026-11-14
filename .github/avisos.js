// Recordatorios de clase desde GitHub (Gestión Deportiva, 31/10/2026). Lo ejecuta la tarea programada .github/workflows/avisos.yml.
// avisos.json lo sube el programa al publicar, cifrado; el secreto AVISOS (en el repositorio) tiene la clave para abrirlo y la
// clave para firmar los avisos. Cada aviso lleva su hora (de Madrid); la tarea corre cada media hora y manda los que tocan.
const c = require("crypto"), fs = require("fs");
const B = s => Buffer.from(s, "base64url");
const [vp, kf] = (process.env.AVISOS || "").split(".");
if (!vp || !kf) { console.log("Falta el secreto AVISOS en el repositorio (Settings → Secrets and variables → Actions)."); process.exit(1); }
const forzar = process.env.FORZAR === "1" || process.env.FORZAR === "true";

let P;
try {
  const e = JSON.parse(fs.readFileSync("avisos.json", "utf8")); const ct = B(e.ct);
  const d = c.createDecipheriv("aes-256-gcm", B(kf), B(e.iv)); d.setAuthTag(ct.subarray(ct.length - 16));
  P = JSON.parse(Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]).toString("utf8"));
} catch (x) { console.log("No se puede abrir avisos.json (¿el secreto AVISOS es el que copiaste del programa?): " + x.message); process.exit(1); }

// hora de Madrid ahora, como «yyyy-mm-dd hh:mm» y en minutos (para comparar con la hora de cada aviso)
const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map(x => [x.type, x.value]));
const minutos = s => { const [d, h] = s.split(" "); const [y, m, dd] = d.split("-").map(Number); const [hh, mi] = h.split(":").map(Number); return Date.UTC(y, m - 1, dd, hh, mi) / 60000; };
const ahora = minutos(p.year + "-" + p.month + "-" + p.day + " " + p.hour + ":" + p.minute);
// la tarea corre cada media hora: manda lo que tocaba en la última media hora (si GitHub se retrasa un poco, también)
const toca = P.l.filter(x => { const m = minutos(x.w); return m <= ahora && m > ahora - 30; });
const ec = c.createECDH("prime256v1"); ec.setPrivateKey(B(vp)); const pub = ec.getPublicKey();
const clave = c.createPrivateKey({ key: { kty: "EC", crv: "P-256", d: vp, x: pub.subarray(1, 33).toString("base64url"), y: pub.subarray(33).toString("base64url") }, format: "jwk" });
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
function vapid(ep) {
  const cab = b64({ typ: "JWT", alg: "ES256" }), cue = b64({ aud: new URL(ep).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: P.sub });
  const firma = c.sign("sha256", Buffer.from(cab + "." + cue), { key: clave, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return "vapid t=" + cab + "." + cue + "." + firma + ", k=" + pub.toString("base64url");
}
function cifrar(txt, p256dh, auth) {   // RFC 8291 (aes128gcm)
  const ua = B(p256dh), as = c.createECDH("prime256v1"); as.generateKeys(); const asPub = as.getPublicKey(), sec = as.computeSecret(ua);
  const hm = (k, d) => c.createHmac("sha256", k).update(d).digest();
  const ikm = hm(hm(B(auth), sec), Buffer.concat([Buffer.from("WebPush: info\0"), ua, asPub, Buffer.from([1])]));
  const sal = c.randomBytes(16), prk = hm(sal, ikm);
  const cek = hm(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16), n = hm(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const ci = c.createCipheriv("aes-128-gcm", cek, n);
  const cuerpo = Buffer.concat([ci.update(Buffer.concat([Buffer.from(txt, "utf8"), Buffer.from([2])])), ci.final(), ci.getAuthTag()]);
  const cab = Buffer.alloc(21); sal.copy(cab, 0); cab.writeUInt32BE(4096, 16); cab[20] = 65;
  return Buffer.concat([cab, asPub, cuerpo]);
}
async function mandar(s, json) {
  try {
    const r = await fetch(s.e, { method: "POST", headers: { TTL: "43200", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Urgency: "high", Authorization: vapid(s.e) }, body: cifrar(json, s.p, s.a) });
    if (r.status < 300) return true; console.log("El servicio de avisos contesta " + r.status + (r.status === 404 || r.status === 410 ? " (ese móvil ya no los recibe)" : "")); return false;
  } catch (x) { console.log("Fallo al mandar: " + x.message); return false; }
}
(async () => {
  let ok = 0, mal = 0;
  for (const x of toca) for (const s of x.s) (await mandar(s, x.j)) ? ok++ : mal++;
  if (forzar) {
    const prox = P.l.filter(x => minutos(x.w) > ahora).sort((a, b) => minutos(a.w) - minutos(b.w));
    const txt = prox.length ? "El próximo sale el " + prox[0].w.slice(8, 10) + "/" + prox[0].w.slice(5, 7) + " a las " + prox[0].w.slice(11) + " (hay " + prox.length + " preparados)." : "No hay recordatorios preparados.";
    for (const s of P.adm || []) await mandar(s, JSON.stringify({ t: "Prueba desde GitHub", b: "Los recordatorios funcionan. " + txt, tag: "prueba" }));
  }
  console.log("Hora de Madrid " + p.hour + ":" + p.minute + ": " + ok + " enviados" + (mal ? ", " + mal + " fallidos" : "") + ".");
})();
