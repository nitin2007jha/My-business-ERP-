/* ═══════════════════════════════════════════════════════════════════
   My Business ERP — Service Worker v3.0
   Features: Periodic Sync, Push Notifications, PWA Widgets, Offline Cache
   ═══════════════════════════════════════════════════════════════════ */

const SW_VERSION = 'erp-sw-v3.1';
const CACHE_NAME  = 'erp-cache-v3.1';

// Files to pre-cache for offline use
const PRE_CACHE = [
  './index.html',
  './manifest.json',
  './voice-erp.js',
  './erp-pwa-widgets.js',
  './widgets/sales-template.json',
  './widgets/gst-template.json',
  './widgets/stock-template.json',
  // Data placeholders (will be filled by periodic sync)
  './widgets/sales-data.json',
  './widgets/gst-data.json',
  './widgets/stock-data.json',
];

// ──────────────────────────────────────────────
// INSTALL
// ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log(`[SW ${SW_VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRE_CACHE.filter(url => !url.includes('data.json'))))
      .then(() => self.skipWaiting())
  );
});

// ──────────────────────────────────────────────
// ACTIVATE — clean old caches
// ──────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log(`[SW ${SW_VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ──────────────────────────────────────────────
// FETCH — Network first, Cache fallback
// ──────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET or cross-origin
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache a clone of successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ──────────────────────────────────────────────
// PERIODIC BACKGROUND SYNC
// Triggers every ~30 minutes when device is online
// ──────────────────────────────────────────────
self.addEventListener('periodicsync', event => {
  console.log(`[SW] Periodic sync triggered: ${event.tag}`);

  if (event.tag === 'erp-sales-sync') {
    event.waitUntil(syncSalesData());
  }
  if (event.tag === 'erp-gst-sync') {
    event.waitUntil(syncGSTData());
  }
  if (event.tag === 'erp-stock-sync') {
    event.waitUntil(syncStockData());
  }
  if (event.tag === 'erp-full-sync') {
    event.waitUntil(
      Promise.all([syncSalesData(), syncGSTData(), syncStockData()])
        .then(() => notifyClientsDataRefreshed())
    );
  }
});

// ──────────────────────────────────────────────
// PUSH NOTIFICATIONS
// ──────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const { type = 'general', title, body, tag, url } = data;

  const options = {
    body: body || 'ERP Update',
    icon: './icons/icon-192.png',
    badge: './icons/icon-96.png',
    tag: tag || type,
    renotify: true,
    requireInteraction: type === 'low-stock',
    vibrate: [200, 100, 200],
    data: { url: url || './index.html', type },
    actions: getActionsForType(type),
  };

  event.waitUntil(
    self.registration.showNotification(title || 'My Business ERP', options)
  );
});

function getActionsForType(type) {
  switch (type) {
    case 'low-stock':
      return [
        { action: 'view-stock',   title: '📦 View Inventory' },
        { action: 'create-po',    title: '🛒 Create PO' },
      ];
    case 'sales':
      return [
        { action: 'view-sales',   title: '📊 View Sales' },
        { action: 'new-invoice',  title: '🧾 New Invoice' },
      ];
    case 'gst':
      return [
        { action: 'view-gst',     title: '📋 GST Report' },
        { action: 'dismiss',      title: '✗ Dismiss' },
      ];
    default:
      return [
        { action: 'open',         title: '🚀 Open ERP' },
      ];
  }
}

// ──────────────────────────────────────────────
// NOTIFICATION CLICK — Deep link into app
// ──────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const action = event.action;
  const data   = event.notification.data || {};

  let targetUrl = './index.html';
  if (action === 'view-stock'  || data.type === 'low-stock')   targetUrl = './index.html?action=low-stock';
  if (action === 'view-sales'  || data.type === 'sales')       targetUrl = './index.html?action=today-sales';
  if (action === 'view-gst'    || data.type === 'gst')         targetUrl = './index.html?action=gst-report';
  if (action === 'new-invoice')                                 targetUrl = './index.html?action=new-invoice';
  if (action === 'create-po')                                   targetUrl = './index.html?action=purchase-order';
  if (data.url && action === 'open')                            targetUrl = data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          client.postMessage({ type: 'SW_NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ══════════════════════════════════════════════
// PWA WIDGET API  (Chrome/Edge + Android 12+)
// https://learn.microsoft.com/adaptive-cards
// ══════════════════════════════════════════════

self.addEventListener('widgetinstall', event => {
  console.log('[SW] Widget installed:', event.widget.definition.tag);
  event.waitUntil(updateWidget(event.widget));
});

self.addEventListener('widgetupdate', event => {
  console.log('[SW] Widget update requested:', event.widget.definition.tag);
  event.waitUntil(updateWidget(event.widget));
});

self.addEventListener('widgetresume', event => {
  console.log('[SW] Widget resumed:', event.widget.definition.tag);
  event.waitUntil(updateWidget(event.widget));
});

self.addEventListener('widgetuninstall', event => {
  console.log('[SW] Widget uninstalled:', event.widget.definition.tag);
});

async function updateWidget(widget) {
  const tag = widget.definition.tag;
  try {
    let templateUrl, dataUrl;

    if (tag === 'erp-sales-widget') {
      templateUrl = './widgets/sales-template.json';
      dataUrl     = './widgets/sales-data.json';
    } else if (tag === 'erp-gst-widget') {
      templateUrl = './widgets/gst-template.json';
      dataUrl     = './widgets/gst-data.json';
    } else if (tag === 'erp-stock-widget') {
      templateUrl = './widgets/stock-template.json';
      dataUrl     = './widgets/stock-data.json';
    } else return;

    const [template, data] = await Promise.all([
      fetch(templateUrl).then(r => r.text()),
      fetch(dataUrl).then(r => r.text()),
    ]);

    await self.widgets.updateByTag(tag, { template, data });
    console.log(`[SW] Widget "${tag}" updated successfully`);
  } catch (err) {
    console.error('[SW] Widget update failed:', err);
    // Push fallback data so widget doesn't show blank
    await self.widgets.updateByTag(tag, {
      template: JSON.stringify(getFallbackTemplate(tag)),
      data: JSON.stringify({ error: 'Could not load data. Open ERP to refresh.', updatedAt: now() })
    });
  }
}

function getFallbackTemplate(tag) {
  return {
    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard', version: '1.5',
    body: [{ type: 'TextBlock', text: 'Open ERP to refresh data', isSubtle: true }]
  };
}

// ──────────────────────────────────────────────
// DATA SYNC HELPERS
// Reads from localStorage snapshot saved by the app
// and writes to widget data JSON in cache
// ──────────────────────────────────────────────
async function syncSalesData() {
  const snapshot = await getDataFromClients('GET_SALES_SNAPSHOT');
  if (!snapshot) return;

  const data = {
    todayRevenue:  formatCurrency(snapshot.todayRevenue  || 0),
    cashTotal:     formatCurrency(snapshot.cashTotal     || 0),
    upiTotal:      formatCurrency(snapshot.upiTotal      || 0),
    invoiceCount:  snapshot.invoiceCount || 0,
    updatedAt:     now(),
  };

  await cacheWidgetData('./widgets/sales-data.json', data);

  // Update live widget if installed
  if (self.widgets) {
    const widget = await self.widgets.getByTag('erp-sales-widget');
    if (widget) await updateWidget(widget);
  }

  // Send push notification if today's sales hit a milestone
  if (snapshot.todayRevenue > 0 && snapshot.milestoneHit) {
    await self.registration.showNotification('🎉 Sales Milestone!', {
      body: `Today's collection: ${formatCurrency(snapshot.todayRevenue)}`,
      icon: './icons/icon-192.png',
      tag: 'sales-milestone',
      data: { type: 'sales' }
    });
  }
}

async function syncGSTData() {
  const snapshot = await getDataFromClients('GET_GST_SNAPSHOT');
  if (!snapshot) return;

  const data = {
    totalGST:     formatCurrency(snapshot.totalGST     || 0),
    taxableAmount:formatCurrency(snapshot.taxableAmount || 0),
    cgst:         formatCurrency(snapshot.cgst          || 0),
    sgst:         formatCurrency(snapshot.sgst          || 0),
    igst:         formatCurrency(snapshot.igst          || 0),
    period:       snapshot.period || 'This Month',
    updatedAt:    now(),
  };

  await cacheWidgetData('./widgets/gst-data.json', data);

  if (self.widgets) {
    const widget = await self.widgets.getByTag('erp-gst-widget');
    if (widget) await updateWidget(widget);
  }
}

async function syncStockData() {
  const snapshot = await getDataFromClients('GET_STOCK_SNAPSHOT');
  if (!snapshot) return;

  const items = (snapshot.lowStockItems || []).slice(0, 5).map(p => ({
    title: p.name,
    value: `Stock: ${p.stock} (Min: ${p.minStock})`
  }));

  const data = {
    alertCount: snapshot.lowStockItems ? snapshot.lowStockItems.length : 0,
    items,
    updatedAt: now(),
  };

  await cacheWidgetData('./widgets/stock-data.json', data);

  if (self.widgets) {
    const widget = await self.widgets.getByTag('erp-stock-widget');
    if (widget) await updateWidget(widget);
  }

  // Push critical stock notification if urgent items exist
  if (data.alertCount > 0) {
    await self.registration.showNotification(`⚠️ ${data.alertCount} Low Stock Alert${data.alertCount > 1 ? 's' : ''}`, {
      body: items.slice(0, 3).map(i => `• ${i.title}`).join('\n'),
      icon: './icons/icon-192.png',
      tag: 'low-stock',
      requireInteraction: true,
      vibrate: [300, 100, 300],
      data: { type: 'low-stock' },
      actions: [
        { action: 'view-stock', title: '📦 View Inventory' },
        { action: 'create-po',  title: '🛒 Create PO' }
      ]
    });
  }
}

// ──────────────────────────────────────────────
// UTILITY: Message a client tab and get reply
// ──────────────────────────────────────────────
function getDataFromClients(messageType) {
  return new Promise(async (resolve) => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clientList.length === 0) {
      // No open tab — try reading from cache
      resolve(await readCachedSnapshot(messageType));
      return;
    }

    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = e => resolve(e.data);
    clientList[0].postMessage({ type: messageType }, [messageChannel.port2]);

    // Timeout fallback after 3 seconds
    setTimeout(() => resolve(null), 3000);
  });
}

async function readCachedSnapshot(type) {
  const cache = await caches.open(CACHE_NAME);
  const keyMap = {
    GET_SALES_SNAPSHOT: './widgets/sales-data.json',
    GET_GST_SNAPSHOT:   './widgets/gst-data.json',
    GET_STOCK_SNAPSHOT: './widgets/stock-data.json',
  };
  const resp = await cache.match(keyMap[type]);
  return resp ? resp.json() : null;
}

async function cacheWidgetData(url, data) {
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put(url, response);
}

async function notifyClientsDataRefreshed() {
  const clientList = await clients.matchAll({ type: 'window' });
  clientList.forEach(client => client.postMessage({ type: 'ERP_DATA_REFRESHED' }));
}

// ──────────────────────────────────────────────
// MESSAGES from main app
// ──────────────────────────────────────────────
self.addEventListener('message', event => {
  const { type, data } = event.data || {};

  if (type === 'CACHE_SNAPSHOT') {
    // App sends latest snapshot for SW to use during background sync
    cacheWidgetData(data.url, data.payload);
    return;
  }

  if (type === 'FORCE_WIDGET_UPDATE') {
    syncSalesData();
    syncGSTData();
    syncStockData();
    return;
  }

  if (type === 'REGISTER_PERIODIC_SYNC') {
    // Triggered from app after user grants permission
    self.registration.periodicSync?.register('erp-full-sync', { minInterval: 30 * 60 * 1000 });
    self.registration.periodicSync?.register('erp-stock-sync', { minInterval: 60 * 60 * 1000 });
    return;
  }

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function now() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
