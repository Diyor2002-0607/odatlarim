# odatlarim
odatlarni kuztish oson va tushanarli bolishi kerak 
bu mening odatlarimni kuzatish imkonini beruvchi ilova boladi

## Telegram eslatmalari (Netlify)

Ilova Telegram Mini App sifatida ochilganda barcha eslatmalar (odat vaqti, qaydlar, Pomidor taymeri)
har bir foydalanuvchining oʻz bot chatiga yuboriladi.

### Sozlash

1. Netlify → Site configuration → Environment variables boʻlimiga qoʻshing:
   - `TELEGRAM_BOT_TOKEN` — @BotFather bergan token (majburiy).
   - `TELEGRAM_CHAT_ID` — sizning chat ID raqamingiz (ixtiyoriy). Unga yangi foydalanuvchi ulanganda xabar keladi.
   Bu qiymatlar kodda saqlanmaydi.
2. Saytni qayta deploy qiling.
3. Brauzerda bir marta `https://SAYTINGIZ.netlify.app/api/setup` manzilini oching: bot webhooki va menyu tugmasi ulanadi.
4. Botga `/start` yuboring va ilovani tugma orqali oching.

### Server qismi

- `netlify/functions/sync.mjs` — `/api/sync`: eslatmalar roʻyxatini saqlaydi (Netlify Blobs).
- `netlify/functions/tick.mjs` — har daqiqada vaqti kelgan eslatmalarni yuboradi.
- `netlify/functions/test.mjs` — `/api/test`: sinov xabari.
- `netlify/functions/backup.mjs` — `/api/backup`: zaxira faylini chatga yuborish.
- `netlify/functions/bot.mjs` — `/api/bot`: `/start` buyrugʻiga javob.
- `netlify/functions/setup.mjs` — `/api/setup`: webhookni ulash.

Himoya: har bir soʻrovdagi Telegram `initData` imzosi bot tokeni bilan tekshiriladi, maʼlumot hajmi va
matn uzunligi cheklangan, har bir foydalanuvchi uchun daqiqasiga soʻrovlar soni cheklangan.
