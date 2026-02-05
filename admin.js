import { auth, db } from "./firebase_config.js";

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
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/** =========================
 *  CONFIG
 *  ========================= */
const ALLOWED_EMAILS = [
  "osvillat@gmail.com",
  "calderamoralesmarisol@gmail.com"
];

/** =========================
 *  ELEMENTS
 *  ========================= */
const $ = (id) => document.getElementById(id);

const loginBox = $("loginBox");
const adminPanel = $("adminPanel");
const loginBtn = $("loginGoogle");
const logoutBtn = $("logoutBtn");
const userChip = $("userChip");

// Admin form elements
const saveBtn = $("saveProduct");
const resetBtn = $("resetForm");
const statusEl = $("status");
const productsListEl = $("productsList");

// Form inputs
const pName = $("pName");
const pPrice = $("pPrice");
const pCategory = $("pCategory");
const pDesc = $("pDesc");
const pImage = $("pImage");
const previewImg = $("previewImg");

/** =========================
 *  AUTH
 *  ========================= */
const provider = new GoogleAuthProvider();

async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Login error:", err);
    alert("Error al iniciar sesión: " + err.message);
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  }
}

if (loginBtn) loginBtn.addEventListener("click", login);
if (logoutBtn) logoutBtn.addEventListener("click", logout);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    showLogin();
    return;
  }

  // Verificar email autorizado
  if (!ALLOWED_EMAILS.includes(user.email)) {
    alert(`El correo ${user.email} no está autorizado.`);
    signOut(auth);
    return;
  }

  // Usuario autorizado
  showAdmin(user);
});

function showLogin() {
  if (loginBox) loginBox.style.display = "block";
  if (adminPanel) adminPanel.style.display = "none";
  if (userChip) userChip.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "none";
}

function showAdmin(user) {
  if (loginBox) loginBox.style.display = "none";
  if (adminPanel) adminPanel.style.display = "block";

  if (userChip) {
    userChip.textContent = user.email;
    userChip.style.display = "inline-flex";
  }
  if (logoutBtn) logoutBtn.style.display = "inline-flex";

  loadAdminProducts();
  loadAssets();
}

/** =========================
 *  PRODUCTS Logic
 *  ========================= */
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* Upload simulation (since we don't have Storage setup yet)
   We will read the file as DataURL to preview it, 
   but for the DB we'll just ask for a URL or save the filename 
   (Note: Real file upload requires Firebase Storage) */
let currentImageBase64 = "";

if (pImage) {
  pImage.addEventListener("change", () => {
    const file = pImage.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      currentImageBase64 = e.target.result;
      if (previewImg) {
        previewImg.src = currentImageBase64;
        previewImg.style.display = "block";
      }
    };
    reader.readAsDataURL(file);
  });
}

if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    const name = pName?.value?.trim();
    if (!name) return alert("El nombre es obligatorio");

    statusEl.textContent = "Guardando...";
    saveBtn.disabled = true;

    try {
      // Determine Image Path: Asset Select OR Uploaded Base64
      let finalImagePath = currentImageBase64 || "";
      const assetSelect = document.getElementById("pAssetSelect");

      if (assetSelect && assetSelect.value) {
        finalImagePath = assetSelect.value;
      }

      const product = {
        name,
        price: pPrice?.value || "",
        category: pCategory?.value || "",
        description: pDesc?.value || "",
        imagePath: finalImagePath,
        active: true, // Manually created products default to active/visible
        createdAt: Date.now()
      };

      await addDoc(collection(db, "products"), product);

      alert("Producto guardado correctamente");
      if (resetBtn) resetBtn.click();
      loadAdminProducts();

    } catch (e) {
      console.error(e);
      alert("Error guardando: " + e.message);
    } finally {
      statusEl.textContent = "";
      saveBtn.disabled = false;
    }
  });
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    pName.value = "";
    pPrice.value = "";
    pCategory.value = "";
    pDesc.value = "";
    pImage.value = "";
    currentImageBase64 = "";
    if (previewImg) previewImg.style.display = "none";
  });
}

// Load manifest assets into dropdown
async function loadAssets() {
  try {
    const resp = await fetch('assets/manifest.json');
    if (!resp.ok) return;
    const data = await resp.json();
    const select = document.getElementById("pAssetSelect");
    if (!select) return;

    // Clear existing (except default)
    select.innerHTML = '<option value="">Seleccionar de mis Assets...</option>';

    for (const [category, paths] of Object.entries(data)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = category;
      paths.forEach(path => {
        const option = document.createElement("option");
        // Show filename only, but value is full path
        option.text = path.split('/').pop();
        option.value = path;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    }

    // Preview Logic for Dropdown
    select.addEventListener('change', (e) => {
      const val = e.target.value;
      const preview = document.getElementById("previewImg");
      if (val) {
        currentImageBase64 = ""; // Clear uploaded file ref
        if (preview) {
          preview.src = val;
          preview.style.display = "block";
        }
        // Clear file input
        if (pImage) pImage.value = "";
      }
    });

  } catch (e) { console.error("Could not load assets manifest", e); }
}

async function loadAdminProducts() {
  if (!productsListEl) return;
  productsListEl.innerHTML = "<p class='muted'>Cargando...</p>";

  try {
    const snap = await getDocs(collection(db, "products"));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (products.length === 0) {
      productsListEl.innerHTML = "<p class='muted'>No hay productos aún.</p>";
      return;
    }

    productsListEl.innerHTML = products.map(p => {
      // Check if image is Base64 (starts with data:) or a path
      let imgSrc = "";
      if (p.imagePath) {
        // Fix for GitHub Pages: remove ../ because admin.html is at root too
        imgSrc = p.imagePath.startsWith("data:") ? p.imagePath : p.imagePath;
      }

      const isDraft = p.active === false;
      const statusLabel = isDraft ? '<span style="color:orange; font-weight:bold;">(Borrador)</span>' : '<span style="color:green; font-weight:bold;">(Visible)</span>';
      const toggleBtnText = isDraft ? 'Publicar' : 'Ocultar';
      const toggleBtnStyle = isDraft ? 'background: #28a745; color: white;' : 'background: #6c757d; color: white;';

      return `
        <div class="item" style="${isDraft ? 'opacity: 0.7; background: #fff5f5;' : ''}">
          <img src="${imgSrc}" alt="img" onerror="this.style.background='#eee'">
          <div style="flex:1; padding: 0 10px;">
            <h4>${escapeHtml(p.name)} ${statusLabel}</h4>
            <p>${escapeHtml(p.description)}</p>
            <div class="price">$${p.price}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            <button class="btn" style="padding:6px 10px; font-size:12px; ${toggleBtnStyle}" 
              onclick="toggleVisibility('${p.id}', ${p.active})">${toggleBtnText}</button>
            <button class="btn ghost" style="padding:6px 10px; font-size:12px;" onclick="deleteProduct('${p.id}')">Borrar</button>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error(e);
    productsListEl.innerHTML = "<p class='muted'>Error cargando productos.</p>";
  }
}

window.deleteProduct = async (id) => {
  if (!confirm("¿Seguro que quieres borrar este producto?")) return;
  try {
    await deleteDoc(doc(db, "products", id));
    loadAdminProducts();
  } catch (e) {
    alert("Error borrando: " + e.message);
  }
};

window.toggleVisibility = async (id, currentStatus) => {
  try {
    const docRef = doc(db, "products", id);
    const newStatus = currentStatus === false ? true : false;

    await updateDoc(docRef, { active: newStatus });
    loadAdminProducts();
  } catch (e) {
    console.error(e);
    alert("Error cambiando estado: " + e.message);
  }
};

window.importFromManifest = async () => {
  if (!confirm("Esto importará todos los productos del manifest.json. ¿Continuar?")) return;
  const btn = document.getElementById("importBtn");
  if (btn) btn.disabled = true;

  try {
    const resp = await fetch('assets/manifest.json');
    if (!resp.ok) throw new Error("No se encontró assets/manifest.json");
    const data = await resp.json();

    let count = 0;

    for (const [category, paths] of Object.entries(data)) {
      for (const path of paths) {
        // Formatting name: "assets/PastelDeQueso.png" -> "Pastel De Queso"
        const basename = path.split('/').pop().split('.')[0];
        // Insert space before capital letters
        const name = basename.replace(/([A-Z])/g, ' $1').trim();

        await addDoc(collection(db, "products"), {
          name: name,
          category: category,
          price: 0,
          description: "Importado automáticamente",
          imagePath: path,
          active: false, // DRAFT MODE - Hidden by default
          createdAt: Date.now()
        });
        count++;
      }
    }

    alert(`¡Importación lista! Se agregaron ${count} productos como 'Borrador'.`);
    loadAdminProducts();

  } catch (e) {
    alert("Error importando: " + e.message);
    console.error(e);
  } finally {
    if (btn) btn.disabled = false;
  }
};
