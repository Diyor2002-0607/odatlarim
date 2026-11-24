// Umumiy yordamchi funksiyalar: Telegram API, initData tekshiruvi, saqlash.
// Bot tokeni va admin chat ID faqat Netlify muhit o'zgaruvchilaridan olinadi.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import { getStore } from '@netlify/blobs';

export const token = () => (process.env.TELEGRAM_BOT_TOKEN || '').trim();
export const adminChat = () => (process.env.TELEGRAM_CHAT_ID || '').trim();

export const store = () => getStore({ name: 'odatlar', consistency: 'strong' });

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

// Telegram Mini App initData imzosini tekshirish.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const MAX_AGE = 7 * 24 * 3600; // soniya
export function checkInitData(initData) {
  const t = token();
  if (!t || typeof initData !== 'string' || !initData || initData.length > 4096) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  p.delete('hash');
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => k + '=' + v).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(t).digest();
  const calc = createHmac('sha256', secret).update(dcs).digest();
  if (!timingSafeEqual(calc, Buffer.from(hash, 'hex'))) return null;
  const at = Number(p.get('auth_date')) || 0;
  if (!at || Date.now() / 1000 - at > MAX_AGE) return null;
  try {
    const u = JSON.parse(p.get('user') || 'null');
    if (!u || !Number.isSafeInteger(u.id) || u.id <= 0) return null;
    return u;
  } catch {
    return null;
  }
}

// Telegram'ga bitta HTTPS so'rov. Faqat IPv4 ishlatiladi: Netlify (AWS Lambda) serverlarida
// IPv6 ulanishi osilib qolib, "vaqt tugadi" xatosiga olib kelishi mumkin.
function post(path, buf, type, ms) {
  return new Promise((resolve, reject) => {
    const rq = httpsRequest({
      host: 'api.telegram.org', path, method: 'POST', family: 4, timeout: ms,
      headers: { 'content-type': type, 'content-length': buf.length },
    }, res => {
      const parts = [];
      res.on('data', c => parts.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString('utf8') }));
      res.on('error', reject);
    });
    rq.on('timeout', () => rq.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError' })));
    rq.on('error', reject);
    rq.end(buf);
  });
}

// Telegram API chaqiruvi. Hech qachon xato tashlamaydi: muammo bo'lsa {ok:false, description} qaytaradi.
// Aloqa uzilsa bir marta qayta urinadi.
export async function tg(method, payload) {
  let buf, type;
  if (payload instanceof FormData) {
    const r = new Response(payload);
    buf = Buffer.from(await r.arrayBuffer());
    type = r.headers.get('content-type');
  } else {
    buf = Buffer.from(JSON.stringify(payload));
    type = 'application/json';
  }
  let last;
  for (const ms of [4000, 4500]) {
    try {
      const r = await post(`/bot${token()}/${method}`, buf, type, ms);
      try { return JSON.parse(r.text); }
      catch { return { ok: false, error_code: r.status, description: 'Telegram notoʻgʻri javob qaytardi (HTTP ' + r.status + ')' }; }
    } catch (e) { last = e; }
  }
  const timeout = last && last.name === 'TimeoutError';
  return { ok: false, description: timeout ? 'Telegram javob bermadi (vaqt tugadi)' : 'Telegram bilan aloqa yoʻq: ' + String((last && (last.code || last.message)) || last) };
}

// Har qanday kutilmagan xatoni ushlab, tushunarli JSON qaytaradi (Netlify xato sahifasi o'rniga).
export const safe = fn => async (req, ctx) => {
  try { return await fn(req, ctx); }
  catch (e) {
    console.error(e);
    return json({ ok: false, err: 'server xatosi: ' + String((e && e.message) || e).slice(0, 200) }, 500);
  }
};

export const sendText = (chat_id, text) => tg('sendMessage', { chat_id, text, disable_web_page_preview: true });

// Telegram xatosini foydalanuvchiga tushunarli matnga aylantirish.
export function tgErr(j) {
  const d = String((j && j.description) || '');
  if (/blocked|chat not found|bot can't initiate|user is deactivated/i.test(d))
    return 'bot sizga yoza olmaydi — botga /start yuboring';
  return 'Telegram xatosi';
}

// So'rov tanasini o'qish: hajm cheklovi va JSON tekshiruvi.
export async function readBody(req, maxBytes) {
  if (req.method !== 'POST') return { err: json({ ok: false, err: 'faqat POST' }, 405) };
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) return { err: json({ ok: false, err: 'maʼlumot juda katta' }, 413) };
  const txt = await req.text();
  if (!txt || txt.length > maxBytes) return { err: json({ ok: false, err: txt ? 'maʼlumot juda katta' : 'boʻsh soʻrov' }, txt ? 413 : 400) };
  let body;
  try { body = JSON.parse(txt); } catch { return { err: json({ ok: false, err: 'notoʻgʻri maʼlumot' }, 400) }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { err: json({ ok: false, err: 'notoʻgʻri maʼlumot' }, 400) };
  if (!token()) return { err: json({ ok: false, err: 'server sozlanmagan' }, 500) };
  const user = checkInitData(body.initData);
  if (!user) return { err: json({ ok: false, err: 'auth' }, 401) };
  return { body, user };
}

// Oddiy spam himoyasi: har bir foydalanuvchi va amal uchun daqiqasiga cheklov.
export async function rateLimit(uid, action, perMinute, minGapMs = 0) {
  const s = store(), key = `rl/${uid}/${action}`, now = Date.now();
  const r = (await s.get(key, { type: 'json' })) || { w: 0, n: 0, last: 0 };
  if (minGapMs && now - r.last < minGapMs) return false;
  const w = Math.floor(now / 60000);
  if (r.w !== w) { r.w = w; r.n = 0; }
  if (r.n >= perMinute) return false;
  r.n++; r.last = now;
  await s.setJSON(key, r);
  return true;
}

export const userKey = uid => `u/${uid}`;

// Webhook maxfiy kaliti bot tokenidan hosil qilinadi, alohida sozlash shart emas.
export const webhookSecret = () => createHash('sha256').update('odatlar-webhook:' + token()).digest('hex').slice(0, 48);

// Saytning asosiy manzili (Netlify URL o'zgaruvchisi), bo'lmasa so'rov manzili.
export const siteUrl = req => (process.env.URL || new URL(req.url).origin).replace(/\/+$/, '');
