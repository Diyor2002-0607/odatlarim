// Sozlamalardagi «sinov xabarini yuborish» tugmasi (POST /api/test).
import { json, readBody, rateLimit, sendText, tgErr, safe } from '../lib/tg.mjs';

export default safe(async req => {
  const { user, err } = await readBody(req, 8_000);
  if (err) return err;
  if (!(await rateLimit(user.id, 'test', 3, 20_000))) return json({ ok: false, err: 'biroz kutib, qayta urining' }, 429);
  const r = await sendText(user.id, 'Sinov xabari ✓ Eslatmalar shu chatga keladi.');
  return r.ok ? json({ ok: true }) : json({ ok: false, err: tgErr(r) }, 502);
});

export const config = { path: '/api/test' };
