/**
 * Линтер стоит здесь ради одной проверки — `no-undef`.
 *
 * Трижды подряд одна и та же ошибка доезжала до браузера: пропс
 * прокидывался в компонент, а использовался во вложенном, где его нет
 * в области видимости. Сборка при этом проходила — Rollup такие
 * обращения не считает ошибкой, — и приложение падало уже на экране.
 *
 * Остальные правила намеренно выключены: задача не причесать стиль,
 * а поймать обращение к тому, чего не существует.
 *
 * Чего он НЕ ловит: обращение к переменной до её инициализации внутри
 * одной области видимости. Правило no-use-before-define отличить такое
 * от «функция объявлена ниже по файлу» не умеет и заваливает проект
 * ложными срабатываниями. Этот класс ошибок ловится только запуском —
 * поэтому экраны проверяются в браузере, а не одной сборкой.
 */

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '.repowise/**'],
  },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    // Плагин подключён не ради правил, а чтобы существующие
    // eslint-disable-комментарии не считались ссылками в пустоту.
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      // JSX-компоненты считаются использованными.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',

      // Всё, что не про «этого не существует», — вне задачи этого линтера.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': 'off',
      'no-constant-condition': 'off',
    },
  },
];
