// Bir martalik sozlash (GET /api/setup): bot webhookini shu saytga ulaydi va menyu tugmasini qo'yadi.
// Manzil va kalit serverda hisoblanadi, shuning uchun uni qayta chaqirish xavfsiz.
import { json, tg, token, webhookSecret, siteUrl, safe } from '../lib/tg.mjs';

// Telegram javobini oddiy o'zbekcha tushuntirishga aylantirish.
function why(j) {
  if (j.ok) return '';
  const d = String(j.description || '');
  const wait = (j.parameters && j.parameters.retry_after) || (d.match(/retry after (\d+)/i) || [])[1];
  if (j.error_code === 429 || wait) return `Telegram juda koʻp soʻrov deb hisobladi. ${wait || 30} soniya kutib, sahifani bir marta qayta oching.`;
  if (j.error_code === 401 || j.error_code === 404 || /unauthorized|not found/i.test(d))
    return 'Bot tokeni notoʻgʻri. Netlify’dagi TELEGRAM_BOT_TOKEN qiymatini @BotFather bergan token bilan solishtiring va saytni qayta deploy qiling.';
  return d || 'nomaʼlum xato';
}

export default safe(async req => {
  if (!token()) return json({ ok: false, xabar: 'TELEGRAM_BOT_TOKEN Netlify sozlamalarida topilmadi. Uni qoʻshib, saytni qayta deploy qiling.' }, 500);
  const base = siteUrl(req);
  // Ikkala so'rov parallel yuboriladi, shunda Netlify'ning 10 soniyalik chegarasiga sig'adi.
  const [a, b] = await Promise.all([
    tg('setWebhook', { url: base + '/api/bot', secret_token: webhookSecret(), allowed_updates: ['message'], drop_pending_updates: true }),
    tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Odatlar', web_app: { url: base + '/' } } }),
  ]);
  if (!a.ok) return json({ ok: false, xabar: 'Ulab boʻlmadi. ' + why(a) }, 502);
  if (!b.ok) return json({ ok: false, xabar: 'Webhook ulandi, lekin menyu tugmasi qoʻyilmadi. ' + why(b) }, 502);
  return json({ ok: true, xabar: 'Bot ulandi ✓ Endi botga /start yuboring.', sayt: base });
});

export const config = { path: '/api/setup' };
