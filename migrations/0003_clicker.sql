CREATE TABLE clicks (
  id    TEXT    PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO clicks (id, count) VALUES ('global', 0);
