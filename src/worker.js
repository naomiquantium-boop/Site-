const json = (data, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-headers', 'content-type, x-admin-password, x-telegram-init-data');
  headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
  return new Response(JSON.stringify(data), { ...init, headers });
};

const PACKAGE_VISIBILITY = {
  standard: 10,
  featured: 25,
  boost: 50,
};

function sanitizeText(value, max = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function sanitizeUrl(value) {
  const text = sanitizeText(value, 300);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
  } catch {}
  return '';
}

function parseTelegramUser(rawHeader) {
  if (!rawHeader) return {};
  try {
    const params = new URLSearchParams(rawHeader);
    const userRaw = params.get('user');
    if (!userRaw) return {};
    const user = JSON.parse(userRaw);
    return {
      telegram_user_id: user.id ? String(user.id) : null,
      telegram_username: user.username || null,
      telegram_first_name: user.first_name || null,
    };
  } catch {
    return {};
  }
}

async function requireAdmin(request, env) {
  const supplied = request.headers.get('x-admin-password') || '';
  const expected = env.ADMIN_PASSWORD || '';
  return Boolean(expected && supplied && supplied === expected);
}

async function listPackages(env) {
  const { results } = await env.DB.prepare(
    `SELECT code, name, price_ton, description, badge, sort_order
     FROM packages
     WHERE is_active = 1
     ORDER BY sort_order ASC`
  ).all();
  return results;
}

async function listListings(env, status = 'live') {
  const stmt = env.DB.prepare(
    `SELECT id, token_name, symbol, contract_address, logo_url, website, telegram_link,
            x_link, description, category, package_code, amount_ton, payment_status,
            tx_hash, admin_note, status, visibility_score, created_at, updated_at
     FROM listings
     WHERE status = ?
     ORDER BY visibility_score DESC, id DESC
     LIMIT 100`
  );
  const { results } = await stmt.bind(status).all();
  return results;
}

async function getListing(env, id) {
  return await env.DB.prepare(
    `SELECT * FROM listings WHERE id = ? LIMIT 1`
  ).bind(id).first();
}

async function handleSubmit(request, env) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body.' }, { status: 400 });

  const token_name = sanitizeText(body.token_name, 80);
  const symbol = sanitizeText(body.symbol, 30).toUpperCase();
  const contract_address = sanitizeText(body.contract_address, 120);
  const description = sanitizeText(body.description, 500);
  const category = sanitizeText(body.category, 40);
  const package_code = sanitizeText(body.package_code, 20).toLowerCase();
  const tx_hash = sanitizeText(body.tx_hash, 120);

  if (!token_name || !symbol || !contract_address || !description || !package_code) {
    return json({ error: 'token_name, symbol, contract_address, description and package_code are required.' }, { status: 400 });
  }

  const pkg = await env.DB.prepare(
    `SELECT code, name, price_ton FROM packages WHERE code = ? AND is_active = 1 LIMIT 1`
  ).bind(package_code).first();

  if (!pkg) return json({ error: 'Unknown package selected.' }, { status: 400 });

  const tg = parseTelegramUser(request.headers.get('x-telegram-init-data'));

  const result = await env.DB.prepare(
    `INSERT INTO listings (
      telegram_user_id, telegram_username, telegram_first_name,
      token_name, symbol, contract_address, logo_url, website, telegram_link, x_link,
      description, category, package_code, amount_ton, payment_wallet,
      payment_status, tx_hash, status, visibility_score, submitted_from
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tg.telegram_user_id || null,
    tg.telegram_username || null,
    tg.telegram_first_name || null,
    token_name,
    symbol,
    contract_address,
    sanitizeUrl(body.logo_url),
    sanitizeUrl(body.website),
    sanitizeUrl(body.telegram_link),
    sanitizeUrl(body.x_link),
    description,
    category,
    pkg.code,
    pkg.price_ton,
    env.PAYMENT_WALLET,
    tx_hash ? 'submitted' : 'pending',
    tx_hash || null,
    tx_hash ? 'pending' : 'draft',
    PACKAGE_VISIBILITY[pkg.code] || 10,
    'telegram-mini-app'
  ).run();

  return json({
    ok: true,
    listing_id: result.meta.last_row_id,
    package: pkg,
    payment_wallet: env.PAYMENT_WALLET,
    amount_ton: pkg.price_ton,
    next_step: tx_hash
      ? 'Admin review pending. Confirm payment and approve the listing from the admin panel.'
      : 'Ask the project to pay the listed amount and then update the submission with a tx hash in production.'
  }, { status: 201 });
}

async function handleAdminStatus(request, env, id) {
  const isAdmin = await requireAdmin(request, env);
  if (!isAdmin) return json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await getListing(env, id);
  if (!existing) return json({ error: 'Listing not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body.' }, { status: 400 });

  const status = sanitizeText(body.status, 20).toLowerCase();
  const payment_status = sanitizeText(body.payment_status, 20).toLowerCase();
  const admin_note = sanitizeText(body.admin_note, 200);

  const allowedStatus = new Set(['draft', 'pending', 'live', 'rejected']);
  const allowedPayment = new Set(['pending', 'submitted', 'confirmed', 'failed']);

  if (!allowedStatus.has(status) || !allowedPayment.has(payment_status)) {
    return json({ error: 'Invalid status or payment_status value.' }, { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE listings
     SET status = ?, payment_status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(status, payment_status, admin_note || null, id).run();

  const updated = await getListing(env, id);
  return json({ ok: true, listing: updated });
}

async function router(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-admin-password, x-telegram-init-data',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    }});
  }

  if (url.pathname === '/api/health') {
    return json({ ok: true, app: env.APP_NAME || 'SpyTON Listings' });
  }

  if (url.pathname === '/api/packages' && request.method === 'GET') {
    return json({ packages: await listPackages(env) });
  }

  if (url.pathname === '/api/listings' && request.method === 'GET') {
    const status = sanitizeText(url.searchParams.get('status') || 'live', 20).toLowerCase();
    return json({ listings: await listListings(env, status) });
  }

  if (url.pathname.startsWith('/api/listings/') && request.method === 'GET') {
    const id = Number(url.pathname.split('/').pop());
    if (!Number.isFinite(id)) return json({ error: 'Invalid listing id.' }, { status: 400 });
    const listing = await getListing(env, id);
    if (!listing) return json({ error: 'Listing not found.' }, { status: 404 });
    return json({ listing });
  }

  if (url.pathname === '/api/submit' && request.method === 'POST') {
    return handleSubmit(request, env);
  }

  if (url.pathname === '/api/admin/listings' && request.method === 'GET') {
    const isAdmin = await requireAdmin(request, env);
    if (!isAdmin) return json({ error: 'Unauthorized' }, { status: 401 });
    const { results } = await env.DB.prepare(
      `SELECT * FROM listings ORDER BY id DESC LIMIT 200`
    ).all();
    return json({ listings: results });
  }

  if (url.pathname.match(/^\/api\/admin\/listings\/\d+\/status$/) && request.method === 'POST') {
    const id = Number(url.pathname.split('/')[4]);
    return handleAdminStatus(request, env, id);
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    try {
      return await router(request, env);
    } catch (error) {
      return json({ error: error?.message || 'Unexpected server error.' }, { status: 500 });
    }
  },
};
