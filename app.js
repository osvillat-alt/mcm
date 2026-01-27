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
 *  UI helpers
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

/** =========================
 *  Products
 *  ========================= */
const productsGrid = $("productsGrid");
const categoryFilter = $("categoryFilter");
const searchInput = $("searchInput");

let allProducts = [];

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

      return `
        <article class="card product">
          <div class="media">
            ${
              img
                ? `<img src="${img}" alt="${escapeHtml(p.name || "Producto")}" loading="lazy" onerror="this.style.display='none'">`
                : ""
            }
          </div>
          <div class="body">
            <h3>${escapeHtml(p.name || "")}</h3>
            <div class="price">${escapeHtml(priceText)}</div>
            ${
              p.description
                ? `<p>${escapeHtml(p.description)}</p>`
                : `<p class="muted">Disponible bajo pedido.</p>`
            }
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
    // fallback si no existe createdAt o el índice aún no está listo
    const snap = await getDocs(collection(db, "products"));
    allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  if (categoryFilter) {
    const cats = Array.from(
      new Set(allProducts.map((p) => p.category).filter(Boolean))
    );

    categoryFilter.innerHTML = [
      `<option value="all">Todas</option>`,
      ...cats.map(
        (c) =>
          `<option value="${escapeHtml(c)}">${escapeHtml(
            c.charAt(0).toUpperCase() + c.slice(1)
          )}</option>`
      ),
    ].join("");
  }

  applyFilters();
}

/** =========================
 *  WhatsApp order
 *  ========================= */
function buildWhatsAppMessage() {
  const get = (id) => $(id)?.value?.trim?.() || "";

  const rellenos = [...document.querySelectorAll(".relleno:checked")]
    .map((x) => x.value)
    .join(", ");

  const fechaEntrega = get("fechaEntrega");
  const horaEntrega = get("horaEntrega");

  const entregaTxt = (fechaEntrega || horaEntrega)
    ? `${fechaEntrega || "Sin fecha"} ${horaEntrega || "Sin hora"}`
    : "No especificada";

  const msg = `🍰 *Pedido de pastel – MCM Repostería*

Tamaño: ${get("tamano") || "-"}
Sabor del pan: ${get("saborPan") || "-"}
Consistencia: ${get("consistencia") || "-"}
Betún: ${get("betun") || "-"}
Relleno(s): ${rellenos || "-"}

Fruta: ${get("detalleFruta") || "-"}
Diseño (papel comestible): ${get("detallesLogo") || "-"}
Imagen de referencia: ${get("imagenReferencia") || "-"}
Frase en fondant: ${get("fraseFondant") || "-"}

Entrega: ${entregaTxt}

Nombre: ${get("nombreCliente") || "-"}
Teléfono: ${get("telefonoCliente") || "-"} 

Comentarios:
${get("comentariosAdicionales") || "-"}`;

  return msg;
}

function setupWhatsApp() {
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
    const msg = buildWhatsAppMessage();
    const url = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  });
}

/** =========================
 *  Boot
 *  ========================= */
document.addEventListener("DOMContentLoaded", () => {
  if (categoryFilter) categoryFilter.addEventListener("change", applyFilters);
  if (searchInput) searchInput.addEventListener("input", applyFilters);

  setupWhatsApp();
  loadProducts();
});
