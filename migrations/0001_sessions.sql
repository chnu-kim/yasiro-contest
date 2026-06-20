CREATE TABLE sessions (
  id          TEXT    PRIMARY KEY,
  channel_id  TEXT    NOT NULL,
  channel_name TEXT   NOT NULL,
  access_token TEXT   NOT NULL,
  refresh_token TEXT  NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
