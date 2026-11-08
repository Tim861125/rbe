CREATE TABLE IF NOT EXISTS groups (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_key TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO groups (key, name, count) VALUES
  ('taipei','台北',0),('zhongli','中壢',0),('hsinchu','新竹',0),('taichung','台中',0)
ON CONFLICT(key) DO NOTHING;
