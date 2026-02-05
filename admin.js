import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/** =========================
 *  CONFIG
 *  ========================= */
const ALLOWED_EMAILS = ["osvillat@gmail.com"]; // cámbialo si quieres permitir más

/** =========================
 *  ELEMENTS
 *  ========================= */
const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const adminPanel = $("adminPanel");
const loginBtn = $("loginGoogle");
const logoutBtn = $("logoutBtn");

const form = $("productForm");
const listEl = $("adminList");

/** =========================
 *  AUTH
 *  ========================= */
const provider = new GoogleAuthProvider();

async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login error:", err);
    alert("No se pudo iniciar sesión. Revisa consola.");
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error("Logout error:", err);
  }
}

if (loginBtn) loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (loginBox) loginBox.style.display = "block";
    if (adminPanel) adminPanel.style.display = "none";
    return;
  }

  // Bloqueo por email
  if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(user.email)) {
    alert("No autorizado.");
    signOut(auth);
    return;
  }

  if (loginBox) loginBox.style.display = "none";
  if (adminPanel) adminPanel.style.display = "block";

  loadAdminProducts();
});

/** =========================
 *  CRUD PRODUCTS (ADMIN)
 *  ========================= */
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadAdminProducts() {
  if (!listEl) return;
  listEl.innerHTML = "Cargando...";

  try {
    const snap = await getDocs(collection(db, "products"));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!items.length) {
      listEl.innerHTML = "<p class='muted'>Aún no hay productos.</p>";
      return;
    }

    listEl.innerHTML = items.map(p => {
      const name = escapeHtml(p.name || "Producto");
      const price = (p.price ?? p.priceFrom ?? "");
      const desc = escapeHtml(p.description || "");
      const cat = escapeHtml(p.category || "");
      const img = p.imagePath ? `../${p.imagePath}` : "";

      return `
        <div class="card" style="padding:14px; margin-bottom:12px;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div style="width:90px; height:90px; border-radius:12px; overflow:hidden; background:#fff; border:1px solid rgba(0,0,0,.08);">
              ${img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;display:block" />` : ""}
            </div>

            <div style="flex:1;">
              <strong>${name}</strong>
              <div class="muted" style="margin-top:4px;">${cat ? `Categoría: ${cat}` : ""}</div>
              <div style="margin-top:4px; font-weight:900;">${price !== "" ? `$${price}` : ""}</div>
              <div class="muted" style="margin-top:6px;">${desc}</div>

              <div style="margin-top:10px; display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn ghost" data-edit="${p.id}" type="button">Editar</button>
                <button class="btn primary" data-del="${p.id}" type="button">Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Load products error:", err);
    listEl.innerHTML = "<p class='muted'>Error cargando productos (revisa consola).</p>";
  }
}

async function createProduct(data) {
  await addDoc(collection(db, "products"), data);
  await loadAdminProducts();
}

async function removeProduct(id) {
  await deleteDoc(doc(db, "products", id));
  await loadAdminProducts();
}

/** =========================
 *  EVENTS
 *  ========================= */
document.addEventListener("click", async (e) => {
  const del = e.target.closest("[data-del]");
  if (del) {
    const id = del.getAttribute("data-del");
    if (confirm("¿Eliminar este producto?")) {
      try {
        await removeProduct(id);
      } catch (err) {
        console.error(err);
        alert("No se pudo eliminar.");
      }
    }
  }
});

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = $("pName")?.value?.trim() || "";
    const price = $("pPrice")?.value?.trim() || "";
    const category = $("pCategory")?.value?.trim() || "";
    const description = $("pDesc")?.value?.trim() || "";
    const imagePath = $("pImage")?.value?.trim() || "";

    if (!name) return alert("Falta el nombre.");

    const data = {
      name,
      category,
      description,
      imagePath,
      // guarda price como number si se puede
      price: price === "" ? "" : Number(price),
      createdAt: Date.now()
    };

    try {
      await createProduct(data);
      form.reset();
      alert("Producto guardado ✅");
    } catch (err) {
      console.error(err);
      alert("Error guardando producto. Revisa consola.");
    }
  });
}
