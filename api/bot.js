// Vercel Serverless Function for Telegram Bot Webhook
// Handles /start command, registers user via Firebase REST API, and sends welcome message with Mini App WebApp Profile button

const FIREBASE_DB_URL = "https://match-watch-f9eec-default-rtdb.firebaseio.com";

async function getTelegramUserAvatarUrl(botToken, userId) {
  if (!botToken || !userId) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.ok && data.result && data.result.total_count > 0 && data.result.photos.length > 0) {
      const photos = data.result.photos[0];
      const largestPhoto = photos[photos.length - 1];
      const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${largestPhoto.file_id}`);
      if (!fileRes.ok) return null;
      const fileData = await fileRes.json();
      if (fileData.ok && fileData.result && fileData.result.file_path) {
        return `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
      }
    }
  } catch (e) {
    console.error("Avatar fetch error:", e);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'MatchWatch Telegram Bot API is running' });
  }

  try {
    const body = req.body;
    if (!body || !body.message) {
      return res.status(200).send('OK');
    }

    const message = body.message;
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const from = message.from || {};
    const firstName = from.first_name || from.username || 'Друг';
    const lastName = from.last_name || '';
    const username = from.username || '';
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.REACT_APP_TELEGRAM_BOT_TOKEN;

    const webAppUrl = 'https://match-watch-zeta.vercel.app';

    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const startParam = parts[1] || '';

      const photoUrl = await getTelegramUserAvatarUrl(botToken, from.id);

      const tgUserData = {
        status: 'approved',
        tgId: from.id,
        firstName,
        lastName,
        username,
        name: [firstName, lastName].filter(Boolean).join(' ') || username || 'Пользователь',
        photoUrl: photoUrl || null,
        avatar: photoUrl || '✈️',
        updatedAt: Date.now()
      };

      // Write user profile to Firebase DB using startParam token OR direct tgId token
      const tokensToSave = [startParam, `tg_user_${from.id}`].filter(Boolean);
      for (const token of tokensToSave) {
        try {
          await fetch(`${FIREBASE_DB_URL}/authTokens/${token}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tgUserData)
          });
        } catch (e) {
          console.error("Firebase REST authTokens error:", e);
        }
      }

      const welcomeText = `🍿 *Добро пожаловать в MatchWatch, ${firstName}!*\n\n` +
        `✅ *Ваш аккаунт Telegram успешно авторизован на сайте!*\n\n` +
        `Здесь вы можете подбирать фильмы и сериалы соло или вместе со своей второй половинкой на основе взаимных лайков.\n\n` +
        `👇 *Нажмите кнопку ниже, чтобы войти в свой профиль:*`;

      const payload = {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎬 Открыть мой профиль',
                web_app: { url: `${webAppUrl}?screen=profile` }
              }
            ],
            [
              {
                text: '🔥 Начать подбор фильмов',
                web_app: { url: webAppUrl }
              }
            ]
          ]
        }
      };

      if (botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Telegram bot webhook error:', error);
    return res.status(200).send('OK');
  }
}
