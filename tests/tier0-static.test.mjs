/**
 * Уровень 0 — статические проверки.
 *
 * Ловит то, что не ловит ни сборка, ни остальные тесты: обращение
 * к переменной, которой в этой области видимости нет. Три раза подряд
 * ошибка была одна и та же — пропс прокидывали в компонент, а брали
 * во вложенном, — и каждый раз она доезжала до экрана пользователя,
 * потому что Rollup такие обращения ошибкой не считает.
 *
 * Тест намеренно стоит уровнем ниже остальных: если код ссылается
 * на несуществующее, проверять его поведение уже бессмысленно.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const TARGETS = ['src', 'shared', 'api', 'tests'];

/** Правила, нарушение которых означает «этот код упадёт при запуске». */
const FATAL = new Set(['no-undef', 'no-dupe-keys', 'no-dupe-args', 'no-unreachable',
  'no-const-assign', 'no-obj-calls', 'no-self-assign', 'no-func-assign']);

test('S1 · в коде нет обращений к несуществующим переменным', async () => {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(TARGETS);

  const fatal = [];
  for (const file of results) {
    for (const message of file.messages) {
      if (!FATAL.has(message.ruleId)) continue;
      fatal.push(`${file.filePath.replace(process.cwd() + '/', '')}:${message.line} `
        + `— ${message.message} (${message.ruleId})`);
    }
  }

  assert.deepEqual(fatal, [],
    `код ссылается на то, чего нет:\n  ${fatal.join('\n  ')}`);
});

/**
 * Разбор JSX ломается тихо: файл с синтаксической ошибкой линтер
 * пропустит с сообщением, а сборка упадёт лишь при импорте этого файла.
 */
test('S2 · все файлы разбираются без синтаксических ошибок', async () => {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(TARGETS);

  const broken = results
    .filter((file) => file.fatalErrorCount > 0)
    .map((file) => file.filePath.replace(process.cwd() + '/', ''));

  assert.deepEqual(broken, [], `не разбираются: ${broken.join(', ')}`);
});

/**
 * В Telegram WebView системные диалоги заблокированы: `window.confirm`
 * молча возвращает false, `alert` и `prompt` не показываются вовсе.
 * Кнопка «Удалить комнату» из-за этого выглядела живой и не делала
 * ничего — снаружи неотличимо от сломанной вёрстки.
 */
test('S3 · интерфейс не полагается на системные диалоги браузера', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

  const offenders = walk('src')
    .filter((f) => f.endsWith('.js') || f.endsWith('.jsx'))
    .flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .map((line, i) => ({ file, line: i + 1, text: line }))
      .filter(({ text }) => /\b(window\.)?(confirm|alert|prompt)\s*\(/.test(text)
        && !text.trimStart().startsWith('*')
        && !text.trimStart().startsWith('//'))
      .map(({ file, line }) => `${file}:${line}`));

  assert.deepEqual(offenders, [],
    `системный диалог вместо своей шторки:\n  ${offenders.join('\n  ')}`);
});

/**
 * `describeError` возвращает объект `{ text, retryable }`.
 *
 * Отданный в текстовую позицию разметки, он роняет весь экран: React
 * не умеет рисовать объект и уходит в границу ошибки. Сборка это
 * пропускает, а на экране выходит «что-то сломалось» без подсказки.
 *
 * Проверка нарочно узкая — только прямая вставка в разметку. Класть
 * объект в состояние и отдавать его в `ErrorState`, который знает эту
 * форму, совершенно законно, и запрещать это значило бы шуметь на
 * работающем коде.
 */
test('S4 · объект ошибки не вставляется в разметку напрямую', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

  const offenders = walk('src')
    .filter((f) => f.endsWith('.jsx'))
    .flatMap((file) => readFileSync(file, 'utf8').split('\n')
      .map((text, i) => ({ file, line: i + 1, text }))
      .filter(({ text }) => /[>{]\s*\{\s*describeError\([^)]*\)\s*\}/.test(text))
      .map(({ file, line }) => `${file}:${line}`));

  assert.deepEqual(offenders, [],
    `объект ошибки уходит в разметку целиком:\n  ${offenders.join('\n  ')}`);
});
