// Telegram webhook (POST /api/bot): /start buyrug'iga javob beradi va ilovani ochish tugmasini yuboradi.
// Soxta so'rovlardan himoya: webhook o'rnatilganda secret_token sifatida bot tokenidan olingan xesh beriladi.
import { tg, token, webhookSecret, siteUrl, safe } from '../lib/tg.mjs';

export default safe(async req => {
  if (req.method !== 'POST' || !token()) return new Response('', { status: 404 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) return new Response('', { status: 403 });
  let up;
  try { up = await req.json(); } catch { return new Response('ok'); }
  const m = up && up.message;
  if (!m || !m.chat || m.chat.type !== 'private' || typeof m.text !== 'string') return new Response('ok');

  if (/^\/start\b/.test(m.text)) {
    const url = siteUrl(req) + '/';
    await tg('sendMessage', {
      chat_id: m.chat.id,
      text: 'Assalomu alaykum! Bu «Odatlar» boti.\n\nIlovani quyidagi tugma orqali oching. Odat yoki qayd uchun eslatma vaqtini belgilasangiz, vaqti kelganda shu chatga xabar keladi.',
      reply_markup: { inline_keyboard: [[{ text: 'Ilovani ochish', web_app: { url } }]] },
    });
  } else {
    await tg('sendMessage', { chat_id: m.chat.id, text: 'Ilovani ochish uchun /start yuboring.' });
  }
  return new Response('ok');
});

export const config = { path: '/api/bot' };
