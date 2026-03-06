(function () {
  function normalizeApiBase(value) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
  }

  function resolveApiBase() {
    const params = new URLSearchParams(window.location.search);
    const apiHostOverride = normalizeApiBase(params.get('apiHost'));
    if (apiHostOverride) return apiHostOverride;

    const fromMeta = normalizeApiBase(document.querySelector('meta[name="lido-api-base"]')?.content || '');
    if (fromMeta) return fromMeta;

    const fromWindow = normalizeApiBase(window.LIDO_API_BASE);
    if (fromWindow) return fromWindow;

    const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
    if (isLocalHost) return 'http://localhost:3000';

    return 'https://api.isolalido.it';
  }

  function formatEuroFromCents(cents) {
    const value = Number(cents || 0) / 100;
    return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatDateOnly(value) {
    if (!value) return '—';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleString('it-IT');
  }

  function compactId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    if (raw.length <= 22) return escapeHtml(raw);
    return `${escapeHtml(raw.slice(0, 12))}...${escapeHtml(raw.slice(-8))}`;
  }

  function statusBadge(value, mode = 'neutral') {
    const raw = String(value || '').trim();
    if (!raw) return '<span class="status-badge status-badge--neutral">n/d</span>';
    let tone = mode;
    if (mode === 'payment') tone = raw.toLowerCase() === 'paid' ? 'success' : 'warn';
    if (mode === 'booking') {
      if (raw.toLowerCase() === 'active') tone = 'info';
      else if (raw.toLowerCase() === 'cancelled') tone = 'danger';
      else tone = 'neutral';
    }
    if (mode === 'donation') tone = 'warn';
    return `<span class="status-badge status-badge--${tone}">${escapeHtml(raw)}</span>`;
  }

  async function loadBookings(e) {
    if (e) e.preventDefault();

    const API_BASE = resolveApiBase();
    const key = document.getElementById('adminKey')?.value?.trim() || '';
    const date = document.getElementById('adminDate')?.value || '';
    const status = document.getElementById('adminStatus')?.value || '';
    const sortBy = document.getElementById('adminSort')?.value || 'newest';

    const rows = document.getElementById('bookingListRows');
    const message = document.getElementById('bookingListMessage');
    const donationRows = document.getElementById('donationListRows');
    const donationMessage = document.getElementById('donationListMessage');
    if (!rows || !message) return;

    rows.innerHTML = '';
    message.textContent = 'Caricamento prenotazioni...';
    if (donationRows) donationRows.innerHTML = '';
    if (donationMessage) donationMessage.textContent = 'Caricamento donazioni...';

    const params = new URLSearchParams();
    params.set('limit', '200');
    params.set('sortBy', sortBy);
    if (date) params.set('date', date);
    if (status) params.set('status', status);

    try {
      const headers = {};
      if (key) headers['x-admin-key'] = key;

      const [listRes, statsRes, donationsRes, donationStatsRes] = await Promise.all([
        fetch(`${API_BASE}/api/booking/lista?${params.toString()}`, { headers }),
        fetch(`${API_BASE}/api/booking/stats${date ? `?date=${encodeURIComponent(date)}` : ''}`, { headers }),
        fetch(`${API_BASE}/api/booking/donazioni?${params.toString()}`, { headers }),
        fetch(`${API_BASE}/api/booking/donazioni-stats${date ? `?date=${encodeURIComponent(date)}` : ''}`, { headers })
      ]);

      if (!listRes.ok) {
        const payload = await listRes.json().catch(() => ({}));
        throw new Error(payload.error || `Errore API (${listRes.status})`);
      }

      const list = await listRes.json();
      const items = Array.isArray(list.items) ? list.items : [];
      const donationList = donationsRes.ok ? await donationsRes.json() : { items: [] };
      const donationItems = Array.isArray(donationList.items) ? donationList.items : [];

      if (statsRes && statsRes.ok) {
        const stats = await statsRes.json();
        setText('statsBookings', String(stats.bookings || 0));
        setText('statsTables', `${stats.tablesBooked || 0} / 110`);
        setText('statsChairs', `${stats.chairsBooked || 0} / 65`);
        setText('statsUmbrellas', `${stats.umbrellasBooked || 0} / 65`);
        setText('statsAmount', formatEuroFromCents(stats.totalAmount || 0));
        setText('statsScope', date ? `Riepilogo data ${date}` : 'Riepilogo totale generale');
      } else {
        setText('statsBookings', '-');
        setText('statsTables', '-');
        setText('statsChairs', '-');
        setText('statsUmbrellas', '-');
        setText('statsAmount', '-');
        setText('statsScope', 'Riepilogo non disponibile');
      }

      if (donationStatsRes.ok) {
        const donationStats = await donationStatsRes.json();
        setText('donationCount', String(donationStats.donations || 0));
        setText('donationAmount', formatEuroFromCents(donationStats.totalAmount || 0));
      } else {
        setText('donationCount', '-');
        setText('donationAmount', '-');
      }

      if (!items.length) {
        message.textContent = 'Nessuna prenotazione trovata con i filtri attuali.';
      } else {
        message.textContent = `${items.length} ${items.length === 1 ? 'prenotazione trovata' : 'prenotazioni trovate'}.`;
        const html = items.map((b) => {
          const notes = String(b.notes || '').trim();
          return `
            <tr>
              <td class="nowrap">${formatDateOnly(b.date)}</td>
              <td>${escapeHtml(b.name || '—')}</td>
              <td>${escapeHtml(b.email || '—')}</td>
              <td class="nowrap">${escapeHtml(b.phone || '—')}</td>
              <td class="center">${Number(b.tables || 0)}</td>
              <td class="center">${Number(b.chairs || 0)}</td>
              <td class="center">${Number(b.umbrellas || 0)}</td>
              <td class="nowrap">${formatEuroFromCents(b.amount || 0)}</td>
              <td>${statusBadge(b.paymentStatus || 'paid', 'payment')}</td>
              <td>${statusBadge(b.status || 'active', 'booking')}</td>
              <td><code class="id-pill" title="${escapeHtml(b.bookingId || '')}">${compactId(b.bookingId)}</code></td>
              <td><code class="id-pill" title="${escapeHtml(b.paymentId || '')}">${compactId(b.paymentId)}</code></td>
              <td>${notes ? escapeHtml(notes) : '<span class="muted">Nessuna nota</span>'}</td>
            </tr>
          `;
        }).join('');
        rows.innerHTML = html;
      }

      if (donationRows && donationMessage) {
        if (!donationItems.length) {
          donationMessage.textContent = 'Nessuna donazione trovata con i filtri attuali.';
        } else {
          donationMessage.textContent = `${donationItems.length} ${donationItems.length === 1 ? 'donazione trovata' : 'donazioni trovate'}.`;
          donationRows.innerHTML = donationItems.map((d) => `
            <tr>
              <td class="nowrap">${formatDateTime(d.paidAt)}</td>
              <td>${escapeHtml(d.donorName || '—')}</td>
              <td>${escapeHtml(d.donorEmail || '—')}</td>
              <td class="nowrap">${formatEuroFromCents(d.amount || 0)}</td>
              <td>${statusBadge(d.paymentStatus || 'paid', 'payment')}</td>
              <td>${statusBadge(d.donationType || 'generic', 'donation')}</td>
              <td><code class="id-pill" title="${escapeHtml(d.paymentId || '')}">${compactId(d.paymentId)}</code></td>
              <td>${d.message ? escapeHtml(d.message) : '<span class="muted">Nessun messaggio</span>'}</td>
            </tr>
          `).join('');
        }
      }
    } catch (error) {
      message.textContent = `Errore: ${error.message}`;
      if (donationMessage) donationMessage.textContent = `Errore: ${error.message}`;
    }
  }

  async function syncFromStripe() {
    const API_BASE = resolveApiBase();
    const key = document.getElementById('adminKey')?.value?.trim() || '';
    const message = document.getElementById('bookingListMessage');
    const button = document.getElementById('syncStripeData');
    if (!key) {
      if (message) message.textContent = 'Inserisci prima la chiave admin per sincronizzare da Stripe.';
      return;
    }

    try {
      if (button) button.setAttribute('disabled', 'true');
      if (message) message.textContent = 'Sincronizzazione da Stripe in corso...';

      const res = await fetch(`${API_BASE}/api/booking/sync-stripe?limit=100`, {
        method: 'POST',
        headers: { 'x-admin-key': key }
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || `Errore API (${res.status})`);

      if (message) {
        message.textContent = `Sync completata. Letti: ${payload.totalSessionsRead || 0}, Prenotazioni: ${payload.bookingsUpserted || 0}, Donazioni: ${payload.donationsUpserted || 0}.`;
      }
      await loadBookings();
    } catch (error) {
      if (message) message.textContent = `Errore sync Stripe: ${error.message}`;
    } finally {
      if (button) button.removeAttribute('disabled');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('bookingAdminFilters');
    const refresh = document.getElementById('refreshBookingList');
    const sync = document.getElementById('syncStripeData');
    if (form) form.addEventListener('submit', loadBookings);
    if (refresh) refresh.addEventListener('click', loadBookings);
    if (sync) sync.addEventListener('click', syncFromStripe);
  });
})();
