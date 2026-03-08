CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_ton REAL NOT NULL,
  description TEXT NOT NULL,
  badge TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_user_id TEXT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  token_name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  logo_url TEXT,
  website TEXT,
  telegram_link TEXT,
  x_link TEXT,
  description TEXT NOT NULL,
  category TEXT,
  package_code TEXT NOT NULL,
  amount_ton REAL NOT NULL,
  payment_wallet TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  admin_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  visibility_score INTEGER NOT NULL DEFAULT 0,
  submitted_from TEXT NOT NULL DEFAULT 'telegram-mini-app',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_code) REFERENCES packages(code)
);

CREATE INDEX IF NOT EXISTS idx_listings_status_created_at ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_payment_status ON listings(payment_status);
CREATE INDEX IF NOT EXISTS idx_listings_package_code ON listings(package_code);

INSERT OR IGNORE INTO packages (code, name, price_ton, description, badge, sort_order)
VALUES
  ('standard', 'Standard Listing', 15, 'Appears in new listings after approval.', 'Starter', 1),
  ('featured', 'Featured Listing', 35, 'Priority placement on the homepage plus featured badge.', 'Featured', 2),
  ('boost', 'Trending Boost', 60, 'Homepage placement with higher visibility score for 7 days.', 'Boost', 3);
