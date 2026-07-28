// Vercel Serverless Function for Telegram Bot Webhook
// Handles /start command and sends welcome message with Mini App WebApp Profile button

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
    const text = message.text || '';
    const from = message.from || {};
    const firstName = from.first_name || from.username || 'Друг';
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.REACT_APP_TELEGRAM_BOT_TOKEN;

    const webAppUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://match-watch-zeta.vercel.app';

    if (text.startsWith('/start')) {
      const welcomeText = `🍿 *Добро пожаловать в MatchWatch, ${firstName}!*\n\n` +
        `Ваш аккаунт Telegram успешно авторизован! ✨\n\n` +
        `Здесь вы можете легко подбирать фильмы и сериалы соло или вместе со своей второй половинкой на основе взаимных лайков.\n\n` +
        `👇 Нажмите кнопку ниже, чтобы открыть ваш профиль:`;

      const payload = {
        chat_id: chatId,
        text: welcomeText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🎬 Открыть MatchWatch (Мой профиль)',
                web_app: { url: `${webAppUrl}?screen=profile` }
              }
            ],
            [
              {
                text: '🔥 Начать выбирать фильмы',
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
