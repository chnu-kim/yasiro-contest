-- 서버 세션 저장소. 원본 세션 ID는 쿠키(__Host-session)에만 있고 DB에는 SHA-256 해시만 둔다.
-- 치지직 토큰은 로그인 직후 폐기하므로 저장하지 않는다(토큰 컬럼 없음).
-- 기존 sessions(0001)는 롤백 대비로 남긴다. 코드가 더 이상 읽지 않게 된 뒤 별도 마이그레이션으로 DROP한다.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id_hash      TEXT    PRIMARY KEY,  -- SHA-256(세션 ID) 소문자 hex 64자
  channel_id   TEXT    NOT NULL,
  channel_name TEXT    NOT NULL,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_channel_id ON auth_sessions (channel_id);
