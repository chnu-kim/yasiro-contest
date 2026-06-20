CREATE TABLE whack_scores (
  channel_id   TEXT    PRIMARY KEY,
  channel_name TEXT    NOT NULL,
  score        INTEGER NOT NULL,
  played_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
