import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/** =========================
 *  Config
 *  ========================= */
const WHATSAPP_PHONE = "528718940806";

/** =========================
 *  Helpers
 *  ========================= */
const $ = (id) => document.getElementById(id);

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return "";
  return `$${v.toFixed(0)}`;
}

/** =========================
 *  Products UI
 *  ========================= */
const productsGrid = $("productsGrid");
const categoryFilter = $("categoryFilter");
const searchInput = $("searchInput");

let allProducts = [];

/** =========================
 *  Cart (LocalStorage + Drawer UI)
 *  ========================= */
const openCartBtn = $("openCart");
const closeCartBtn = $("closeCart");
const cartOverlay = $("cartOverlay");
const cartDrawer = $("cartDrawer");

const cartItemsEl = $("cartItems");
const cartTotalEl = $("cartTotal");
const cartCountEl = $("cartCount");
const sendCartBtn = $("sendCartWhatsApp");
const clearCartBtn = $("clearCart");

let cart = JSON.parse(localStorage.getItem("mcm_cart") || "[]");

function saveCart() {
  localStorage.setItem("mcm_cart", JSON.stringify(cart));
  updateCartBadge();
  updateCartHeight();
}

function updateCartBadge() {
  if (!cartCountEl) return;
  const count = cart.reduce((acc, it) => acc + (it.qty || 1), 0);
  cartCountEl.textContent = String(count);
}

function updateCartHeight(){
  // crecimiento según cantidad total (sumando qty)
  const count = cart.reduce((acc, it) => acc + (it.qty || 1), 0);

  let h = 52;
  if (count === 0) h = 44;
  else if (count <= 2) h = 55;
  else if (count <= 5) h = 68;
  else if (count <= 8) h = 78;
  else h = 88;

  document.documentElement.style.setProperty("--cart-h", `${h}vh`);
}

function openCart() {
  document.body.classList.add("cart-open");
  if (cartDrawer) cartDrawer.setAttribute("aria-hidden", "false");
  renderCart();
  updateCartHeight();
}

function closeCart() {
  document.body.classList.remove("cart-open");
  if (cartDrawer) cartDrawer.setAttribute("aria-hidden", "true");
}

function addToCart(product) {
  const id = product.id;
  const existing = cart.find((x) => x.id === id);

  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({
      id,
      name: product.name || "Producto",
      price: (product.price ?? product.priceFrom ?? ""),
      imagePath: product.imagePath || "",
      qty: 1
    });
  }

  saveCart();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((x) => x.id !== id);
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const it = cart.find((x) => x.id === id);
  if (!it) return;

  it.qty = (it.qty || 1) + delta;
  if (it.qty <= 0) {
    removeFromCart(id);
    return;
  }

  saveCart();
  renderCart();
}

function calcTotal() {
  let total = 0;
  for (const it of cart) {
    const p = Number(it.price);
    const q = Number(it.qty || 1);
    if (!Number.isNaN(p)) total += p * q;
  }
  return total;
}

function renderCart() {
  if (!cartItemsEl || !cartTotalEl) return;

  if (!cart.length) {
    cartItemsEl.innerHTML = `
      <div class="card" style="padding:14px;">
        <strong>Tu carrito está vacío.</strong>
        <p class="muted" style="margin:8px 0 0;">Agrega productos desde el catálogo.</p>
      </div>
    `;
    cartTotalEl.textContent = "$0";
    updateCartBadge();
    updateCartHeight();
    return;
  }

  cartItemsEl.innerHTML = cart
    .map((it) => {
      const img = it.imagePath ? `./${it.imagePath}` : "";
      const safeName = escapeHtml(it.name || "Producto");

      return `
        <div class="cart-item">
          <div class="cart-thumb">
            ${img ? `<img src="${img}" alt="${safeName}" loading="lazy">` : ""}
          </div>

          <div class="cart-info">
            <p class="cart-name">${safeName}</p>

            <div class="cart-meta">
              <span>${it.price !== "" ? money(it.price) : ""}</span>

              <div class="cart-qty">
                <button class="qty-btn" data-act="dec" data-id="${it.id}" type="button">−</button>
                <span class="qty-num">${it.qty || 1}</span>
                <button class="qty-btn" data-act="inc" data-id="${it.id}" type="button">+</button>
              </div>
            </div>

            <div style="margin-top:8px; display:flex; justify-content:flex-end;">
              <button class="remove-btn" data-act="rm" data-id="${it.id}" type="button">Quitar</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  cartTotalEl.textContent = money(calcTotal());
  updateCartBadge();
  updateCartHeight();
}

function buildCartWhatsApp() {
  if (!cart.length) return "Hola, quiero hacer un pedido con MCM Repostería.";

  const lines = cart
    .map((it, i) => {
      const qty = it.qty || 1;
      const priceTxt = it.price !== "" ? ` - ${money(it.price)}` : "";
      return `${i + 1}) ${it.name} x${qty}${priceTxt}`;
    })
    .join("\n");

  const total = calcTotal();
  const totalTxt = total > 0 ? `\n\nTotal aprox: ${money(total)}` : "";

  return `🧁 *Pedido – MCM Repostería*\n\nEn el horno:\n${lines}${totalTxt}\n\nHola, quiero hacer este pedido por favor.`;
}

function setupCartUI() {
  updateCartBadge();
  updateCartHeight();

  if (openCartBtn) openCartBtn.addEventListener("click", openCart);
  if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
  if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      cart = [];
      saveCart();
      renderCart();
    });
  }

  if (sendCartBtn) {
    sendCartBtn.addEventListener("click", () => {
      const msg = buildCartWhatsApp();
      const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    });
  }

  // Botones dentro del carrito (delegación)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id");

    if (act === "inc") changeQty(id, +1);
    if (act === "dec") changeQty(id, -1);
    if (act === "rm") removeFromCart(id);
  });
}

/** =========================
 *  Product WhatsApp
 *  ========================= */
function buildProductWhatsApp(product) {
  const name = product.name || "Producto";
  const price = (product.price ?? product.priceFrom ?? "");
  const desc = product.description ? `\n${product.description}` : "";
  return `🍰 *Pedido – MCM Repostería*\n\nProducto: *${name}*${price !== "" ? `\nPrecio: $${price}` : ""}${desc}\n\nHola, quiero pedir este producto por favor.`;
}

/** =========================
 *  Render products + actions
 *  ========================= */
function renderProducts(list) {
  if (!productsGrid) return;

  if (!list.length) {
    productsGrid.innerHTML = `
      <div class="card" style="padding:16px; grid-column: 1 / -1;">
        <strong>Aún no hay productos.</strong>
        <p class="muted" style="margin:8px 0 0;">Agrega productos desde <a href="./admin.html"><u>admin.html</u></a>.</p>
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = list
    .map((p) => {
      const img = p.imagePath ? `./${p.imagePath}` : "";
      const price = (p.price ?? p.priceFrom ?? "");
      const priceText = price !== "" ? `$${price}` : "";
      const safeName = escapeHtml(p.name || "Producto");

      return `
        <article class="card product">
          <div class="media">
            ${img ? `<img src="${img}" alt="${safeName}" loading="lazy" onerror="this.style.display='none'">` : ""}
          </div>

          <div class="body">
            <h3>${safeName}</h3>
            <div class="price">${escapeHtml(priceText)}</div>
            ${p.description ? `<p>${escapeHtml(p.description)}</p>` : `<p class="muted">Disponible bajo pedido.</p>`}

            <div class="product-actions">
              <button class="btn primary" data-action="order" data-id="${p.id}" type="button">Pedir</button>
              <button class="btn ghost" data-action="add" data-id="${p.id}" type="button">Agregar</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function applyFilters() {
  const cat = categoryFilter?.value || "all";
  const term = (searchInput?.value || "").trim().toLowerCase();

  const filtered = allProducts.filter((p) => {
    const okCat = cat === "all" ? true : p.category === cat;
    const okTerm = term
      ? (String(p.name || "").toLowerCase().includes(term) ||
         String(p.description || "").toLowerCase().includes(term))
      : true;

    return okCat && okTerm;
  });

  renderProducts(filtered);
}

async function loadProducts() {
  if (!productsGrid) return;

  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    const snap = await getDocs(collection(db, "products"));
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (categoryFilter) {
    const cats = Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean)));
    categoryFilter.innerHTML = [
      `<option value="all">Todas</option>`,
      ...cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</option>`)
    ].join("");
  }

  applyFilters();
}

/** =========================
 *  Pedido personalizado (form)
 *  ========================= */
function buildCakeWhatsAppMessage() {
  const get = (id) => $(id)?.value?.trim?.() || "";
  const rellenos = [...document.querySelectorAll(".relleno:checked")].map((x) => x.value).join(", ");

  const fechaEntrega = get("fechaEntrega");
  const horaEntrega = get("horaEntrega");
  const entregaTxt = (fechaEntrega || horaEntrega)
    ? `${fechaEntrega || "Sin fecha"} ${horaEntrega || "Sin hora"}`
    : "No especificada";

  return `🍰 *Pedido de pastel – MCM Repostería*

Tamaño: ${get("tamano") || "-"}
Sabor del pan: ${get("saborPan") || "-"}
Consistencia: ${get("consistencia") || "-"}
Betún: ${get("betun") || "-"}
Relleno(s): ${rellenos || "-"}

Fruta / Otro: ${get("detalleFruta") || "-"}
Diseño (papel comestible): ${get("detallesLogo") || "-"}
Imagen de referencia: ${get("imagenReferencia") || "-"}
Texto (fondant/chocolate): ${get("fraseFondant") || "-"}

Entrega: ${entregaTxt}

Nombre: ${get("nombreCliente") || "-"}
Teléfono: ${get("telefonoCliente") || "-"}

Comentarios:
${get("comentariosAdicionales") || "-"}`;
}

function setupCakeWhatsApp() {
  const btn = $("sendCakeWhatsApp");
  const waDirect = $("waDirect");
  const year = $("year");

  if (year) year.textContent = new Date().getFullYear();

  const directUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    "Hola, quiero hacer un pedido con MCM Repostería."
  )}`;

  if (waDirect) waDirect.href = directUrl;

  if (!btn) return;
  btn.addEventListener("click", () => {
    const msg = buildCakeWhatsAppMessage();
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  });
}

/** =========================
 *  Acciones en productos
 *  ========================= */
function setupProductActions() {
  if (!productsGrid) return;

  productsGrid.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");

    const product = allProducts.find((x) => x.id === id);
    if (!product) return;

    if (action === "order") {
      const msg = buildProductWhatsApp(product);
      const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    }

    if (action === "add") {
      addToCart(product);
      openCart();
    }
  });
}

/** =========================
 *  Boot
 *  ========================= */
document.addEventListener("DOMContentLoaded", () => {
  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
  if (searchInput) searchInput.addEventListener("input", applyFilters);

  setupCartUI();
  setupCakeWhatsApp();
  setupProductActions();
  loadProducts();
});
