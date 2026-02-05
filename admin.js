import { db, auth, storage } from "./firebase.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

/** =========================
 *  Auth UI
 *  ========================= */
const provider = new GoogleAuthProvider();

const loginBox = $("loginBox");
const adminPanel = $("adminPanel");
const loginGoogleBtn = $("loginGoogle");
const logoutBtn = $("logoutBtn");
const userChip = $("userChip");

/** Solo tú (opcional): pon tu correo aquí */
const ALLOWED_EMAILS = [
  "osvillat@gmail.com",
  "calderamoralesmarisol@gmail.com"
];

function isAllowedUser(user) {
  if (!user) return false;
  if (!ALLOWED_EMAILS.length) return true; 
  return ALLOWED_EMAILS.includes(user.email);
}

if (loginGoogleBtn) {
  loginGoogleBtn.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert("No se pudo iniciar sesión. Revisa consola.");
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, (user) => {
  if (user && isAllowedUser(user)) {
    if (loginBox) loginBox.style.display = "none";
    if (adminPanel) adminPanel.style.display = "block";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    if (userChip) {
      userChip.style.display = "inline-flex";
      userChip.textContent = user.email || "Sesión iniciada";
    }

    // cargar lista al entrar
    loadProductsList();
  } else {
    if (loginBox) loginBox.style.display = "block";
    if (adminPanel) adminPanel.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";

    if (userChip) {
      userChip.style.display = "none";
      userChip.textContent = "";
    }
  }
});
catch (err) {
  console.error("LOGIN ERROR:", err);
  alert("No se pudo iniciar sesión. Revisa consola.\n\n" + (err?.code || "") + " " + (err?.message || ""));
}


/** =========================
 *  Form Elements
 *  ========================= */
const pName = $("pName");
const pPrice = $("pPrice");
const pCategory = $("pCategory");
const pDesc = $("pDesc");
const pImage = $("pImage");

const previewImg = $("previewImg");
const saveProductBtn = $("saveProduct");
const resetFormBtn = $("resetForm");

const productsList = $("productsList");
const refreshListBtn = $("refreshList");

/** Preview */
if (pImage) {
  pImage.addEventListener("change", () => {
    const file = pImage.files?.[0];
    if (!file) {
      if (previewImg) previewImg.style.display = "none";
      return;
    }
    const url = URL.createObjectURL(file);
    if (previewImg) {
      previewImg.src = url;
      previewImg.style.display = "block";
    }
  });
}

function resetForm() {
  if (pName) pName.value = "";
  if (pPrice) pPrice.value = "";
  if (pCategory) pCategory.value = "";
  if (pDesc) pDesc.value = "";
  if (pImage) pImage.value = "";
  if (previewImg) previewImg.style.display = "none";
  setStatus("");
}

if (resetFormBtn) resetFormBtn.addEventListener("click", resetForm);

/** =========================
 *  Save Product (Firestore + Storage)
 *  ========================= */
async function uploadImageAndGetPath(file) {
  // Guardamos en Storage y también guardamos una ruta relativa "assets/..."
  const safeName = file.name.replaceAll(" ", "_");
  const path = `products/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return { storagePath: path, downloadURL: url };
}

async function saveProduct() {
  const user = auth.currentUser;
  if (!user || !isAllowedUser(user)) {
    alert("No autorizado. Inicia sesión primero.");
    return;
  }

  const name = pName?.value?.trim() || "";
  const price = pPrice?.value ? Number(pPrice.value) : "";
  const category = pCategory?.value?.trim() || "";
  const description = pDesc?.value?.trim() || "";

  if (!name) return alert("Pon un nombre.");
  if (price === "") return alert("Pon un precio (número).");

  const file = pImage?.files?.[0];
  if (!file) return alert("Sube una imagen.");

  setStatus("Subiendo imagen...");

  try {
    const { storagePath, downloadURL } = await uploadImageAndGetPath(file);

    setStatus("Guardando producto...");

    // Guardamos en Firestore lo necesario para tu catálogo
    await addDoc(collection(db, "products"), {
      name,
      price,
      category,
      description,
      imagePath: downloadURL, // Usaremos URL directa para evitar rutas raras en Vercel/GH
      storagePath,            
      createdAt: serverTimestamp(),
    });

    setStatus("✅ Producto guardado.");
    resetForm();
    await loadProductsList();
  } catch (e) {
    console.error(e);
    setStatus("❌ Error guardando. Revisa consola.");
  }
}

if (saveProductBtn) saveProductBtn.addEventListener("click", saveProduct);

/** =========================
 *  List + Delete
 *  ========================= */
async function loadProductsList() {
  if (!productsList) return;

  productsList.innerHTML = `<p class="muted">Cargando...</p>`;

  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  if (snap.empty) {
    productsList.innerHTML = `<p class="muted">Aún no hay productos.</p>`;
    return;
  }

  productsList.innerHTML = snap.docs.map((d) => {
    const p = d.data();
    const img = p.imagePath || "";
    const name = escapeHtml(p.name || "Producto");
    const cat = escapeHtml(p.category || "sin categoría");
    const desc = escapeHtml(p.description || "");
    const price = p.price !== undefined ? money(p.price) : "";

    return `
      <div class="item">
        ${img ? `<img src="${img}" alt="${name}">` : `<div></div>`}

        <div>
          <h4>${name}</h4>
          <div class="price">${price}</div>
          <p>${cat}${desc ? " • " + desc : ""}</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end;">
          <button class="btn ghost" data-del="${d.id}" type="button">Borrar</button>
        </div>
      </div>
    `;
  }).join("");
}

if (refreshListBtn) refreshListBtn.addEventListener("click", loadProductsList);

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;

  const id = btn.getAttribute("data-del");
  if (!id) return;

  const ok = confirm("¿Borrar este producto?");
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "products", id));
    await loadProductsList();
  } catch (e) {
    console.error(e);
    alert("No se pudo borrar. Revisa consola.");
  }
});
