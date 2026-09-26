# Aitu Dating

Интерактивный прототип Aitu Dating на mock-данных: закрытое verified-сообщество знакомств через разговоры, посты и безопасные планы встреч один на один. Приложение на Expo (iOS, Android, web-preview).

- Спека фундамента и тикеты: GitHub Issues этого репозитория (спека — #1).
- Глоссарий: [`CONTEXT.md`](CONTEXT.md). Архитектурные решения: [`docs/adr/`](docs/adr).

## Что установить один раз

|                | Windows                            | macOS                                              | Linux                                                  |
| -------------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| Git            | `winget install Git.Git`           | `brew install git` или Xcode Command Line Tools    | пакет `git` вашего дистрибутива                        |
| Node.js 22 LTS | `winget install OpenJS.NodeJS.LTS` | `brew install node@22` или установщик с nodejs.org | [nvm](https://github.com/nvm-sh/nvm): `nvm install 22` |

После установки Node включите pnpm (он идёт вместе с Node через corepack):

```bash
corepack enable
```

На Windows команду запускайте в терминале, открытом от имени администратора, если без этого она выдаёт ошибку доступа.

Для просмотра на телефоне поставьте **Expo Go** из App Store или Google Play. Нужна свежая версия: Expo Go открывает только последнюю версию Expo SDK (у нас SDK 57). Если телефон пишет, что SDK несовместим, обновите Expo Go.

## Первый запуск

```bash
git clone https://github.com/kuanyshs/aitu_dating.git
cd aitu_dating
git checkout claude/sweet-hypatia-gwvlba
pnpm install
```

### В браузере

```bash
pnpm web
```

Откроется `http://localhost:8081`. Чтобы увидеть вид телефона, включите в браузере режим устройства (DevTools → Toggle device toolbar, например iPhone 12/13 — 390×844). Тёмная тема включается вместе с тёмной темой системы.

### На телефоне

```bash
pnpm start
```

В терминале появится QR-код. Телефон и компьютер должны быть в одной Wi-Fi сети.

- iPhone: отсканируйте QR камерой.
- Android: отсканируйте QR в приложении Expo Go.

Если телефон не подключается (другая сеть, корпоративный Wi-Fi), запустите `pnpm start --tunnel`.

## Демо-панель

В приложении есть «Профиль → Настройки → Demo controls»: сменить личность Aitu Passport, истечь и восстановить membership, поставить и снять ограничение, включить роль модератора, вызвать одну ошибку сети, включить режим offline, сбросить демо. Панель включена флагом `EXPO_PUBLIC_DEMO_TOOLS=1` в файле `.env`. В production-сборке флаг нужно выключить (`.env.production` с `EXPO_PUBLIC_DEMO_TOOLS=0`), тогда код панели не попадает в сборку.

Состояние демо и выбранная тема сохраняются между перезапусками (в браузере — в localStorage).

## Как обновиться

```bash
git pull
pnpm install
pnpm web
```

## Команды для разработки

| Команда                   | Что делает                                 |
| ------------------------- | ------------------------------------------ |
| `pnpm web` / `pnpm start` | dev-сервер для браузера / для Expo Go      |
| `pnpm check`              | проверка типов TypeScript                  |
| `pnpm lint`               | ESLint и проверка форматирования           |
| `pnpm format`             | отформатировать код                        |
| `pnpm test`               | unit-тесты (Vitest)                        |
| `pnpm build:web`          | статическая web-сборка в `dist/`           |
| `pnpm e2e`                | Playwright-тесты по готовой сборке `dist/` |
| `pnpm e2e:full`           | сборка + Playwright-тесты                  |

Перед первым `pnpm e2e` на своём компьютере установите браузер: `pnpm exec playwright install chromium`.

## Структура

```
src/contracts/      Zod-контракт всего продукта, без зависимостей от React Native
src/catalogs/       ключи справочников и русские подписи к ним
src/clock/          внедряемые часы (seed-время, таймзона Asia/Almaty)
src/storage/        хранилище с версиями ключей и миграциями
src/repository/     mock-репозиторий: seed, урезание данных по ролям, демо-флаги
src/data/           хуки TanStack Query поверх репозитория
src/app/            маршруты Expo Router (5 вкладок в (tabs)/, модальные экраны рядом)
src/features/       части экранов: access flow, ограничение
src/ui/             токены тем, компоненты, tab bar, тексты (strings.ts)
src/demo/           демо-панель (только при EXPO_PUBLIC_DEMO_TOOLS=1)
e2e/                Playwright-тесты
```

## Контракт

Контракт заморожен до backend-интеграции. `src/contracts/repository.ts` — интерфейс `AituRepository`: все методы продукта. `src/contracts/registry.ts` — те же методы как данные: схема входа и ответа для каждого. Backend реализует ровно это; OpenAPI позже генерируется из реестра.

Ошибки приходят в едином формате `ApiError` (`code`, `message`, `fieldErrors`, `requestId`). Методы, поведение которых появится в следующих спеках, mock уже содержит: они отвечают ошибкой `NOT_IMPLEMENTED`, а не молчат. Тест `src/repository/mock/registry.contract.test.ts` проверяет, что каждый метод отвечает либо данными по схеме, либо типизированной ошибкой.

Правила кода: цвета только через токены темы (`src/ui/theme/palette.ts`), тексты интерфейса только из `src/ui/strings.ts`. Оба правила проверяет `pnpm lint`.
