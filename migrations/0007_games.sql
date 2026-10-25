-- /games "플레이한 게임" 정본을 src/data/games.json에서 D1로 옮긴다. 데이터는 0008_games_seed.sql.
-- 수정자 표시 이름(updated_by_name, actor_name)은 채널 ID → 고정 별칭으로만 정한다(세션 channel_name을 쓰지 않음).
-- CHECK로 별칭 3개만 허용해 실명 문자열이 들어갈 수 없게 한다.
-- channel_id 컬럼은 감사용이다. API 응답·export·로그로 내보내지 않는다.

CREATE TABLE IF NOT EXISTS games (
  id                    TEXT    PRIMARY KEY,
  name                  TEXT    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  original_title        TEXT    CHECK (original_title IS NULL OR length(trim(original_title)) BETWEEN 1 AND 200),
  category_id           TEXT    UNIQUE CHECK (category_id IS NULL OR length(trim(category_id)) >= 1),
  poster_url            TEXT    CHECK (poster_url IS NULL OR poster_url LIKE 'https://%'),
  first_played          TEXT    CHECK (first_played IS NULL OR first_played GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status                TEXT    NOT NULL DEFAULT 'unknown' CHECK (status IN ('clear', 'fail', 'endless', 'unknown')),
  hidden                INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  -- 낙관적 잠금. 쓰기마다 +1
  version               INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  -- 마지막 쓰기 요청의 nonce. batch 안의 뒤따르는 문장이 "이 요청의 UPDATE가 실제로 적용됐는지"를 확인하는 데 쓴다
  write_token           TEXT,
  created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_by_channel_id TEXT,
  updated_by_name       TEXT    NOT NULL DEFAULT '시스템' CHECK (updated_by_name IN ('야시로', '관리자', '시스템'))
);

CREATE INDEX IF NOT EXISTS games_hidden_first_played ON games (hidden, first_played DESC);

CREATE TABLE IF NOT EXISTS game_vods (
  game_id  TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  video_id TEXT NOT NULL CHECK (length(video_id) = 11),
  url      TEXT NOT NULL CHECK (url LIKE 'https://%'),
  title    TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  date     TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  -- 같은 날짜 다시보기의 순서. 0부터, 게임 안에서 date 오름차순으로 정렬된 뒤의 위치. 조회는 ORDER BY date, position
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (game_id, video_id)
);

CREATE INDEX IF NOT EXISTS game_vods_game_order ON game_vods (game_id, date, position);

CREATE TABLE IF NOT EXISTS game_changes (
  id          TEXT    PRIMARY KEY,
  game_id     TEXT    NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  -- 감사용. 시드(import)는 NULL
  channel_id  TEXT,
  actor_name  TEXT    NOT NULL CHECK (actor_name IN ('야시로', '관리자', '시스템')),
  action      TEXT    NOT NULL CHECK (action IN ('import', 'create', 'update', 'hide', 'unhide')),
  summary     TEXT    NOT NULL CHECK (length(summary) BETWEEN 1 AND 300),
  -- GameSnapshot JSON. create·import는 NULL
  before_json TEXT,
  after_json  TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS game_changes_game_created ON game_changes (game_id, created_at DESC);
