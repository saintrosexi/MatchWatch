// Vercel Serverless Function for Telegram Bot Webhook
// Handles /start command, registers user via Firebase REST API, and sends welcome message with Mini App WebApp Profile button

const FIREBASE_DB_URL = "https://match-watch-f9eec-default-rtdb.firebaseio.com";

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

      const tgUserData = {
        status: 'approved',
        tgId: from.id,
        firstName,
        lastName,
        username,
        name: [firstName, lastName].filter(Boolean).join(' ') || username || 'Пользователь',
        photoUrl: null,
        updatedAt: Date.now()
      };

      // If startParam exists (e.g., login token login_xxxxxx or room code), write to Firebase Realtime Database via REST API
      if (startParam) {
        try {
          await fetch(`${FIREBASE_DB_URL}/authTokens/${startParam}.json`, {
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
