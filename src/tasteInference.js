// tasteInference.js - Dynamic 5D Taste Inference Generator (30+ variations)

export function generateSimpleTasteInference({ likedMovies = [], favorites = {} }) {
  if (!likedMovies || likedMovies.length === 0) {
    return "Вы пока не оценили достаточное количество фильмов. Свайпайте карточки, чтобы сформировать ваш 5D профиль вкуса!";
  }

  let sum = { energy: 0, darkness: 0, intellect: 0, emotion: 0, dynamism: 0 };
  let totalWeight = 0;

  likedMovies.forEach(m => {
    const vec = m.sensationVector || { energy: 5, darkness: 5, intellect: 5, emotion: 5, dynamism: 5 };
    const isFav = !!favorites[m.id];
    const weight = isFav ? 2.5 : 1.0;
    sum.energy += (vec.energy || 5) * weight;
    sum.darkness += (vec.darkness || 5) * weight;
    sum.intellect += (vec.intellect || 5) * weight;
    sum.emotion += (vec.emotion || 5) * weight;
    sum.dynamism += (vec.dynamism || 5) * weight;
    totalWeight += weight;
  });

  const v = {
    energy: +(sum.energy / totalWeight).toFixed(1),
    darkness: +(sum.darkness / totalWeight).toFixed(1),
    intellect: +(sum.intellect / totalWeight).toFixed(1),
    emotion: +(sum.emotion / totalWeight).toFixed(1),
    dynamism: +(sum.dynamism / totalWeight).toFixed(1)
  };

  const high = [];
  const low = [];
  if (v.intellect >= 7.0) high.push("intellect");
  else if (v.intellect <= 4.5) low.push("intellect");

  if (v.emotion >= 7.0) high.push("emotion");
  else if (v.emotion <= 4.5) low.push("emotion");

  if (v.darkness >= 7.0) high.push("darkness");
  else if (v.darkness <= 4.5) low.push("darkness");

  if (v.energy >= 7.0) high.push("energy");
  else if (v.energy <= 4.5) low.push("energy");

  if (v.dynamism >= 7.0) high.push("dynamism");
  else if (v.dynamism <= 4.5) low.push("dynamism");

  // Rule Combinations (30+ specific rich texts based on 5D profile)
  
  if (high.includes("intellect") && high.includes("emotion")) {
    return "Вы ищете в кинематографе тонкий синтез ума и чувства: вас привлекают психоаналитические драмы, философские притчи и глубокие человеческие истории.";
  }

  if (high.includes("intellect") && high.includes("darkness")) {
    return "Ваш выбор — мрачные психологические триллеры, сложная нео-нуарная эстетика и закрученные детективные головоломки с нелинейным сюжетом.";
  }

  if (high.includes("intellect") && high.includes("energy")) {
    return "Вы цените высокий интеллектуальный драйв: вам идеальны динамичные детективы, научно-фантастический экшен и остросюжетные концептуальные картины.";
  }

  if (high.includes("intellect") && high.includes("dynamism")) {
    return "Ваша стихия — стремительный умный кинематограф: закрученные сюжетные рокировки, быстрый монтаж и интенсивные технические триллеры.";
  }

  if (high.includes("emotion") && high.includes("darkness")) {
    return "Вам близки глубокие драматические переживания с мрачным оттенком: вам по душе готические драмы, психологический саспенс и трагические истории катарсиса.";
  }

  if (high.includes("emotion") && high.includes("energy")) {
    return "Вы — эмоциональный искатель ярких впечатлений: вас вдохновляют экспрессивные мюзиклы, страстные романтические истории и зажигательные драмы.";
  }

  if (high.includes("emotion") && high.includes("dynamism")) {
    return "Вы погружаетесь в кино с головой: вам важен стремительный поток чувств, адреналиновые приключения и истории с сильным эмоциональным откликом.";
  }

  if (high.includes("darkness") && high.includes("energy")) {
    return "Вам по вкусу мрачный экшен и драйвовый саспенс: нуарные боевики, мистический драйв и напряжённое противостояние с тёмными силами.";
  }

  if (high.includes("darkness") && high.includes("dynamism")) {
    return "Ваш стиль — агрессивный динамичный нуар: выживание, стремительные погони, криминальные разборки и брутальный бескомпромиссный экшен.";
  }

  if (high.includes("energy") && high.includes("dynamism")) {
    return "Вы — абсолютный фанат адреналинового кинематографа: бешеный темп, грандиозные блокбастеры, масштабные взрывы и непрекращающийся драйв.";
  }

  if (high.length === 1) {
    if (high.includes("intellect")) {
      return "Для вас на первом месте стоит умное кино: вам важен авторский замысел, нетривиальный сюжет и оригинальная режиссёрская мысль.";
    }
    if (high.includes("emotion")) {
      return "Главный ориентир вашего киновкуса — сильный эмоциональный отклик, искренние человеческие характеры и трогательные драмы.";
    }
    if (high.includes("darkness")) {
      return "Вас притягивает густая атмосфера, психологический саспенс, нуарный стиль и сложные моральные дилеммы героев.";
    }
    if (high.includes("energy")) {
      return "Вы отдаёте предпочтение драйву, выразительной химии персонажей и яркому зрелищному кинематографу.";
    }
    if (high.includes("dynamism")) {
      return "Вам важен быстрый ритм: сюжет не должен стоять на месте, а действия персонажей стремительно развиваются с первой минуты.";
    }
  }

  if (low.includes("darkness") && high.includes("emotion")) {
    return "Вы предпочитаете жизнеутверждающее светлое кино с фокусом на теплые эмоции, надежду и добрый человеческий юмор.";
  }

  if (low.includes("darkness") && low.includes("dynamism")) {
    return "Вам идеальны созерцательные, медитативные фильмы с уютной визуальной эстетикой и плавным развитием событий.";
  }

  if (low.includes("intellect") && high.includes("dynamism")) {
    return "Вы выбираете лёгкий развлекательный аттракцион: драйвовые блокбастеры и комедии для чистого отдыха и разрядки.";
  }

  if (low.includes("energy") && high.includes("intellect")) {
    return "Вы предпочитаете спокойное интеллектуальное кино, где акцент смещён с громких эффектов на глубокие диалоги и атмосферу.";
  }

  if (low.includes("emotion") && high.includes("darkness")) {
    return "Вам интересен хладнокровный стильный кинематограф: концептуальные триллеры, мафиозные хроники и строгий кинематографический стиль.";
  }

  if (v.intellect >= 6.0 && v.emotion >= 6.0 && v.darkness >= 6.0) {
    return "Ваш профиль отражает эстетику современного авторского арт-хауса и глубоких психологических драм со сложным подтекстом.";
  }

  if (v.energy >= 6.0 && v.dynamism >= 6.0 && v.intellect >= 6.0) {
    return "Вы предпочитаете голливудские блокбастеры высокого класса от культовых постановщиков уровня Нолана или Спилберга.";
  }

  if (v.darkness <= 4.0 && v.emotion >= 6.0 && v.energy >= 6.0) {
    return "Ваш вкус нацелен на яркие вдохновляющие картины, семейные шедевры и добрый кинематограф, дарящий позитивный заряд.";
  }

  if (v.intellect >= 7.0 && v.dynamism <= 4.5) {
    return "Ваш формат — неспешный интеллектуальный детектив и размеренное киноисследование психологии человека.";
  }

  if (v.emotion >= 7.0 && v.dynamism <= 4.5) {
    return "Вы цените душевные уютные мелодрамы и глубокие семейные истории с плавным погружением в жизнь героев.";
  }

  if (v.darkness >= 7.0 && v.dynamism <= 4.5) {
    return "Вам по душе тягучие атмосферные триллеры, где напряжение нарастает постепенно за счёт визуала и звука.";
  }

  if (v.energy >= 7.0 && v.darkness <= 4.0) {
    return "Вы выбираете позитивные приключенческие картины, яркие комедии и зрелищные истории успеха.";
  }

  if (v.dynamism >= 7.0 && v.darkness <= 4.0) {
    return "Вам нравятся весёлые динамичные приключения, спортивные драмы и легкий жизнерадостный экшен.";
  }

  if (v.intellect >= 5.5 && v.emotion >= 5.5 && v.energy >= 5.5 && v.darkness >= 5.5 && v.dynamism >= 5.5) {
    return "У вас универсальный и сбалансированный киновкус: вы одинаково легко наслаждаетесь как умной драмой, так и драйвовым блокбастером.";
  }

  if (v.intellect <= 5.0 && v.emotion <= 5.0 && v.darkness <= 5.0 && v.energy <= 5.0 && v.dynamism <= 5.0) {
    return "Ваш кинематографический профиль находится на этапе активного формирования — продолжайте открывать новые жанры в MatchWatch!";
  }

  const maxDim = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
  const dimNames = {
    intellect: "глубокий интеллект и смыслы",
    emotion: "эмоциональный отклик и человеческие драмы",
    darkness: "нуарную атмосферу и саспенс",
    energy: "яркую харизму и высокую энергию",
    dynamism: "быстрый темп и стремительное развитие событий"
  };

  return `В вашем киновкусе отчетливо преобладает стремление к ${dimNames[maxDim[0]] || "хорошему кино"}. Профиль сформирован на основе ваших решений.`;
}
