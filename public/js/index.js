let products = [];
let cart = [];
let savedCart = loadSavedCart();
let currentUser = null;
let customerOrders = [];
let productDetailsTrigger = null;
let productSearchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  restoreCustomerSession().then(() => {
    if (!sessionStorage.getItem("zohd_auth_prompted")) {
      setTimeout(() => {
        openAuthModal();
        sessionStorage.setItem("zohd_auth_prompted", "true");
      }, 1200);
    }
  });
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
  const searchableText = [
    product.name,
    product.sku,
    product.category,
    product.description,
    ...(product.keywords || []),
    ...(product.variants || [])
  ]
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
          ${p.sku ? `<div class="product-sku">SKU: ${escapeHtml(p.sku)}</div>` : ""}
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

async function checkDeliveryArea(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const pincode = form.elements.pincode.value.trim();
  const resultElement = document.getElementById("delivery-check-result");
  const submit = form.querySelector('button[type="submit"]');
  resultElement.textContent = "Checking…";
  submit.disabled = true;
  try {
    const response = await fetch(`/api/delivery-areas?pincode=${encodeURIComponent(pincode)}`);
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Unable to check delivery (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(result.error || `Unable to check delivery (HTTP ${response.status}).`);
    resultElement.textContent = result.available
      ? `Delivery is available in ${result.area} (${pincode}).`
      : `Delivery is not currently available for ${pincode}. Please contact us to confirm.`;
    resultElement.classList.toggle("delivery-available", result.available);
    resultElement.classList.toggle("delivery-unavailable", !result.available);
  } catch (error) {
    resultElement.textContent = error.message || "Unable to check delivery. Please try again.";
    resultElement.classList.remove("delivery-available");
    resultElement.classList.add("delivery-unavailable");
  } finally {
    submit.disabled = false;
  }
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
      ${product.sku ? `<p class="product-detail-sku">SKU: ${escapeHtml(product.sku)}</p>` : ""}
      <p class="product-detail-price">₹${product.price} ${product.mrp > product.price ? `<del class="product-mrp">₹${product.mrp}</del>` : ""}</p>
      ${product.keywords && product.keywords.length ? `<p class="product-keywords">${product.keywords.map(keyword => `<span>${escapeHtml(keyword)}</span>`).join("")}</p>` : ""}
      <div class="product-detail-highlights">
        <div class="product-detail-highlight"><i class="fa-solid fa-box-open" aria-hidden="true"></i><span><strong>In this pack</strong><span id="product-detail-pack-summary">${escapeHtml(product.selectedVariant || variants[0] || "Default")}</span></span></div>
        <div class="product-detail-highlight"><i class="fa-solid fa-leaf" aria-hidden="true"></i><span><strong>Material</strong><span>${escapeHtml(materialDetails)}</span></span></div>
        ${isToothbrush ? `<div class="product-detail-highlight"><i class="fa-solid fa-tooth" aria-hidden="true"></i><span><strong>Bristles</strong><span>${escapeHtml(bristleDetails)}</span></span></div>` : ""}
      </div>
      <div class="product-detail-description">${(product.description || "").split(/\r?\n+/).map(paragraph => {
        const heading = paragraph.match(/^\*\*(.+)\*\*$/);
        return `<p>${heading ? `<strong>${escapeHtml(heading[1])}</strong>` : escapeHtml(paragraph)}</p>`;
      }).join("")}</div>
      ${variants.length ? `<div class="form-group">
        <label for="product-detail-variant">Choose Variant</label>
        <select id="product-detail-variant">${variants.map(variant => `<option value="${escapeHtml(variant)}" ${variant === product.selectedVariant ? "selected" : ""}>${escapeHtml(variant)}</option>`).join("")}</select>
      </div>` : ""}
      <button type="button" class="btn btn-primary full-width product-detail-add" ${product.stock === "Out of Stock" ? "disabled" : ""}>Add to Bag</button>
    </div>
    <section class="product-reviews" aria-labelledby="product-reviews-heading" data-review-product-id="${productId}">
      <div class="product-reviews-heading">
        <div><h3 id="product-reviews-heading">Customer reviews</h3><p class="product-review-summary">Loading reviews…</p></div>
      </div>
      <div class="product-review-list"></div>
      ${currentUser && currentUser.id ? `<form class="product-review-form">
        <label for="product-review-rating">Your rating</label>
        <select id="product-review-rating" name="rating" required>
          <option value="">Choose a rating</option>
          <option value="5">★★★★★ — Excellent</option>
          <option value="4">★★★★☆ — Very good</option>
          <option value="3">★★★☆☆ — Good</option>
          <option value="2">★★☆☆☆ — Fair</option>
          <option value="1">★☆☆☆☆ — Poor</option>
        </select>
        <label for="product-review-text">Your review</label>
        <textarea id="product-review-text" name="text" minlength="10" maxlength="1000" rows="3" placeholder="Share your experience (10–1,000 characters)" required></textarea>
        <button class="btn btn-outline" type="submit">Submit review</button>
        <p class="product-review-status" role="status" aria-live="polite"></p>
      </form>` : `<p class="product-review-signin"><button type="button" class="review-signin-btn">Sign in to review a product you ordered</button></p>`}
    </section>`;
  const detailContent = modal.querySelector(".product-detail-content");

  const variantSelect = modal.querySelector("#product-detail-variant");
  if (variantSelect) {
    variantSelect.addEventListener("change", event => {
      const summary = modal.querySelector("#product-detail-pack-summary");
      if (summary) summary.textContent = event.currentTarget.value;
    });
  }
  
  detailContent.onclick = event => {
    const thumbnail = event.target.closest("[data-detail-image-index]");
    if (thumbnail) {
      const image = images[Number(thumbnail.dataset.detailImageIndex)];
      if (!image) return;
      modal.querySelector(".product-detail-image").src = image;
      modal.querySelectorAll("[data-detail-image-index]").forEach(button => {
        const selected = button === thumbnail;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      return;
    }
    if (event.target.closest(".review-signin-btn")) {
      closeProductDetails();
      openAuthModal();
      switchAuthMode("login");
    }
  };

  const reviewForm = detailContent.querySelector(".product-review-form");
  if (reviewForm) {
    reviewForm.addEventListener("submit", event => submitProductReview(event, productId));
  }
  loadProductReviews(productId, detailContent);
  
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

async function loadProductReviews(productId, detailContent) {
  try {
    const response = await fetch(`/api/products/${productId}/reviews`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Unable to load reviews (HTTP ${response.status}).`);
    const reviewsSection = detailContent.querySelector(".product-reviews");
    if (!reviewsSection || Number(reviewsSection.dataset.reviewProductId) !== productId) return;
    const summary = reviewsSection.querySelector(".product-review-summary");
    const list = reviewsSection.querySelector(".product-review-list");
    if (summary) {
      summary.textContent = result.count
        ? `${result.average} out of 5 · ${result.count} ${result.count === 1 ? "review" : "reviews"}`
        : "No approved reviews yet.";
    }
    if (list) {
      list.innerHTML = result.reviews.length
        ? result.reviews.map(review => `
          <article class="product-review">
            <div class="product-review-stars" aria-label="${review.rating} out of 5 stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
            <p>${escapeHtml(review.text)}</p>
            <small>${escapeHtml(review.customerName)} · Verified order</small>
          </article>
        `).join("")
        : `<p class="product-review-empty">Reviews from verified customers will appear here after approval.</p>`;
    }
  } catch (error) {
    const summary = detailContent.querySelector(".product-review-summary");
    if (summary) summary.textContent = error.message;
  }
}

async function submitProductReview(event, productId) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector(".product-review-status");
  const submit = form.querySelector('button[type="submit"]');
  status.textContent = "";
  submit.disabled = true;
  try {
    const response = await fetch(`/api/products/${productId}/reviews`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: Number(form.elements.rating.value),
        text: form.elements.text.value
      })
    });
    const result = await response.json();
    if (!response.ok)     if (response.status === 401) {
      currentUser = null;
      const displayName = document.getElementById("user-display-name");
      if (displayName) displayName.textContent = "Login / Register";
      closeProductDetails();
      openAuthModal();
      const loginError = document.getElementById("customer-login-error");
      if (loginError) loginError.textContent = result.error || "Please sign in again to submit your review.";
    }
    throw new Error(result.error || `Unable to submit review (HTTP ${response.status}).`);
    form.reset();
    status.textContent = "Thanks! Your review is waiting for approval.";
  } catch (error) {
    status.textContent = error.message || "Unable to submit review. Please try again.";
  } finally {
    submit.disabled = false;
  }
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

async function checkoutViaWhatsApp() {
  const status = document.getElementById("checkout-status");
  if (cart.length === 0) {
    if (status) status.textContent = "Your shopping bag is empty.";
    return;
  }
  if (!currentUser || !currentUser.id) {
    if (status) status.textContent = "Please sign in before placing an order so we can save your order and delivery details.";
    toggleCart(false);
    openAuthModal();
    switchAuthMode("login");
    return;
  }

  if (status) status.textContent = "";
  const whatsAppWindow = window.open("about:blank", "_blank");
  const button = document.querySelector("#cart-drawer .btn-whatsapp");
  if (button) {
    button.disabled = true;
    button.dataset.originalHtml = button.innerHTML;
    button.textContent = "Saving your order…";
  }
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(item => ({
          productId: item.id,
          variant: item.variant,
          quantity: item.quantity
        }))
      })
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Unable to save your order (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      if (response.status === 401) {
        currentUser = null;
        const displayName = document.getElementById("user-display-name");
        if (displayName) displayName.textContent = "Login / Register";
        openAuthModal();
        const loginError = document.getElementById("customer-login-error");
        if (loginError) loginError.textContent = result.error || "Please sign in again to place your order.";
      }
      throw new Error(result.error || `Unable to save your order (HTTP ${response.status}).`);
    }
    if (!result.order || !result.order.orderNumber) {
      throw new Error("The server did not return an order confirmation.");
    }

    const order = result.order;
    let message = `Hi ZOHD Team! I have placed order *${order.orderNumber}*:\n\n`;
    order.items.forEach((item, index) => {
      message += `${index + 1}. *${item.name}*\n   Variant: ${item.variant}\n   Qty: ${item.quantity}\n   Price: ₹${item.lineTotal}\n\n`;
    });
    message += `*Subtotal:* ₹${order.subtotal}\n*Deliver to:* ${order.customer.address}, ${order.customer.location}\n\nPlease confirm my order. Thank you!`;

    cart = [];
    savedCart = [];
    saveCart();
    toggleCart(false);
    if (status) status.textContent = `Order ${order.orderNumber} saved. Continue in WhatsApp to confirm it.`;
    if (whatsAppWindow) {
      whatsAppWindow.location.href = `https://wa.me/918655903153?text=${encodeURIComponent(message)}`;
    } else {
      window.location.assign(`https://wa.me/918655903153?text=${encodeURIComponent(message)}`);
    }
    if (currentUser && currentUser.id) loadCustomerOrders();
  } catch (error) {
    if (whatsAppWindow && !whatsAppWindow.closed) whatsAppWindow.close();
    if (status) status.textContent = error.message || "Unable to place your order. Please try again.";
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = button.dataset.originalHtml || '<i class="fa-brands fa-whatsapp"></i> Place Order on WhatsApp';
    }
  }
}

function openAuthModal() {
  const isSignedIn = Boolean(currentUser && currentUser.id);
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

  const guestDivider = document.querySelector(".guest-divider-wrapper");
  if (guestDivider) guestDivider.classList.toggle("hidden", isSignedIn);

  const adminSignin = document.getElementById("customer-admin-signin");
  if (adminSignin) adminSignin.classList.toggle("hidden", isSignedIn);

  if (isSignedIn) {
    const accName = document.getElementById("customer-account-name");
    if (accName) accName.textContent = `Welcome, ${currentUser.name}`;
    const accIdentifier = document.getElementById("customer-account-identifier");
    if (accIdentifier) accIdentifier.textContent = currentUser.identifier || "";
    loadCustomerOrders();
  } else {
    switchAuthMode("login");
  }
  
  const modal = document.getElementById("auth-modal");
  if (modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
}

function switchAuthMode(mode) {
  const isLogin = mode === "login";
  const loginContainer = document.getElementById("login-form-container");
  if (loginContainer) loginContainer.classList.toggle("hidden", !isLogin);
  
  const regContainer = document.getElementById("register-form-container");
  if (regContainer) regContainer.classList.toggle("hidden", isLogin);

  const loginTab = document.getElementById("tab-login-btn");
  if (loginTab) loginTab.classList.toggle("active", isLogin);
  const registerTab = document.getElementById("tab-register-btn");
  if (registerTab) registerTab.classList.toggle("active", !isLogin);

  ["customer-login-error", "customer-register-error"].forEach(id => {
    const error = document.getElementById(id);
    if (error) error.textContent = "";
  });
}

async function handleCustomerAuth(event, mode) {
  event.preventDefault();
  const isRegister = mode === "register";
  const errorElem = document.getElementById(isRegister ? "customer-register-error" : "customer-login-error");
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  if (errorElem) errorElem.textContent = "";

  const password = document.getElementById(isRegister ? "reg-password" : "login-password").value;
  if (isRegister && password !== document.getElementById("reg-confirm-password").value) {
    if (errorElem) errorElem.textContent = "Passwords do not match.";
    return;
  }

  const body = isRegister
    ? {
        name: document.getElementById("reg-name").value,
        identifier: document.getElementById("reg-identifier").value,
        address: document.getElementById("reg-address").value,
        location: document.getElementById("reg-location").value,
        password
      }
    : {
        identifier: document.getElementById("login-id").value,
        password
      };

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = isRegister ? "Creating account..." : "Signing in...";
  }

  try {
    const response = await fetch(`/api/customer/${mode}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let result;
    try {
      result = await response.json();
    } catch {
      if (response.status === 404) {
        throw new Error("The customer account API was not found. Redeploy the latest site/API files and open the site from that deployment.");
      }
      throw new Error(response.ok
        ? "The server returned an invalid sign-in response."
        : `Account request failed (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("The customer account API was not found. Redeploy the latest site/API files and open the site from that deployment.");
      }
      throw new Error(result.error || `Account request failed (HTTP ${response.status}).`);
    }
    if (!result.customer || !result.customer.id) {
      throw new Error("The server did not return a valid customer account.");
    }

    setCurrentCustomer(result.customer);
    closeModal("auth-modal");
  } catch (error) {
    if (errorElem) errorElem.textContent = error.message || "Unable to complete your account request. Please try again.";
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
}

function setCurrentCustomer(customer) {
  currentUser = customer;
  const displayName = document.getElementById("user-display-name");
  if (displayName) displayName.textContent = customer.name;
  const accountName = document.getElementById("customer-account-name");
  if (accountName) accountName.textContent = `Welcome, ${customer.name}`;
  const accountIdentifier = document.getElementById("customer-account-identifier");
  if (accountIdentifier) accountIdentifier.textContent = customer.identifier || "";
  loadCustomerOrders();
}

async function loadCustomerOrders() {
  const list = document.getElementById("customer-orders-list");
  if (!list || !currentUser || !currentUser.id) return;
  list.innerHTML = "<p>Loading your orders…</p>";
  try {
    const response = await fetch("/api/customer/orders", { credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Unable to load orders (HTTP ${response.status}).`);
    if (!Array.isArray(result)) throw new Error("The order history response is invalid.");
    customerOrders = result;
    list.innerHTML = customerOrders.length
      ? customerOrders.map((order, index) => `
        <article class="customer-order">
          <div><strong>${escapeHtml(order.orderNumber)}</strong><span>${escapeHtml(order.status)}</span></div>
          <p>${new Date(order.createdAt).toLocaleDateString()} · ₹${order.subtotal}</p>
          <button type="button" class="btn btn-outline" onclick="reorderCustomerOrder(${index})">Reorder</button>
        </article>
      `).join("")
      : "<p>You have not placed an order yet.</p>";
  } catch (error) {
    list.innerHTML = `<p role="alert">${escapeHtml(error.message || "Unable to load your orders.")}</p>`;
  }
}

async function reorderCustomerOrder(orderIndex) {
  const order = customerOrders[orderIndex];
  if (!order) return;
  if (!products.length) {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error(`Unable to load the catalog (HTTP ${response.status}).`);
      products = await response.json();
    } catch (error) {
      alert(error.message || "Unable to load products for reorder.");
      return;
    }
  }

  let skipped = 0;
  for (const item of order.items) {
    const product = products.find(entry => entry.id === item.productId);
    const variants = product && Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : ["Standard"];
    if (!product || product.stock === "Out of Stock" || !variants.includes(item.variant)) {
      skipped += 1;
      continue;
    }
    const existing = cart.find(entry => entry.id === product.id && entry.variant === item.variant);
    const quantity = Math.min(item.quantity, 99);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, 99);
    else cart.push({ ...product, variant: item.variant, quantity });
  }
  saveCart();
  closeModal("auth-modal");
  toggleCart(true);
  const status = document.getElementById("checkout-status");
  if (status) {
    status.textContent = skipped
      ? `${skipped} unavailable item(s) were skipped. Review your bag before checkout.`
      : "Your previous items are back in the bag. Review quantities before checkout.";
  }
}

async function restoreCustomerSession() {
  try {
    const response = await fetch("/api/customer/me", { credentials: "same-origin" });
    if (response.status === 401) return;
    if (!response.ok) {
      throw new Error(`Unable to restore customer session (HTTP ${response.status}).`);
    }
    const result = await response.json();
    if (!result.customer || !result.customer.id) {
      throw new Error("The server returned an invalid customer session.");
    }
    setCurrentCustomer(result.customer);
  } catch (error) {
    console.error("Unable to restore customer session:", error);
  }
}

async function logoutCustomer() {
  const errorElem = document.getElementById("customer-logout-error");
  if (errorElem) errorElem.textContent = "";
  try {
    const response = await fetch("/api/customer/logout", {
      method: "POST",
      credentials: "same-origin"
    });
    if (!response.ok) {
      let message = `Unable to sign out (HTTP ${response.status}).`;
      try {
        const result = await response.json();
        if (result.error) message = result.error;
      } catch {
        // Keep the HTTP status message when the server provides no JSON error.
      }
      throw new Error(message);
    }
    currentUser = null;
    customerOrders = [];
    const displayName = document.getElementById("user-display-name");
    if (displayName) displayName.textContent = "Login / Register";
    openAuthModal();
  } catch (error) {
    if (errorElem) errorElem.textContent = error.message || "Unable to sign out. Please try again.";
  }
}

function continueAsGuest() {
  currentUser = { name: "Guest" };
  const displayName = document.getElementById("user-display-name");
  if (displayName) displayName.textContent = "Guest";
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
  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.classList.remove("hidden");
  const guestDivider = document.querySelector(".guest-divider-wrapper");
  if (guestDivider) guestDivider.classList.remove("hidden");
  const adminSignin = document.getElementById("customer-admin-signin");
  if (adminSignin) adminSignin.classList.remove("hidden");
  const adminContainer = document.getElementById("admin-login-container");
  if (adminContainer) adminContainer.classList.add("hidden");
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
const adminForm = document.getElementById("main-admin-login-form");
if (adminForm) {
  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const adminIdInput = document.getElementById("main-admin-id");
    const passwordInput = document.getElementById("main-admin-password");
    const errorElem = document.getElementById("main-admin-error");
    if (errorElem) errorElem.textContent = "";

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: adminIdInput.value,
          password: passwordInput.value
        })
      });

      if (!response.ok) {
        let message = "Unable to sign in to the admin portal.";
        try {
          const result = await response.json();
          if (result.error) message = result.error;
        } catch {
          message = `Admin sign-in failed (HTTP ${response.status}).`;
        }
        throw new Error(message);
      }

      window.location.assign("/admin/dashboard");
    } catch (error) {
      if (errorElem) errorElem.textContent = error.message;
    }
  });
}