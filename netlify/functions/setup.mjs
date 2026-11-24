// Bir martalik sozlash (GET /api/setup): bot webhookini shu saytga ulaydi va menyu tugmasini qo'yadi.
// Manzil va kalit serverda hisoblanadi, shuning uchun uni qayta chaqirish xavfsiz.
import { json, tg, token, webhookSecret, siteUrl } from '../lib/tg.mjs';

export default async req => {
  if (!token()) return json({ ok: false, err: 'TELEGRAM_BOT_TOKEN Netlify sozlamalarida berilmagan' }, 500);
  const base = siteUrl(req);
  const a = await tg('setWebhook', {
    url: base + '/api/bot', secret_token: webhookSecret(), allowed_updates: ['message'], drop_pending_updates: true,
  });
  const b = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Odatlar', web_app: { url: base + '/' } } });
  const ok = !!(a.ok && b.ok);
  return json({
    ok,
    xabar: ok ? 'Bot ulandi ✓ Endi botga /start yuboring.' : 'Ulab boʻlmadi. Bot tokenini tekshiring.',
    webhook: a.description || '', menyu: b.description || '',
  }, ok ? 200 : 502);
};

export const config = { path: '/api/setup' };
