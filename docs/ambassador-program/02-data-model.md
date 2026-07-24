# Амбассадорская программа — Модель данных

Версия: 1.0 (MVP) · СУБД: PostgreSQL (общая база с Career GPS) · Префикс: `amb_`

Стиль совпадает с существующим server.js: `SERIAL PRIMARY KEY`, `TEXT`,
`TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, миграции через `IF NOT EXISTS`.
Перечисления храним как TEXT + CHECK — так же дешево, но читаемо в админке.

## ER-схема (основные связи)

```
users (Career GPS) ◄──── (0..1) amb_profiles ────► amb_streams ────► coordinator (amb_profiles)
                                    │  │  │              │
                                    │  │  └────────► amb_teams ────► teamlead (amb_profiles)
                                    │  │
                                    │  └── amb_profile_tracks ──► amb_tracks (справочник 11 шт.)
                                    │
        ┌───────────────┬───────────┼──────────────┬────────────────┬──────────────┐
        ▼               ▼           ▼              ▼                ▼              ▼
amb_applications  amb_task_    amb_points_   amb_weekly_    amb_event_      amb_status_
 (заявка+вводное   assignments  ledger        reports        attendance      history
  задание)             ▲        (баллы)                          ▲
                       │                                         │
                   amb_tasks (задания)                      amb_events
```

## Таблицы

### 1. `amb_profiles` — профиль амбассадора (центральная таблица)

```sql
CREATE TABLE IF NOT EXISTS amb_profiles (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,        -- первичная идентичность
  telegram_username TEXT,
  user_id INTEGER REFERENCES users(id),      -- связь с Career GPS (опционально)
  ambassador_number INTEGER UNIQUE,          -- => "KYD-0248"; присваивается при приеме
  language TEXT NOT NULL DEFAULT 'ru'
    CHECK (language IN ('kz','ru')),

  first_name TEXT,
  last_name TEXT,
  birth_date DATE,
  city TEXT,
  phone TEXT,                                -- из Telegram-контакта
  email TEXT,
  study_or_work TEXT,                        -- место учебы/работы
  speciality TEXT,
  education_level TEXT,                      -- school / bachelor / master / phd / other
  languages TEXT,                            -- свободный ввод: "каз, рус, англ B2"
  skills TEXT,
  volunteer_experience TEXT,
  project_experience TEXT,
  motivation TEXT,
  availability TEXT,                         -- часов в неделю: '1-3','4-6','7+'
  social_links TEXT,

  program_role TEXT NOT NULL DEFAULT 'candidate'
    CHECK (program_role IN ('candidate','trainee','ambassador','active',
                            'senior','teamlead','coordinator','alumni')),
  activity_status TEXT NOT NULL DEFAULT 'active'
    CHECK (activity_status IN ('active','probation','needs_support',
                               'unresponsive','recommended_promotion',
                               'suspended','reserve')),
  stream_id INTEGER,                         -- FK на amb_streams (добавляется после)
  team_id INTEGER,                           -- FK на amb_teams

  is_minor BOOLEAN DEFAULT false,            -- вычисляется по birth_date при анкете
  guardian_contact TEXT,                     -- контакт законного представителя
  consents JSONB DEFAULT '{}',               -- {pdn: ts, rules: ts, code: ts, mailing: ts, guardian: ts}

  source TEXT,                               -- site / whatsapp / instagram / friend / other
  onboarding_passed_at TIMESTAMP,            -- вводное обучение пройдено
  trainee_until DATE,                        -- конец 30-дневного испытательного
  joined_at TIMESTAMP,                       -- дата приема в программу
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS amb_profiles_team_idx ON amb_profiles (team_id);
CREATE INDEX IF NOT EXISTS amb_profiles_stream_idx ON amb_profiles (stream_id);
```

Баланс баллов НЕ хранится в профиле — всегда `SUM` по `amb_points_ledger`
(единственный источник правды, невозможно рассинхронизировать).

### 2. `amb_streams` — управленческие потоки (4 шт.)

```sql
CREATE TABLE IF NOT EXISTS amb_streams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                        -- "Поток A" / имя координатора
  coordinator_id INTEGER REFERENCES amb_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. `amb_teams` — команды тимлидов (по 5 на поток)

```sql
CREATE TABLE IF NOT EXISTS amb_teams (
  id SERIAL PRIMARY KEY,
  stream_id INTEGER NOT NULL REFERENCES amb_streams(id),
  name TEXT NOT NULL,
  teamlead_id INTEGER REFERENCES amb_profiles(id),
  capacity INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Инвариант (проверяется в коде): `amb_profiles.stream_id` всегда равен
`stream_id` команды, в которую входит участник.

### 4. `amb_tracks` — справочник профессиональных направлений (11 шт.)

```sql
CREATE TABLE IF NOT EXISTS amb_tracks (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                 -- 'diplomacy','gov','business','media',
                                             -- 'events','education','social','volunteer',
                                             -- 'career_hr','it','technical'
  name_ru TEXT NOT NULL,
  name_kz TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);
```

### 5. `amb_profile_tracks` — выбор направлений (1 основное + до 2 доп.)

```sql
CREATE TABLE IF NOT EXISTS amb_profile_tracks (
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES amb_tracks(id),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (profile_id, track_id)
);
-- ровно одно основное направление на человека:
CREATE UNIQUE INDEX IF NOT EXISTS amb_profile_tracks_one_primary
  ON amb_profile_tracks (profile_id) WHERE is_primary;
-- лимит "не более 3 всего" проверяется в коде при записи.
```

### 6. `amb_applications` — заявки кандидатов и верификация действующих

```sql
CREATE TABLE IF NOT EXISTS amb_applications (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
  kind TEXT NOT NULL DEFAULT 'new'
    CHECK (kind IN ('new','migration')),     -- новичок / верификация из 370
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','in_review','needs_revision',
                      'interview','accepted','reserve','rejected')),

  intro_task_type TEXT                       -- video / event_idea / post / problem / quiz
    CHECK (intro_task_type IS NULL OR intro_task_type IN
           ('video','event_idea','post','problem','quiz')),
  intro_task_content TEXT,                   -- текст ответа или file_id Telegram
  intro_task_file_id TEXT,                   -- Telegram file_id (видео/фото) — файлы
                                             -- не скачиваем, храним ссылку на TG
  quiz_score INTEGER,                        -- для мини-теста (миграция)

  reviewer_id INTEGER REFERENCES users(id),  -- кто рассматривает (аккаунт сайта)
  internal_notes TEXT,                       -- внутренние комментарии
  decision_reason TEXT,                      -- причина решения (уходит кандидату)

  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS amb_applications_status_idx ON amb_applications (status);
```

Анкетные ответы пишутся сразу в `amb_profiles` (заявка ссылается на профиль) —
не дублируем данные; история изменений при доработке не нужна в MVP.

### 7. `amb_tasks` — задания

```sql
CREATE TABLE IF NOT EXISTS amb_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('media','org','research','career','partner','other')),
  track_id INTEGER REFERENCES amb_tracks(id),      -- тематическое направление (опц.)

  audience TEXT NOT NULL DEFAULT 'all'             -- кому видно
    CHECK (audience IN ('all','stream','team','track')),
  audience_id INTEGER,                             -- id потока/команды/трека

  points_min INTEGER NOT NULL DEFAULT 5,
  points_max INTEGER NOT NULL DEFAULT 5,           -- проверяющий ставит в диапазоне
  deadline TIMESTAMP,
  max_participants INTEGER,                        -- лимит; NULL = без лимита
  report_format TEXT NOT NULL DEFAULT 'text'
    CHECK (report_format IN ('text','photo','file','link','none')),
  expected_result TEXT,

  created_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft','open','closed','archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 8. `amb_task_assignments` — взятые задания и отчеты по ним

```sql
CREATE TABLE IF NOT EXISTS amb_task_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES amb_tasks(id),
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
  status TEXT NOT NULL DEFAULT 'taken'
    CHECK (status IN ('taken','submitted','approved','rejected','expired','cancelled')),

  report_text TEXT,
  report_file_id TEXT,                       -- Telegram file_id
  report_link TEXT,

  points_awarded INTEGER,                    -- итог проверки (в диапазоне задания)
  reviewed_by INTEGER REFERENCES users(id),
  review_comment TEXT,                       -- причина отклонения / похвала

  taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  UNIQUE (task_id, profile_id)               -- одно задание нельзя взять дважды
);
CREATE INDEX IF NOT EXISTS amb_assignments_review_queue
  ON amb_task_assignments (status) WHERE status = 'submitted';
```

### 9. `amb_points_ledger` — журнал баллов (append-only)

```sql
CREATE TABLE IF NOT EXISTS amb_points_ledger (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
  delta INTEGER NOT NULL,                    -- + начисление / − списание
  reason TEXT NOT NULL,                      -- человекочитаемо, показывается в боте
  source_type TEXT NOT NULL
    CHECK (source_type IN ('task','event','weekly_streak','onboarding',
                           'mentoring','initiative','manual','penalty')),
  source_id INTEGER,                         -- id задания/мероприятия/отчета
  awarded_by INTEGER REFERENCES users(id),   -- NULL = автоматика
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS amb_points_profile_idx ON amb_points_ledger (profile_id);
```

Правила: записи не редактируются и не удаляются; исправление — компенсирующая
запись. Штраф за ложную отчетность = `source_type 'penalty'`, отрицательный delta.

### 10. `amb_weekly_reports` — еженедельные отчеты

```sql
CREATE TABLE IF NOT EXISTS amb_weekly_reports (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
  week_start DATE NOT NULL,                  -- понедельник недели
  answers JSONB NOT NULL DEFAULT '{}',       -- {done, events, skills, help, next_week}
  needs_help BOOLEAN DEFAULT false,
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (profile_id, week_start)
);
```

### 11. `amb_events` — мероприятия

```sql
CREATE TABLE IF NOT EXISTS amb_events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP NOT NULL,
  location TEXT,
  points INTEGER NOT NULL DEFAULT 5,
  audience TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all','stream','team','track')),
  audience_id INTEGER,
  qr_token TEXT UNIQUE,                      -- секрет для QR-подтверждения
  registration_open BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 12. `amb_event_attendance` — регистрация и подтверждение участия

```sql
CREATE TABLE IF NOT EXISTS amb_event_attendance (
  event_id INTEGER NOT NULL REFERENCES amb_events(id),
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attended BOOLEAN DEFAULT false,
  confirmed_via TEXT CHECK (confirmed_via IS NULL OR confirmed_via IN ('qr','manual')),
  confirmed_by INTEGER REFERENCES users(id), -- при manual
  confirmed_at TIMESTAMP,
  PRIMARY KEY (event_id, profile_id)
);
```

QR-механика: на площадке показывается QR со ссылкой
`t.me/<bot>?start=ev_<qr_token>` — участник сканирует, бот отмечает
`attended = true, confirmed_via = 'qr'` и начисляет баллы в ledger.

### 13. `amb_status_history` — история статусов и ролей (аудит)

```sql
CREATE TABLE IF NOT EXISTS amb_status_history (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES amb_profiles(id),
  field TEXT NOT NULL
    CHECK (field IN ('program_role','activity_status','stream','team')),
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_by INTEGER REFERENCES users(id),   -- NULL = автоматика/cron
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 14. `amb_bot_states` — состояние диалога бота (FSM)

```sql
CREATE TABLE IF NOT EXISTS amb_bot_states (
  telegram_id BIGINT PRIMARY KEY,
  state TEXT NOT NULL,                       -- 'reg:ask_name', 'weekly:q2', ...
  payload JSONB NOT NULL DEFAULT '{}',       -- накопленные ответы текущего сценария
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Хранится в БД, чтобы анкета переживала рестарты сервера на Render.

## Ключевые бизнес-правила на уровне данных

1. **Баллы — только через ledger**, баланс всегда вычисляется. Ручные операции
   требуют `awarded_by` и `reason`.
2. **Одна команда — один поток** (инвариант в коде при переводе участника,
   с записью в `amb_status_history`).
3. **Треки:** ровно 1 primary (уникальный индекс), суммарно ≤ 3 (проверка в коде).
4. **Файлы не скачиваем** — храним Telegram `file_id` (видео-визитки, фото
   отчетов). Это решает проблему эфемерного диска Render без раздувания БД
   (текущий подход base64-в-БД для больших видео не подойдет).
5. **Повышение до teamlead/coordinator** меняет `program_role` и одновременно
   назначение в `amb_teams.teamlead_id` / `amb_streams.coordinator_id` — одной
   транзакцией.
6. Старая таблица `ambassadors` (email/name/region) остается нетронутой до
   запуска, потом данные при желании импортируются в `amb_profiles` как лиды.

## Объемы (оценка на 400+ участников)

Все таблицы — тысячи–десятки тысяч строк в год (400 чел × 52 отчета = ~21 тыс.
строк/год в самой активной таблице). Бесплатного/минимального тарифа PostgreSQL
на Render хватает с большим запасом. Индексов выше достаточно.
