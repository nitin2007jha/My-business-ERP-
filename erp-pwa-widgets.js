/* ═══════════════════════════════════════════════════════════════════
   My Business ERP — In-App PWA Widget System v2.0
   Features: Live Widget Strip | Periodic BG Sync | SW Data Bridge
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  let refreshInterval = null;
  const REFRESH_MS = 60 * 1000; // refresh every 60 seconds

  // ── STYLES ────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('erp-widget-styles')) return;
    const style = document.createElement('style');
    style.id = 'erp-widget-styles';
    style.textContent = `
      /* ── Widget Strip Container ── */
      #erp-widget-strip {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding: 12px 14px 4px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        flex-shrink: 0;
      }
      #erp-widget-strip::-webkit-scrollbar { display: none; }

      /* ── Individual Widget Card ── */
      .erp-widget-card {
        flex: 0 0 160px;
        border-radius: 16px;
        padding: 14px 14px 12px;
        position: relative;
        overflow: hidden;
        cursor: pointer;
        transition: transform .18s, box-shadow .18s;
        -webkit-tap-highlight-color: transparent;
        border: 1px solid rgba(255,255,255,.06);
      }
      .erp-widget-card:active { transform: scale(.96); }

      /* Sales Widget */
      .erp-widget-card.sales {
        background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
        box-shadow: 0 4px 16px rgba(6,78,59,.4);
      }
      /* GST Widget */
      .erp-widget-card.gst {
        background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
        box-shadow: 0 4px 16px rgba(30,58,95,.4);
      }
      /* Stock Widget */
      .erp-widget-card.stock {
        background: linear-gradient(135deg, #451a03 0%, #92400e 100%);
        box-shadow: 0 4px 16px rgba(69,26,3,.4);
      }
      /* Stock widget — green when all good */
      .erp-widget-card.stock.ok {
        background: linear-gradient(135deg, #14532d 0%, #15803d 100%);
        box-shadow: 0 4px 16px rgba(20,83,45,.4);
      }

      /* Widget inner elements */
      .erp-w-icon {
        width: 28px; height: 28px; border-radius: 8px;
        background: rgba(255,255,255,.15);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        margin-bottom: 8px;
      }
      .erp-w-label {
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .07em;
        color: rgba(255,255,255,.55);
        margin-bottom: 2px;
        font-family: 'Inter', sans-serif;
      }
      .erp-w-value {
        font-size: 20px; font-weight: 800;
        color: #fff;
        font-family: 'Inter', sans-serif;
        line-height: 1.1;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .erp-w-sub {
        font-size: 11px;
        color: rgba(255,255,255,.5);
        font-family: 'Inter', sans-serif;
        line-height: 1.3;
      }
      .erp-w-badge {
        position: absolute;
        top: 10px; right: 10px;
        background: rgba(255,255,255,.2);
        border-radius: 10px;
        padding: 2px 7px;
        font-size: 10px; font-weight: 700;
        color: #fff;
        font-family: 'Inter', sans-serif;
      }
      .erp-w-badge.alert {
        background: #dc2626;
        animation: erp-w-pulse 2s ease-in-out infinite;
      }
      @keyframes erp-w-pulse {
        0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.4); }
        50%      { box-shadow: 0 0 0 5px rgba(220,38,38,.0); }
      }

      /* Shimmer loading state */
      .erp-w-shimmer .erp-w-value,
      .erp-w-shimmer .erp-w-sub {
        background: rgba(255,255,255,.12);
        border-radius: 4px;
        color: transparent;
        animation: erp-shimmer 1.4s ease-in-out infinite;
      }
      .erp-w-shimmer .erp-w-value { height: 24px; width: 80px; }
      .erp-w-shimmer .erp-w-sub   { height: 12px; width: 100px; margin-top: 4px; }
      @keyframes erp-shimmer {
        0%   { opacity: .5; }
        50%  { opacity: 1;  }
        100% { opacity: .5; }
      }

      /* Refresh indicator */
      .erp-w-refreshing::after {
        content: ''; position: absolute;
        bottom: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
        animation: erp-w-sweep 1s linear infinite;
      }
      @keyframes erp-w-sweep {
        from { transform: translateX(-100%); }
        to   { transform: translateX(100%); }
      }

      /* ── Widget Section Title ── */
      .erp-widget-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px 0;
      }
      .erp-widget-header-label {
        font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
        color: #adb5bd;
        font-family: 'Inter', sans-serif;
      }
      .erp-widget-refresh-btn {
        font-size: 11px; color: #714b67;
        background: none; border: none; cursor: pointer;
        font-family: 'Inter', sans-serif;
        font-weight: 600; padding: 2px 0;
        display: flex; align-items: center; gap: 4px;
      }
      .erp-widget-refresh-btn.spinning svg {
        animation: erp-spin .7s linear infinite;
      }
      @keyframes erp-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

      /* ── Full-screen Widget Expand Modal ── */
      #erp-widget-modal {
        position: fixed; inset: 0;
        background: rgba(0,0,0,.7);
        backdrop-filter: blur(4px);
        z-index: 9995;
        display: none;
        align-items: flex-end;
        justify-content: center;
      }
      #erp-widget-modal.open { display: flex; }
      #erp-widget-modal-inner {
        background: #1a1127;
        border-radius: 24px 24px 0 0;
        width: 100%; max-width: 520px;
        padding: 20px 20px calc(24px + env(safe-area-inset-bottom, 0px));
        animation: erp-slide-up .3s cubic-bezier(.4,0,.2,1);
        max-height: 75vh; overflow-y: auto;
      }
      @keyframes erp-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
      #erp-widget-modal-handle {
        width: 40px; height: 4px; background: rgba(255,255,255,.2);
        border-radius: 2px; margin: 0 auto 20px;
      }

      /* Detail rows inside expanded widget */
      .erp-wm-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,.06);
        font-family: 'Inter', sans-serif;
      }
      .erp-wm-row:last-child { border-bottom: none; }
      .erp-wm-row-label { font-size: 13px; color: rgba(255,255,255,.6); }
      .erp-wm-row-value { font-size: 14px; font-weight: 700; color: #fff; }
      .erp-wm-title {
        font-size: 18px; font-weight: 800; color: #fff;
        font-family: 'Inter', sans-serif; margin-bottom: 16px;
      }
      .erp-wm-close {
        position: absolute; top: 14px; right: 16px;
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(255,255,255,.1); border: none;
        color: rgba(255,255,255,.6); font-size: 15px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
      }
    `;
    document.head.appendChild(style);
  }

  // ── BUILD WIDGET STRIP HTML ────────────────────────────────────────
  function buildWidgetStrip() {
    // Find the dashboard container to inject before main content
    const dashTab = document.getElementById('view-dashboard') || document.querySelector('[id*="dashboard"]');
    if (!dashTab) return;

    // Avoid duplicates
    if (document.getElementById('erp-widget-strip')) return;

    const header = document.createElement('div');
    header.className = 'erp-widget-header';
    header.innerHTML = `
      <span class="erp-widget-header-label">📊 Live Widgets</span>
      <button class="erp-widget-refresh-btn" id="erp-w-refresh-btn" onclick="window.ERPWidgets&&ERPWidgets.refresh()">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
        </svg>
        Refresh
      </button>
    `;

    const strip = document.createElement('div');
    strip.id = 'erp-widget-strip';
    strip.innerHTML = `
      <!-- Sales Widget -->
      <div class="erp-widget-card sales erp-w-shimmer" id="erp-w-sales" onclick="window.ERPWidgets&&ERPWidgets.expand('sales')">
        <div class="erp-w-icon">💰</div>
        <div class="erp-w-label">Today's Sales</div>
        <div class="erp-w-value" id="erp-w-sales-val">Loading…</div>
        <div class="erp-w-sub" id="erp-w-sales-sub">Fetching data</div>
        <span class="erp-w-badge" id="erp-w-sales-badge">—</span>
      </div>

      <!-- GST Widget -->
      <div class="erp-widget-card gst erp-w-shimmer" id="erp-w-gst" onclick="window.ERPWidgets&&ERPWidgets.expand('gst')">
        <div class="erp-w-icon">🧾</div>
        <div class="erp-w-label">GST Tracker</div>
        <div class="erp-w-value" id="erp-w-gst-val">Loading…</div>
        <div class="erp-w-sub" id="erp-w-gst-sub">CGST + SGST + IGST</div>
        <span class="erp-w-badge" id="erp-w-gst-badge">—</span>
      </div>

      <!-- Stock Widget -->
      <div class="erp-widget-card stock erp-w-shimmer" id="erp-w-stock" onclick="window.ERPWidgets&&ERPWidgets.expand('stock')">
        <div class="erp-w-icon">📦</div>
        <div class="erp-w-label">Low Stock</div>
        <div class="erp-w-value" id="erp-w-stock-val">Loading…</div>
        <div class="erp-w-sub" id="erp-w-stock-sub">Checking inventory</div>
        <span class="erp-w-badge" id="erp-w-stock-badge">—</span>
      </div>
    `;

    // Inject at top of dashboard tab content
    const firstChild = dashTab.querySelector('.o-cp, [class*="page-header"], .stat, .grid');
    if (firstChild) {
      dashTab.insertBefore(strip, firstChild);
      dashTab.insertBefore(header, strip);
    } else {
      dashTab.prepend(strip);
      dashTab.prepend(header);
    }
  }

  // ── BUILD EXPAND MODAL ─────────────────────────────────────────────
  function buildModal() {
    if (document.getElementById('erp-widget-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'erp-widget-modal';
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    modal.innerHTML = `
      <div id="erp-widget-modal-inner" style="position:relative">
        <div id="erp-widget-modal-handle"></div>
        <button class="erp-wm-close" onclick="window.ERPWidgets&&ERPWidgets.closeModal()">✕</button>
        <div id="erp-widget-modal-content"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // ── DATA CALCULATION ───────────────────────────────────────────────
  function calcSalesData() {
    const { invoices = [] } = window.AppState || {};
    const todayStr = new Date().toDateString();

    const todayInvs = invoices.filter(i => {
      if (i.status !== 'final') return false;
      const d = i.date || i.createdAt;
      const dateStr = typeof d === 'string' ? new Date(d).toDateString()
                    : d?.toDate ? d.toDate().toDateString()
                    : new Date(d).toDateString();
      return dateStr === todayStr;
    });

    const all = invoices.filter(i => i.status === 'final');
    return {
      todayTotal:   todayInvs.reduce((s, i) => s + (i.total || i.grandTotal || 0), 0),
      todayCash:    todayInvs.reduce((s, i) => s + (i.cashPaid || i.splitPayment?.cash || 0), 0),
      todayUPI:     todayInvs.reduce((s, i) => s + (i.upiPaid  || i.splitPayment?.upi  || 0), 0),
      todayCredit:  todayInvs.reduce((s, i) => s + (i.creditPaid || i.splitPayment?.credit || 0), 0),
      todayCount:   todayInvs.length,
      allTimeTotal: all.reduce((s, i) => s + (i.total || i.grandTotal || 0), 0),
      allTimeCount: all.length,
    };
  }

  function calcGSTData() {
    const { invoices = [] } = window.AppState || {};
    const now  = new Date();
    const mon  = now.getMonth();
    const yr   = now.getFullYear();

    let cgst = 0, sgst = 0, igst = 0;
    let cgstM = 0, sgstM = 0, igstM = 0;

    invoices.filter(i => i.status === 'final').forEach(inv => {
      const d = new Date(inv.date || inv.createdAt);
      const isThisMonth = d.getMonth() === mon && d.getFullYear() === yr;

      (inv.items || []).forEach(item => {
        const taxable = (item.rate || 0) * (item.qty || 1);
        const pct     = item.gst || 0;
        if (inv.gstMode === 'inter') {
          const i = taxable * pct / 100;
          igst += i; if (isThisMonth) igstM += i;
        } else {
          const half = taxable * (pct / 2) / 100;
          cgst += half; sgst += half;
          if (isThisMonth) { cgstM += half; sgstM += half; }
        }
      });
    });

    return {
      cgst, sgst, igst, total: cgst + sgst + igst,
      cgstM, sgstM, igstM, monthTotal: cgstM + sgstM + igstM,
      taxableEl: document.getElementById('dash-tax')?.textContent || '',
    };
  }

  function calcStockData() {
    const { products = [] } = window.AppState || {};
    const low     = products.filter(p => p.minStock > 0 && (p.stock || 0) <= p.minStock);
    const critical = low.filter(p => (p.stock || 0) === 0);
    return {
      lowCount:      low.length,
      criticalCount: critical.length,
      items:         low.slice(0, 8),
      totalProducts: products.length,
    };
  }

  // ── RENDER WIDGETS ─────────────────────────────────────────────────
  function renderSalesWidget() {
    const d = calcSalesData();
    const el    = document.getElementById('erp-w-sales');
    const valEl = document.getElementById('erp-w-sales-val');
    const subEl = document.getElementById('erp-w-sales-sub');
    const badge = document.getElementById('erp-w-sales-badge');
    if (!el) return;

    el.classList.remove('erp-w-shimmer');
    if (valEl) valEl.textContent = fmt(d.todayTotal);
    if (subEl) subEl.textContent = `Cash ${fmt(d.todayCash)} • UPI ${fmt(d.todayUPI)}`;
    if (badge) { badge.textContent = `${d.todayCount} inv`; badge.className = 'erp-w-badge'; }

    // Cache for SW
    sendToSW('CACHE_SNAPSHOT', {
      url: './widgets/sales-data.json',
      payload: {
        todayRevenue: d.todayTotal, cashTotal: d.todayCash,
        upiTotal: d.todayUPI, invoiceCount: d.todayCount,
        updatedAt: timeNow(),
      }
    });
  }

  function renderGSTWidget() {
    const d = calcGSTData();
    const el    = document.getElementById('erp-w-gst');
    const valEl = document.getElementById('erp-w-gst-val');
    const subEl = document.getElementById('erp-w-gst-sub');
    const badge = document.getElementById('erp-w-gst-badge');
    if (!el) return;

    el.classList.remove('erp-w-shimmer');
    if (valEl) valEl.textContent = fmt(d.monthTotal);
    if (subEl) subEl.textContent = `CGST ${fmt(d.cgstM)} • SGST ${fmt(d.sgstM)}`;
    if (badge) { badge.textContent = 'This Month'; badge.className = 'erp-w-badge'; }

    sendToSW('CACHE_SNAPSHOT', {
      url: './widgets/gst-data.json',
      payload: {
        totalGST: d.monthTotal, taxableAmount: d.taxableEl,
        cgst: d.cgstM, sgst: d.sgstM, igst: d.igstM,
        period: 'This Month', updatedAt: timeNow(),
      }
    });
  }

  function renderStockWidget() {
    const d = calcStockData();
    const el    = document.getElementById('erp-w-stock');
    const valEl = document.getElementById('erp-w-stock-val');
    const subEl = document.getElementById('erp-w-stock-sub');
    const badge = document.getElementById('erp-w-stock-badge');
    if (!el) return;

    el.classList.remove('erp-w-shimmer');

    if (d.lowCount === 0) {
      el.classList.add('ok');
      if (valEl) valEl.textContent = 'All Good ✓';
      if (subEl) subEl.textContent = `${d.totalProducts} products in stock`;
      if (badge) { badge.textContent = '✓'; badge.className = 'erp-w-badge'; }
    } else {
      el.classList.remove('ok');
      if (valEl) valEl.textContent = `${d.lowCount} Items`;
      if (subEl) subEl.textContent = `${d.criticalCount} out of stock`;
      if (badge) { badge.textContent = d.criticalCount > 0 ? `${d.criticalCount} critical` : 'alert'; badge.className = 'erp-w-badge alert'; }
    }

    sendToSW('CACHE_SNAPSHOT', {
      url: './widgets/stock-data.json',
      payload: {
        alertCount: d.lowCount,
        items: d.items.map(p => ({ title: p.name, value: `Stock: ${p.stock || 0}` })),
        updatedAt: timeNow(),
      }
    });
  }

  function renderAll(showRefreshing) {
    if (showRefreshing) {
      ['erp-w-sales', 'erp-w-gst', 'erp-w-stock'].forEach(id => {
        document.getElementById(id)?.classList.add('erp-w-refreshing');
      });
      const btn = document.getElementById('erp-w-refresh-btn');
      if (btn) btn.classList.add('spinning');
    }

    setTimeout(() => {
      renderSalesWidget();
      renderGSTWidget();
      renderStockWidget();

      ['erp-w-sales', 'erp-w-gst', 'erp-w-stock'].forEach(id => {
        document.getElementById(id)?.classList.remove('erp-w-refreshing');
      });
      const btn = document.getElementById('erp-w-refresh-btn');
      if (btn) btn.classList.remove('spinning');
    }, showRefreshing ? 500 : 0);
  }

  // ── EXPAND MODAL ───────────────────────────────────────────────────
  function expand(type) {
    const modal = document.getElementById('erp-widget-modal');
    const content = document.getElementById('erp-widget-modal-content');
    if (!modal || !content) return;

    if (type === 'sales') {
      const d = calcSalesData();
      content.innerHTML = `
        <div class="erp-wm-title">📊 Sales Details</div>
        ${row('Today\'s Total',  fmt(d.todayTotal))}
        ${row('Today\'s Cash',   fmt(d.todayCash))}
        ${row('Today\'s UPI',    fmt(d.todayUPI))}
        ${row('Today\'s Credit', fmt(d.todayCredit))}
        ${row('Today\'s Count',  d.todayCount + ' invoices')}
        <div style="margin:16px 0;height:1px;background:rgba(255,255,255,.08)"></div>
        ${row('All-Time Revenue', fmt(d.allTimeTotal))}
        ${row('All-Time Invoices', d.allTimeCount + ' invoices')}
        <button onclick="window.switchTab&&switchTab('dashboard');window.ERPWidgets&&ERPWidgets.closeModal()"
          style="width:100%;margin-top:16px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#064e3b,#059669);border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">
          View Full Dashboard →
        </button>
      `;
    } else if (type === 'gst') {
      const d = calcGSTData();
      content.innerHTML = `
        <div class="erp-wm-title">🧾 GST / Tax Tracker</div>
        ${row('This Month Total GST', fmt(d.monthTotal), '#a3e635')}
        ${row('This Month CGST',      fmt(d.cgstM))}
        ${row('This Month SGST',      fmt(d.sgstM))}
        ${row('This Month IGST',      fmt(d.igstM))}
        <div style="margin:16px 0;height:1px;background:rgba(255,255,255,.08)"></div>
        ${row('All-Time Total GST', fmt(d.total))}
        ${row('All-Time CGST',      fmt(d.cgst))}
        ${row('All-Time SGST',      fmt(d.sgst))}
        ${row('All-Time IGST',      fmt(d.igst))}
        <button onclick="window.switchTab&&switchTab('reports');window.ERPWidgets&&ERPWidgets.closeModal()"
          style="width:100%;margin-top:16px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#1e3a5f,#2563eb);border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">
          View GST Report →
        </button>
      `;
    } else if (type === 'stock') {
      const d = calcStockData();
      const listHTML = d.items.length === 0
        ? '<div style="color:rgba(255,255,255,.5);font-size:14px;text-align:center;padding:20px 0">✅ Sab products stock mein hain</div>'
        : d.items.map(p => row(p.name, `Stock: ${p.stock || 0}  (Min: ${p.minStock})`, (p.stock||0) === 0 ? '#f87171' : '#fb923c')).join('');

      content.innerHTML = `
        <div class="erp-wm-title">📦 Low Stock Alert (${d.lowCount} items)</div>
        ${listHTML}
        <button onclick="window.switchTab&&switchTab('inventory');window.ERPWidgets&&ERPWidgets.closeModal()"
          style="width:100%;margin-top:16px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#451a03,#b45309);border:none;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif">
          Manage Inventory →
        </button>
      `;
    }

    modal.classList.add('open');
  }

  function closeModal() {
    document.getElementById('erp-widget-modal')?.classList.remove('open');
  }

  function row(label, value, valueColor) {
    return `<div class="erp-wm-row">
      <span class="erp-wm-row-label">${label}</span>
      <span class="erp-wm-row-value" style="${valueColor ? `color:${valueColor}` : ''}">${value}</span>
    </div>`;
  }

  // ── SW BRIDGE ──────────────────────────────────────────────────────
  function sendToSW(type, data) {
    if (!navigator.serviceWorker?.controller) return;
    navigator.serviceWorker.controller.postMessage({ type, data });
  }

  function bindSWMessages() {
    if (!navigator.serviceWorker) return;

    // Reply to SW data requests (for widget updates when no tab is open)
    navigator.serviceWorker.addEventListener('message', event => {
      const { type } = event.data || {};
      if (type === 'GET_SALES_SNAPSHOT') {
        const d = calcSalesData();
        event.ports[0]?.postMessage({
          todayRevenue: d.todayTotal, cashTotal: d.todayCash,
          upiTotal: d.todayUPI, invoiceCount: d.todayCount,
        });
      }
      if (type === 'GET_GST_SNAPSHOT') {
        const d = calcGSTData();
        event.ports[0]?.postMessage({
          totalGST: d.monthTotal, cgst: d.cgstM, sgst: d.sgstM, igst: d.igstM,
          taxableAmount: '—', period: 'This Month',
        });
      }
      if (type === 'GET_STOCK_SNAPSHOT') {
        const d = calcStockData();
        event.ports[0]?.postMessage({
          lowStockItems: d.items.map(p => ({
            name: p.name, stock: p.stock || 0, minStock: p.minStock
          }))
        });
      }
      if (type === 'ERP_DATA_REFRESHED') {
        renderAll(false);
      }
    });
  }

  // ── PERIODIC SYNC REGISTRATION ─────────────────────────────────────
  async function registerPeriodicSync() {
    if (!('periodicSync' in (navigator.serviceWorker?.ready ?? {}))) return;

    try {
      const sw = await navigator.serviceWorker.ready;
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') {
        await sw.periodicSync.register('erp-full-sync',  { minInterval: 30 * 60 * 1000 });
        await sw.periodicSync.register('erp-stock-sync', { minInterval: 60 * 60 * 1000 });
        console.log('[ERPWidgets] Periodic background sync registered');
      }
    } catch (e) {
      console.warn('[ERPWidgets] Periodic sync registration failed:', e);
    }
  }

  // ── PUSH NOTIFICATION PERMISSION ──────────────────────────────────
  async function requestPushPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    // Only ask after user interaction with app, not on cold load
  }

  // Ask permission when user visits dashboard
  function maybeAskPushPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    setTimeout(async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        // Tell SW to register periodic sync now
        sendToSW('REGISTER_PERIODIC_SYNC', {});
        console.log('[ERPWidgets] Push notifications granted');
      }
    }, 3000); // 3s delay so user is settled in the app
  }

  // ── URL ACTION HANDLER ─────────────────────────────────────────────
  function handleURLAction() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'today-sales') {
      setTimeout(() => {
        window.switchTab?.('dashboard');
        setTimeout(() => expand('sales'), 400);
      }, 800);
    } else if (action === 'low-stock') {
      setTimeout(() => {
        window.switchTab?.('inventory');
      }, 800);
    } else if (action === 'gst-report') {
      setTimeout(() => {
        window.switchTab?.('reports');
      }, 800);
    }
  }

  // ── HELPERS ────────────────────────────────────────────────────────
  function fmt(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  function timeNow() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────
  window.ERPWidgets = {
    refresh:    () => renderAll(true),
    expand,
    closeModal,
    renderAll,
  };

  // ── INIT ──────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    buildModal();

    // Wait for AppState to be populated before rendering widgets
    let attempts = 0;
    const waitForData = setInterval(() => {
      attempts++;
      if (window.AppState?.invoices !== undefined || attempts > 20) {
        clearInterval(waitForData);
        buildWidgetStrip();
        renderAll(false);
        bindSWMessages();
        registerPeriodicSync();
        maybeAskPushPermission();
        handleURLAction();

        // Auto-refresh every minute
        refreshInterval = setInterval(() => renderAll(false), REFRESH_MS);

        // Re-render when AppState updates (hook into existing ERP events)
        document.addEventListener('erp:data-updated', () => renderAll(false));
        document.addEventListener('erp:invoice-saved', () => renderAll(false));
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
