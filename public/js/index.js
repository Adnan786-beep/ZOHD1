let products = [];
let cart = [];
let savedCart = loadSavedCart();
let currentUser = null;
let productDetailsTrigger = null;
let productSearchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  restoreCustomerSession();

  if (!localStorage.getItem("zohd_visited")) {
    setTimeout(() => {
      openAuthModal();
      localStorage.setItem("zohd_visited", "true");
    }, 1200);
  }
});

async function loadProducts() {
  try {
    const response = await fetch('data/products.json');
    if (!response.ok) {
      throw new Error(`Unable to load product catalog (HTTP ${response.status}).`);
    }
    const catalog = await response.json();
    if (!Array.isArray(catalog)) throw new Error("The product catalog response is invalid.");
    
    products = catalog.map(product => ({
      ...product,
      selectedVariant: product.variants ? product.variants[0] : ""
    }));

    cart = savedCart.flatMap(item => {
      const product = products.find(entry =>
        entry.id === item.id && (entry.variants || []).includes(item.variant)
      );
      return product ? [{ ...product, variant: item.variant, quantity: item.quantity }] : [];
    });
    savedCart = [];
    saveCart();

    renderProducts("product-grid-container");
    renderProducts("home-product-grid", 4);
    updateProductSearchStatus();
  } catch (error) {
    console.error(error);
    document.querySelectorAll("#product-grid-container, #home-product-grid").forEach(productContainer => {
      productContainer.innerHTML = `<p class="catalog-message" role="alert">${escapeHtml(error.message)} Please refresh the page or try again later.</p>`;
    });
  }
}

function showSection(sectionId) {
  document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-links a").forEach(a => a.classList.remove("active"));
  
  const targetNav = document.getElementById(`nav-${sectionId.replace('-section', '')}`);
  if (targetNav) targetNav.classList.add("active");

  const section = document.getElementById(sectionId);
  if (section) section.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showMaterialsComparison() {
  showSection("home-section");
  requestAnimationFrame(() => {
    const target = document.getElementById("materials-comparison");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function openProductSearch(query = "") {
  showSection("shop-section");
  const input = document.getElementById("product-search");
  if (input) {
    input.value = query;
    filterProducts(query);
    input.focus();
  }
}

function filterProducts(query) {
  productSearchQuery = query.trim().toLocaleLowerCase();
  document.querySelectorAll("#product-grid-container, #home-product-grid").forEach(container => {
    renderProducts(container.id, container.id === "home-product-grid" ? 4 : products.length);
  });
  updateProductSearchStatus();
}

function clearProductSearch() {
  const input = document.getElementById("product-search");
  if (input) {
    input.value = "";
    filterProducts("");
    input.focus();
  }
}

function updateProductSearchStatus() {
  const status = document.getElementById("product-search-status");
  if (!status) return;
  const matchingCount = products.filter(productMatchesSearch).length;
  status.textContent = productSearchQuery
    ? `${matchingCount} ${matchingCount === 1 ? "product" : "products"} found`
    : `${products.length} products`;
}

function productMatchesSearch(product) {
  if (!productSearchQuery) return true;
  const searchableText = [product.name, product.category, product.description, ...(product.variants || [])]
    .join(" ")
    .toLocaleLowerCase();
  return searchableText.includes(productSearchQuery);
}

function selectVariant(productId, variant) {
  const p = products.find(x => x.id === productId);
  if (!p) return;
  p.selectedVariant = variant;
  document.querySelectorAll(`[data-product-id="${productId}"][data-variant]`).forEach(button => {
    const selected = button.dataset.variant === variant;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderProducts(containerId, limit = products.length) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const matchingProducts = products.filter(productMatchesSearch);
  if (matchingProducts.length === 0) {
    container.innerHTML = productSearchQuery 
      ? `<p>No products match “${escapeHtml(productSearchQuery)}”. Try another search.</p>`
      : `<p>No products are currently available.</p>`;
    return;
  }
  container.innerHTML = matchingProducts.slice(0, limit).map(p => {
    const variants = p.variants || [];
    return `
      <div class="product-card" data-product-card data-product-id="${p.id}" role="group" aria-label="${escapeHtml(p.name)}">
        <div class="product-gallery">
          <img src="${escapeHtml(p.image)}" class="product-img" alt="${escapeHtml(p.name)}" />
          ${(p.images || [p.image]).length > 1 ? `
            <div class="product-thumbnails" aria-label="Product images">
              ${(p.images || [p.image]).map((image, index) => `
                <button type="button" class="product-thumbnail ${index === 0 ? "active" : ""}" data-product-id="${p.id}" data-image-index="${index}" aria-label="View product image ${index + 1}" aria-pressed="${index === 0}">
                  <img src="${escapeHtml(image)}" alt="" />
                </button>
              `).join("")}
            </div>
          ` : ""}
        </div>
        <div class="product-info">
          <div class="product-title">${escapeHtml(p.name)}</div>
          <div class="product-desc">${escapeHtml((p.description || "").slice(0, 150))}${(p.description || "").length > 150 ? "…" : ""}</div>
          <button type="button" class="product-details-hint" data-product-detail-trigger="${p.id}" onclick="openProductDetails(${p.id}, this)">View full product details</button>
          
          <div class="variant-pills">
            ${variants.map(v => `
              <button type="button" class="variant-pill ${p.selectedVariant === v ? 'active' : ''}" data-product-id="${p.id}" data-variant="${escapeHtml(v)}">${escapeHtml(v)}</button>
            `).join('')}
          </div>

          <div class="product-price">
            ₹${p.price}
            ${p.mrp > p.price ? `<del class="product-mrp">₹${p.mrp}</del>` : ""}
          </div>

          <button class="btn btn-primary full-width" onclick="addToCart(${p.id})" ${p.stock === "Out of Stock" ? "disabled" : ""}>
            <i class="fa-solid fa-bag-shopping"></i> Add to Bag
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function subscribeToNewsletter(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("newsletter-status");
  const submitButton = form.querySelector('button[type="submit"]');
  if (status) {
    status.textContent = "Thanks for subscribing! (Static Mode)";
    status.classList.remove("error");
  }
  form.reset();
}

document.querySelectorAll("#product-grid-container, #home-product-grid").forEach(container => {
  container.addEventListener("click", event => {
    const thumbnail = event.target.closest("[data-product-id][data-image-index]");
    if (thumbnail) {
      const product = products.find(item => item.id === Number(thumbnail.dataset.productId));
      const image = product && (product.images || [product.image])[Number(thumbnail.dataset.imageIndex)];
      if (image) {
        thumbnail.closest(".product-gallery").querySelector(".product-img").src = image;
        thumbnail.closest(".product-thumbnails").querySelectorAll(".product-thumbnail").forEach(button => {
          const selected = button === thumbnail;
          button.classList.toggle("active", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
      }
      return;
    }
    const pill = event.target.closest("[data-product-id][data-variant]");
    if (pill) {
      selectVariant(Number(pill.dataset.productId), pill.dataset.variant);
      return;
    }
    if (event.target.closest("button, select, a")) return;
    const card = event.target.closest("[data-product-card]");
    if (card) openProductDetails(Number(card.dataset.productId));
  });
});

function openProductDetails(productId, trigger = null) {
  const product = products.find(item => item.id === productId);
  const modal = document.getElementById("product-detail-modal");
  if (!product || !modal) return;

  const images = product.images || [product.image];
  const variants = product.variants || [];
  const isFamilyPack = /family/i.test(product.category || "");
  const isToothbrush = /toothbrush/i.test(product.name || "");
  const materialDetails = /neem/i.test(`${product.name} ${product.category}`)
    ? "Neem wood"
    : /notebook/i.test(product.name)
      ? "Seed notebook"
      : "Natural bamboo";
  const bristleDetails = isFamilyPack
    ? "Soft bristles for adults and extra-soft bristles for kids"
    : /neem/i.test(`${product.name} ${product.category}`)
      ? (/kids/i.test(product.category || "") ? "Softer design for kids" : "Soft, biodegradable bristles")
      : (/kids/i.test(product.category || "") ? "Ultra-soft for kids" : "Soft for adults");
  productDetailsTrigger = trigger || document.querySelector(`[data-product-detail-trigger="${productId}"]:not([hidden])`);
  
  modal.querySelector(".product-detail-content").innerHTML = `
    <div class="product-detail-gallery">
      <img class="product-detail-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" />
      ${images.length > 1 ? `<div class="product-thumbnails" aria-label="Product images">
        ${images.map((image, index) => `<button type="button" class="product-thumbnail ${index === 0 ? "active" : ""}" data-detail-image-index="${index}" aria-label="View product image ${index + 1}" aria-pressed="${index === 0}">
          <img src="${escapeHtml(image)}" alt="" />
        </button>`).join("")}
      </div>` : ""}
    </div>
    <div class="product-detail-info">
      <span class="product-detail-category">${escapeHtml(product.category)}</span>
      <h2 id="product-detail-heading">${escapeHtml(product.name)}</h2>
      <p class="product-detail-price">₹${product.price} ${product.mrp > product.price ? `<del class="product-mrp">₹${product.mrp}</del>` : ""}</p>
      <div class="product-detail-highlights">
        <div class="product-detail-highlight"><i class="fa-solid fa-box-open" aria-hidden="true"></i><span><strong>In this pack</strong><span id="product-detail-pack-summary">${escapeHtml(product.selectedVariant || variants[0] || "Default")}</span></span></div>
        <div class="product-detail-highlight"><i class="fa-solid fa-leaf" aria-hidden="true"></i><span><strong>Material</strong><span>${escapeHtml(materialDetails)}</span></span></div>
        ${isToothbrush ? `<div class="product-detail-highlight"><i class="fa-solid fa-tooth" aria-hidden="true"></i><span><strong>Bristles</strong><span>${escapeHtml(bristleDetails)}</span></span></div>` : ""}
      </div>
      <div class="product-detail-description">${(product.description || "").split(/\r?\n+/).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
      ${variants.length ? `<div class="form-group">
        <label for="product-detail-variant">Choose Variant</label>
        <select id="product-detail-variant">${variants.map(variant => `<option value="${escapeHtml(variant)}" ${variant === product.selectedVariant ? "selected" : ""}>${escapeHtml(variant)}</option>`).join("")}</select>
      </div>` : ""}
      <button type="button" class="btn btn-primary full-width product-detail-add" ${product.stock === "Out of Stock" ? "disabled" : ""}>Add to Bag</button>
    </div>`;

  const variantSelect = modal.querySelector("#product-detail-variant");
  if (variantSelect) {
    variantSelect.addEventListener("change", event => {
      const summary = modal.querySelector("#product-detail-pack-summary");
      if (summary) summary.textContent = event.currentTarget.value;
    });
  }
  
  modal.querySelector(".product-detail-content").onclick = event => {
    const thumbnail = event.target.closest("[data-detail-image-index]");
    if (!thumbnail) return;
    const image = images[Number(thumbnail.dataset.detailImageIndex)];
    if (!image) return;
    modal.querySelector(".product-detail-image").src = image;
    modal.querySelectorAll("[data-detail-image-index]").forEach(button => {
      const selected = button === thumbnail;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  };
  
  modal.querySelector(".product-detail-add").onclick = () => {
    const selectedVar = variantSelect ? variantSelect.value : (product.selectedVariant || "");
    closeProductDetails();
    addToCart(productId, selectedVar);
  };
  
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("product-detail-open");
  const closeBtn = modal.querySelector(".product-detail-close");
  if (closeBtn) closeBtn.focus();
}

function closeProductDetails() {
  const modal = document.getElementById("product-detail-modal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("product-detail-open");
  const content = modal.querySelector(".product-detail-content");
  if (content) content.replaceChildren();
  if (productDetailsTrigger) productDetailsTrigger.focus();
  productDetailsTrigger = null;
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeProductDetails();
});

function addToCart(productId, selectedVariant = null) {
  const p = products.find(x => x.id === productId);
  if (!p || p.stock === "Out of Stock") {
    alert("This product is unavailable. Refresh the catalog and try again.");
    return;
  }

  const variant = selectedVariant || p.selectedVariant || "";
  const existing = cart.find(x => x.id === productId && x.variant === variant);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...p, variant, quantity: 1 });
  }

  saveCart();
  toggleCart(true);
}

function updateCartQty(index, delta) {
  if (!cart[index]) return;
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  saveCart();
}

function loadSavedCart() {
  try {
    const storedCart = localStorage.getItem("zohd_cart");
    if (!storedCart) return [];
    const parsedCart = JSON.parse(storedCart);
    if (!Array.isArray(parsedCart)) throw new Error("Saved shopping bag data is invalid.");
    return parsedCart.filter(item =>
      item
      && Number.isInteger(item.id)
      && typeof item.variant === "string"
      && Number.isInteger(item.quantity)
      && item.quantity > 0
      && item.quantity <= 99
    ).map(item => ({ id: item.id, variant: item.variant, quantity: item.quantity }));
  } catch (error) {
    console.error("Unable to restore saved shopping bag:", error);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem("zohd_cart", JSON.stringify(cart.map(item => ({
      id: item.id,
      variant: item.variant,
      quantity: item.quantity
    }))));
  } catch (error) {
    console.error("Unable to save shopping bag:", error);
  }
  updateCartUI();
}

function updateCartUI() {
  const totalCount = cart.reduce((s, i) => s + i.quantity, 0);
  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);

  const countElem = document.getElementById("cart-count");
  const subtotalElem = document.getElementById("cart-subtotal");
  if (countElem) countElem.innerText = totalCount;
  if (subtotalElem) subtotalElem.innerText = `₹${subtotal}`;

  const container = document.getElementById("cart-items-container");
  if (!container) return;
  
  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-light); margin-top:3rem;">Your shopping bag is empty.</p>`;
  } else {
    container.innerHTML = cart.map((item, idx) => `
      <div class="cart-item-card">
        <img src="${escapeHtml(item.image)}" class="cart-item-img" />
        <div style="flex:1;">
          <strong style="font-size:0.92rem; color:var(--text-dark);">${escapeHtml(item.name)}</strong>
          <p style="font-size:0.78rem; color:var(--text-light); margin:0.2rem 0 0.6rem;">Variant: ${escapeHtml(item.variant)}</p>
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

function checkoutViaWhatsApp() {
  if (cart.length === 0) return alert("Your shopping bag is empty!");

  let msg = `Hi ZOHD Team! I would like to place an order:\n\n`;
  cart.forEach((item, index) => {
    msg += `${index + 1}. *${item.name}*\n   • Variant: ${item.variant}\n   • Qty: ${item.quantity}\n   • Price: ₹${item.price * item.quantity}\n\n`;
  });
  
  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  msg += `*Subtotal:* ₹${subtotal}\n\nPlease confirm payment details. Thank you!`;

  cart = [];
  saveCart();
  const whatsappUrl = `https://wa.me/918655903153?text=${encodeURIComponent(msg)}`;
  window.open(whatsappUrl, "_blank");
}

function openAuthModal() {
  const isSignedIn = currentUser && currentUser.id;
  const summary = document.getElementById("customer-account-summary");
  if (summary) summary.classList.toggle("hidden", !isSignedIn);
  
  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.classList.toggle("hidden", Boolean(isSignedIn));
  
  const loginContainer = document.getElementById("login-form-container");
  if (loginContainer) loginContainer.classList.toggle("hidden", Boolean(isSignedIn));
  
  const regContainer = document.getElementById("register-form-container");
  if (regContainer) regContainer.classList.add("hidden");
  
  const adminContainer = document.getElementById("admin-login-container");
  if (adminContainer) adminContainer.classList.add("hidden");
  
  if (isSignedIn) {
    const accName = document.getElementById("customer-account-name");
    if (accName) accName.textContent = `Welcome, ${currentUser.name}`;
  } else {
    switchAuthMode("login");
  }
  
  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

function switchAuthMode(mode) {
  const loginContainer = document.getElementById("login-form-container");
  if (loginContainer) loginContainer.classList.toggle("hidden", mode !== 'login');
  
  const regContainer = document.getElementById("register-form-container");
  if (regContainer) regContainer.classList.toggle("hidden", mode !== 'register');
}

function restoreCustomerSession() {
  console.log('Static mode: Backend session restore skipped.');
}

function continueAsGuest() {
  currentUser = { name: "Guest" };
  const displayName = document.getElementById("user-display-name");
  if (displayName) displayName.innerText = "Guest";
  closeModal("auth-modal");
}

window.addEventListener('load', () => {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  setTimeout(() => loader.classList.add('hidden'), 600);
});
function showAdminSignIn() {
  alert("Admin portal is disabled in static mode.");
}

function showCustomerSignIn() {
  switchAuthMode("login");
}
function showAdminSignIn() {
  const summary = document.getElementById("customer-account-summary");
  if (summary) summary.classList.add("hidden");

  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.classList.add("hidden");

  const loginContainer = document.getElementById("login-form-container");
  if (loginContainer) loginContainer.classList.add("hidden");

  const regContainer = document.getElementById("register-form-container");
  if (regContainer) regContainer.classList.add("hidden");

  const guestDivider = document.querySelector(".guest-divider-wrapper");
  if (guestDivider) guestDivider.classList.add("hidden");

  const customerSigninBtn = document.getElementById("customer-admin-signin");
  if (customerSigninBtn) customerSigninBtn.classList.add("hidden");

  const adminContainer = document.getElementById("admin-login-container");
  if (adminContainer) adminContainer.classList.remove("hidden");

  const adminError = document.getElementById("main-admin-error");
  if (adminError) adminError.textContent = "";

  const modal = document.getElementById("auth-modal");
  if (modal) modal.classList.add("active");
}