/* ==========================================================================
   ZOHD - HOUSE OF SUSTAINABLES (FRONTEND CONTROLLER)
   ========================================================================== */

// BACKEND API BASE URL (Adjust port if your Node.js server runs on another port)
const API_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:5000' 
  : '';

// LOCAL FALLBACK CATALOG (Used if Node.js server is offline or endpoints return HTML)
const FALLBACK_PRODUCTS = [
  {
    _id: "1",
    name: "ZOHD Signature Adult Bamboo Toothbrush",
    price: 199,
    category: "Adult Care",
    selectedVariant: "Natural Sand",
    variants: ["Natural Sand", "Earthy Brown", "Midnight Black"],
    image: "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?auto=format&fit=crop&w=600&q=80",
    description: "Raw organic bamboo handle with soft antimicrobial bristles."
  },
  {
    _id: "2",
    name: "ZOHD Kid's Bamboo Toothbrush (Ages 3-8)",
    price: 179,
    category: "Kid's Care",
    selectedVariant: "Blossom Pink",
    variants: ["Blossom Pink", "Sky Blue", "Natural Beige", "Midnight Black"],
    image: "https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=600&q=80",
    description: "Gentle soft bristles crafted specifically for tender gums."
  },
  {
    _id: "3",
    name: "ZOHD Natural Neem Wood Tongue Cleanser",
    price: 149,
    category: "Oral Wellness",
    selectedVariant: "Pure Neem Wood",
    variants: ["Pure Neem Wood"],
    image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=600&q=80",
    description: "100% pure Neem wood. Naturally antibacterial and plastic-free."
  }
];

let products = [];
let cart = JSON.parse(localStorage.getItem("zohd_cart")) || [];
let currentUser = JSON.parse(localStorage.getItem("zohd_user")) || null;

// INITIALIZATION
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadReviews();
  updateCartUI();
  updateUserUI();

  // Show Auth Modal on first visit
  if (!localStorage.getItem("zohd_visited")) {
    setTimeout(() => {
      openAuthModal();
      localStorage.setItem("zohd_visited", "true");
    }, 1200);
  }
});

// 1. SAFE FETCH PRODUCTS FROM NODE.JS BACKEND
async function loadProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products`);

    // Check if response is valid JSON and not an HTML error page
    if (!response.ok) {
      console.warn(`Server returned status ${response.status}. Using fallback products.`);
      products = FALLBACK_PRODUCTS;
    } else {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        products = data.map(p => ({
          ...p,
          selectedVariant: p.variants && p.variants.length > 0 ? p.variants[0] : "Standard"
        }));
      } else {
        console.warn("Server returned non-JSON response. Using fallback products.");
        products = FALLBACK_PRODUCTS;
      }
    }
  } catch (error) {
    console.error("Fetch error for products:", error);
    products = FALLBACK_PRODUCTS;
  }

  renderProducts();
}

// 2. SAFE FETCH REVIEWS FROM NODE.JS BACKEND
async function loadReviews() {
  const reviewsContainer = document.getElementById("reviews-display-container");
  if (!reviewsContainer) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/reviews`);

    if (!response.ok) {
      console.warn(`Reviews API returned status ${response.status}`);
      reviewsContainer.innerHTML = `<p style="color:var(--text-light);">No customer reviews available yet.</p>`;
      return;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const reviews = await response.json();
      renderReviews(reviews);
    } else {
      console.warn("Reviews API returned HTML instead of JSON.");
      reviewsContainer.innerHTML = `<p style="color:var(--text-light);">No customer reviews available yet.</p>`;
    }
  } catch (error) {
    console.error("Fetch error for reviews:", error);
    reviewsContainer.innerHTML = `<p style="color:var(--text-light);">No customer reviews available yet.</p>`;
  }
}

// RENDER REVIEWS IN UI
function renderReviews(reviews) {
  const container = document.getElementById("reviews-display-container");
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = `<p style="color:var(--text-light);">No customer reviews available yet. Be the first to review!</p>`;
    return;
  }

  container.innerHTML = reviews.map(r => `
    <div style="background:var(--accent-beige); padding:1rem; border-radius:12px; margin-bottom:0.8rem; border:1px solid var(--border-color);">
      <div style="display:flex; justify-style:space-between; align-items:center;">
        <strong style="color:var(--primary-green);">${r.author || 'Customer'}</strong>
        <span style="color:#d4a373;">${'★'.repeat(r.rating || 5)}</span>
      </div>
      <p style="font-size:0.9rem; margin-top:0.3rem;">"${r.comment}"</p>
      <small style="font-size:0.75rem; color:var(--text-light);">${r.productName || 'Verified Buyer'}</small>
    </div>
  `).join('');
}

// RENDER PRODUCTS
function renderProducts() {
  const container = document.getElementById("product-grid-container");
  if (!container) return;

  container.innerHTML = products.map(p => `
    <div class="product-card">
      <img src="${p.image}" class="product-img" alt="${p.name}" />
      <div class="product-info">
        <div class="product-title">${p.name}</div>
        <div class="product-desc">${p.description}</div>
        
        <div class="variant-pills">
          ${(p.variants || ['Standard']).map(v => `
            <div class="variant-pill ${p.selectedVariant === v ? 'active' : ''}" onclick="selectVariant('${p._id}', '${v}')">${v}</div>
          `).join('')}
        </div>

        <div class="product-price">₹${p.price}</div>

        <button class="btn btn-primary full-width" onclick="addToCart('${p._id}')">
          <i class="fa-solid fa-bag-shopping"></i> Add to Bag
        </button>
      </div>
    </div>
  `).join('');
}

function selectVariant(productId, variant) {
  const p = products.find(x => x._id === productId || x.id === productId);
  if (p) p.selectedVariant = variant;
  renderProducts();
}

// SHOPPING BAG DRAWER
function saveCart() {
  localStorage.setItem("zohd_cart", JSON.stringify(cart));
  updateCartUI();
}

function addToCart(productId) {
  const p = products.find(x => x._id === productId || x.id === productId);
  if (!p) return;

  const existing = cart.find(x => (x._id === productId || x.id === productId) && x.variant === p.selectedVariant);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...p, variant: p.selectedVariant, quantity: 1 });
  }

  saveCart();
  toggleCart(true);
}

function updateCartQty(index, delta) {
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  saveCart();
}

function updateCartUI() {
  const totalCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

  const countBadge = document.getElementById("cart-count");
  if (countBadge) countBadge.innerText = totalCount;

  const subtotalEl = document.getElementById("cart-subtotal");
  if (subtotalEl) subtotalEl.innerText = `₹${subtotal}`;

  const container = document.getElementById("cart-items-container");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-light); margin-top:3rem;">Your shopping bag is empty.</p>`;
  } else {
    container.innerHTML = cart.map((item, idx) => `
      <div class="cart-item-card">
        <img src="${item.image}" class="cart-item-img" />
        <div style="flex:1;">
          <strong style="font-size:0.92rem; color:var(--text-dark);">${item.name}</strong>
          <p style="font-size:0.78rem; color:var(--text-light); margin:0.2rem 0 0.6rem;">Variant: ${item.variant}</p>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:800; color:var(--primary-green);">₹${item.price * item.quantity}</span>
            <div class="qty-control">
              <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
              <span class="qty-number">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function toggleCart(open = null) {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (!drawer || !overlay) return;

  if (open === true) {
    drawer.classList.add("active");
    overlay.classList.add("active");
  } else if (open === false) {
    drawer.classList.remove("active");
    overlay.classList.remove("active");
  } else {
    drawer.classList.toggle("active");
    overlay.classList.toggle("active");
  }
}

// WHATSAPP CHECKOUT & BACKEND ORDER LOG
async function checkoutViaWhatsApp() {
  if (cart.length === 0) return alert("Your shopping bag is empty!");

  let msg = "Hi ZOHD Team! I would like to place an order:\n\n";
  let total = 0;

  const orderItems = cart.map((item, i) => {
    const itemTot = item.price * item.quantity;
    total += itemTot;
    msg += `${i + 1}. *${item.name}*\n   • Variant: ${item.variant}\n   • Qty: ${item.quantity}\n   • Price: ₹${itemTot}\n\n`;
    return { productName: item.name, variant: item.variant, quantity: item.quantity, price: item.price };
  });

  msg += `*Subtotal:* ₹${total}\n\nPlease confirm payment details. Thank you!`;

  // Log order to Express Backend asynchronously
  try {
    fetch(`${API_BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: currentUser ? currentUser.name : 'Guest Customer',
        customerContact: currentUser ? currentUser.identifier : 'WhatsApp Order',
        items: orderItems,
        totalAmount: total,
        type: 'Purchase'
      })
    }).catch(err => console.log('Backend log skipped:', err));
  } catch (e) {
    // Continue even if backend call fails
  }

  window.open(`https://wa.me/918655903153?text=${encodeURIComponent(msg)}`, "_blank");
}

// TRADE-IN PICKUP REQUEST
function handleRecyclingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("recycle-name").value;
  const phone = document.getElementById("recycle-phone").value;
  const type = document.getElementById("recycle-type").value;
  const qty = document.getElementById("recycle-qty").value;

  const msg = `Hi ZOHD Team! I'd like to submit a Trade-In Request:\n\nName: ${name}\nPhone: ${phone}\nItem: ${type}\nQty: ${qty}`;
  window.open(`https://wa.me/918655903153?text=${encodeURIComponent(msg)}`, "_blank");
}

// AUTH MODAL & GUEST MODE
function openAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

function switchAuthMode(mode) {
  const tabLogin = document.getElementById("tab-login-btn");
  const tabReg = document.getElementById("tab-register-btn");
  const formLogin = document.getElementById("login-form-container");
  const formReg = document.getElementById("register-form-container");

  if (tabLogin) tabLogin.classList.toggle("active", mode === 'login');
  if (tabReg) tabReg.classList.toggle("active", mode === 'register');
  if (formLogin) formLogin.classList.toggle("hidden", mode !== 'login');
  if (formReg) formReg.classList.toggle("hidden", mode !== 'register');
}

function handleCustomerAuth(e, mode) {
  e.preventDefault();
  const nameInput = document.getElementById("reg-name");
  const name = mode === 'register' && nameInput ? nameInput.value : "Customer";
  currentUser = { name: name };
  localStorage.setItem("zohd_user", JSON.stringify(currentUser));
  updateUserUI();
  closeModal("auth-modal");
}

function continueAsGuest() {
  currentUser = { name: "Guest" };
  localStorage.setItem("zohd_user", JSON.stringify(currentUser));
  updateUserUI();
  closeModal("auth-modal");
}

function updateUserUI() {
  const userDisplay = document.getElementById("user-display-name");
  if (userDisplay && currentUser) {
    userDisplay.innerText = currentUser.name;
  }
}