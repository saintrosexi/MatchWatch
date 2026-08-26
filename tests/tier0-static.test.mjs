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
