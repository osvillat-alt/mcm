const WHATSAPP_NUMBER = "528718940806"; // +52 871 894 0806

const state = {
  products: [],
  categories: ["Todos"]
};

function waLink(text){
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

async function loadProducts(){
  const res = await fetch("data/products.json", { cache: "no-store" });
  const data = await res.json();
  state.products = Array.isArray(data.products) ? data.products : [];
  buildCategories();
  renderFilters();
  renderGrid();
}

function buildCategories(){
  const set = new Set(["Todos"]);
  state.products.forEach(p => set.add(p.category || "Otros"));
  state.categories = Array.from(set);
}

function renderFilters(){
  const sel = document.getElementById("categoryFilter");
  sel.innerHTML = state.categories.map(c => `<option value="${c}">${c}</option>`).join("");
  sel.addEventListener("change", renderGrid);

  const q = document.getElementById("searchInput");
  q.addEventListener("input", renderGrid);
}

function matches(p, category, query){
  const catOk = category === "Todos" || (p.category || "Otros") === category;
  const text = `${p.name||""} ${p.description||""}`.toLowerCase();
  const qOk = !query || text.includes(query.toLowerCase());
  return catOk && qOk;
}

function renderGrid(){
  const grid = document.getElementById("productsGrid");
  const category = document.getElementById("categoryFilter").value;
  const query = document.getElementById("searchInput").value.trim();

  const items = state.products.filter(p => matches(p, category, query));

  if(items.length === 0){
    grid.innerHTML = `<div class="card"><strong>Sin productos aún.</strong><p class="muted">Agrega productos desde el panel admin.</p></div>`;
    return;
  }

  grid.innerHTML = items.map(p => {
    const img = p.image || "assets/logo.png";
    const price = p.priceFrom ? `Desde $${p.priceFrom}` : "Precio a cotizar";
    const categoryBadge = p.category || "Otros";
    const msg = `Hola! Quiero pedir: ${p.name}\nCategoría: ${categoryBadge}\n${p.priceFrom ? "Precio desde: $" + p.priceFrom : ""}\n\n¿Me compartes disponibilidad y opciones?`;
    return `
      <div class="card product">
        <img src="${img}" alt="${p.name || "Producto"}" loading="lazy"/>
        <div class="row">
          <span class="badge">${categoryBadge}</span>
          <strong>${price}</strong>
        </div>
        <h3>${p.name || "Producto"}</h3>
        <p>${p.description || ""}</p>
        <div class="actions">
          <a class="btn primary" target="_blank" rel="noreferrer" href="${waLink(msg)}">Pedir</a>
        </div>
      </div>
    `;
  }).join("");
}

function setupCakeWhatsApp(){
  const btn = document.getElementById("sendCakeWhatsApp");
  btn.addEventListener("click", () => {
    const tamano = val("tamano");
    const sabor = val("saborPan");
    const consistencia = val("consistencia");
    const betun = val("betun");
    const rellenos = Array.from(document.querySelectorAll(".relleno:checked")).map(x=>x.value);
    const fruta = val("detalleFruta");
    const logo = val("detallesLogo");
    const frase = val("fraseFondant");
    const nombre = val("nombreCliente");
    const tel = val("telefonoCliente");
    const com = val("comentariosAdicionales");

    const msg =
`Hola! Quiero personalizar un pastel 🍰

• Tamaño: ${tamano || "—"}
• Sabor: ${sabor || "—"}
• Consistencia: ${consistencia || "—"}
• Relleno(s): ${rellenos.length ? rellenos.join(", ") : "—"}
• Fruta: ${fruta || "—"}
• Betún: ${betun || "—"}

• Diseño/logo: ${logo || "—"}
• Frase: ${frase || "—"}

Cliente:
• Nombre: ${nombre || "—"}
• Teléfono: ${tel || "—"}

Comentarios: ${com || "—"}
`;
    window.open(waLink(msg), "_blank");
  });

  const wa = document.getElementById("waDirect");
  wa.href = waLink("Hola! Quiero información de MCM Repostería 😊");
}

function val(id){ return document.getElementById(id).value.trim(); }

document.getElementById("year").textContent = new Date().getFullYear();
setupCakeWhatsApp();
loadProducts();
