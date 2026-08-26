/**
 * Ленивая загрузка, переживающая выкладку новой версии.
 *
 * Проблема настоящая и повторяемая. Страница у человека открыта со
 * старой сборки и ссылается на файл вроде `MatchCelebration-CFQvy2RR.js`.
 * Мы выкладываем новую версию — имена файлов меняются, старый исчезает.
 * Человек доходит до мэтча, браузер идёт за чанком, получает 404 —
 * и вместо празднования видит «Что-то сломалось».
 *
 * Ровно это и случилось: празднование мэтча не показалось никому,
 * потому что я выкладывал правки, пока люди играли.
 *
 * Лечится перезагрузкой: новая страница подтянет новые имена. Но
 * перезагружать можно только один раз — если файла нет по другой
 * причине, бесконечный цикл перезагрузок хуже честной ошибки.
 */

const RELOADED = 'mw:chunk-reloaded';

/**
 * @param {() => Promise<any>} load импорт модуля
 * @param {string} name имя для журнала — без него не понять, что упало
 */
export function retryChunk(load, name) {
  return () => load().catch((error) => {
    const stale = /import|dynamically imported|Failed to fetch|Loading chunk|module script/i
      .test(String(error?.message ?? ''));

    if (!stale) throw error;

    let already = false;
    try {
      already = sessionStorage.getItem(RELOADED) === '1';
      sessionStorage.setItem(RELOADED, '1');
    } catch {
      /*
       * Приватный режим и запрет на хранилище. Считаем, что уже
       * перезагружались: лучше показать ошибку, чем зациклить браузер.
       */
      already = true;
    }

    if (already) throw error;

    console.warn(`[chunk] ${name} не загрузился — перезагружаем страницу`);
    globalThis.location?.reload();

    // Промис намеренно не разрешается: страница уже уходит на перезагрузку,
    // и показывать что-либо в этот момент незачем.
    return new Promise(() => {});
  });
}

/** Сбрасывается при успешной загрузке приложения — иначе одна давняя
 *  неудача навсегда запретила бы перезагрузку в этой вкладке. */
export function clearChunkReload() {
  try {
    sessionStorage.removeItem(RELOADED);
  } catch {
    /* хранилище недоступно — и не нужно */
  }
}
