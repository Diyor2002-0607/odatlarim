// Har daqiqada ishlaydi: vaqti kelgan eslatmalarni har bir foydalanuvchining bot chatiga yuboradi.
import { store, sendText, token } from '../lib/tg.mjs';

const LATE = 15 * 60_000; // shu muddatdan kech qolgan eslatma yuborilmaydi (eski eslatmalar bilan spam bo'lmasin)

// Foydalanuvchining mahalliy vaqti: sana kaliti, hafta kuni (0 = dushanba) va "HH:MM".
function local(now, tz, off) {
  if (tz) {
    try {
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(now).map(x => [x.type, x.value]));
      const key = `${p.year}-${p.month}-${p.day}`;
      const wd = (new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay() + 6) % 7;
      return { key, wd, hm: `${p.hour}:${p.minute}` };
    } catch {}
  }
  const d = new Date(now + off * 60_000);
  const key = d.toISOString().slice(0, 10);
  return { key, wd: (d.getUTCDay() + 6) % 7, hm: d.toISOString().slice(11, 16) };
}

// Mahalliy "HH:MM" bugun qachon bo'lganini (ms) taxminan hisoblash.
function habitAt(now, hm, time) {
  const m = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  return now - (m(hm) - m(time)) * 60_000;
}

export function due(u, now) {
  const { data, sent } = u, out = [];
  const L = local(now, data.tz, data.off);
  for (const h of data.habits) {
    if (!h.days.includes(L.wd) || h.done.includes(L.key)) continue;
    const at = habitAt(now, L.hm, h.time);
    if (at > now || now - at > LATE) continue;
    out.push({ k: `h:${h.id}:${L.key}`, text: `⏰ Eslatma: ${h.name}\nBugun bajarishni unutmang.` });
  }
  for (const t of data.tasks) {
    if (t.at > now || now - t.at > LATE) continue;
    out.push({ k: `t:${t.id}:${t.at}`, text: `🔔 Qayd: ${t.title}` });
  }
  const tm = data.timer;
  if (tm && tm.at <= now && now - tm.at <= LATE) {
    out.push({
      k: `p:${tm.at}`,
      text: tm.phase === 'break' ? '☕ Tanaffus tugadi. Ishga qaytish vaqti.' : `🍅 Mashgʻulot tugadi${tm.name ? ': ' + tm.name : ''}. Natijani ilovada belgilang.`,
    });
  }
  return out.filter(x => !sent[x.k]);
}

export default async () => {
  if (!token()) return;
  const s = store(), now = Date.now();
  const { blobs } = await s.list({ prefix: 'u/' });
  for (const { key } of blobs) {
    let u;
    try { u = await s.get(key, { type: 'json' }); } catch { continue; }
    if (!u || !u.data) continue;
    const list = due(u, now);
    if (!list.length) continue;
    let gone = false;
    for (const m of list.slice(0, 10)) {
      const r = await sendText(u.chat, m.text).catch(() => ({}));
      if (r.ok || r.error_code === 400) u.sent[m.k] = now; // 400: qayta urinish foyda bermaydi
      if (r.error_code === 403) { gone = true; break; } // foydalanuvchi botni bloklagan
    }
    // Eski belgilarni tozalash (2 kundan eski).
    for (const k of Object.keys(u.sent)) if (now - u.sent[k] > 2 * 86400_000) delete u.sent[k];
    if (gone) await s.delete(key);
    else await s.setJSON(key, u);
  }
};

export const config = { schedule: '* * * * *' };
