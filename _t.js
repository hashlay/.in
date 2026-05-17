
/* ═══════════════════════════════════════════════════
   CONFIG & STATE
═══════════════════════════════════════════════════ */
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://api.hashlay.in';

// ── DEMO DATA ────────────────────────────────────


let QUICK_REPLIES = [
  {label:'How to use foam?',response:'Apply a small amount onto a brush. Scrub in circular motions. Wipe with microfiber cloth. 🧴✨'},
  {label:'Is it suede safe?',response:'Yes! Our foam is 100% safe for suede, leather, mesh & canvas. pH balanced formula. ✅'},
  {label:'COD available?',response:'Yes! COD is available across India. Small ₹30 handling charge applies. 📦'},
  {label:'Delivery time?',response:'3-5 business days standard. Metro cities get delivery in 2-3 days. 🚚'},
];

let AUTO_RESPONSES = [
  {trigger:'return',response:'We accept returns within 7 days for unopened products. Email hello@hashlay.in 📧'},
  {trigger:'track',response:'Please share your Order ID and we will check the tracking status for you! 🔍'},
];



let ACTIVITY_LOG = [
  {action:'Updated order #HL-0071 to Processing',user:'Super Admin',time:'2 min ago'},
  {action:'Added coupon WELCOME50',user:'Ravi Kumar',time:'1 hour ago'},
  {action:'Approved review from Rahul S.',user:'Super Admin',time:'3 hours ago'},
  {action:'Updated product stock',user:'Super Admin',time:'5 hours ago'},
  {action:'Created campaign: Launch Campaign',user:'Ravi Kumar',time:'1 day ago'},
];

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
window.doLogin = async function () {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  if (!email || !pass) return toast('Enter email and password', 'error');

  try {
    const result = await apiPost('/api/auth/login', { email, password: pass });
    if (result?.success) {
      localStorage.setItem('hl_token', result.token);
      localStorage.setItem('hl_admin', JSON.stringify(result.admin));
      initApp();
    } else {
      toast(result?.message || 'Invalid credentials', 'error');
    }
  } catch(e) {
    toast('Login failed — check connection', 'error');
  }
}

// ═══════════════════════════════════════════
// SETTINGS SAVE FUNCTIONS
// ═══════════════════════════════════════════

async function savePaymentSettings() {
  const payload = {
    razorpayKeyId: document.querySelector('#tab-settings input[placeholder*="rzp_"]')?.value || '',
    onlinePayment: document.querySelector('#tab-settings .toggle-label')?.previousElementSibling?.querySelector('input')?.checked ?? true,
    codEnabled: Array.from(document.querySelectorAll('#tab-settings input[type=checkbox]')).find(el => el.closest('.form-group')?.textContent.includes('COD'))?.checked ?? true,
    codCharge: parseInt(document.querySelector('#tab-settings input[type=number]')?.value) || 0,
  };
  const result = await apiPatch('/api/settings/payment', { value: payload });
  result?.success ? toast('Payment settings saved!', 'success') : toast('Failed to save payment settings', 'error');
}

async function saveAnnouncementSettings() {
  const inputs = document.querySelectorAll('#tab-settings input[type=text]');
  const payload = {
    enabled: true,
    text: inputs[0]?.value || '',
    coupon: inputs[1]?.value || '',
  };
  const result = await apiPatch('/api/settings/announcement', { value: payload });
  result?.success ? toast('Announcement saved!', 'success') : toast('Failed to save announcement', 'error');
}

async function saveSEOSettings() {
  const inputs = document.querySelectorAll('#tab-settings input[type=text], #tab-settings textarea');
  const payload = {
    metaTitle: inputs[0]?.value || '',
    metaDescription: inputs[1]?.value || '',
    keywords: inputs[2]?.value || '',
  };
  const result = await apiPatch('/api/settings/seo', { value: payload });
  result?.success ? toast('SEO settings saved!', 'success') : toast('Failed to save SEO settings', 'error');
}

async function saveDeliverySettings() {
  const inputs = document.querySelectorAll('#tab-settings input[type=number]');
  const payload = {
    freeDeliveryThreshold: parseInt(inputs[0]?.value) || 599,
    standardCharge: parseInt(inputs[1]?.value) || 49,
    expressCharge: parseInt(inputs[2]?.value) || 99,
  };
  const result = await apiPatch('/api/settings/delivery', { value: payload });
  result?.success ? toast('Delivery settings saved!', 'success') : toast('Failed to save delivery settings', 'error');
}

async function saveStoreSettings() {
  const inputs = document.querySelectorAll('#tab-settings input[type=text], #tab-settings input[type=email], #tab-settings input[type=tel]');
  const payload = {
    storeName: inputs[0]?.value || '',
    storeEmail: inputs[1]?.value || '',
    storePhone: inputs[2]?.value || '',
    storeAddress: inputs[3]?.value || '',
  };
  const result = await apiPatch('/api/settings/store', { value: payload });
  result?.success ? toast('Store settings saved!', 'success') : toast('Failed to save store settings', 'error');
}

async function loadSettings() {
  const result = await apiGet('/api/settings');
  if (!result?.data) return;
  const s = {};
  result.data.forEach(item => { s[item.key] = item.value; });

  // Pre-fill announcement
  if (s.announcement) {
    const inputs = document.querySelectorAll('#tab-settings input[type=text]');
    if (inputs[0]) inputs[0].value = s.announcement.text || '';
    if (inputs[1]) inputs[1].value = s.announcement.coupon || '';
  }

  // Pre-fill payment
  if (s.payment) {
    const rzpInput = document.querySelector('#tab-settings input[placeholder*="rzp_"]');
    if (rzpInput) rzpInput.value = s.payment.razorpayKeyId || '';
  }
}

async function saveBannerSettings() {
  const inputs = document.querySelectorAll('#tab-settings input[type=text]');
  const payload = {
    title: document.querySelector('input[value*="Sneaker"]')?.value || '',
    subtitle: document.querySelector('input[value*="Care"]')?.value || '',
    ctaText: document.querySelector('input[value*="Shop"]')?.value || '',
    ctaLink: document.querySelector('input[value*="#products"]')?.value || '#products',
  };
  const result = await apiPatch('/api/settings/banner', { value: payload });
  result?.success
    ? toast('Banner updated!', 'success')
    : toast('Failed to update banner', 'error');
}


// ═══════════════════════════════════════════
// PRODUCT IMAGE UPLOAD
// ═══════════════════════════════════════════

function previewProductImage(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('product-image-preview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';
}

async function uploadProductImage() {
  const fileInput = document.getElementById('product-image-file');
  const file = fileInput?.files[0];
  if (!file) return null;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(API_BASE + '/api/upload/product', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('hl_token')
      },
      body: formData
    });
    const data = await res.json();
    if (data?.success) return data.url;
    toast('Image upload failed', 'error');
    return null;
  } catch(e) {
    toast('Image upload error: ' + e.message, 'error');
    return null;
  }
}
// ═══════════════════════════════════════════
// CAMPAIGN SEND
// ═══════════════════════════════════════════

async function sendCampaign(btn) {
  const id = btn?.closest('[data-id]')?.dataset?.id
           || btn?.closest('tr')?.dataset?.id;
  if (!id) return toast('Campaign ID not found', 'error');

  const confirm = window.confirm('Send this campaign now to all subscribers?');
  if (!confirm) return;

  btn.disabled = true;
  btn.textContent = 'Sending...';

  const result = await apiPost('/api/campaigns/' + id + '/send', {});

  if (result?.success) {
    toast('Campaign sent successfully!', 'success');
    loadCampaigns(); // refresh the list
  } else {
    toast(result?.message || 'Failed to send campaign', 'error');
    btn.disabled = false;
    btn.textContent = 'Send';
  }
}

async function doLogout() {
  try { await apiPost('/api/auth/logout', {}); } catch(e) {}
  localStorage.removeItem('hl_token');
  localStorage.removeItem('hl_admin');
  document.getElementById('app').classList.remove('visible');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('l-pass').value = '';
  toast('Logged out successfully.', 'info');
}

// Auto-login if token exists
(function checkExistingSession() {
  const token = localStorage.getItem('hl_token');
  if (token) {
    // Verify token is still valid
    fetch(API_BASE + '/api/auth/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(data => {
      if (data && data.success) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.add('visible');
        const nameEl = document.getElementById('sidebar-admin-name');
        const roleEl = document.getElementById('sidebar-admin-role');
        if (nameEl) nameEl.textContent = data.admin?.name || 'Admin';
        if (roleEl) roleEl.textContent = data.admin?.role || '';
        initApp();
      } else {
        localStorage.removeItem('hl_token');
        localStorage.removeItem('hl_admin');
      }
    })
    .catch(() => {
      localStorage.removeItem('hl_token');
      localStorage.removeItem('hl_admin');
    });
  }
})();

/* ═══════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════ */
const PAGE_TITLES = {
  dashboard:'Dashboard',orders:'Orders',products:'Products',
  customers:'Customers',reviews:'Reviews',marketing:'Marketing',
  analytics:'Analytics',faq:'FAQ Manager',chatbot:'AI Chatbot',
  notify:'Notify List',contact:'Contact Messages',settings:'Settings',
  admins:'Admin Users',notifications:'Notifications',activitylog:'Activity Log'
};

function goPage(id, el) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.nav-item').forEach(n=>{
      if(n.textContent.toLowerCase().includes(id.toLowerCase().slice(0,5))) n.classList.add('active');
    });
  }
  document.getElementById('topbar-title').textContent = (PAGE_TITLES[id]||id).toUpperCase();
  document.getElementById('topbar-breadcrumb').textContent = `Hashlay Admin → ${PAGE_TITLES[id]||id}`;
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

/* ═══════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════ */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(m=>{
  m.addEventListener('click',function(e){ if(e.target===this) this.classList.remove('open'); });
});

/* ═══════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════ */
function toast(msg, type='info') {
  const icons = {success:'✅',error:'❌',info:'ℹ️'};
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icons[type]||''}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(()=>{ t.style.animation='toastOut .3s forwards'; setTimeout(()=>t.remove(),300); }, 3500);
}

/* ═══════════════════════════════════════════════════
   INIT APP
═══════════════════════════════════════════════════ */
function initApp() {
  loadDashboard();
  loadOrders();
  loadProducts();
  loadCustomers();
  loadReviews();
  loadCoupons();
  loadCampaigns();
  loadFaqs();
  loadNotifyList();
  loadContacts();
  loadAdminUsers();
  loadActivityLog();
  loadSettings();
  loadNotifications();
  renderShippingZones();
  renderQuickReplies();
  renderAutoResponses();
  initCharts();
}

/* ═══════════════════════════════════════════════════
   DASHBOARD — REAL API
═══════════════════════════════════════════════════ */
async function loadDashboard() {
  const data = await apiGet('/api/dashboard/stats');
  if (!data || !data.success) return;
  const d = data.data;

  // Update stat cards — use IDs already in the HTML
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-today-orders',   d.todayOrders   ?? 0);
  setEl('stat-today-revenue',  '₹' + (d.todayRevenue ?? 0).toLocaleString());
  setEl('stat-total-orders',   d.totalOrders   ?? 0);
  setEl('stat-total-revenue',  '₹' + (d.totalRevenue ?? 0).toLocaleString());
  setEl('stat-total-products', d.totalProducts ?? 0);
  setEl('stat-total-customers',d.totalCustomers?? 0);
  setEl('stat-pending-orders', d.pendingOrders ?? 0);
  setEl('stat-delivered',      d.deliveredOrders ?? 0);

  // Recent orders on dashboard
  if (d.recentOrders && d.recentOrders.length) {
    const tbody = document.getElementById('activity-log');
    if (tbody) {
      tbody.innerHTML = d.recentOrders.map(o => `
        <div style="padding:.7rem 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;flex-direction:column;gap:.2rem;">
          <div style="font-size:.8rem;">Order #${o.orderId} — ${o.customerName} — ₹${o.total}</div>
          <div style="font-size:.68rem;color:var(--gray);">${o.orderStatus} · ${new Date(o.createdAt).toLocaleDateString('en-IN')}</div>
        </div>
      `).join('');
    }
  }

  // Low stock alerts
  if (d.lowStock && d.lowStock.length) {
    const existing = document.getElementById('low-stock-list');
    if (existing) {
      existing.innerHTML = d.lowStock.map(p =>
        `<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(255,255,255,.04);">
          <span style="font-size:.8rem;">${p.name}</span>
          <span class="badge badge-yellow">${p.stock} left</span>
        </div>`
      ).join('');
    }
  }

  // Revenue chart from real data
  loadRevenueChart();
}

async function loadRevenueChart() {
  const data = await apiGet('/api/dashboard/revenue-chart?range=7d');
  if (!data || !data.success) return;
  const labels = data.data.map(d => d._id);
  const revenues = data.data.map(d => d.revenue);
  const chartEl = document.getElementById('revenue-chart');
  if (!chartEl) return;
  // Destroy existing chart if present
  const existing = Chart.getChart(chartEl);
  if (existing) existing.destroy();
  new Chart(chartEl, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data: revenues,
        borderColor: '#0057ff',
        backgroundColor: 'rgba(0,87,255,0.08)',
        borderWidth: 2, fill: true, tension: 0.4,
        pointBackgroundColor: '#0057ff', pointBorderWidth: 0, pointRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => '₹' + v.toLocaleString() } }
      }
    }
  });
}

/* ═══════════════════════════════════════════════════
   ORDERS — REAL API
═══════════════════════════════════════════════════ */
let ORDERS = []; // now populated from API

async function loadOrders(filter = 'all', search = '') {
  let url = '/api/orders?page=1&limit=50';
  if (filter !== 'all') url += '&status=' + filter;
  if (search) url += '&search=' + encodeURIComponent(search);
  const data = await apiGet(url);
  if (data && data.data && data.data.docs) {
    ORDERS = data.data.docs;
    renderOrders(filter, search);
  }
}

function renderOrders(filter = 'all', search = '') {
  let data = [...ORDERS];
  if (filter !== 'all') data = data.filter(o => o.orderStatus === filter);
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(o =>
      (o.orderId||'').toLowerCase().includes(q) ||
      (o.customerName||'').toLowerCase().includes(q) ||
      (o.customerPhone||'').includes(q)
    );
  }
  const tbody = document.getElementById('orders-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--gray);">No orders found</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(o => `
    <tr>
      <td class="mono text-blue">#${o.orderId}</td>
      <td class="fw-600">${o.customerName}</td>
      <td class="text-muted">${o.customerPhone || ''}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${(o.items||[]).map(i => i.name + ' x' + i.quantity).join(', ')}
      </td>
      <td class="fw-600">₹${o.total}</td>
      <td>${o.paymentMethod?.toUpperCase()}</td>
      <td><span class="badge ${PAY_BADGE[o.paymentStatus]||'badge-gray'}">${o.paymentStatus}</span></td>
      <td><span class="badge ${STATUS_BADGE[o.orderStatus]||'badge-gray'}">${o.orderStatus}</span></td>
      <td class="text-muted">${new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="viewOrder('${o._id}')" title="View">👁</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openStatusModal('${o._id}')" title="Update Status">✏️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterOrders(filter, el) {
  document.querySelectorAll('#page-orders .filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  loadOrders(filter, document.getElementById('order-search')?.value || '');
}

function searchOrders(q) {
  const activeFilter = document.querySelector('#page-orders .filter-tab.active')?.dataset?.filter || 'all';
  loadOrders(activeFilter, q);
}

function openStatusModal(id) {
  document.getElementById('status-order-id').value = id;
  const o = ORDERS.find(x => x._id === id);
  if (o) document.getElementById('new-status-select').value = o.orderStatus;
  openModal('modal-status');
}

async function confirmStatusUpdate() {
  const id = document.getElementById('status-order-id').value;
  const newStatus = document.getElementById('new-status-select').value;
  const result = await apiPatch('/api/orders/' + id + '/status', { orderStatus: newStatus });
  if (result && result.success) {
    toast('Order updated to ' + newStatus, 'success');
    loadOrders();
  } else {
    toast('Failed to update order status', 'error');
  }
  closeModal('modal-status');
}

/* ═══════════════════════════════════════════════════
   PRODUCTS — REAL API
═══════════════════════════════════════════════════ */
let PRODUCTS_DATA = [];
let currentProductFilter = 'all';
let editingProductId = null;

async function loadProducts(filter, search) {
  if (filter !== undefined) currentProductFilter = filter;
  let url = '/api/products?limit=100';
  const data = await apiGet(url);
  if (data && data.data && data.data.docs) {
    PRODUCTS_DATA = data.data.docs;
    renderProducts();
  }
}

function renderProducts(filter, search) {
  if (filter !== undefined) currentProductFilter = filter;
  const q = (search !== undefined ? search : (document.getElementById('product-search')?.value || '')).toLowerCase();
  const f = currentProductFilter;
  let data = PRODUCTS_DATA.filter(p => {
    if (f === 'instock')    return p.stock > 0;
    if (f === 'lowstock')   return p.stock > 0 && p.stock < 10;
    if (f === 'outofstock') return p.stock === 0;
    return true;
  });
  if (q) data = data.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));

  const all = PRODUCTS_DATA.length;
  const instock = PRODUCTS_DATA.filter(p => p.stock > 0).length;
  const low = PRODUCTS_DATA.filter(p => p.stock > 0 && p.stock < 10).length;
  const out = PRODUCTS_DATA.filter(p => p.stock === 0).length;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('prod-count-all', all);
  setEl('prod-count-instock', instock);
  setEl('prod-count-low', low);
  setEl('prod-count-out', out);

  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray);">No products found</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.8rem;">
          <div class="prod-img">
            ${p.images && p.images[0]
              ? `<img src="${p.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);">`
              : '📦'}
          </div>
          <div>
            <div class="fw-600">${p.name}</div>
            <div class="text-muted" style="font-size:.7rem;">${p.category}</div>
          </div>
        </div>
      </td>
      <td class="fw-600">₹${p.price}</td>
      <td class="text-muted">${p.offerPrice ? '₹' + p.offerPrice : '—'}</td>
      <td class="fw-600 ${p.stock < 5 ? 'text-danger' : ''}">${p.stock}</td>
      <td>${p.offerBadge ? `<span class="badge badge-blue">${p.offerBadge}</span>` : '—'}</td>
      <td>${p.isFeatured ? '<span class="badge badge-yellow">⭐ Featured</span>' : '<span class="badge badge-gray">No</span>'}</td>
      <td>${p.isActive ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="editProduct('${p._id}')" title="Edit">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteProduct('${p._id}')" title="Delete">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddProduct() {
  editingProductId = null;
  document.getElementById('modal-product-title').textContent = 'Add Product';
  document.getElementById('p-name').value = '';
  document.getElementById('p-slug').value = '';
  document.getElementById('p-price').value = '';
  document.getElementById('p-offer').value = '';
  document.getElementById('p-stock').value = '';
  document.getElementById('p-badge').value = '';
  openModal('modal-product');
}

function editProduct(id) {
  const p = PRODUCTS_DATA.find(x => x._id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('modal-product-title').textContent = 'Edit Product';
  document.getElementById('p-name').value  = p.name || '';
  document.getElementById('p-slug').value  = p.slug || '';
  document.getElementById('p-price').value = p.price || '';
  document.getElementById('p-offer').value = p.offerPrice || '';
  document.getElementById('p-stock').value = p.stock || '';
  document.getElementById('p-badge').value = p.offerBadge || '';
  openModal('modal-product');
}

async function saveProduct() {
  // Upload image first if file selected
let imageUrl = document.getElementById('product-image-url')?.value || '';
const fileInput = document.getElementById('product-image-file');
if (fileInput?.files[0]) {
  toast('Uploading image...', 'info');
  imageUrl = await uploadProductImage() || imageUrl;
}
  const name = document.getElementById('p-name').value.trim();
  if (!name) { toast('Product name is required!', 'error'); return; }
  const payload = {
    name,
    slug: document.getElementById('p-slug').value.trim() || undefined,
    price: +document.getElementById('p-price').value,
    offerPrice: +document.getElementById('p-offer').value || undefined,
    stock: +document.getElementById('p-stock').value,
    offerBadge: document.getElementById('p-badge').value.trim() || undefined,
    category: document.getElementById('p-category')?.value || 'Sneaker Care',
    shortDescription: document.getElementById('p-short-desc')?.value || '',
    description: document.getElementById('p-desc')?.value || '',
    isActive: true,
  };
  let result;
  if (editingProductId) {
    result = await apiPut('/api/products/' + editingProductId, payload);
  } else {
    result = await apiPost('/api/products', payload);
  }
  if (result && result.success) {
    toast('Product "' + name + '" saved!', 'success');
    closeModal('modal-product');
    loadProducts();
  } else {
    toast(result?.message || 'Failed to save product', 'error');
  }
}

async function deleteProduct(id) {
  const p = PRODUCTS_DATA.find(x => x._id === id);
  if (!confirm('Delete product "' + (p?.name || id) + '"?')) return;
  const result = await apiDelete('/api/products/' + id);
  if (result && result.success) {
    toast('Product deleted.', 'info');
    loadProducts();
  } else {
    toast('Failed to delete product', 'error');
  }
}

async function toggleFeatured(id) {
  const result = await apiPatch('/api/products/' + id + '/featured', {});
  if (result && result.success) {
    toast('Featured status updated!', 'success');
    loadProducts();
  }
}

/* ═══════════════════════════════════════════════════
   CUSTOMERS — REAL API
═══════════════════════════════════════════════════ */
let CUSTOMERS_DATA = [];
let currentCustomerFilter = 'all';

async function loadCustomers(filter, search) {
  if (filter !== undefined) currentCustomerFilter = filter;
  const url = '/api/customers?page=1&limit=100';
  const data = await apiGet(url);
  if (data && data.data && data.data.docs) {
    CUSTOMERS_DATA = data.data.docs;
    renderCustomers();
  }
}

function renderCustomers(filter, search) {
  if (filter !== undefined) currentCustomerFilter = filter;
  const q = (search !== undefined ? search : (document.getElementById('customer-search')?.value || '')).toLowerCase();
  const TYPE_BADGE = { repeat: 'badge-green', new: 'badge-blue', vip: 'badge-yellow' };
  let data = [...CUSTOMERS_DATA];
  if (currentCustomerFilter === 'repeat')      data = data.filter(c => c.totalOrders > 1);
  else if (currentCustomerFilter === 'highspenders') data.sort((a, b) => b.totalSpend - a.totalSpend);
  if (q) data = data.filter(c =>
    (c.name||'').toLowerCase().includes(q) ||
    (c.email||'').toLowerCase().includes(q) ||
    (c.phone||'').includes(q)
  );
  const tbody = document.getElementById('customers-tbody');
  if (!tbody) return;
  tbody.innerHTML = data.length ? data.map(c => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.7rem;">
          <div class="sidebar-avatar" style="width:32px;height:32px;font-size:.7rem;">
            ${(c.name||'?').split(' ').map(n => n[0]).join('').toUpperCase()}
          </div>
          <div class="fw-600">${c.name}</div>
        </div>
      </td>
      <td class="text-muted">${c.email}</td>
      <td>${c.phone || '—'}</td>
      <td class="fw-600">${c.totalOrders || 0}</td>
      <td class="fw-600 text-blue">₹${(c.totalSpend||0).toLocaleString()}</td>
      <td><span class="badge ${c.totalOrders > 3 ? 'badge-yellow' : c.totalOrders > 1 ? 'badge-green' : 'badge-blue'}">
        ${c.totalOrders > 3 ? 'VIP' : c.totalOrders > 1 ? 'Repeat' : 'New'}
      </span></td>
      <td class="text-muted">${new Date(c.createdAt).toLocaleDateString('en-IN', {month:'short',year:'numeric'})}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="toast('View orders for ${c.name}','info')">View Orders</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray);">No customers found</td></tr>`;
}

function filterCustomers(filter, el) {
  document.querySelectorAll('#page-customers .filter-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  loadCustomers(filter);
}

/* ═══════════════════════════════════════════════════
   REVIEWS — REAL API
═══════════════════════════════════════════════════ */
let REVIEWS_DATA = [];

async function loadReviews(filter = 'all') {
  let url = '/api/reviews?limit=100';
  if (filter !== 'all') url += '&status=' + filter;
  const data = await apiGet(url);
  if (data && data.data && data.data.docs) {
    REVIEWS_DATA = data.data.docs;
    renderReviews(filter);
  }
}

function renderReviews(filter = 'all') {
  let data = filter === 'all' ? REVIEWS_DATA : REVIEWS_DATA.filter(r => r.status === filter);
  const el = document.getElementById('reviews-list');
  if (!el) return;
  el.innerHTML = data.map(r => `
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div>
          <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.6rem;">
            <div class="sidebar-avatar" style="width:36px;height:36px;">
              ${(r.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase()}
            </div>
            <div>
              <div class="fw-600">${r.name}</div>
              <div class="text-muted" style="font-size:.7rem;">
                ${r.product?.name || 'Product'} · ${new Date(r.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>
          <div style="color:#facc15;margin-bottom:.5rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          <div style="font-size:.85rem;color:var(--gray-lt);max-width:500px;">"${r.comment || r.text || ''}"</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;">
          <span class="badge ${r.status==='approved'?'badge-green':r.status==='rejected'?'badge-red':'badge-yellow'}">${r.status}</span>
          <div style="display:flex;gap:.4rem;">
            ${r.status!=='approved'?`<button class="btn btn-success btn-sm" onclick="updateReview('${r._id}','approved')">✓ Approve</button>`:''}
            ${r.status!=='rejected'?`<button class="btn btn-danger btn-sm" onclick="updateReview('${r._id}','rejected')">✕ Reject</button>`:''}
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteReview('${r._id}')">🗑</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  const badge = document.getElementById('review-badge');
  if (badge) badge.textContent = REVIEWS_DATA.filter(r => r.status === 'pending').length;
}

function filterReviews(filter, el) {
  document.querySelectorAll('#page-reviews .filter-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  loadReviews(filter);
}

async function updateReview(id, status) {
  const result = await apiPatch('/api/reviews/' + id, { status });
  if (result && result.success) {
    toast('Review ' + status + '!', status === 'approved' ? 'success' : 'info');
    loadReviews();
  } else {
    toast('Failed to update review', 'error');
  }
}

async function deleteReview(id) {
  if (!confirm('Delete this review?')) return;
  const result = await apiDelete('/api/reviews/' + id);
  if (result && result.success) {
    toast('Review deleted.', 'info');
    loadReviews();
  }
}

/* ═══════════════════════════════════════════════════
   COUPONS — REAL API
═══════════════════════════════════════════════════ */
let COUPONS = [];

async function loadCoupons() {
  const data = await apiGet('/api/coupons');
  if (data && data.data) {
    COUPONS = data.data;
    renderCoupons();
  }
}

function renderCoupons() {
  const tbody = document.getElementById('coupons-tbody');
  if (!tbody) return;
  tbody.innerHTML = COUPONS.map(c => `
    <tr>
      <td><span class="mono fw-600 text-blue">${c.code}</span></td>
      <td>${c.type === 'percentage' ? 'Percentage' : 'Flat'}</td>
      <td class="fw-600">${c.type === 'percentage' ? c.value + '%' : '₹' + c.value}</td>
      <td>₹${c.minOrder || 0}</td>
      <td>${c.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-IN') : '—'}</td>
      <td>${c.usedCount || 0}/${c.usageLimit || '∞'}</td>
      <td>${c.isActive ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCoupon('${c._id}','${c.code}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function saveCoupon() {
  const code = document.getElementById('c-code').value.toUpperCase();
  if (!code) { toast('Coupon code is required!', 'error'); return; }
  const payload = {
    code,
    type: document.getElementById('c-type').value === 'percent' ? 'percentage' : 'flat',
    value: +document.getElementById('c-value').value,
    minOrder: +document.getElementById('c-min').value || 0,
    expiryDate: document.getElementById('c-expiry').value || undefined,
    usageLimit: +document.getElementById('c-limit').value || undefined,
    isActive: document.getElementById('c-active').checked,
  };
  const result = await apiPost('/api/coupons', payload);
  if (result && result.success) {
    toast('Coupon ' + code + ' created!', 'success');
    closeModal('modal-coupon');
    loadCoupons();
  } else {
    toast(result?.message || 'Failed to create coupon', 'error');
  }
}

async function deleteCoupon(id, code) {
  if (!confirm('Delete coupon ' + code + '?')) return;
  const result = await apiDelete('/api/coupons/' + id);
  if (result && result.success) {
    toast('Coupon deleted.', 'info');
    loadCoupons();
  }
}

/* ═══════════════════════════════════════════════════
   CAMPAIGNS — REAL API
═══════════════════════════════════════════════════ */
let CAMPAIGNS = [];

async function loadCampaigns() {
  const data = await apiGet('/api/campaigns');
  if (data && data.data) {
    CAMPAIGNS = data.data;
    renderCampaigns();
  }
}

function renderCampaigns() {
  const ST = { sent: 'badge-green', scheduled: 'badge-yellow', draft: 'badge-gray' };
  const tbody = document.getElementById('campaigns-tbody');
  if (!tbody) return;
  tbody.innerHTML = CAMPAIGNS.map(c => `
    <tr>
      <td class="fw-600">${c.name}</td>
      <td>${c.type || c.channel || '—'}</td>
      <td>${c.audience || '—'}</td>
      <td>${c.scheduledAt ? new Date(c.scheduledAt).toLocaleDateString('en-IN') : '—'}</td>
      <td><span class="badge ${ST[c.status] || 'badge-gray'}">${c.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="toast('Campaign: ${c.name}','info')">View</button>
      </td>
    </tr>
  `).join('');
}

/* ═══════════════════════════════════════════════════
   FAQs — REAL API
═══════════════════════════════════════════════════ */
let FAQS = [];

async function loadFaqs() {
  const data = await apiGet('/api/faqs');
  if (data && data.data) {
    FAQS = data.data;
    renderFaqs();
  }
}

function renderFaqs() {
  const el = document.getElementById('faq-list');
  if (!el) return;
  el.innerHTML = FAQS.map(f => `
    <div class="faq-item" id="faq-${f._id}">
      <div class="faq-q" onclick="toggleFaq('${f._id}')">
        <span><span class="badge badge-blue" style="margin-right:.5rem;">${f.category || f.cat || 'General'}</span>${f.question || f.q}</span>
        <div style="display:flex;gap:.4rem;align-items:center;">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deleteFaq('${f._id}')">🗑</button>
          <span>▾</span>
        </div>
      </div>
      <div class="faq-a">${f.answer || f.a}</div>
    </div>
  `).join('');
}

async function saveFaq() {
  const q = document.getElementById('faq-q').value.trim();
  const a = document.getElementById('faq-a').value.trim();
  if (!q || !a) { toast('Question and answer are required!', 'error'); return; }
  const payload = {
    category: document.getElementById('faq-cat').value,
    question: q,
    answer: a,
    isActive: true,
  };
  const result = await apiPost('/api/faqs', payload);
  if (result && result.success) {
    toast('FAQ added!', 'success');
    closeModal('modal-faq');
    loadFaqs();
  } else {
    toast(result?.message || 'Failed to save FAQ', 'error');
  }
}

async function deleteFaq(id) {
  if (!confirm('Delete this FAQ?')) return;
  const result = await apiDelete('/api/faqs/' + id);
  if (result && result.success) {
    toast('FAQ deleted.', 'info');
    loadFaqs();
  }
}

/* ═══════════════════════════════════════════════════
   NOTIFY LIST — REAL API
═══════════════════════════════════════════════════ */
let NOTIFY_LIST = [];

async function loadNotifyList() {
  const data = await apiGet('/api/notify-list');
  if (data && data.data) {
    NOTIFY_LIST = data.data;
    renderNotifyList();
  }
}

function renderNotifyList() {
  const tbody = document.getElementById('notify-tbody');
  if (!tbody) return;
  tbody.innerHTML = NOTIFY_LIST.map(n => `
    <tr>
      <td class="fw-600">${n.name}</td>
      <td>${n.email}</td>
      <td>${n.phone || '—'}</td>
      <td class="text-muted">${n.address || '—'}</td>
      <td class="text-muted">${new Date(n.createdAt).toLocaleDateString('en-IN')}</td>
      <td>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteNotify('${n._id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

async function deleteNotify(id) {
  const result = await apiDelete('/api/notify-list/' + id);
  if (result && result.success) {
    toast('Entry deleted.', 'info');
    loadNotifyList();
  }
}

/* ═══════════════════════════════════════════════════
   CONTACTS — REAL API
═══════════════════════════════════════════════════ */
let CONTACTS = [];

async function loadContacts() {
  const data = await apiGet('/api/contacts');
  if (data && data.data) {
    CONTACTS = data.data;
    renderContacts();
  }
}

function renderContacts() {
  const ST = { open: 'badge-yellow', resolved: 'badge-green' };
  const tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  tbody.innerHTML = CONTACTS.map(c => `
    <tr>
      <td class="fw-600">${c.name}</td>
      <td>${c.email}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.message}</td>
      <td class="text-muted">${new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
      <td><span class="badge ${ST[c.status] || 'badge-gray'}">${c.status}</span></td>
      <td>
        <div style="display:flex;gap:.3rem;">
          ${c.status !== 'resolved' ? `<button class="btn btn-success btn-sm" onclick="resolveContact('${c._id}')">✓ Resolve</button>` : ''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteContact('${c._id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function resolveContact(id) {
  const result = await apiPatch('/api/contacts/' + id, { status: 'resolved' });
  if (result && result.success) {
    toast('Marked as resolved!', 'success');
    loadContacts();
  }
}

async function deleteContact(id) {
  const result = await apiDelete('/api/contacts/' + id);
  if (result && result.success) {
    toast('Deleted.', 'info');
    loadContacts();
  }
}

/* ═══════════════════════════════════════════════════
   ADMIN USERS — REAL API
═══════════════════════════════════════════════════ */
let ADMIN_USERS = [];

async function loadAdminUsers() {
  const data = await apiGet('/api/admins');
  if (data && data.data) {
    ADMIN_USERS = data.data;
    renderAdminUsers();
  }
}

function renderAdminUsers() {
  const ROLE_BADGE = { super_admin: 'badge-yellow', admin: 'badge-blue', editor: 'badge-cyan', viewer: 'badge-gray' };
  const el = document.getElementById('admin-users-list');
  if (!el) return;
  el.innerHTML = ADMIN_USERS.map((a, i) => `
    <div class="admin-user-card">
      <div class="admin-avatar">${(a.name||'A').split(' ').map(n=>n[0]).join('').toUpperCase()}</div>
      <div class="admin-info">
        <div class="admin-name">${a.name}</div>
        <div class="admin-email">${a.email}</div>
      </div>
      <span class="badge ${ROLE_BADGE[a.role] || 'badge-gray'}">${a.role}</span>
      <div class="admin-actions">
        ${a.role !== 'super_admin' ? `<button class="btn btn-danger btn-sm btn-icon" onclick="deleteAdminUser('${a._id}')">🗑</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function deleteAdminUser(id) {
  if (!confirm('Remove this admin user?')) return;
  const result = await apiDelete('/api/admins/' + id);
  if (result && result.success) {
    toast('Admin removed.', 'info');
    loadAdminUsers();
  }
}

/* ═══════════════════════════════════════════════════
   ACTIVITY LOG — REAL API
═══════════════════════════════════════════════════ */
async function loadActivityLog() {
  const data = await apiGet('/api/activity-log?limit=50');
  if (data && data.data && data.data.docs) {
    renderActivityLogFromAPI(data.data.docs);
  }
}

function renderActivityLogFromAPI(logs) {
  const typeIcons = { order:'🛒', product:'📦', customer:'👤', review:'⭐', admin:'🔑', payment:'💳', system:'⚙️', marketing:'🎯' };
  const statusColors = { success:'var(--success)', failure:'var(--danger)', error:'var(--danger)' };

  // Sidebar widget (top 8)
  const sideEl = document.getElementById('activity-log');
  if (sideEl) {
    sideEl.innerHTML = logs.slice(0, 8).map(a => `
      <div style="padding:.7rem 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;flex-direction:column;gap:.2rem;">
        <div style="font-size:.8rem;">${a.action}</div>
        <div style="font-size:.68rem;color:var(--gray);">by ${a.adminName} · ${new Date(a.createdAt).toLocaleDateString('en-IN')}</div>
      </div>
    `).join('');
  }

  // Full page
  const pageEl = document.getElementById('activity-log-page');
  if (pageEl) {
    pageEl.innerHTML = logs.map(l => `
      <div class="log-item">
        <div style="font-size:1.1rem;width:28px;text-align:center;flex-shrink:0;">${typeIcons[l.module] || '📝'}</div>
        <div style="flex:1;min-width:0;">
          <div class="log-action">${l.action}</div>
          <div class="log-meta">
            <span>${l.details}</span>
          </div>
          <div class="log-meta" style="margin-top:.2rem;">
            <span>👤 ${l.adminName}</span>
            <span>🕐 ${new Date(l.createdAt).toLocaleString('en-IN')}</span>
            ${l.ip ? `<span>🌐 ${l.ip}</span>` : ''}
            <span class="log-badge" style="background:${statusColors[l.status]||'var(--bg-4)'};color:#fff;opacity:.85;">${l.status}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
}

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS — REAL API
═══════════════════════════════════════════════════ */
async function loadNotifications() {
  const data = await apiGet('/api/notifications?limit=20');
  if (data && data.data && data.data.docs) {
    NOTIFICATIONS = data.data.docs.map(n => ({
      id: n._id,
      category: n.type,
      icon: { order:'🛒', review:'⭐', customer:'👤', inventory:'📦', admin:'🔑', system:'⚙️', payment:'💳' }[n.type] || '🔔',
      title: n.title,
      message: n.message,
      time: new Date(n.createdAt).toLocaleTimeString('en-IN'),
      ts: new Date(n.createdAt).getTime(),
      read: n.read,
      link: n.link || 'dashboard',
    }));
    updateNotifBadge();
    renderNotifications();
  }
}

/* ═══════════════════════════════════════════════════
   ORDERS
═══════════════════════════════════════════════════ */
const STATUS_BADGE = {
  pending:'badge-yellow',confirmed:'badge-blue',processing:'badge-cyan',
  shipped:'badge-blue',delivered:'badge-green',cancelled:'badge-red'
};
const PAY_BADGE = {paid:'badge-green',pending:'badge-yellow',failed:'badge-red'};

function renderOrders(filter='all', search='') {
  let data = ORDERS.filter(o=> filter==='all'||o.status===filter);
  if(search) data = data.filter(o=>o.id.toLowerCase().includes(search)||o.customer.toLowerCase().includes(search)||o.phone.includes(search));
  document.getElementById('orders-tbody').innerHTML = data.map(o=>`
    <tr>
      <td class="mono text-blue">#${o.id}</td>
      <td class="fw-600">${o.customer}</td>
      <td class="text-muted">${o.phone}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.products}</td>
      <td class="fw-600">₹${o.amount}</td>
      <td>${o.payment}</td>
      <td><span class="badge ${PAY_BADGE[o.payStatus]||'badge-gray'}">${o.payStatus}</span></td>
      <td><span class="badge ${STATUS_BADGE[o.status]||'badge-gray'}">${o.status}</span></td>
      <td class="text-muted">${o.date}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="viewOrder('${o.id}')" title="View">👁</button>
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openStatusModal('${o.id}')" title="Update Status">✏️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterOrders(filter, el) {
  document.querySelectorAll('#page-orders .filter-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderOrders(filter, document.getElementById('order-search')?.value||'');
}

function searchOrders(q) {
  const activeFilter = document.querySelector('#page-orders .filter-tab.active')?.textContent?.trim().toLowerCase()||'all';
  renderOrders(activeFilter==='all orders'?'all':activeFilter, q);
}

function openStatusModal(id) {
  document.getElementById('status-order-id').value = id;
  const o = ORDERS.find(x=>x.id===id);
  if(o) document.getElementById('new-status-select').value = o.status;
  openModal('modal-status');
}

function confirmStatusUpdate() {
  const id = document.getElementById('status-order-id').value;
  const newStatus = document.getElementById('new-status-select').value;
  const o = ORDERS.find(x=>x.id===id);
  if(o) {
    o.status=newStatus;
    renderOrders();
    toast(`Order #${id} updated to ${newStatus}`,'success');
    addActivityEntry('order',`Order status updated`,`Order #${id} status changed to "${newStatus}".`,'Super Admin','success');
    addSystemNotif('order',`🛒 Order ${newStatus}`,`Order #${id} has been updated to "${newStatus}".`,'Super Admin');
  }
  closeModal('modal-status');
}

/* ═══════════════════════════════════════════════════
   PRODUCTS
═══════════════════════════════════════════════════ */


function renderProducts(filter, search) {
  if(filter!==undefined) currentProductFilter = filter;
  const q = (search!==undefined ? search : (document.getElementById('product-search')?.value||'')).toLowerCase();
  const f = currentProductFilter;
  let data = PRODUCTS_DATA.filter(p=>{
    if(f==='instock')    return p.stock>0;
    if(f==='lowstock')   return p.stock>0 && p.stock<10;
    if(f==='outofstock') return p.stock===0;
    return true;
  });
  if(q) data = data.filter(p=>p.name.toLowerCase().includes(q)||p.category.toLowerCase().includes(q)||p.id.toLowerCase().includes(q));

  document.getElementById('products-tbody').innerHTML = data.length ? data.map(p=>`
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.8rem;">
          <div class="prod-img">${p.emoji}</div>
          <div>
            <div class="fw-600">${p.name}</div>
            <div class="text-muted" style="font-size:.7rem;margin-top:.1rem;">${p.id}</div>
          </div>
        </div>
      </td>
      <td>${p.category}</td>
      <td class="fw-600">₹${p.price}</td>
      <td>${p.offer?`<span class="text-success fw-600">₹${p.offer}</span>`:'<span class="text-muted">—</span>'}</td>
      <td>
        <span class="${p.stock===0?'text-danger':p.stock<10?'text-warning':'text-success'} fw-600">${p.stock}</span>
        ${p.stock===0?'<span class="badge badge-red" style="margin-left:.3rem;">Out</span>':p.stock<10?'<span class="badge badge-yellow" style="margin-left:.3rem;">Low</span>':''}
      </td>
      <td>${p.stock>0?'<span class="badge badge-green">In Stock</span>':'<span class="badge badge-red">Out of Stock</span>'}</td>
      <td>${p.featured?'<span class="badge badge-blue">⭐ Featured</span>':'<span class="text-muted">—</span>'}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-secondary btn-sm" onclick="editProduct('${p.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteProduct('${p.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray);">No products found</td></tr>`;

  // Update counts
  const all = PRODUCTS_DATA.length;
  const instock = PRODUCTS_DATA.filter(p=>p.stock>0).length;
  const low = PRODUCTS_DATA.filter(p=>p.stock>0&&p.stock<10).length;
  const out = PRODUCTS_DATA.filter(p=>p.stock===0).length;
  const set = (id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n?`(${n})`:'';};
  set('pf-count-all',all);set('pf-count-instock',instock);set('pf-count-lowstock',low);set('pf-count-outofstock',out);
}

function filterProducts(filter, el) {
  document.querySelectorAll('#page-products .filter-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderProducts(filter);
}

function openAddProduct() {
  document.getElementById('modal-product-title').textContent='Add New Product';
  document.getElementById('p-name').value='';
  document.getElementById('p-slug').value='';
  document.getElementById('p-price').value='';
  document.getElementById('p-offer').value='';
  document.getElementById('p-desc').value='';
  document.getElementById('p-fulldesc').value='';
  document.getElementById('p-stock').value='';
  document.getElementById('p-badge').value='';
  document.getElementById('p-img').value='';
  openModal('modal-product');
}

function editProduct(id) {
  const p = PRODUCTS_DATA.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('modal-product-title').textContent='Edit Product';
  document.getElementById('p-name').value=p.name;
  document.getElementById('p-slug').value=p.id;
  document.getElementById('p-price').value=p.price;
  document.getElementById('p-offer').value=p.offer||'';
  document.getElementById('p-stock').value=p.stock;
  document.getElementById('p-badge').value=p.badge||'';
  openModal('modal-product');
}

function saveProduct() {
  const name = document.getElementById('p-name').value;
  const slug = document.getElementById('p-slug').value;
  const price = parseFloat(document.getElementById('p-price').value);
  const offer = document.getElementById('p-offer').value;
  const stock = parseInt(document.getElementById('p-stock').value);
  const badge = document.getElementById('p-badge').value;
  const imgUrl = document.getElementById('p-img').value;

  if (!name) { toast('Product name is required!', 'error'); return; }

  const existingIndex = PRODUCTS_DATA.findIndex(x => x.id === slug);

  const productObj = {
    id: slug || name.toLowerCase().replace(/\s+/g, '-'),
    name: name,
    price: price || 0,
    offerPrice: offer ? parseFloat(offer) : null,
    offerBadge: badge || null,
    stock: stock || 0,
    images: imgUrl ? [imgUrl] : [],   // 👈 THIS is the images fix
    isFeatured: false,
  };

  if (existingIndex !== -1) {
    // Edit existing product
    PRODUCTS_DATA[existingIndex] = { ...PRODUCTS_DATA[existingIndex], ...productObj };
  } else {
    // Add new product
    PRODUCTS_DATA.push(productObj);
  }

  toast(`Product "${name}" saved successfully!`, 'success');
  addActivityEntry('product', 'Product saved', `Product "${name}" was saved by admin.`, 'Super Admin', 'success');
  addSystemNotif('inventory', '📦 Product Updated', `Product "${name}" was updated.`, 'Super Admin');
  closeModal('modal-product');
  renderProducts();
}

function deleteProduct(id) {
  if(confirm('Delete this product?')) {
    const p = PRODUCTS_DATA.find(x=>x.id===id);
    PRODUCTS_DATA = PRODUCTS_DATA.filter(p=>p.id!==id);
    renderProducts();
    toast('Product deleted.','info');
    if(p){
      addActivityEntry('product','Product deleted',`Product "${p.name}" was deleted.`,'Super Admin','error');
      addSystemNotif('inventory','🗑 Product Deleted',`Product "${p.name}" was removed from catalog.`,'Super Admin');
    }
  }
}

/* ═══════════════════════════════════════════════════
   CUSTOMERS
═══════════════════════════════════════════════════ */


function renderCustomers(filter, search) {
  if(filter!==undefined) currentCustomerFilter = filter;
  const q = (search!==undefined ? search : (document.getElementById('customer-search')?.value||'')).toLowerCase();
  const f = currentCustomerFilter;
  const TYPE_BADGE = {New:'badge-blue',Repeat:'badge-green',VIP:'badge-yellow'};

  let data = [...CUSTOMERS_DATA];
  if(f==='new')          data.sort((a,b)=>b.joined.localeCompare(a.joined));
  else if(f==='repeat')  data = data.filter(c=>c.orders>1);
  else if(f==='highspenders') data.sort((a,b)=>b.spent-a.spent);

  if(q) data = data.filter(c=>c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q)||c.phone.includes(q));

  document.getElementById('customers-tbody').innerHTML = data.length ? data.map(c=>`
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.7rem;">
          <div class="sidebar-avatar" style="width:32px;height:32px;font-size:.7rem;">${c.name.split(' ').map(n=>n[0]).join('')}</div>
          <div class="fw-600">${c.name}</div>
        </div>
      </td>
      <td class="text-muted">${c.email}</td>
      <td>${c.phone}</td>
      <td class="fw-600">${c.orders}</td>
      <td class="fw-600 text-blue">₹${c.spent.toLocaleString()}</td>
      <td><span class="badge ${TYPE_BADGE[c.type]||'badge-gray'}">${c.type}</span></td>
      <td class="text-muted">${c.joined}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="toast('Order history for ${c.name}','info')">View Orders</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray);">No customers found</td></tr>`;
}

function filterCustomers(filter, el) {
  document.querySelectorAll('#page-customers .filter-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderCustomers(filter);
}

/* ═══════════════════════════════════════════════════
   REVIEWS
═══════════════════════════════════════════════════ */
function renderReviews(filter='all') {
  let data = REVIEWS_DATA.filter(r=>filter==='all'||r.status===filter);
  document.getElementById('reviews-list').innerHTML = data.map(r=>`
    <div class="card" style="margin-bottom:1rem;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div>
          <div style="display:flex;align-items:center;gap:.8rem;margin-bottom:.6rem;">
            <div class="sidebar-avatar" style="width:36px;height:36px;">${r.name.split(' ').map(n=>n[0]).join('')}</div>
            <div>
              <div class="fw-600">${r.name}</div>
              <div class="text-muted" style="font-size:.7rem;">${r.product} · ${r.date}</div>
            </div>
          </div>
          <div style="color:#facc15;margin-bottom:.5rem;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
          <div style="font-size:.85rem;color:var(--gray-lt);max-width:500px;">"${r.text}"</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;">
          <span class="badge ${r.status==='approved'?'badge-green':r.status==='rejected'?'badge-red':'badge-yellow'}">${r.status}</span>
          <div style="display:flex;gap:.4rem;">
            ${r.status!=='approved'?`<button class="btn btn-success btn-sm" onclick="updateReview(${r.id},'approved')">✓ Approve</button>`:''}
            ${r.status!=='rejected'?`<button class="btn btn-danger btn-sm" onclick="updateReview(${r.id},'rejected')">✕ Reject</button>`:''}
            <button class="btn btn-danger btn-sm btn-icon" onclick="deleteReview(${r.id})">🗑</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('review-badge').textContent = REVIEWS_DATA.filter(r=>r.status==='pending').length;
}

function filterReviews(filter, el) {
  document.querySelectorAll('#page-reviews .filter-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderReviews(filter);
}

function updateReview(id, status) {
  const r = REVIEWS_DATA.find(x=>x.id===id);
  if(r){
    r.status=status;
    renderReviews();
    toast(`Review ${status}!`,status==='approved'?'success':'info');
    addActivityEntry('review',`Review ${status}`,`Review by ${r.name} was ${status}.`,'Super Admin',status==='approved'?'success':'info');
    addSystemNotif('review',`⭐ Review ${status}`,`Review from ${r.name} (${r.product}) has been ${status}.`,'Super Admin');
  }
}

function deleteReview(id) {
  if(confirm('Delete this review?')) {
    REVIEWS_DATA = REVIEWS_DATA.filter(r=>r.id!==id);
    renderReviews();
    toast('Review deleted.','info');
  }
}

/* ═══════════════════════════════════════════════════
   MARKETING
═══════════════════════════════════════════════════ */
function renderCoupons() {
  document.getElementById('coupons-tbody').innerHTML = COUPONS.map(c=>`
    <tr>
      <td><span class="mono fw-600 text-blue">${c.code}</span></td>
      <td>${c.type==='percent'?'Percentage':'Flat'}</td>
      <td class="fw-600">${c.type==='percent'?c.value+'%':'₹'+c.value}</td>
      <td>₹${c.min}</td>
      <td>${c.expiry}</td>
      <td>${c.used}/${c.limit}</td>
      <td>${c.active?'<span class="badge badge-green">Active</span>':'<span class="badge badge-gray">Inactive</span>'}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-secondary btn-sm" onclick="toast('Edit coupon: ${c.code}','info')">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCoupon('${c.code}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderCampaigns() {
  const ST = {sent:'badge-green',scheduled:'badge-yellow',draft:'badge-gray'};
  document.getElementById('campaigns-tbody').innerHTML = CAMPAIGNS.map(c=>`
    <tr>
      <td class="fw-600">${c.name}</td>
      <td>${c.channel}</td>
      <td>${c.audience}</td>
      <td>${c.scheduled}</td>
      <td><span class="badge ${ST[c.status]||'badge-gray'}">${c.status}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="toast('Viewing campaign: ${c.name}','info')">View</button>
      </td>
    </tr>
  `).join('');
}

function openAddCoupon() {
  document.getElementById('c-code').value='';
  document.getElementById('c-value').value='';
  document.getElementById('c-min').value='';
  document.getElementById('c-limit').value='';
  openModal('modal-coupon');
}

function saveCoupon() {
  const code = document.getElementById('c-code').value.toUpperCase();
  if(!code) { toast('Coupon code is required!','error'); return; }
  const newCoupon = {
    code,type:document.getElementById('c-type').value,
    value:+document.getElementById('c-value').value,
    min:+document.getElementById('c-min').value,
    expiry:document.getElementById('c-expiry').value||'2025-12-31',
    used:0,limit:+document.getElementById('c-limit').value||100,
    active:document.getElementById('c-active').checked
  };
  COUPONS.push(newCoupon);
  renderCoupons();
  toast(`Coupon ${code} created!`,'success');
  addActivityEntry('marketing','Coupon created',`Coupon "${code}" created with ${newCoupon.type==='percent'?newCoupon.value+'%':'₹'+newCoupon.value} discount.`,'Super Admin','success');
  addSystemNotif('system','🎟 Coupon Created',`New coupon "${code}" has been created.`,'Super Admin');
  closeModal('modal-coupon');
}

function deleteCoupon(code) {
  if(confirm('Delete coupon '+code+'?')) {
    COUPONS = COUPONS.filter(c=>c.code!==code);
    renderCoupons();
    toast('Coupon deleted.','info');
  }
}

function openAddCampaign() { openModal('modal-campaign'); }

function switchMarketingTab(id, el) {
  document.querySelectorAll('#page-marketing .settings-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#page-marketing .settings-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('m-'+id).classList.add('active');
}

/* ═══════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════ */
function renderFaqs() {
  document.getElementById('faq-list').innerHTML = FAQS.map(f=>`
    <div class="faq-item" id="faq-${f.id}">
      <div class="faq-q" onclick="toggleFaq(${f.id})">
        <span><span class="badge badge-blue" style="margin-right:.5rem;">${f.cat}</span>${f.q}</span>
        <div style="display:flex;gap:.4rem;align-items:center;">
          <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deleteFaq(${f.id})">🗑</button>
          <span>▾</span>
        </div>
      </div>
      <div class="faq-a">${f.a}</div>
    </div>
  `).join('');
}

function toggleFaq(id) {
  document.getElementById('faq-'+id).classList.toggle('open');
}

function openAddFaq() {
  document.getElementById('faq-q').value='';
  document.getElementById('faq-a').value='';
  openModal('modal-faq');
}

function saveFaq() {
  const q = document.getElementById('faq-q').value;
  const a = document.getElementById('faq-a').value;
  if(!q||!a) { toast('Question and answer are required!','error'); return; }
  FAQS.push({id:Date.now(),cat:document.getElementById('faq-cat').value,q,a});
  renderFaqs();
  toast('FAQ added and published to website!','success');
  closeModal('modal-faq');
}

function deleteFaq(id) {
  if(confirm('Delete this FAQ?')) {
    FAQS = FAQS.filter(f=>f.id!==id);
    renderFaqs();
    toast('FAQ deleted.','info');
  }
}

/* ═══════════════════════════════════════════════════
   CHATBOT
═══════════════════════════════════════════════════ */
function renderQuickReplies() {
  document.getElementById('quick-replies-list').innerHTML = QUICK_REPLIES.map((r,i)=>`
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem;background:var(--bg-3);border-radius:var(--radius);margin-bottom:.4rem;">
      <div style="flex:1;">
        <div class="fw-600" style="font-size:.8rem;">${r.label}</div>
        <div class="text-muted" style="font-size:.7rem;margin-top:.2rem;">${r.response.slice(0,60)}…</div>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteQuickReply(${i})">🗑</button>
    </div>
  `).join('');
}

function renderAutoResponses() {
  document.getElementById('auto-responses-list').innerHTML = AUTO_RESPONSES.map((r,i)=>`
    <div style="display:flex;align-items:center;gap:.6rem;padding:.6rem;background:var(--bg-3);border-radius:var(--radius);margin-bottom:.4rem;">
      <div style="flex:1;">
        <div class="fw-600" style="font-size:.8rem;">Trigger: "${r.trigger}"</div>
        <div class="text-muted" style="font-size:.7rem;margin-top:.2rem;">${r.response.slice(0,60)}…</div>
      </div>
      <button class="btn btn-danger btn-sm btn-icon" onclick="deleteAutoResponse(${i})">🗑</button>
    </div>
  `).join('');
}

function openAddQuickReply() { openModal('modal-qr'); }

function saveQuickReply() {
  const label = document.getElementById('qr-label').value;
  const response = document.getElementById('qr-response').value;
  if(!label||!response) { toast('Label and response required!','error'); return; }
  QUICK_REPLIES.push({label,response});
  renderQuickReplies();
  toast('Quick reply added!','success');
  closeModal('modal-qr');
}

function deleteQuickReply(i) { QUICK_REPLIES.splice(i,1); renderQuickReplies(); toast('Deleted.','info'); }
function deleteAutoResponse(i) { AUTO_RESPONSES.splice(i,1); renderAutoResponses(); toast('Deleted.','info'); }
function openAddAutoResponse() { toast('Feature: add auto response trigger','info'); }

/* ═══════════════════════════════════════════════════
   NOTIFY LIST
═══════════════════════════════════════════════════ */
function renderNotifyList() {
  document.getElementById('notify-tbody').innerHTML = NOTIFY_LIST.map((n,i)=>`
    <tr>
      <td class="fw-600">${n.name}</td>
      <td>${n.email}</td>
      <td>${n.phone}</td>
      <td class="text-muted">${n.address}</td>
      <td class="text-muted">${n.date}</td>
      <td>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteNotify(${i})">🗑</button>
      </td>
    </tr>
  `).join('');
}

function deleteNotify(i) { NOTIFY_LIST.splice(i,1); renderNotifyList(); toast('Entry deleted.','info'); }

/* ═══════════════════════════════════════════════════
   CONTACT MESSAGES
═══════════════════════════════════════════════════ */
function renderContacts() {
  const ST = {unread:'badge-yellow',resolved:'badge-green'};
  document.getElementById('contacts-tbody').innerHTML = CONTACTS.map((c,i)=>`
    <tr>
      <td class="fw-600">${c.name}</td>
      <td>${c.email}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.message}</td>
      <td class="text-muted">${c.date}</td>
      <td><span class="badge ${ST[c.status]||'badge-gray'}">${c.status}</span></td>
      <td>
        <div style="display:flex;gap:.3rem;">
          ${c.status!=='resolved'?`<button class="btn btn-success btn-sm" onclick="resolveContact(${i})">✓ Resolve</button>`:''}
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteContact(${i})">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function resolveContact(i) { CONTACTS[i].status='resolved'; renderContacts(); toast('Marked as resolved!','success'); }
function deleteContact(i) { CONTACTS.splice(i,1); renderContacts(); toast('Deleted.','info'); }

/* ═══════════════════════════════════════════════════
   ADMIN USERS
═══════════════════════════════════════════════════ */
function renderAdminUsers() {
  const ROLE_BADGE = {'Super Admin':'badge-yellow','Manager':'badge-blue','Support Staff':'badge-gray'};
  document.getElementById('admin-users-list').innerHTML = ADMIN_USERS.map((a,i)=>`
    <div class="admin-user-card">
      <div class="admin-avatar">${a.initials}</div>
      <div class="admin-info">
        <div class="admin-name">${a.name}</div>
        <div class="admin-email">${a.email}</div>
      </div>
      <span class="badge ${ROLE_BADGE[a.role]||'badge-gray'}">${a.role}</span>
      <div class="admin-actions">
        <button class="btn btn-secondary btn-sm btn-icon" onclick="toast('Edit admin: ${a.name}','info')">✏️</button>
        ${i>0?`<button class="btn btn-danger btn-sm btn-icon" onclick="deleteAdmin(${i})">🗑</button>`:''}
      </div>
    </div>
  `).join('');
}

function openAddAdmin() { openModal('modal-admin'); }
function deleteAdmin(i) {
  if(confirm('Remove admin user?')) {
    ADMIN_USERS.splice(i,1);
    renderAdminUsers();
    toast('Admin removed.','info');
  }
}

/* ═══════════════════════════════════════════════════
   SETTINGS TABS
═══════════════════════════════════════════════════ */
function switchSettingsTab(id, el) {
  document.querySelectorAll('#page-settings .settings-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('#page-settings .settings-panel').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('s-'+id).classList.add('active');
}

/* ═══════════════════════════════════════════════════
   CHARTS
═══════════════════════════════════════════════════ */
Chart.defaults.color = '#6666aa';
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';

function initCharts() {
  // Revenue Chart
  new Chart(document.getElementById('revenue-chart'), {
    type:'line',
    data:{
      labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets:[{
        label:'Revenue (₹)',
        data:[3200,4800,3700,6200,4100,8900,4197],
        borderColor:'#0057ff',backgroundColor:'rgba(0,87,255,0.08)',
        borderWidth:2,fill:true,tension:0.4,
        pointBackgroundColor:'#0057ff',pointBorderWidth:0,pointRadius:4,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{display:false}},
        y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{callback:v=>'₹'+v.toLocaleString()}}
      }
    }
  });

  // Order Donut
  new Chart(document.getElementById('order-donut'), {
    type:'doughnut',
    data:{
      labels:['Delivered','Shipped','Processing','Pending','Cancelled'],
      datasets:[{
        data:[198,23,12,4,8],
        backgroundColor:['#22c55e','#0057ff','#06b6d4','#f59e0b','#ef4444'],
        borderWidth:0,hoverOffset:6
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'72%',
      plugins:{legend:{position:'bottom',labels:{padding:12,boxWidth:10}}}
    }
  });

  // Analytics Revenue
  new Chart(document.getElementById('analytics-revenue-chart'), {
    type:'bar',
    data:{
      labels:['Jan','Feb','Mar','Apr','May'],
      datasets:[{
        label:'Revenue',
        data:[18000,24000,31000,28000,41000],
        backgroundColor:'rgba(0,87,255,0.6)',borderRadius:6,
        hoverBackgroundColor:'rgba(0,87,255,0.9)',
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{grid:{display:false}},
        y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{callback:v=>'₹'+v.toLocaleString()}}
      }
    }
  });

  // Traffic Sources
  new Chart(document.getElementById('traffic-chart'), {
    type:'doughnut',
    data:{
      labels:['Instagram','WhatsApp','Google','Direct'],
      datasets:[{
        data:[42,28,18,12],
        backgroundColor:['#e1306c','#25d366','#4285f4','#9999bb'],
        borderWidth:0,hoverOffset:6
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,cutout:'68%',
      plugins:{legend:{position:'bottom',labels:{padding:12,boxWidth:10}}}
    }
  });

  // Customer Growth
  new Chart(document.getElementById('customer-growth-chart'), {
    type:'line',
    data:{
      labels:['Jan','Feb','Mar','Apr','May'],
      datasets:[{
        label:'Customers',
        data:[48,87,142,219,284],
        borderColor:'#22c55e',backgroundColor:'rgba(34,197,94,0.08)',
        borderWidth:2,fill:true,tension:0.4,
        pointBackgroundColor:'#22c55e',pointRadius:4,
      }]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false}},y:{grid:{color:'rgba(255,255,255,0.04)'}}}
    }
  });
}

/* ═══════════════════════════════════════════════════
   NOTIFICATIONS SYSTEM
═══════════════════════════════════════════════════ */
let NOTIFICATIONS = [
  {id:1,category:'order',icon:'🛒',title:'New Order Placed',message:'Order #HL-0072 placed by Rahul Sharma for ₹629 (COD)',time:'2 min ago',ts:Date.now()-120000,read:false,link:'orders'},
  {id:2,category:'order',icon:'🛒',title:'Order Status Updated',message:'Order #HL-0071 has been updated to Processing',time:'5 min ago',ts:Date.now()-300000,read:false,link:'orders'},
  {id:3,category:'review',icon:'⭐',title:'New Review Submitted',message:'Arjun K. left a 5-star review on Sneaker Kit — pending approval',time:'1 hour ago',ts:Date.now()-3600000,read:false,link:'reviews'},
  {id:4,category:'customer',icon:'👤',title:'New Customer Registered',message:'Priya Mehta (priya@gmail.com) just created an account',time:'2 hours ago',ts:Date.now()-7200000,read:true,link:'customers'},
  {id:5,category:'inventory',icon:'📦',title:'Low Stock Alert',message:'Premium Sneaker Foam has only 5 units remaining',time:'3 hours ago',ts:Date.now()-10800000,read:false,link:'products'},
  {id:6,category:'inventory',icon:'📦',title:'Low Stock Alert',message:'Pro Cleaning Brush has only 7 units remaining',time:'3 hours ago',ts:Date.now()-10900000,read:true,link:'products'},
  {id:7,category:'system',icon:'⚙️',title:'Settings Updated',message:'Announcement bar text was updated by Super Admin',time:'5 hours ago',ts:Date.now()-18000000,read:true,link:'settings'},
  {id:8,category:'order',icon:'💳',title:'Payment Received',message:'₹897 online payment confirmed for order #HL-0070',time:'Yesterday',ts:Date.now()-86400000,read:true,link:'orders'},
];
let notifIdCounter = 9;

function addSystemNotif(category,title,message,user){
  const icons={order:'🛒',review:'⭐',customer:'👤',inventory:'📦',admin:'🔑',system:'⚙️',payment:'💳'};
  const linkMap={order:'orders',review:'reviews',customer:'customers',inventory:'products',admin:'admins',system:'settings',payment:'orders'};
  NOTIFICATIONS.unshift({
    id:notifIdCounter++,category,icon:icons[category]||'🔔',title,message,
    time:'Just now',ts:Date.now(),read:false,link:linkMap[category]||'dashboard',user
  });
  updateNotifBadge();
  if(document.getElementById('page-notifications')?.classList.contains('active')) renderNotifications();
}

function updateNotifBadge(){
  const unread = NOTIFICATIONS.filter(n=>!n.read).length;
  const badge = document.getElementById('notif-count-badge');
  const navBadge = document.getElementById('notif-nav-badge');
  if(badge){ badge.textContent=unread; badge.style.display=unread?'flex':'none'; }
  if(navBadge){ navBadge.textContent=unread; navBadge.style.display=unread?'flex':'none'; }
}

let currentNotifFilter = 'all';
function filterNotifs(cat, el){
  document.querySelectorAll('#page-notifications .filter-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  currentNotifFilter = cat;
  renderNotifications();
}

function renderNotifications(){
  const f = currentNotifFilter;
  let data = f==='all' ? NOTIFICATIONS : NOTIFICATIONS.filter(n=>n.category===f);
  const list = document.getElementById('notifications-list');
  const empty = document.getElementById('notif-empty');
  if(!list) return;
  if(!data.length){ list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const catClass={order:'notif-cat-order',review:'notif-cat-review',customer:'notif-cat-customer',
    inventory:'notif-cat-inventory',admin:'notif-cat-admin',system:'notif-cat-system',payment:'notif-cat-payment'};
  list.innerHTML = data.map(n=>`
    <div class="notif-item ${n.read?'':'unread'}" onclick="openNotifLink('${n.link}',${n.id})">
      <div class="notif-icon-wrap">${n.icon}</div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-meta">
          <span class="notif-time">🕐 ${n.time}</span>
          <span class="notif-cat-badge ${catClass[n.category]||''}">${n.category}</span>
          ${n.user?`<span class="notif-time">by ${n.user}</span>`:''}
        </div>
      </div>
      <div class="notif-actions">
        ${!n.read?`<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();markNotifRead(${n.id})" title="Mark as read" style="padding:.3rem .6rem;font-size:.65rem;">✓</button>`:''}
        <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deleteNotif(${n.id})" title="Delete" style="width:28px;height:28px;">✕</button>
      </div>
      ${!n.read?'<div class="unread-dot"></div>':''}
    </div>
  `).join('');
}

function openNotifLink(link,id){
  markNotifRead(id);
  goPage(link,null);
}
function markNotifRead(id){
  const n=NOTIFICATIONS.find(x=>x.id===id);
  if(n){n.read=true;}
  updateNotifBadge();
  renderNotifications();
}
function markAllNotifsRead(){ NOTIFICATIONS.forEach(n=>n.read=true); updateNotifBadge(); renderNotifications(); toast('All notifications marked as read.','success'); }
function clearAllNotifs(){ if(confirm('Clear all notifications?')){ NOTIFICATIONS=[]; updateNotifBadge(); renderNotifications(); toast('All notifications cleared.','info'); } }
function deleteNotif(id){ NOTIFICATIONS=NOTIFICATIONS.filter(n=>n.id!==id); updateNotifBadge(); renderNotifications(); }

/* ═══════════════════════════════════════════════════
   ACTIVITY LOG SYSTEM
═══════════════════════════════════════════════════ */
let ACTIVITY_LOG_FULL = [
  {id:1,type:'order',action:'Order status updated',detail:'Order #HL-0071 updated to Processing',user:'Super Admin',ip:'192.168.1.1',status:'success',ts:Date.now()-120000,timeStr:'2 min ago'},
  {id:2,type:'marketing',action:'Coupon created',detail:'Coupon WELCOME50 created with 50₹ flat discount',user:'Ravi Kumar',ip:'192.168.1.2',status:'success',ts:Date.now()-3600000,timeStr:'1 hour ago'},
  {id:3,type:'review',action:'Review approved',detail:'Review from Rahul S. on Sneaker Care Kit approved',user:'Super Admin',ip:'192.168.1.1',status:'success',ts:Date.now()-10800000,timeStr:'3 hours ago'},
  {id:4,type:'product',action:'Product stock updated',detail:'Sneaker Care Kit stock updated to 9 units',user:'Super Admin',ip:'192.168.1.1',status:'success',ts:Date.now()-18000000,timeStr:'5 hours ago'},
  {id:5,type:'marketing',action:'Campaign created',detail:'Campaign "Launch Campaign" scheduled for 2025-05-01',user:'Ravi Kumar',ip:'192.168.1.2',status:'success',ts:Date.now()-86400000,timeStr:'1 day ago'},
  {id:6,type:'admin',action:'Admin logged in',detail:'Super Admin logged into the admin panel',user:'Super Admin',ip:'192.168.1.1',status:'success',ts:Date.now()-90000000,timeStr:'1 day ago'},
];
let logIdCounter = 7;
const LOG_PAGE_SIZE = 20;
let logCurrentPage = 1;

function addActivityEntry(type,action,detail,user,status='success'){
  ACTIVITY_LOG_FULL.unshift({
    id:logIdCounter++,type,action,detail,user,ip:'192.168.x.x',
    status,ts:Date.now(),timeStr:'Just now'
  });
  renderActivityLog(); // update the sidebar widget
  if(document.getElementById('page-activitylog')?.classList.contains('active')) renderActivityLogPage();
}

function renderActivityLog() {
  const el = document.getElementById('activity-log');
  if(!el) return;
  el.innerHTML = ACTIVITY_LOG_FULL.slice(0,8).map(a=>`
    <div style="padding:.7rem 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;flex-direction:column;gap:.2rem;">
      <div style="font-size:.8rem;">${a.action}</div>
      <div style="font-size:.68rem;color:var(--gray);">by ${a.user} · ${a.timeStr}</div>
    </div>
  `).join('');
}

function renderActivityLogPage(){
  const typeFilter = document.getElementById('log-filter-type')?.value||'all';
  const userFilter = document.getElementById('log-filter-user')?.value||'all';
  const q = (document.getElementById('log-search')?.value||'').toLowerCase();
  const typeIcons={order:'🛒',product:'📦',customer:'👤',review:'⭐',admin:'🔑',payment:'💳',system:'⚙️',marketing:'🎯'};
  const statusColors={success:'var(--success)',error:'var(--danger)',info:'var(--blue-lt)',warning:'var(--warning)'};

  let data = ACTIVITY_LOG_FULL.filter(l=>{
    if(typeFilter!=='all'&&l.type!==typeFilter) return false;
    if(userFilter!=='all'&&l.user!==userFilter) return false;
    if(q&&!l.action.toLowerCase().includes(q)&&!l.detail.toLowerCase().includes(q)&&!l.user.toLowerCase().includes(q)) return false;
    return true;
  });

  const total = data.length;
  const totalPages = Math.max(1,Math.ceil(total/LOG_PAGE_SIZE));
  logCurrentPage = Math.min(logCurrentPage, totalPages);
  const paged = data.slice((logCurrentPage-1)*LOG_PAGE_SIZE, logCurrentPage*LOG_PAGE_SIZE);

  const el = document.getElementById('activity-log-page');
  if(!el) return;
  el.innerHTML = paged.length ? paged.map(l=>`
    <div class="log-item">
      <div class="log-type-dot log-type-${l.type}" style="background:${statusColors[l.status]||'var(--gray)'}"></div>
      <div style="font-size:1.1rem;width:28px;text-align:center;flex-shrink:0;">${typeIcons[l.type]||'📝'}</div>
      <div style="flex:1;min-width:0;">
        <div class="log-action">${l.action}</div>
        <div class="log-meta">
          <span>${l.detail}</span>
        </div>
        <div class="log-meta" style="margin-top:.2rem;">
          <span>👤 ${l.user}</span>
          <span>🕐 ${l.timeStr}</span>
          ${l.ip?`<span>🌐 ${l.ip}</span>`:''}
          <span class="log-badge" style="background:${statusColors[l.status]||'var(--bg-4)'};color:#fff;opacity:.85;">${l.status}</span>
        </div>
      </div>
    </div>
  `).join('') : `<div style="text-align:center;padding:3rem;color:var(--gray);">No activity logs found</div>`;

  // Pagination
  const pag = document.getElementById('log-pagination');
  if(!pag) return;
  if(totalPages<=1){ pag.innerHTML=''; return; }
  let btns='';
  for(let i=1;i<=totalPages;i++){
    btns+=`<button onclick="logGoPage(${i})" class="btn btn-sm ${i===logCurrentPage?'btn-primary':'btn-secondary'}">${i}</button>`;
  }
  pag.innerHTML=btns;
}

function logGoPage(p){ logCurrentPage=p; renderActivityLogPage(); }

function exportActivityLog(){
  const rows=[['ID','Type','Action','Detail','User','IP','Status','Time'],...ACTIVITY_LOG_FULL.map(l=>[l.id,l.type,l.action,`"${l.detail}"`,l.user,l.ip||'',l.status,l.timeStr])];
  const csv=rows.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='hashlay-activity-log.csv';
  a.click();
  toast('Activity log exported!','success');
}

/* ═══════════════════════════════════════════════════
   SHIPPING ZONES (EDITABLE)
═══════════════════════════════════════════════════ */
const ALL_INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
  'Andaman & Nicobar','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Lakshadweep','Puducherry'
];

let SHIPPING_ZONES = [
  {id:'zone-a',name:'Zone A — Metro Cities',desc:'Low delivery charge',charge:40,freeAbove:599,states:['Maharashtra','Karnataka','Delhi','Tamil Nadu','Gujarat','Telangana','West Bengal']},
  {id:'zone-b',name:'Zone B — Tier 2 Cities',desc:'Standard delivery',charge:50,freeAbove:599,states:['Andhra Pradesh','Rajasthan','Uttar Pradesh','Madhya Pradesh','Kerala']},
  {id:'zone-c',name:'Zone C — Tier 3 States',desc:'Higher delivery area',charge:65,freeAbove:699,states:['Bihar','Odisha','Jharkhand','Chhattisgarh','Goa','Uttarakhand']},
  {id:'zone-d',name:'Zone D — Remote Areas',desc:'Remote delivery',charge:100,freeAbove:999,states:['Assam','Sikkim','Manipur','Nagaland','Ladakh','Andaman & Nicobar']},
];

function renderShippingZones(){
  const container = document.getElementById('shipping-zones-list');
  if(!container) return;
  container.innerHTML = SHIPPING_ZONES.map(z=>{
    const usedStates = SHIPPING_ZONES.flatMap(x=>x.id!==z.id?x.states:[]);
    const available = ALL_INDIAN_STATES.filter(s=>!usedStates.includes(s)&&!z.states.includes(s));
    return `
    <div class="zone-card" id="zcard-${z.id}">
      <div class="zone-header">
        <div>
          <div class="zone-name">${z.name}</div>
          ${z.desc?`<div style="font-size:.7rem;color:var(--gray);">${z.desc}</div>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;">
          <div class="zone-charge">₹${z.charge} | Free above ₹${z.freeAbove}</div>
          <button class="zone-card-toggle" onclick="toggleZoneEdit('${z.id}')">⚙️ Edit</button>
        </div>
      </div>
      <div class="zone-states" id="zone-states-${z.id}">
        ${z.states.map(s=>`
          <span class="zone-state-removable" title="Click to remove">
            ${s}
            <button class="zone-state-remove" onclick="removeState('${z.id}','${s}')" title="Remove ${s}">✕</button>
          </span>
        `).join('')}
      </div>
      <div class="zone-edit-section" id="zedit-${z.id}" style="display:none;border-top:1px solid rgba(255,255,255,.06);margin-top:1rem;padding-top:1rem;">
        <div class="zone-inputs">
          <div>
            <label style="font-size:.65rem;color:var(--gray-lt);text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:.3rem;">Delivery Charge (₹)</label>
            <input class="zone-input-sm" type="number" id="zcharge-${z.id}" value="${z.charge}" min="0"/>
          </div>
          <div>
            <label style="font-size:.65rem;color:var(--gray-lt);text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:.3rem;">Free Delivery Above (₹)</label>
            <input class="zone-input-sm" type="number" id="zfree-${z.id}" value="${z.freeAbove}" min="0"/>
          </div>
        </div>
        <div class="zone-edit-row" style="margin-top:.8rem;">
          <select class="zone-select-sm" id="zstate-add-${z.id}" style="flex:1;">
            <option value="">— Select state to add —</option>
            ${available.map(s=>`<option value="${s}">${s}</option>`).join('')}
          </select>
          <button class="zone-save-btn" onclick="addState('${z.id}')" style="background:rgba(34,197,94,.2);color:#4ade80;border:1px solid rgba(34,197,94,.3);">+ Add State</button>
          <button class="zone-save-btn" onclick="saveZone('${z.id}')">💾 Save Zone</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleZoneEdit(id){
  const el = document.getElementById('zedit-'+id);
  if(!el) return;
  el.style.display = el.style.display==='none' ? 'block' : 'none';
}

function addState(zoneId){
  const sel = document.getElementById('zstate-add-'+zoneId);
  const state = sel?.value;
  if(!state){ toast('Please select a state to add.','error'); return; }
  const zone = SHIPPING_ZONES.find(z=>z.id===zoneId);
  if(!zone) return;
  if(zone.states.includes(state)){ toast('State already in this zone!','error'); return; }
  // Check if state is in another zone
  const otherZone = SHIPPING_ZONES.find(z=>z.id!==zoneId&&z.states.includes(state));
  if(otherZone){ toast(`"${state}" is already in ${otherZone.name}. Remove it first.`,'error'); return; }
  zone.states.push(state);
  renderShippingZones();
  // Re-open the edit section
  setTimeout(()=>{ const el=document.getElementById('zedit-'+zoneId); if(el) el.style.display='block'; },50);
  toast(`${state} added to ${zone.name}!`,'success');
  addActivityEntry('system','Shipping zone updated',`State "${state}" added to ${zone.name}.`,'Super Admin','success');
}

function removeState(zoneId, state){
  const zone = SHIPPING_ZONES.find(z=>z.id===zoneId);
  if(!zone) return;
  zone.states = zone.states.filter(s=>s!==state);
  renderShippingZones();
  setTimeout(()=>{ const el=document.getElementById('zedit-'+zoneId); if(el) el.style.display='block'; },50);
  toast(`${state} removed from zone.`,'info');
}

function saveZone(zoneId){
  const zone = SHIPPING_ZONES.find(z=>z.id===zoneId);
  if(!zone) return;
  const charge = +document.getElementById('zcharge-'+zoneId)?.value;
  const freeAbove = +document.getElementById('zfree-'+zoneId)?.value;
  if(isNaN(charge)||charge<0){ toast('Invalid delivery charge!','error'); return; }
  if(isNaN(freeAbove)||freeAbove<0){ toast('Invalid free delivery amount!','error'); return; }
  zone.charge = charge;
  zone.freeAbove = freeAbove;
  renderShippingZones();
  toast(`${zone.name} saved successfully!`,'success');
  addActivityEntry('system','Shipping zone saved',`${zone.name} — Charge: ₹${charge}, Free above: ₹${freeAbove}.`,'Super Admin','success');
}

/* ═══════════════════════════════════════════════════
   INVOICE GENERATION
═══════════════════════════════════════════════════ */
let currentInvoiceOrderId = null;

function viewOrder(id) {
  currentInvoiceOrderId = id;
  const o = ORDERS.find(x=>x.id===id);
  if(!o) return;
  document.getElementById('modal-order-id').textContent = `Order #${o.id}`;
  document.getElementById('modal-order-body').innerHTML = `
    <div class="grid-2" style="margin-bottom:1.2rem;">
      <div>
        <div class="form-label">Customer</div>
        <div class="fw-600">${o.customer}</div>
      </div>
      <div>
        <div class="form-label">Phone</div>
        <div>${o.phone}</div>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:1.2rem;">
      <div>
        <div class="form-label">Amount</div>
        <div class="fw-600 text-blue" style="font-size:1.2rem;">₹${o.amount}</div>
      </div>
      <div>
        <div class="form-label">Payment</div>
        <span class="badge ${PAY_BADGE[o.payStatus]||'badge-gray'}">${o.payment} · ${o.payStatus}</span>
      </div>
    </div>
    <div style="margin-bottom:1.2rem;">
      <div class="form-label">Products</div>
      <div>${o.products}</div>
    </div>
    <div style="margin-bottom:1.5rem;">
      <div class="form-label">Status</div>
      <span class="badge ${STATUS_BADGE[o.status]}">${o.status}</span>
    </div>
    <div class="form-label" style="margin-bottom:.6rem;">Order Timeline</div>
    <div class="timeline">
      ${['pending','confirmed','processing','shipped','delivered'].map((s,i)=>{
        const stepsDone = ['pending','confirmed','processing','shipped','delivered'].indexOf(o.status);
        const done = i<=stepsDone;
        return `<div class="tl-item ${done?'done':''}">
          <div class="tl-status" style="color:${done?'var(--blue-lt)':'var(--gray)'}">${s.charAt(0).toUpperCase()+s.slice(1)}</div>
          <div class="tl-time">${done?'Completed':'Pending'}</div>
        </div>`;
      }).join('')}
    </div>
  `;
  openModal('modal-order');
}

function generateInvoiceHTML(orderId) {
  const o = ORDERS.find(x=>x.id===orderId);
  if(!o) return '';
  const invNum = 'INV-'+orderId+'-'+new Date().getFullYear();
  const orderDate = o.date || new Date().toISOString().slice(0,10);
  const codCharge = o.payment==='COD' ? 30 : 0;
  const deliveryCharge = o.amount >= 599 ? 0 : 60;
  const subtotal = o.amount - codCharge - deliveryCharge;

  return `
  <div id="invoice-preview">
    <div class="inv-header">
      <div class="inv-logo-box">
        <div class="inv-logo-icon">H</div>
        <div>
          <div class="inv-logo-text">HASHLAY</div>
          <div class="inv-logo-sub">Deserved Care For Everything You Own</div>
          <div style="font-size:.72rem;color:#6b7280;margin-top:.2rem;">hello@hashlay.in · hashlay.in</div>
          <div style="font-size:.72rem;color:#6b7280;">Mumbai, Maharashtra, India</div>
        </div>
      </div>
      <div class="inv-meta-right">
        <div class="inv-number">${invNum}</div>
        <div class="inv-meta-row">Order: #${o.id}</div>
        <div class="inv-meta-row">Date: ${orderDate}</div>
        <div class="inv-meta-row">Status: <strong style="color:${o.status==='delivered'?'#22c55e':o.status==='cancelled'?'#ef4444':'#f59e0b'}">${o.status.toUpperCase()}</strong></div>
      </div>
    </div>

    <div class="inv-grid-2">
      <div>
        <div class="inv-section-title">Bill To</div>
        <div class="inv-field-value">${o.customer}</div>
        <div class="inv-field-label" style="margin-top:.4rem;">Phone</div>
        <div style="font-size:.85rem;color:#374151;">${o.phone}</div>
      </div>
      <div>
        <div class="inv-section-title">Payment Details</div>
        <div class="inv-field-label">Method</div>
        <div class="inv-field-value">${o.payment==='COD'?'Cash on Delivery':'Online Payment (Razorpay)'}</div>
        <div class="inv-field-label" style="margin-top:.4rem;">Payment Status</div>
        <div class="inv-field-value" style="color:${o.payStatus==='paid'?'#22c55e':'#f59e0b'}">${o.payStatus.toUpperCase()}</div>
      </div>
    </div>

    <div class="inv-section">
      <div class="inv-section-title">Order Items</div>
      <table class="inv-table">
        <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>
          ${o.products.split(',').map((prod,i)=>{
            const parts = prod.trim().match(/^(.+)\sx(\d+)$/i);
            const name = parts ? parts[1].trim() : prod.trim();
            const qty = parts ? parseInt(parts[2]) : 1;
            const unitPrice = Math.round(subtotal / (o.products.split(',').length));
            return `<tr>
              <td style="color:#9ca3af;">${i+1}</td>
              <td style="font-weight:600;">${name}</td>
              <td>${qty}</td>
              <td>₹${unitPrice}</td>
              <td style="font-weight:700;">₹${unitPrice*qty}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div class="inv-totals">
      <div class="inv-total-row"><span>Subtotal</span><span>₹${subtotal}</span></div>
      <div class="inv-total-row"><span>Delivery Charge</span><span>${deliveryCharge===0?'<span style="color:#22c55e;">FREE</span>':'₹'+deliveryCharge}</span></div>
      ${codCharge?`<div class="inv-total-row"><span>COD Handling</span><span>₹${codCharge}</span></div>`:''}
      <div class="inv-total-row final"><span>TOTAL</span><span>₹${o.amount}</span></div>
    </div>

    <div class="inv-footer">
      <div>Thank you for shopping with Hashlay! 💙</div>
      <div style="margin-top:.4rem;">For support: hello@hashlay.in | hashlay.in</div>
      <div style="margin-top:.4rem;font-size:.65rem;">This is a computer-generated invoice and does not require a signature.</div>
    </div>
  </div>`;
}

function printInvoice(){
  if(!currentInvoiceOrderId){ toast('No order selected','error'); return; }
  const html = generateInvoiceHTML(currentInvoiceOrderId);
  const printArea = document.getElementById('invoice-print-area');
  printArea.style.display='block';
  printArea.innerHTML = html;
  window.print();
  printArea.style.display='none';
  addActivityEntry('order','Invoice printed',`Invoice for order #${currentInvoiceOrderId} was printed.`,'Super Admin','success');
  toast('Invoice sent to printer!','success');
}

function downloadInvoicePDF() {
  if (!currentInvoiceOrderId) { 
    toast('No order selected', 'error'); 
    return; 
  }

  const html = generateInvoiceHTML(currentInvoiceOrderId);

  // Grab all styles safely
  let styles = '';
  try {
    document.querySelectorAll('style').forEach(s => {
      styles += s.textContent;
    });
  } catch(e) {
    styles = '';
  }

  const win = window.open('', '_blank');
  if (!win) {
    toast('Popup blocked — allow popups and try again', 'error');
    return;
  }

  win.document.write(`<!DOCTYPE html>
  <html>
  <head>
    <title>Invoice #${currentInvoiceOrderId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      body { margin:0; padding:1.5rem; font-family:'DM Sans',sans-serif; background:#fff; color:#000; }
      ${styles}
      @media print { body { margin:0; padding:1rem; } }
    </style>
  </head>
  <body>
    ${html}
    <scr` + `ipt>
      window.onload = () => {
        setTimeout(() => { window.print(); }, 500);
      };
    </scr` + `ipt>
  </body>
  </html>`);

  win.document.close();

  addActivityEntry('order', 'Invoice downloaded', 
    `Invoice PDF for order #${currentInvoiceOrderId} downloaded.`, 
    'Super Admin', 'success');

  toast('Invoice opening for download...', 'success');
}
async function apiGet(endpoint) {
  try {
    const res = await fetch(API_BASE+endpoint, {
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+localStorage.getItem('hl_token')
      }
    });
    if(!res.ok) throw new Error('API Error');
    return await res.json();
  } catch(e) {
    console.warn('[Admin API]',endpoint,'failed:',e.message);
    return null;
  }
}

async function apiPost(endpoint, data) {
  try {
    const res = await fetch(API_BASE+endpoint, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+localStorage.getItem('hl_token')
      },
      body:JSON.stringify(data)
    });
    return await res.json();
  } catch(e) {
    console.warn('[Admin API] POST',endpoint,'failed:',e.message);
    return null;
  }
}

async function apiPatch(endpoint, data) {
  try {
    const res = await fetch(API_BASE+endpoint, {
      method:'PATCH',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+localStorage.getItem('hl_token')
      },
      body:JSON.stringify(data)
    });
    return await res.json();
  } catch(e) { return null; }
}

async function apiDelete(endpoint) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('hl_token')
      }
    });
    return await res.json();
  } catch(e) {
    console.warn('[Admin API] DELETE', endpoint, 'failed:', e.message);
    return null;
  }
}

async function apiPut(endpoint, data) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('hl_token')
      },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch(e) {
    console.warn('[Admin API] PUT', endpoint, 'failed:', e.message);
    return null;
  }
}
