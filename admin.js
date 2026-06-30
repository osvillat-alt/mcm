import { auth, db, storage } from "./firebase_config.js";

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
  doc,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/** =========================
 *  CONFIG
 *  ========================= */
const ALLOWED_EMAILS = [
  "osvillat@gmail.com",
  "calderamoralesmarisol@gmail.com"
];

/** =========================
 *  HELPERS
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

/** Show a brief toast message instead of alert() */
let toastTimer = null;
function toast(msg, type = "success") {
  const el = $("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, 3000);
}

/** =========================
 *  AUTH
 *  ========================= */
const provider = new GoogleAuthProvider();

if ($("loginGoogle")) $("loginGoogle").addEventListener("click", () => signInWithPopup(auth, provider).catch(e => toast(e.message, "error")));
if ($("logoutBtn"))  $("logoutBtn").addEventListener("click",  () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) { showLogin(); return; }
  if (!ALLOWED_EMAILS.includes(user.email)) {
    toast(`${user.email} no está autorizado.`, "error");
    signOut(auth);
    return;
  }
  showAdmin(user);
});

function showLogin() {
  $("loginBox").style.display = "block";
  $("adminPanel").style.display = "none";
  if ($("userChip"))  $("userChip").style.display  = "none";
  if ($("logoutBtn")) $("logoutBtn").style.display  = "none";
  if ($("fab"))       $("fab").style.display        = "none";
}

function showAdmin(user) {
  $("loginBox").style.display   = "none";
  $("adminPanel").style.display = "block";
  if ($("fab")) $("fab").style.display = "flex";

  if ($("userChip")) {
    $("userChip").textContent = user.email;
    $("userChip").style.display = "inline-flex";
  }
  if ($("logoutBtn")) $("logoutBtn").style.display = "inline-flex";

  loadAdminProducts();
}

/** =========================
 *  IMAGE UPLOAD (Firebase Storage)
 *  ========================= */
function setupImageUpload() {
  const uploadArea    = $("adminUploadArea");
  const fileInput     = $("adminFileInput");
  const prompt        = $("adminUploadPrompt");
  const loading       = $("adminUploadLoading");
  const loadingText   = $("adminUploadLoadingText");
  const progressBar   = $("adminProgressBar");
  const previewCont   = $("adminUploadPreviewContainer");
  const previewImg    = $("adminUploadPreview");
  const removeBtn     = $("adminBtnRemoveImage");
  const imageUrlInput = $("adminImageUrl");

  if (!uploadArea) return;

  window.adminResetImageUI = function () {
    fileInput.value = "";
    imageUrlInput.value = "";
    previewImg.src = "";
    loading.style.display = "none";
    previewCont.style.display = "none";
    prompt.style.display = "flex";
    progressBar.style.width = "0%";
  };

  /** Show an existing image URL in preview (for edit mode) */
  window.adminSetImagePreview = function (url) {
    if (!url) return;
    imageUrlInput.value = url;
    previewImg.src = url;
    prompt.style.display = "none";
    loading.style.display = "none";
    previewCont.style.display = "flex";
  };

  uploadArea.addEventListener("click", (e) => {
    if (e.target.closest("#adminBtnRemoveImage")) return;
    if (previewCont.style.display === "flex") return;
    if (loading.style.display === "flex") return;
    fileInput.click();
  });

  // Drag-and-drop
  ["dragenter", "dragover"].forEach(ev => uploadArea.addEventListener(ev, e => { e.preventDefault(); uploadArea.classList.add("drag-over"); }, false));
  ["dragleave", "drop"].forEach(ev =>    uploadArea.addEventListener(ev, e => { e.preventDefault(); uploadArea.classList.remove("drag-over"); }, false));
  uploadArea.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

  function handleFile(file) {
    if (!file.type.startsWith("image/")) { toast("Selecciona un archivo de imagen.", "error"); return; }
    if (file.size > 5 * 1024 * 1024)    { toast("Máximo 5 MB por imagen.", "error"); return; }

    prompt.style.display = "none";
    previewCont.style.display = "none";
    loading.style.display = "flex";
    progressBar.style.width = "0%";

    const cleanName  = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
    const storageRef = ref(storage, `productos/${Date.now()}_${cleanName}`);
    const task       = uploadBytesResumable(storageRef, file);

    task.on("state_changed",
      snap => {
        const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
        progressBar.style.width = `${pct}%`;
        loadingText.textContent = `Subiendo: ${Math.round(pct)}%`;
      },
      err => { toast("Error al subir: " + err.message, "error"); window.adminResetImageUI(); },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          imageUrlInput.value = url;
          previewImg.src = url;
          loading.style.display = "none";
          previewCont.style.display = "flex";
          toast("Imagen cargada ✓");
        } catch (e) {
          toast("Error al obtener URL.", "error");
          window.adminResetImageUI();
        }
      }
    );
  }

  if (removeBtn) removeBtn.addEventListener("click", e => { e.stopPropagation(); window.adminResetImageUI(); });
}

/** =========================
 *  FORM  (create + edit)
 *  ========================= */
let editingId = null; // null = new product, string = product id being edited

function setupForm() {
  const categorySelect = $("pCategory");
  const customCatLabel = $("customCatLabel");
  const saveBtn   = $("saveProduct");
  const cancelBtn = $("cancelEdit");
  const fab       = $("fab");

  // Show/hide custom category input
  if (categorySelect) {
    categorySelect.addEventListener("change", () => {
      if (customCatLabel) customCatLabel.style.display = categorySelect.value === "otro" ? "block" : "none";
    });
  }

  // FAB scrolls to top and focuses name field
  if (fab) {
    fab.addEventListener("click", () => {
      resetForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => $("pName")?.focus(), 400);
    });
  }

  // Cancel editing
  if (cancelBtn) cancelBtn.addEventListener("click", resetForm);

  // Refresh list button
  const refreshBtn = $("refreshList");
  if (refreshBtn) refreshBtn.addEventListener("click", loadAdminProducts);

  if (!saveBtn) return;

  saveBtn.addEventListener("click", async () => {
    const name = $("pName")?.value?.trim();
    if (!name) { toast("El nombre es obligatorio.", "error"); return; }

    const rawCat   = categorySelect?.value || "";
    const category = rawCat === "otro"
      ? ($("pCategoryCustom")?.value?.trim() || "otro")
      : rawCat;

    const imageUrl = $("adminImageUrl")?.value || "";
    const price    = $("pPrice")?.value || "";
    const desc     = $("pDesc")?.value?.trim() || "";

    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";

    try {
      if (editingId) {
        // UPDATE existing product
        await updateDoc(doc(db, "products", editingId), {
          name,
          price,
          category,
          description: desc,
          ...(imageUrl && { imagePath: imageUrl }) // only update image if one was (re)uploaded
        });
        toast("Producto actualizado ✓");
      } else {
        // CREATE new product
        await addDoc(collection(db, "products"), {
          name,
          price,
          category,
          description: desc,
          imagePath: imageUrl,
          active: true,
          createdAt: Date.now()
        });
        toast("Producto guardado ✓");
      }

      resetForm();
      loadAdminProducts();
    } catch (e) {
      console.error(e);
      toast("Error al guardar: " + e.message, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar producto";
    }
  });
}

function resetForm() {
  editingId = null;

  const fields = ["pName", "pPrice", "pDesc"];
  fields.forEach(id => { const el = $(id); if (el) el.value = ""; });

  const cat = $("pCategory");
  if (cat) cat.value = "";

  const customCatLabel = $("customCatLabel");
  if (customCatLabel) customCatLabel.style.display = "none";

  const customCat = $("pCategoryCustom");
  if (customCat) customCat.value = "";

  if (window.adminResetImageUI) window.adminResetImageUI();

  const formTitle = $("formTitle");
  if (formTitle) formTitle.textContent = "➕ Nuevo producto";

  const cancelBtn = $("cancelEdit");
  if (cancelBtn) cancelBtn.style.display = "none";
}

/** Load a product into the form for editing */
function loadProductIntoForm(product) {
  editingId = product.id;

  $("pName").value  = product.name || "";
  $("pPrice").value = product.price || "";
  $("pDesc").value  = product.description || "";

  const cat = $("pCategory");
  const customCatLabel = $("customCatLabel");
  if (cat) {
    const knownCats = ["pasteles", "pays", "galletas", "roles", "postres"];
    if (knownCats.includes(product.category)) {
      cat.value = product.category;
      if (customCatLabel) customCatLabel.style.display = "none";
    } else if (product.category) {
      cat.value = "otro";
      if (customCatLabel) customCatLabel.style.display = "block";
      const customCat = $("pCategoryCustom");
      if (customCat) customCat.value = product.category;
    }
  }

  if (product.imagePath && window.adminSetImagePreview) {
    window.adminSetImagePreview(product.imagePath);
  } else if (window.adminResetImageUI) {
    window.adminResetImageUI();
  }

  const formTitle = $("formTitle");
  if (formTitle) formTitle.textContent = `✏️ Editando: ${product.name}`;

  const cancelBtn = $("cancelEdit");
  if (cancelBtn) cancelBtn.style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** =========================
 *  PRODUCTS LIST
 *  ========================= */
let allAdminProducts = [];

async function loadAdminProducts() {
  const listEl = $("productsList");
  if (!listEl) return;
  listEl.innerHTML = `<p class="muted" style="padding:8px 0;">Cargando…</p>`;

  try {
    const q    = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allAdminProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // fallback without orderBy in case index not ready
    const snap = await getDocs(collection(db, "products"));
    allAdminProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  if (!allAdminProducts.length) {
    listEl.innerHTML = `<p class="muted" style="padding:8px 0;">Aún no hay productos.</p>`;
    return;
  }

  listEl.innerHTML = allAdminProducts.map(p => {
    const isDraft     = p.active === false;
    const visLabel    = isDraft ? "Publicar" : "Ocultar";
    const visClass    = isDraft ? "draft" : "visible";
    const draftBadge  = isDraft ? `<span class="draft-badge">Borrador</span>` : "";
    const img         = p.imagePath || "";
    const price       = p.price ? `$${p.price}` : "";

    return `
      <div class="prod-item" data-id="${p.id}">
        <img class="prod-thumb"
             src="${escapeHtml(img)}"
             alt="${escapeHtml(p.name)}"
             loading="lazy"
             onerror="this.style.background='#f0f0f0'; this.removeAttribute('src');" />
        <div class="prod-info">
          <h4>${escapeHtml(p.name)}${draftBadge}</h4>
          <div class="prod-cat">${escapeHtml(p.category || "")}</div>
          <div class="prod-price">${escapeHtml(price)}</div>
          <div class="prod-actions">
            <button class="btn-edit"       data-action="edit"   data-id="${p.id}">✏️ Editar</button>
            <button class="btn-toggle-vis ${visClass}" data-action="toggle" data-id="${p.id}" data-active="${p.active}">${visLabel}</button>
            <button class="btn-delete"     data-action="delete" data-id="${p.id}">🗑</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/** Delegate list button clicks */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id     = btn.getAttribute("data-id");

  if (action === "edit") {
    const product = allAdminProducts.find(p => p.id === id);
    if (product) loadProductIntoForm(product);
    return;
  }

  if (action === "toggle") {
    const currentActive = btn.getAttribute("data-active");
    const newActive = currentActive === "false" ? true : false;
    try {
      await updateDoc(doc(db, "products", id), { active: newActive });
      toast(newActive ? "Producto publicado ✓" : "Producto ocultado");
      loadAdminProducts();
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
    return;
  }

  if (action === "delete") {
    if (!confirm("¿Borrar este producto? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, "products", id));
      toast("Producto eliminado");
      loadAdminProducts();
    } catch (err) {
      toast("Error: " + err.message, "error");
    }
  }
});

/** =========================
 *  BOOT
 *  ========================= */
document.addEventListener("DOMContentLoaded", () => {
  setupImageUpload();
  setupForm();
});
