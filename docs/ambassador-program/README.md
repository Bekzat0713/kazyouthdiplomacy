# Амбассадорская программа KazYouthDiplomacy — проектная документация

Полный проект цифровой системы: сайт → Telegram-бот → админ-панель,
на базе существующей платформы (Express + PostgreSQL, Render).

| Документ | Содержимое | Пункты запроса |
|---|---|---|
| [01-architecture-roles.md](01-architecture-roles.md) | Структура продукта, компоненты, роли и права | 1, 4 |
| [02-data-model.md](02-data-model.md) | База данных: 14 таблиц с SQL | 3 |
| [03-bot-scenarios.md](03-bot-scenarios.md) | Сценарии бота: регистрация, миграция, задания, отчеты, QR | 2 |
| [04-admin-panel.md](04-admin-panel.md) | Админ-панель, распределение по потокам/командам, API | 5, 6 |
| [05-statuses-points-reporting.md](05-statuses-points-reporting.md) | Лестница статусов, баллы, антинакрутка, каденция отчетности | 7, 8, 9 |
| [06-mvp-tz.md](06-mvp-tz.md) | Границы MVP, структура кода, 8 этапов, критерии приемки | 10 |
| [07-bot-texts.md](07-bot-texts.md) | Тексты бота на русском и казахском | 11 |
| [08-site-page.md](08-site-page.md) | Страница «Стать амбассадором»: секции и тексты | 12 |
| [09-risks-metrics.md](09-risks-metrics.md) | Риски с митигацией, KPI программы | 13, 14 |

Статус: MVP реализован (2026-07-18). Код: `bot/` (grammY-бот), `routes/amb-admin.js`
(API панели), `lib/amb-*.js` (БД, права, баллы, cron), `public/ambassador.html`
(лендинг RU/KZ), `public/amb-admin.html` (панель). Запуск: раздел 6 в `DEPLOY.md`.
До запуска: создать бота у @BotFather, задать env-переменные, вычитать казахские
тексты (bot/i18n.js, public/ambassador.js) у носителя языка.
