import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let manifest = {};

async function loadManifest(){
  const res = await fetch("./assets/manifest.json?v=" + Date.now());
  if (!res.ok) throw new Error("No se pudo cargar assets/manifest.json");
  manifest = await res.json();
}

function fillImagesForCategory(cat){
  const sel = $("pImagePath");
  const preview = $("pImagePreview");
  const list = manifest?.[cat] || [];

  if (!sel) return;

  sel.innerHTML = list.length
    ? [`<option value="">Selecciona</option>`, ...list.map(p => `<option value="${p}">${p.split("/").pop()}</option>`)].join("")
    : `<option value="">No hay imágenes en manifest para: ${cat}</option>`;

  if (preview){
    preview.style.display = "none";
    preview.src = "";
  }
}

function wirePickers(){
  const catSel = $("pCategory");
  const imgSel = $("pImagePath");
  const preview = $("pImagePreview");

  catSel?.addEventListener("change", () => fillImagesForCategory(catSel.value));

  imgSel?.addEventListener("change", () => {
    const path = imgSel.value;
    if (!preview) return;

    if (!path){
      preview.style.display = "none";
      preview.src = "";
      return;
    }
    preview.src = `./${path}`;
    preview.style.display = "block";
  });
}

function toNumberOrNull(v){
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : null;
}

async function saveProduct(){
  const name = ($("pName")?.value || "").trim();
  const price = toNumberOrNull($("pPrice")?.value || "");
  const category = ($("pCategory")?.value || "").trim();
  const imagePath = ($("pImagePath")?.value || "").trim();
  const description = ($("pDesc")?.value || "").trim();
  const active = ($("pActive")?.value || "true") === "true";

  if (!name || !category){
    alert("Falta nombre o categoría.");
    return;
  }

  const data = {
    name,
    price,
    category,
    imagePath,
    description,
    active,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "products"), data);

  alert("Producto guardado ✅");
  // Clear basics
  if ($("pName")) $("pName").value = "";
  if ($("pPrice")) $("pPrice").value = "";
  if ($("pDesc")) $("pDesc").value = "";
}

function escapeHtml(str=""){
  return str
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function renderAdminProducts(){
  const wrap = $("adminProducts");
  if (!wrap) return;

  wrap.innerHTML = "";
  let docs = [];
  try{
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }catch(e){
    const snap = await getDocs(collection(db, "products"));
    docs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }

  if (!docs.length){
    wrap.innerHTML = `<div class="card" style="padding:16px; grid-column:1/-1;">
      <strong>Sin productos aún.</strong>
      <p class="muted" style="margin:8px 0 0;">Agrega tu primer producto arriba.</p>
    </div>`;
    return;
  }

  wrap.innerHTML = docs.map(p => {
    const img = p.imagePath ? `./${p.imagePath}` : "";
    const priceText = (p.price ?? "") !== "" ? `$${p.price}` : "";
    return `
      <article class="card product">
        <div class="media">
          ${img ? `<img src="${img}" alt="${escapeHtml(p.name||"")}" loading="lazy" onerror="this.style.display='none'">` : ""}
        </div>
        <div class="body">
          <h3>${escapeHtml(p.name || "")}</h3>
          <div class="price">${escapeHtml(priceText)}</div>
          <p class="muted">${escapeHtml(p.category || "")} • ${p.active ? "Activo" : "Inactivo"}</p>
        </div>
      </article>
    `;
  }).join("");
}

async function boot(){
  // Buttons
  $("saveProduct")?.addEventListener("click", saveProduct);
  $("refreshProducts")?.addEventListener("click", renderAdminProducts);
  $("reloadManifest")?.addEventListener("click", async () => {
    try{
      await loadManifest();
      fillImagesForCategory($("pCategory")?.value || "");
      alert("Manifest recargado ✅");
    }catch(e){
      alert("No se pudo recargar manifest: " + e.message);
    }
  });

  await loadManifest();
  wirePickers();
  await renderAdminProducts();
}

boot();
