/* ═══════════════════════════════════════════
   ShopBot AI — app.js  (full version)
   · Canvas particle network
   · Typewriter effect
   · 3D card tilt on hover
   · Ctrl+click / Double-click → open product URL
   · Skeleton loaders
   · Confetti on order success
   · Ripple buttons
   · Sort & filter
   · History sidebar + detail modal
   ═══════════════════════════════════════════ */

const API = "http://localhost:8000";

/* ════ STATE ════ */
let sessionId   = `s_${Date.now()}`;
let isBusy      = false;
let allProducts = [];

/* ════ DOM ════ */
const $  = id => document.getElementById(id);
const chatBox      = $('chatMessages');
const chatInput    = $('chatInput');
const sendBtn      = $('sendBtn');
const productsArea = $('productsArea');
const emptyState   = $('emptyState');
const countBadge   = $('countBadge');
const productCount = $('productCount');
const sortControls = $('sortControls');

/* ════════════════════════════════════════════
   1. PARTICLE CANVAS
   ════════════════════════════════════════════ */
(() => {
  const canvas = $('particleCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];
  const mouse = { x: -999, y: -999 };
  const COUNT = 55, MAX_DIST = 130;
  const COLORS = ['#5b8af0','#9d6cff','#2dd4a0','#7ba3ff'];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }

  function mkPart() {
    return { x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-.5)*.45, vy: (Math.random()-.5)*.45,
      r: Math.random()*1.8+.8,
      color: COLORS[Math.floor(Math.random()*COLORS.length)],
      alpha: Math.random()*.5+.2 };
  }

  function tick() {
    ctx.clearRect(0,0,W,H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      const dx = p.x-mouse.x, dy = p.y-mouse.y, d = Math.hypot(dx,dy);
      if (d < 100) { p.x += (dx/d)*.8; p.y += (dy/d)*.8; }
      if (p.x<0||p.x>W) p.vx*=-1;
      if (p.y<0||p.y>H) p.vy*=-1;
    });
    for (let i=0;i<particles.length;i++) for (let j=i+1;j<particles.length;j++) {
      const a=particles[i],b=particles[j], d=Math.hypot(a.x-b.x,a.y-b.y);
      if (d<MAX_DIST) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
        ctx.strokeStyle=`rgba(91,138,240,${(1-d/MAX_DIST)*.15})`; ctx.lineWidth=.7; ctx.stroke(); }
    }
    particles.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.color+Math.floor(p.alpha*255).toString(16).padStart(2,'0'); ctx.fill(); });
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  document.addEventListener('mousemove', e => { mouse.x=e.clientX; mouse.y=e.clientY; });
  resize();
  particles = Array.from({length:COUNT}, mkPart);
  tick();
})();

/* ════════════════════════════════════════════
   2. TEXTAREA AUTO-RESIZE
   ════════════════════════════════════════════ */
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 130) + 'px';
});
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

/* ════════════════════════════════════════════
   3. SEND MESSAGE
   ════════════════════════════════════════════ */
async function sendMessage() {
  const text    = chatInput.value.trim();
  const address = $('addressInput').value.trim();
  if (!text || isBusy) return;

  hideQuickChips();
  appendUserMsg(text);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  triggerSendRipple();
  setLoading(true);
  showSkeletons();
  const typingId = appendTyping();

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, session_id: sessionId, address }),
    });
    if (!res.ok) throw new Error((await res.json()).detail || 'API error');
    const data = await res.json();
    sessionId = data.session_id;
    removeTyping(typingId);
    hideSkeletons();
    appendBotMsg(data.reply);
    if (data.action_type === 'search' && data.products?.length) {
      renderProducts(data.products);
    } else if (data.action_type === 'order' && data.order) {
      clearSkeletons();
      showOrderModal(data.order);
    } else {
      clearSkeletons();
    }
  } catch (err) {
    removeTyping(typingId);
    hideSkeletons();
    appendBotMsg(`❌ Lỗi: ${err.message}`);
    showToast('❌ Không kết nối được server', 'error');
  } finally {
    setLoading(false);
  }
}

function sendQuick(text) {
  chatInput.value = text;
  sendMessage();
}

/* ════════════════════════════════════════════
   4. CHAT HELPERS
   ════════════════════════════════════════════ */
function appendUserMsg(text) {
  const div = document.createElement('div');
  div.className = 'message user-message';
  div.innerHTML = `<div class="msg-body"><div class="msg-bubble user-bubble">${escHtml(text)}</div></div>`;
  chatBox.appendChild(div);
  scrollChat();
}

function appendBotMsg(text) {
  const div = document.createElement('div');
  div.className = 'message bot-message';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble bot-bubble';
  div.innerHTML = `<div class="avatar-wrap"><div class="bot-avatar"><span class="avatar-emoji">🛒</span><div class="avatar-glow"></div></div></div>`;
  const body = document.createElement('div');
  body.className = 'msg-body';
  body.appendChild(bubble);
  div.appendChild(body);
  chatBox.appendChild(div);
  scrollChat();
  typewriter(bubble, formatMd(text));
}

function typewriter(el, html, speed = 12) {
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  el.appendChild(cursor);
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const plain = temp.textContent;
  let i = 0;
  const iv = setInterval(() => {
    const ratio = i / plain.length;
    const partLen = Math.ceil(html.length * ratio);
    el.innerHTML = html.substring(0, partLen);
    el.appendChild(cursor);
    i += 2;
    if (i >= plain.length) {
      clearInterval(iv);
      el.innerHTML = html;
      cursor.remove();
      scrollChat();
    }
  }, speed);
}

function appendTyping() {
  const id = `typing_${Date.now()}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'message bot-message';
  div.innerHTML = `
    <div class="avatar-wrap"><div class="bot-avatar"><span class="avatar-emoji">🛒</span><div class="avatar-glow"></div></div></div>
    <div class="msg-body">
      <div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>
    </div>`;
  chatBox.appendChild(div);
  scrollChat();
  return id;
}

function removeTyping(id) {
  const el = $(id);
  if (el) { el.style.opacity = '0'; setTimeout(() => el?.remove(), 200); }
}

function hideQuickChips() {
  const qc = $('quickChips');
  if (qc) { qc.style.transition='all .3s'; qc.style.opacity='0'; qc.style.transform='translateY(-10px)'; setTimeout(()=>qc.remove(),300); }
}

function scrollChat() {
  requestAnimationFrame(() => { chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' }); });
}

function setLoading(val) {
  isBusy = val;
  sendBtn.disabled = val;
  chatInput.disabled = val;
  sendBtn.style.opacity = val ? '.5' : '1';
}

/* ════════════════════════════════════════════
   5. SKELETON LOADERS
   ════════════════════════════════════════════ */
const SK_IDS = ['sk1','sk2','sk3','sk4'];

function showSkeletons() {
  emptyState.style.display = 'none';
  productsArea.querySelectorAll('.product-card').forEach(c => c.remove());
  SK_IDS.forEach((id, i) => {
    const sk = document.createElement('div');
    sk.id = id; sk.className = 'skeleton-card';
    sk.style.animationDelay = `${i*80}ms`;
    sk.innerHTML = `<div class="sk-img"></div><div class="sk-lines">
      <div class="sk-line" style="width:85%"></div>
      <div class="sk-line" style="width:55%"></div>
      <div class="sk-line" style="width:40%"></div>
      <div class="sk-line" style="width:70%;height:8px;margin-top:4px"></div>
    </div>`;
    productsArea.appendChild(sk);
  });
}

function hideSkeletons() {
  SK_IDS.forEach(id => {
    const el = $(id);
    if (el) { el.style.transition='opacity .25s'; el.style.opacity='0'; setTimeout(()=>el.remove(),250); }
  });
}

function clearSkeletons() {
  hideSkeletons();
  setTimeout(() => {
    if (!productsArea.querySelector('.product-card')) emptyState.style.display = 'flex';
  }, 300);
}

/* ════════════════════════════════════════════
   6. PRODUCT CARDS
   ════════════════════════════════════════════ */
function renderProducts(products) {
  allProducts = products;
  displayProducts(products);
  sortControls.style.opacity = '1';
}

function displayProducts(products) {
  productsArea.querySelectorAll('.product-card,.skeleton-card').forEach(c => {
    c.style.transition='opacity .2s'; c.style.opacity='0';
    setTimeout(()=>c.remove(),200);
  });
  emptyState.style.display = 'none';
  setTimeout(() => {
    products.forEach((p, i) => productsArea.appendChild(buildCard(p, i)));
    productCount.textContent = products.length;
    countBadge.classList.add('bump');
    setTimeout(()=>countBadge.classList.remove('bump'), 800);
  }, 220);
}

function buildCard(p, idx) {
  const card = document.createElement('div');
  card.className = 'product-card ripple-btn';
  card.style.animationDelay = `${idx*70}ms`;

  const thumbHtml = p.thumbnail
    ? `<img class="card-img" src="${p.thumbnail}" alt="${escHtml(p.title)}" loading="lazy"
         onerror="this.parentElement.innerHTML='<div class=\\'img-placeholder\\'>📦</div>'">
       <div class="img-overlay"></div>`
    : `<div class="img-placeholder">📦</div>`;

  const ratingHtml = p.rating
    ? `<span class="meta-rating">⭐ ${p.rating}${p.reviews ? ` (${fmtNum(p.reviews)})` : ''}</span>`
    : '';

  card.innerHTML = `
    <div class="click-hint">Ctrl+click / 2×click để mở</div>
    ${idx < 3 ? `<div class="card-rank">${idx+1}</div>` : ''}
    <div class="card-img-wrap">${thumbHtml}</div>
    <div class="card-body">
      <div class="card-name" title="${escHtml(p.title)}">${escHtml(p.title)}</div>
      <div class="card-price">
        ${escHtml(p.price || 'Liên hệ')}
        ${idx === 0 ? '<span class="price-tag">GIÁ TỐT</span>' : ''}
      </div>
      <div class="card-meta">
        <span class="meta-source">${escHtml(p.source || 'Google Shopping')}</span>
        ${ratingHtml}
      </div>
      <div class="card-actions">
        <a class="card-btn btn-link" href="${p.link || '#'}" target="_blank" rel="noopener noreferrer">
          🔗 Xem trang
        </a>
        <button class="card-btn btn-buy ripple-btn"
          onclick="handleOrder(${JSON.stringify(JSON.stringify(p))})">
          🛒 Đặt hàng
        </button>
      </div>
    </div>`;

  // ── Ctrl+click: open product URL in new tab ──
  card.addEventListener('click', e => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      openProductLink(p.link);
      return;
    }
    addRipple(card, e);
  });

  // ── Double-click: open product URL in new tab ──
  card.addEventListener('dblclick', e => {
    e.preventDefault();
    e.stopPropagation();
    openProductLink(p.link);
  });

  // ── 3D magnetic tilt ──
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const rx = ((e.clientY - r.top - r.height/2) / (r.height/2)) * 4;
    const ry = ((e.clientX - r.left - r.width/2) / (r.width/2)) * -4;
    card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(4px)`;
    card.style.setProperty('--mx', `${(e.clientX-r.left)/r.width*100}%`);
    card.style.setProperty('--my', `${(e.clientY-r.top)/r.height*100}%`);
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform .5s cubic-bezier(.25,.46,.45,.94)';
    setTimeout(()=>card.style.transition='',500);
  });

  return card;
}

function openProductLink(link) {
  if (!link || link === '#') {
    showToast('⚠️ Không có link cho sản phẩm này', 'warn');
    return;
  }
  window.open(link, '_blank', 'noopener,noreferrer');
  showToast('🔗 Đang mở trang sản phẩm...', 'info');
}

/* ════════════════════════════════════════════
   7. SORT
   ════════════════════════════════════════════ */
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.sort;
    let sorted = [...allProducts];
    if (mode === 'price-asc')  sorted.sort((a,b)=>parsePrice(a.price)-parsePrice(b.price));
    if (mode === 'price-desc') sorted.sort((a,b)=>parsePrice(b.price)-parsePrice(a.price));
    displayProducts(sorted);
  });
});

function parsePrice(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[^0-9.]/g,'')) || 0;
}

/* ════════════════════════════════════════════
   8. ORDER FLOW
   ════════════════════════════════════════════ */
async function handleOrder(productJson) {
  const p = JSON.parse(productJson);
  const address = $('addressInput').value.trim();

  const confirmMsg = `Xác nhận đặt hàng:\n\n📦 ${p.title}\n💰 ${p.price || 'Liên hệ'}\n🏪 ${p.source || 'Google Shopping'}${address ? `\n📍 Giao đến: ${address}` : ''}`;
  if (!confirm(confirmMsg)) return;

  const orderMsg = `Đặt hàng: ${p.title}, giá ${p.price||'không rõ'}, từ ${p.source||'unknown'}${address ? `, giao đến ${address}` : ''}`;
  appendUserMsg(`🛒 Đặt hàng: ${p.title}`);
  setLoading(true);
  const typingId = appendTyping();

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: orderMsg, session_id: sessionId, address }),
    });
    const data = await res.json();
    removeTyping(typingId);
    appendBotMsg(data.reply);
    if (data.order) showOrderModal(data.order);
  } catch {
    removeTyping(typingId);
    appendBotMsg('❌ Không thể đặt hàng lúc này, vui lòng thử lại!');
  } finally {
    setLoading(false);
  }
}

/* ════════════════════════════════════════════
   9. ORDER MODAL + CONFETTI
   ════════════════════════════════════════════ */
function showOrderModal(order) {
  const rows = [
    ['Mã đơn hàng', `<span class="order-id">${order.order_id}</span>`],
    ['Sản phẩm',    escHtml(order.product)],
    ['Số lượng',    `${order.quantity} sản phẩm`],
    ['Giá',         `<span class="price-value">${escHtml(order.price)}</span>`],
    ['Cửa hàng',    escHtml(order.store)],
    ['Địa chỉ',     escHtml(order.address)],
    ['Giao dự kiến', `📅 ${escHtml(order.estimated_delivery)}`],
    ['Thanh toán',  escHtml(order.payment_method)],
  ];
  $('orderDetails').innerHTML = rows.map(([l,v]) =>
    `<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${v}</span></div>`
  ).join('');
  $('orderModal').classList.add('active');
  fireConfetti();
}

function closeModal() {
  $('orderModal').classList.remove('active');
  stopConfetti();
}

$('orderModal').addEventListener('click', e => { if (e.target === $('orderModal')) closeModal(); });

let confettiAnim;
function fireConfetti() {
  const canvas = $('confettiCanvas'); const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const COLORS = ['#5b8af0','#9d6cff','#2dd4a0','#f5c842','#ff5f7a','#fff'];
  const pieces = Array.from({length:120}, () => ({
    x: Math.random()*canvas.width, y: -20-Math.random()*120,
    r: Math.random()*5+3, d: Math.random()*1.5+.5,
    color: COLORS[Math.floor(Math.random()*COLORS.length)],
    tilt: Math.random()*12-6, tiltSpeed: Math.random()*.08+.04, angle:0,
    shape: Math.random()>.5 ? 'circle' : 'rect',
  }));
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => {
      p.y += p.d*2.5; p.angle += p.tiltSpeed; p.tilt = Math.sin(p.angle)*12;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.tilt*Math.PI/180);
      ctx.fillStyle = p.color;
      if (p.shape==='circle') { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
      else ctx.fillRect(-p.r,-p.r*.5,p.r*2,p.r);
      ctx.restore();
      if (p.y > canvas.height) { p.y=-20; p.x=Math.random()*canvas.width; }
    });
    confettiAnim = requestAnimationFrame(draw);
  }
  draw();
}

function stopConfetti() {
  if (confettiAnim) cancelAnimationFrame(confettiAnim);
  const c = $('confettiCanvas'); c.getContext('2d').clearRect(0,0,c.width,c.height);
}

/* ════════════════════════════════════════════
   10. RIPPLE
   ════════════════════════════════════════════ */
function addRipple(el) {
  el.classList.remove('rippling'); void el.offsetWidth; el.classList.add('rippling');
  setTimeout(()=>el.classList.remove('rippling'),500);
}

function triggerSendRipple() {
  const r = $('sendRipple'); r.classList.remove('animate'); void r.offsetWidth; r.classList.add('animate');
}

/* ════════════════════════════════════════════
   11. TOAST
   ════════════════════════════════════════════ */
function showToast(msg, type='info') {
  const icons = {info:'ℹ️', error:'❌', success:'✅', warn:'⚠️'};
  const container = $('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast-item';
  el.innerHTML = `<span class="toast-icon">${icons[type]||'💬'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(()=>{ el.classList.add('fade-out'); setTimeout(()=>el.remove(),350); }, 3000);
}

/* ════════════════════════════════════════════
   12. RESET
   ════════════════════════════════════════════ */
$('btnReset').addEventListener('click', () => {
  sessionId = `s_${Date.now()}`;
  allProducts = [];
  [...chatBox.children].forEach((c,i) => {
    setTimeout(()=>{ c.style.transition='opacity .2s,transform .2s'; c.style.opacity='0'; c.style.transform='translateY(-8px)'; }, i*40);
  });
  setTimeout(()=>{
    chatBox.innerHTML='';
    const div = document.createElement('div');
    div.className = 'message bot-message';
    div.innerHTML = `<div class="avatar-wrap"><div class="bot-avatar"><span class="avatar-emoji">🛒</span><div class="avatar-glow"></div></div></div>
      <div class="msg-body"><div class="msg-bubble bot-bubble"></div></div>`;
    chatBox.appendChild(div);
    typewriter(div.querySelector('.msg-bubble'), '✨ Cuộc trò chuyện mới bắt đầu! Bạn muốn tìm sản phẩm gì?');
  }, [...chatBox.children].length*40+300);
  productsArea.querySelectorAll('.product-card').forEach(c=>{ c.style.transition='opacity .3s'; c.style.opacity='0'; });
  setTimeout(()=>{ productsArea.querySelectorAll('.product-card').forEach(c=>c.remove()); emptyState.style.display='flex'; productCount.textContent='0'; sortControls.style.opacity='0'; },350);
  showToast('🔄 Cuộc trò chuyện mới', 'info');
});

/* ════════════════════════════════════════════
   13. HISTORY SIDEBAR
   ════════════════════════════════════════════ */
const historySidebar  = $('historySidebar');
const sidebarBackdrop = $('sidebarBackdrop');
const historyList     = $('historyList');
const historyEmpty    = $('historyEmpty');

async function openHistorySidebar() {
  historySidebar.classList.add('open');
  sidebarBackdrop.classList.add('active');
  await loadHistoryList();
}

function closeHistorySidebar() {
  historySidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('active');
}

async function loadHistoryList() {
  historyList.innerHTML = '';
  try {
    const res  = await fetch(`${API}/history`);
    const data = await res.json();
    const list = data.sessions || [];

    if (list.length === 0) {
      historyList.appendChild(historyEmpty.cloneNode(true));
      return;
    }

    list.forEach(sess => {
      const item = document.createElement('div');
      item.className = 'hs-item';
      const updatedAt = sess.updated_at ? new Date(sess.updated_at).toLocaleString('vi-VN') : '';
      item.innerHTML = `
        <span class="hs-item-icon">💬</span>
        <div class="hs-item-body">
          <div class="hs-item-title">${escHtml(sess.title || 'Cuộc trò chuyện')}</div>
          <div class="hs-item-meta">
            <span>${updatedAt}</span>
            <span class="hs-item-count">${sess.message_count} tin</span>
          </div>
        </div>
        <button class="hs-item-del" onclick="deleteSession('${sess.session_id}',event)" title="Xoá">🗑</button>`;
      item.addEventListener('click', () => openHistoryDetail(sess.session_id, sess.title));
      historyList.appendChild(item);
    });
  } catch {
    historyList.innerHTML = '<div class="hs-empty"><span>❌</span><p>Không kết nối được server</p></div>';
  }
}

async function openHistoryDetail(sessionId, title) {
  $('historyDetailTitle').textContent = title || 'Lịch sử';
  const container = $('historyDetailMessages');
  container.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:20px">Đang tải...</p>';
  $('historyModal').classList.add('active');

  try {
    const res  = await fetch(`${API}/history/${sessionId}`);
    const data = await res.json();
    const msgs = data.messages || [];

    container.innerHTML = '';
    if (msgs.length === 0) {
      container.innerHTML = '<p style="color:var(--text-3);text-align:center;padding:20px">Chưa có tin nhắn</p>';
      return;
    }

    msgs.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'hd-msg';
      const ts   = msg.timestamp ? new Date(msg.timestamp).toLocaleString('vi-VN') : '';
      const role = msg.role === 'user' ? 'Bạn' : 'ShopBot';
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';

      let extras = '';
      if (msg.products?.length) {
        extras = `<div class="hd-products-hint">🛍️ ${msg.products.length} sản phẩm đã tìm</div>`;
      }
      if (msg.order) {
        extras += `<div class="hd-products-hint" style="background:rgba(45,212,160,.12);color:var(--green)">✅ Đơn hàng ${msg.order.order_id}</div>`;
      }

      div.innerHTML = `
        <span class="hd-role ${roleClass}">${role}</span>
        <div class="hd-content">${formatMd(escHtml(msg.content))}</div>
        ${extras}
        <span class="hd-time">${ts}</span>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  } catch {
    container.innerHTML = '<p style="color:var(--red);text-align:center;padding:20px">Lỗi khi tải lịch sử</p>';
  }
}

function closeHistoryModal() {
  $('historyModal').classList.remove('active');
}

$('historyModal').addEventListener('click', e => { if (e.target === $('historyModal')) closeHistoryModal(); });

async function deleteSession(sessionId, e) {
  e.stopPropagation();
  if (!confirm('Xoá cuộc trò chuyện này?')) return;
  await fetch(`${API}/history/${sessionId}`, { method: 'DELETE' });
  showToast('🗑 Đã xoá cuộc trò chuyện', 'info');
  await loadHistoryList();
}

$('btnHistory').addEventListener('click', openHistorySidebar);
$('historyClose').addEventListener('click', closeHistorySidebar);
sidebarBackdrop.addEventListener('click', closeHistorySidebar);

$('historyClearAll').addEventListener('click', async () => {
  if (!confirm('Xoá toàn bộ lịch sử? Không thể khôi phục.')) return;
  const res  = await fetch(`${API}/history`);
  const data = await res.json();
  await Promise.all((data.sessions||[]).map(s => fetch(`${API}/history/${s.session_id}`,{method:'DELETE'})));
  showToast('🗑 Đã xoá tất cả lịch sử', 'warn');
  await loadHistoryList();
});

/* ════════════════════════════════════════════
   14. UTILS
   ════════════════════════════════════════════ */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatMd(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code style="background:rgba(91,138,240,.15);padding:1px 5px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/\n/g,'<br>');
}

function fmtNum(n) { return n ? n.toLocaleString('vi-VN') : ''; }

/* ════════════════════════════════════════════
   15. HEALTH CHECK
   ════════════════════════════════════════════ */
const statusText = $('statusText');

window.addEventListener('load', async () => {
  try {
    const res  = await fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data.openai_key && data.serpapi_key) {
      statusText.textContent = 'Hoạt động bình thường';
      showToast('✅ Đã kết nối server!', 'success');
    } else {
      const missing = [!data.openai_key&&'OPENAI_API_KEY', !data.serpapi_key&&'SERPAPI_KEY'].filter(Boolean).join(', ');
      statusText.textContent = 'Thiếu cấu hình';
      showToast(`⚠️ Chưa có: ${missing}`, 'warn');
    }
  } catch {
    statusText.textContent = 'Mất kết nối server';
    document.querySelector('.status-dot').style.background = 'var(--red)';
    showToast('❌ Cần chạy backend: uvicorn main:app --port 8000', 'error');
  }
});
