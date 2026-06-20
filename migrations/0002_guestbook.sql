CREATE TABLE guestbook (
  id           TEXT    PRIMARY KEY,
  message      TEXT    NOT NULL,
  channel_id   TEXT    NOT NULL,
  channel_name TEXT    NOT NULL,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
