const STORAGE_KEY = "mcm_products_draft";

const state = { products: [] };

async function bootstrap(){
  // Carga desde localStorage si existe; si no, desde el JSON público
  const draft = localStorage.getItem(STORAGE_KEY);
  if(draft){
    state.products = JSON.parse(draft);
  } else {
    const res = await fetch("data/products.json", { cache: "no-store" });
    const data = await res.json();
    state.products = Array.isArray(data.products) ? data.products : [];
    persist();
  }
  render();
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
}

function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function readImageAsDataUrl(file){
  return new Promise((resolve, reject) => {
    if(!file) return resolve("");
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function addProduct(){
  const name = v("pName");
  const category = v("pCategory") || "Otros";
  const priceFrom = v("pPrice");
  const description = v("pDesc");
  const file = document.getElementById("pImage").files[0];
  const image = await readImageAsDataUrl(file);

  if(!name){
    alert("Pon al menos el nombre del producto.");
    return;
  }

  state.products.unshift({
    id: uid(),
    name,
    category,
    priceFrom: priceFrom || "",
    description: description || "",
    image: image || ""
  });

  persist();
  clearForm();
  render();
}

function clearForm(){
  ["pName","pCategory","pPrice","pDesc"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("pImage").value = "";
}

function removeProduct(id){
  state.products = state.products.filter(p => p.id !== id);
  persist();
  render();
}

function exportJson(){
  const payload = { products: state.products };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "products.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importJson(file){
  const text = await file.text();
  const data = JSON.parse(text);
  if(!data || !Array.isArray(data.products)){
    alert("JSON inválido. Debe tener { products: [] }");
    return;
  }
  // Normaliza ids si faltan
  state.products = data.products.map(p => ({ id: p.id || uid(), ...p }));
  persist();
  render();
}

function render(){
  const grid = document.getElementById("adminList");
  if(state.products.length === 0){
    grid.innerHTML = `<div class="card"><strong>Sin productos.</strong><p class="muted">Agrega el primero arriba.</p></div>`;
    return;
  }

  grid.innerHTML = state.products.map(p => {
    const img = p.image || "assets/logo.png";
    const price = p.priceFrom ? `Desde $${p.priceFrom}` : "Precio a cotizar";
    return `
      <div class="card product">
        <img src="${img}" alt="${p.name}" loading="lazy"/>
        <div class="row">
          <span class="badge">${p.category || "Otros"}</span>
          <strong>${price}</strong>
        </div>
        <h3>${p.name}</h3>
        <p>${p.description || ""}</p>
        <div class="actions">
          <button class="btn ghost" onclick="window.__del('${p.id}')">Eliminar</button>
        </div>
      </div>
    `;
  }).join("");
}

function v(id){ return document.getElementById(id).value.trim(); }

// Hooks
window.__del = removeProduct;

document.getElementById("addProduct").addEventListener("click", addProduct);
document.getElementById("exportJson").addEventListener("click", exportJson);
document.getElementById("importJson").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(file) importJson(file);
});

bootstrap();
