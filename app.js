const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
let services=[], activeFilter='Semua';
const icons={Instagram:'◎',TikTok:'♪',YouTube:'▶',Facebook:'f',Telegram:'➤',Lainnya:'✦'};
async function loadServices(){
 const r=await fetch('/api/services'); services=await r.json();
 renderServices(); const sel=$('#serviceSelect');
 services.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.title} — ${money(s.price)}`;sel.appendChild(o)});
}
function renderServices(){
 const list=services.filter(s=>activeFilter==='Semua'||s.platform===activeFilter);
 $('#services').innerHTML=list.map(s=>`<article class="service-card"><div class="service-top"><div class="platform-icon">${icons[s.platform]||'✦'}</div><div><h3>${escapeHtml(s.platform)}</h3><p>${escapeHtml(s.title)}</p></div></div><div class="service-bottom"><div><small>Mulai dari</small><strong>${money(s.price)}</strong></div><button class="round-arrow" data-order="${s.id}" aria-label="Pilih ${escapeHtml(s.title)}">→</button></div></article>`).join('')||'<p>Belum ada layanan pada kategori ini.</p>';
 document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>{ $('#serviceSelect').value=b.dataset.order; updatePrice(); $('#orderForm').scrollIntoView({behavior:'smooth',block:'center'}); }));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('#filters').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));renderServices()});
function updatePrice(){const s=services.find(x=>x.id===Number($('#serviceSelect').value));$('#totalPrice').textContent=s?money(s.price):money(0)}
$('#serviceSelect').addEventListener('change',updatePrice);
$('#orderForm').addEventListener('submit',async e=>{e.preventDefault();const msg=$('#orderMessage');msg.className='message';msg.textContent='Menyimpan pesanan...';const data=Object.fromEntries(new FormData(e.target));data.serviceId=Number(data.serviceId);try{const r=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Gagal menyimpan');msg.className='message ok';msg.textContent=`${j.message} Nomor pesanan: #${j.orderId}`;e.target.reset();updatePrice()}catch(err){msg.className='message err';msg.textContent=err.message}});
$('#themeToggle').addEventListener('click',()=>document.body.classList.toggle('light-mode'));
$('#waLink').href='https://wa.me/?text='+encodeURIComponent('Halo YAANZ STORE, saya ingin bertanya tentang layanan.');
loadServices().catch(()=>{$('#services').innerHTML='<p>Katalog belum dapat dimuat. Coba muat ulang halaman.</p>'});
