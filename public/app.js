const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const state = {
  packages: [],
  liveListings: [],
  adminListings: [],
  adminPassword: localStorage.getItem('spyton_admin_password') || '',
};

const els = {
  packages: document.getElementById('packages'),
  packageSelect: document.getElementById('packageSelect'),
  liveListings: document.getElementById('liveListings'),
  submitForm: document.getElementById('submitForm'),
  submitResult: document.getElementById('submitResult'),
  refreshBtn: document.getElementById('refreshBtn'),
  adminPassword: document.getElementById('adminPassword'),
  adminLoginBtn: document.getElementById('adminLoginBtn'),
  adminListings: document.getElementById('adminListings'),
};

els.adminPassword.value = state.adminPassword;

function showNotice(message, type = 'success') {
  els.submitResult.textContent = message;
  els.submitResult.className = `notice ${type}`;
}

function initHeaders(extra = {}) {
  const headers = { ...extra };
  if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
  if (state.adminPassword) headers['x-admin-password'] = state.adminPassword;
  return headers;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...initHeaders(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function renderPackages() {
  els.packages.innerHTML = '';
  els.packageSelect.innerHTML = '<option value="">Choose package</option>';

  state.packages.forEach((pkg) => {
    const card = document.createElement('div');
    card.className = 'package-card';
    card.innerHTML = `
      <strong>${pkg.name}</strong>
      <div class="meta">${pkg.price_ton} TON · ${pkg.badge || 'Package'}</div>
      <p class="small">${pkg.description}</p>
    `;
    els.packages.appendChild(card);

    const option = document.createElement('option');
    option.value = pkg.code;
    option.textContent = `${pkg.name} — ${pkg.price_ton} TON`;
    els.packageSelect.appendChild(option);
  });
}

function renderListings() {
  els.liveListings.innerHTML = '';
  if (!state.liveListings.length) {
    els.liveListings.innerHTML = '<div class="muted">No live listings yet. Approve one in the admin panel.</div>';
    return;
  }

  state.liveListings.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.innerHTML = `
      <div class="listing-head">
        ${item.logo_url ? `<img class="logo" src="${item.logo_url}" alt="${item.token_name} logo" />` : '<div class="logo"></div>'}
        <div>
          <strong>${item.token_name} <span class="muted">$${item.symbol}</span></strong>
          <div class="meta">${item.package_code} · visibility ${item.visibility_score}</div>
        </div>
      </div>
      <p class="small">${item.description}</p>
      <div class="meta">${item.contract_address}</div>
    `;
    els.liveListings.appendChild(card);
  });
}

function renderAdmin() {
  els.adminListings.innerHTML = '';
  if (!state.adminListings.length) {
    els.adminListings.innerHTML = '<div class="muted">Enter the admin password to load all submissions.</div>';
    return;
  }

  state.adminListings.forEach((item) => {
    const wrap = document.createElement('div');
    wrap.className = 'admin-card';
    wrap.innerHTML = `
      <strong>#${item.id} · ${item.token_name} ($${item.symbol})</strong>
      <div class="meta">Package: ${item.package_code} · Price: ${item.amount_ton} TON</div>
      <div class="meta">Payment: ${item.payment_status} · Status: ${item.status}</div>
      <div class="meta">TX: ${item.tx_hash || 'none'}</div>
      <p class="small">${item.description}</p>
      <div class="actions">
        <button data-action="approve" data-id="${item.id}">Approve</button>
        <button data-action="reject" data-id="${item.id}">Reject</button>
        <button data-action="confirm" data-id="${item.id}">Confirm payment</button>
      </div>
    `;
    els.adminListings.appendChild(wrap);
  });
}

async function loadPackages() {
  const data = await api('/api/packages');
  state.packages = data.packages || [];
  renderPackages();
}

async function loadLive() {
  const data = await api('/api/listings?status=live');
  state.liveListings = data.listings || [];
  renderListings();
}

async function loadAdmin() {
  if (!state.adminPassword) return renderAdmin();
  const data = await api('/api/admin/listings');
  state.adminListings = data.listings || [];
  renderAdmin();
}

els.submitForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(els.submitForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const data = await api('/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    showNotice(`Listing #${data.listing_id} created. Pay ${data.amount_ton} TON to ${data.payment_wallet} and approve it from admin.`, 'success');
    els.submitForm.reset();
    await Promise.all([loadLive(), loadAdmin()]);
  } catch (error) {
    showNotice(error.message, 'warn');
  }
});

els.refreshBtn.addEventListener('click', async () => {
  await Promise.all([loadPackages(), loadLive(), loadAdmin()]);
});

els.adminLoginBtn.addEventListener('click', async () => {
  state.adminPassword = els.adminPassword.value.trim();
  localStorage.setItem('spyton_admin_password', state.adminPassword);
  try {
    await loadAdmin();
  } catch (error) {
    els.adminListings.innerHTML = `<div class="notice warn">${error.message}</div>`;
  }
});

els.adminListings.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const payload = {
    approve: { status: 'live', payment_status: 'confirmed', admin_note: 'Approved from MVP panel' },
    reject: { status: 'rejected', payment_status: 'failed', admin_note: 'Rejected from MVP panel' },
    confirm: { status: 'pending', payment_status: 'confirmed', admin_note: 'Payment confirmed' },
  }[action];
  try {
    await api(`/api/admin/listings/${id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await Promise.all([loadLive(), loadAdmin()]);
  } catch (error) {
    alert(error.message);
  }
});

await Promise.all([loadPackages(), loadLive(), loadAdmin()]);
