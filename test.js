
// ── CURSOR ──
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.transform = `translate(${mx - 6}px, ${my - 6}px)`;
});
function animateRing() {
  rx += (mx - rx - 18) * 0.12;
  ry += (my - ry - 18) * 0.12;
  ring.style.transform = `translate(${rx}px, ${ry}px)`;
  requestAnimationFrame(animateRing);
}
animateRing();
document.querySelectorAll('a, button').forEach(el => {
  el.addEventListener('mouseenter', () => { cursor.style.transform += ' scale(2)'; ring.style.transform += ' scale(1.5)'; ring.style.opacity = '0.3'; });
  el.addEventListener('mouseleave', () => { ring.style.opacity = '0.6'; });
});

// ── LOADER ──
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 2200);
});

// ── HEADER SCROLL ──
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 60);
});

// ── PRODUCTS DATA (carregado do Google Sheets via Apps Script) ──
const FALLBACK_PRODUCTS = [
  { id:1, name:'Vestido Floral Midi', cat:'Vestidos', price:289, oldPrice:389, badge:'new', img:'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&q=80', colors:['#E91E8C','#FFF','#1a0a12'], desc:'Lindo vestido floral de comprimento midi, ideal para eventos de dia e passeios elegantes. Confeccionado em crepe de seda de alta qualidade, proporcionando excelente caimento e frescor.', stock:{pp:2, p:5, m:8, g:4, gg:1}, shopeeUrl:'https://shopee.com.br', tiktokUrl:'https://shop.tiktok.com' },
  { id:2, name:'Blusa Off-Shoulder', cat:'Blusas', price:159, oldPrice:null, badge:null, img:'https://images.unsplash.com/photo-1594938298603-4bf6b9c6d1d9?w=400&q=80', colors:['#FFF','#E91E8C','#f5e6d3'], desc:'Blusa estilo ciganinha (ombro a ombro) leve e estilosa. Perfeita para os dias mais quentes combinada com saias ou shorts de cintura alta.', stock:{pp:0, p:3, m:10, g:7, gg:2}, shopeeUrl:'', tiktokUrl:'' },
  { id:3, name:'Calça Palazzo Rose', cat:'Calças', price:219, oldPrice:279, badge:'sale', img:'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&q=80', colors:['#f4c5d3','#E91E8C','#333'], desc:'Calça pantalona fluida de tom rosé elegante. Possui cintura alta marcada e pregas delicadas que alongam a silhueta com extremo requinte.', stock:{pp:1, p:2, m:3, g:1, gg:0}, shopeeUrl:'https://shopee.com.br', tiktokUrl:'' },
  { id:4, name:'Vestido Longo Gala', cat:'Vestidos', price:489, oldPrice:null, badge:'new', img:'https://images.unsplash.com/photo-1566206091558-7f218b696731?w=400&q=80', colors:['#1a0a12','#E91E8C'], desc:'Um espetacular vestido longo de gala em tom fúcsia profundo, com decote drapeado em V nas costas e fenda elegante. Garanta os holofotes na sua noite especial.', stock:{pp:0, p:1, m:2, g:1, gg:0}, shopeeUrl:'', tiktokUrl:'' },
  { id:5, name:'Conjunto Cropped', cat:'Blusas', price:199, oldPrice:249, badge:'sale', img:'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=80&q=80', colors:['#E91E8C','#FFF'], desc:'Conjunto cropped moderno e jovial, confeccionado em linho misto. O caimento é estruturado, mantendo a leveza e a sofisticação da modelagem.', stock:{pp:1, p:0, m:0, g:1, gg:0}, shopeeUrl:'', tiktokUrl:'' },
  { id:6, name:'Bolsa Mini Pink', cat:'Acessórios', price:149, oldPrice:null, badge:null, img:'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400&q=80', colors:['#E91E8C','#f4c5d3','#1a0a12'], desc:'Bolsa tiracolo em couro sintético pink vibrante com alça de corrente dourada regulável. Adicione um toque pop de elegância em qualquer composição.', stock:{pp:0, p:0, m:12, g:0, gg:0}, shopeeUrl:'', tiktokUrl:'' },
  { id:7, name:'Vestido Wrap Floral', cat:'Vestidos', price:329, oldPrice:null, badge:'new', img:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80', colors:['#f4c5d3','#E91E8C','#FFF'], desc:'Vestido envelope transpassado clássico, com estampa de folhagem aquarelada. Possui babados delicados na bainha e mangas tulipa charmosas.', stock:{pp:1, p:3, m:4, g:2, gg:2}, shopeeUrl:'', tiktokUrl:'' },
  { id:8, name:'Saia Midi Elegante', cat:'Calças', price:179, oldPrice:229, badge:'sale', img:'https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=400&q=80', colors:['#1a0a12','#E91E8C','#f4c5d3'], desc:'Saia de pregas com fivela e cinto encapado do mesmo tecido. O caimento evasê estruturado é perfeito para reuniões de trabalho ou almoços informais.', stock:{pp:0, p:2, m:5, g:3, gg:1}, shopeeUrl:'', tiktokUrl:'' },
];

let productsData = [];
let categoriesData = [];
let cartItems = [];
let activeFilter = 'Todos';
let currentProduct = null;
let selectedSize = '';

// Converter produto do formato Admin → formato Loja
function adminToStoreProduct(p) {
  return {
    id:       p.id,
    name:     p.name,
    cat:      p.cat,
    price:    p.salePrice || p.price,
    oldPrice: p.salePrice ? p.price : null,
    badge:    p.featured === 'Sim' ? 'new' : (p.salePrice ? 'sale' : null),
    img:      p.imgUrl || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&q=80',
    colors:   ['#E91E8C', '#FFF', '#1a0a12'],
    desc:     p.desc || '',
    stock:    p.stock || { pp:1, p:1, m:1, g:1, gg:1 },
    shopeeUrl: p.shopeeUrl || '',
    tiktokUrl: p.tiktokUrl || '',
  };
}

async function loadProductsFromSheets() {
  // Tentar carregar do localStorage (cache do admin)
  try {
    const cached = localStorage.getItem('sophia_products');
    if (cached) {
      const adminProds = JSON.parse(cached);
      const ativos = adminProds.filter(p => p.status === 'Ativo');
      if (ativos.length > 0) {
        productsData = ativos.map(adminToStoreProduct);
        renderProducts();
        // Não usar 'return' aqui para forçar a atualização via internet
      }
    }
  } catch(_) {}

  // Tentar carregar do Apps Script diretamente
  const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbzRlUIqKpsNLeFqoAd1N8PDHMRbTI-HibsuVRDKUw8CFRQWgJREc7MoiB4_ADmmvZPhTg/exec';
  if (appsScriptUrl) {
    try {
      const res  = await fetch(appsScriptUrl + '?action=list&t=' + Date.now());
      const data = await res.json();
      if (data.success) {
        if (data.products && data.products.length > 0) {
          const ativos = data.products.filter(p => p.status === 'Ativo');
          productsData = ativos.map(adminToStoreProduct);
          localStorage.setItem('sophia_products', JSON.stringify(data.products));
        }
        if (data.categories && data.categories.length > 0) {
          categoriesData = data.categories;
          localStorage.setItem('sophia_categories', JSON.stringify(data.categories));
        }
        renderProducts();
        renderCategories();
        
        // Verifica se há pedido para abrir produto específico via link
        const urlParams = new URLSearchParams(window.location.search);
        const pId = urlParams.get('p');
        if (pId) {
          const parsedId = Number(pId) || pId;
          setTimeout(() => openProductDetail(parsedId), 500);
        }
        
        return;
      }
    } catch(_) {}
  }

  // Fallback: produtos de exemplo
  productsData = FALLBACK_PRODUCTS;
  renderProducts();
}

function renderProducts(filter = 'Todos') {
  const grid = document.getElementById('products-grid');
  const items = filter === 'Todos' ? productsData : productsData.filter(p => p.cat === filter);

  if (items.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--gray)">
      <div style="font-size:3rem;margin-bottom:1rem">🛍</div>
      <p style="font-size:0.9rem">Nenhum produto nesta categoria ainda.</p>
    </div>`;
    return;
  }

  const renderCard = (p) => `
    <div class="product-card" data-id="${p.id}" onclick="openProductDetail(${p.id}, event)" style="">
      <div class="product-img">
        <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&q=80'">
        ${p.badge ? `<div class="product-badge ${p.badge==='new'?'badge-new':'badge-sale'}">${p.badge==='new'?'Novo':'Sale'}</div>` : ''}
        <div class="product-actions">
          <button class="action-btn main" onclick="openProductDetail(${p.id}, event)">🛍 Adicionar à Sacola</button>
          <button class="action-btn wishlist-btn" onclick="shareProduct(${p.id}, event)" title="Compartilhar" style="margin-right: 0.2rem;">📤</button>
          <button class="action-btn wishlist-btn" onclick="openProductDetail(${p.id}, event)" title="Espiar">👁</button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-cat">${p.cat}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-stars">★★★★★ <span style="color:var(--gray);font-size:0.55rem">(14)</span></div>
        <div class="product-price">
          <span class="price-current">R$ ${p.price.toFixed(2).replace('.',',')}</span>
          ${p.oldPrice ? `<span class="price-old">R$ ${p.oldPrice.toFixed(2).replace('.',',')}</span>` : ''}
        </div>
        <div class="product-sizes-preview">
          <div class="size-preview-btn">P</div>
          <div class="size-preview-btn">M</div>
          <div class="size-preview-btn">G</div>
        </div>
      </div>
    </div>
  `;

  if (filter === 'Todos') {
    const categories = [...new Set(items.map(p => p.cat))];
    let html = '';
    categories.forEach(cat => {
      const catItems = items.filter(p => p.cat === cat);
      html += `
        <div style="grid-column: 1/-1; margin-top: 2rem; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 0.5rem; margin-bottom: 1rem;">
          <h3 style="font-family:'Cormorant Garamond',serif; font-size: 1.8rem; color: var(--pink);">${cat}</h3>
        </div>
      `;
      html += catItems.map(renderCard).join('');
    });
    grid.innerHTML = html;
  } else {
    grid.innerHTML = items.map(renderCard).join('');
  }
}

function setFilter(btn, filter) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = filter;
  renderProducts(filter);
}
function filterProducts(cat) {
  activeFilter = cat;
  document.querySelectorAll('.filter-tab').forEach(b => {
    b.classList.toggle('active', b.textContent === cat);
  });
  document.getElementById('products').scrollIntoView({behavior:'smooth'});
  renderProducts(cat);
}

// ── COMPARTILHAR PRODUTO ──
window.shareProduct = function(id, e) {
  if (e) e.stopPropagation();
  const p = productsData.find(x => x.id === id);
  if (!p) return;
  const link = window.location.origin + window.location.pathname + '?p=' + id;
  const text = `Olha que lindo esse produto: ${p.name} por R$ ${p.price.toFixed(2).replace('.',',')}!\n\nConfira na loja:\n${link}`;
  
  if (navigator.share) {
    navigator.share({
      title: p.name,
      text: text,
      url: link
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(text);
    alert('Link do produto copiado para a área de transferência! Você pode colar no WhatsApp.');
  }
}

// ── CART ──
function addToCart(id) {
  const product = productsData.find(p => p.id === id);
  const existing = cartItems.find(i => i.id === id);
  if (existing) existing.qty++;
  else cartItems.push({ ...product, qty: 1 });
  updateCart();
  openCart();
}
function updateCart() {
  const count = cartItems.reduce((s, i) => s + i.qty, 0);
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total').textContent = `R$ ${total.toFixed(2).replace('.',',')}`;
  const container = document.getElementById('cart-items');
  if (cartItems.length === 0) {
    container.innerHTML = `<div class="cart-empty"><div class="cart-empty-icon">🛍</div><p style="font-size:.8rem;color:var(--gray)">Seu carrinho está vazio</p></div>`;
  } else {
    container.innerHTML = cartItems.map(item => `
      <div style="display:flex;gap:1rem;padding:1rem 0;border-bottom:1px solid #f3f4f6;align-items:center">
        <img src="${item.img}" style="width:70px;height:90px;object-fit:cover;flex-shrink:0">
        <div style="flex:1">
          <div style="font-size:.85rem;font-weight:500">${item.name}</div>
          <div style="font-size:.7rem;color:var(--gray);margin:.25rem 0">${item.cat}</div>
          <div style="font-size:.9rem;color:var(--pink);font-weight:500">R$ ${item.price.toFixed(2).replace('.',',')}</div>
          <div style="display:flex;align-items:center;gap:.75rem;margin-top:.5rem">
            <button onclick="changeQty(${item.id},-1)" style="width:26px;height:26px;border:1px solid #e5e7eb;background:none;font-size:.8rem">-</button>
            <span style="font-size:.8rem">${item.qty}</span>
            <button onclick="changeQty(${item.id},1)" style="width:26px;height:26px;border:1px solid #e5e7eb;background:none;font-size:.8rem">+</button>
          </div>
        </div>
        <button onclick="removeFromCart(${item.id})" style="background:none;border:none;color:var(--gray);font-size:1.1rem;padding:.25rem">✕</button>
      </div>
    `).join('');
  }
}
function changeQty(id, delta) {
  const item = cartItems.find(i => i.id === id);
  if (item) { item.qty += delta; if (item.qty <= 0) removeFromCart(id); else updateCart(); }
}
function removeFromCart(id) {
  cartItems = cartItems.filter(i => i.id !== id);
  updateCart();
}
function openCart() {
  document.getElementById('cart-overlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cart-overlay').classList.remove('open');
}
function checkoutWhatsApp() {
  if (cartItems.length === 0) return;
  const lines = cartItems.map(i => `• ${i.name} (x${i.qty}) - R$ ${(i.price*i.qty).toFixed(2).replace('.',',')}`).join('%0A');
  const total = cartItems.reduce((s,i)=>s+i.price*i.qty,0);
  const msg = `Olá! Gostaria de finalizar meu pedido na Sophia Elegance Store:%0A%0A${lines}%0A%0ATotal: R$ ${total.toFixed(2).replace('.',',')}`;
  window.open(`https://wa.me/5548999999999?text=${msg}`, '_blank');
}

function checkoutBling() {
  if (cartItems.length === 0) return;
  const btn = document.querySelector('.cart-checkout[onclick="checkoutBling()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Gerando link seguro...';
  btn.style.opacity = '0.7';
  btn.style.pointerEvents = 'none';

  const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbzRlUIqKpsNLeFqoAd1N8PDHMRbTI-HibsuVRDKUw8CFRQWgJREc7MoiB4_ADmmvZPhTg/exec';
  if (!appsScriptUrl) {
    alert("Ops! O sistema não encontrou a conexão segura com o Google Scripts. Redirecionando para o WhatsApp...");
    checkoutWhatsApp();
    btn.innerHTML = originalText;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    return;
  }

  const total = cartItems.reduce((s,i)=>s+i.price*i.qty,0);
  const payload = {
    action: 'checkoutBling',
    cart: cartItems,
    total: total
  };

  fetch(appsScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.link) {
      window.location.href = data.link;
      cartItems = [];
      updateCart();
    } else {
      throw new Error(data.error || "Erro desconhecido na API.");
    }
  })
  .catch(err => {
    alert("Erro ao processar pagamento: " + err.message + "\\nRedirecionando para o WhatsApp...");
    btn.innerHTML = originalText;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    checkoutWhatsApp();
  });
}
document.getElementById('cart-btn').addEventListener('click', openCart);
document.getElementById('cart-close').addEventListener('click', closeCart);
document.getElementById('cart-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCart(); });

// ── NEWSLETTER ──
function subscribeNewsletter(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = '✓ Cadastrado!';
  btn.style.background = '#25D366';
  setTimeout(() => { btn.textContent = 'Quero Desconto'; btn.style.background = ''; }, 3000);
}

// ── CATEGORIES ──
function renderCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  let cats = categoriesData;
  if (!cats || cats.length === 0) {
    try {
      cats = JSON.parse(localStorage.getItem('sophia_categories') || '[]');
    } catch(_) {}
  }

  // Fallback padrão
  if (!cats || !cats.length) {
    cats = [
      { name:'Vestidos',   imgUrl:'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80', order:1 },
      { name:'Blusas',     imgUrl:'https://images.unsplash.com/photo-1594938298603-4bf6b9c6d1d9?w=600&q=80', order:2 },
      { name:'Calças',     imgUrl:'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&q=80', order:3 },
      { name:'Acessórios', imgUrl:'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600&q=80', order:4 },
    ];
  }
  cats.sort((a,b) => (a.order||99) - (b.order||99));
  grid.innerHTML = cats.map(c => {
    const count = productsData.filter(p => p.cat === c.name).length;
    return `
    <div class="cat-card" onclick="filterProducts('${c.name}')">
      <img src="${c.imgUrl || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&q=80'}"
           alt="${c.name}"
           onerror="this.src='https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&q=80'">
      <div class="cat-info">
        <div class="cat-name">${c.name}</div>
        <div class="cat-count">${count > 0 ? count + ' peças' : 'Ver coleção'}</div>
      </div>
      <div class="cat-arrow">→</div>
    </div>`;
  }).join('');

  // Atualizar filtros de produtos
  const tabs = document.querySelector('.filter-tabs');
  if (tabs) {
    tabs.innerHTML = `<button class="filter-tab active" onclick="setFilter(this,'Todos')">Todos</button>` +
      cats.map(c => `<button class="filter-tab" onclick="setFilter(this,'${c.name}')">${c.name}</button>`).join('');
  }
}

// Init — carrega produtos do Sheets ou cache
loadProductsFromSheets().then(() => renderCategories());

// ── INTERACTIVE PRODUCT DETAIL MODAL ──
let currentDetailProduct = null;

function openProductDetail(id, event) {
  if (event) event.stopPropagation();
  
  const product = productsData.find(p => p.id === id);
  if (!product) return;
  
  currentDetailProduct = product;
  selectedSize = ''; // Reset sizing

  document.getElementById('detail-modal-img').src = product.img;
  document.getElementById('detail-modal-img').alt = product.name;
  document.getElementById('detail-modal-cat').textContent = product.cat;
  document.getElementById('detail-modal-title').textContent = product.name;
  document.getElementById('detail-modal-desc').textContent = product.desc || 'Sem descrição cadastrada ainda.';
  
  document.getElementById('detail-modal-price').textContent = `R$ ${product.price.toFixed(2).replace('.',',')}`;
  const oldPriceEl = document.getElementById('detail-modal-old-price');
  if (product.oldPrice) {
    oldPriceEl.textContent = `R$ ${product.oldPrice.toFixed(2).replace('.',',')}`;
    oldPriceEl.style.display = 'inline';
  } else {
    oldPriceEl.style.display = 'none';
  }

  // Populate Sizing selectors depending on stock
  const sizeWrap = document.getElementById('detail-modal-sizes');
  sizeWrap.innerHTML = '';
  
  const sizes = ['pp', 'p', 'm', 'g', 'gg'];
  sizes.forEach(sz => {
    const qty = product.stock ? (product.stock[sz] || 0) : 1;
    const btn = document.createElement('button');
    btn.className = 'size-selector-btn';
    btn.textContent = sz.toUpperCase();
    
    if (qty <= 0) {
      btn.classList.add('disabled');
      btn.title = 'Sem estoque';
    } else {
      btn.onclick = () => selectSize(sz, btn);
    }
    sizeWrap.appendChild(btn);
  });

  // Wire up Marketplace buttons
  const btnShopee = document.getElementById('detail-btn-shopee');
  const btnTiktok = document.getElementById('detail-btn-tiktok');

  if (product.shopeeUrl) {
    btnShopee.href = product.shopeeUrl;
    btnShopee.style.display = 'flex';
  } else {
    btnShopee.style.display = 'none';
  }

  if (product.tiktokUrl) {
    btnTiktok.href = product.tiktokUrl;
    btnTiktok.style.display = 'flex';
  } else {
    btnTiktok.style.display = 'none';
  }

  // Show Modal
  document.getElementById('product-detail-modal-overlay').classList.add('open');
}

function closeProductDetail() {
  document.getElementById('product-detail-modal-overlay').classList.remove('open');
  currentDetailProduct = null;
  selectedSize = '';
}

function selectSize(size, btn) {
  document.querySelectorAll('.size-selector-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedSize = size.toUpperCase();
}

function checkoutSingleWhatsApp() {
  if (!currentDetailProduct) return;
  if (!selectedSize) {
    alert('Por favor, selecione um tamanho antes de prosseguir!');
    return;
  }
  const msg = `Olá! Gostaria de comprar o produto *${currentDetailProduct.name}* no tamanho *${selectedSize}* no valor de R$ ${currentDetailProduct.price.toFixed(2).replace('.',',')}!`;
  window.open(`https://wa.me/5548999999999?text=${encodeURIComponent(msg)}`, '_blank');
}

function addCurrentToCart() {
  if (!currentDetailProduct) return;
  if (!selectedSize) {
    alert('Por favor, selecione um tamanho antes de adicionar ao carrinho!');
    return;
  }
  
  // Custom addToCart logic to preserve sizes
  const cartId = currentDetailProduct.id + '-' + selectedSize;
  const existing = cartItems.find(i => i.cartId === cartId);
  if (existing) {
    existing.qty++;
  } else {
    cartItems.push({
      ...currentDetailProduct,
      cartId: cartId,
      name: `${currentDetailProduct.name} (${selectedSize})`,
      qty: 1
    });
  }
  updateCart();
  closeProductDetail();
  openCart();
}

document.getElementById('product-detail-modal-overlay').addEventListener('click', e => { 
  if (e.target === e.currentTarget) closeProductDetail(); 
});
