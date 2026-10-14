import { auth, db } from "./firebase_config.js";
import { uploadAdminImage, removeAdminImage, requireImageAdmin } from "./admin-images.js";

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
  query,
  limit,
  startAfter,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
  if (!user.emailVerified || !ALLOWED_EMAILS.includes(user.email)) {
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
  loadAdminGallery(true);
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
  let uploading = false;

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

  async function handleFile(file) {
    if (uploading) return;
    uploading = true;
    const previousUrl = imageUrlInput.value;
    $("saveProduct").disabled = true;
    prompt.style.display = "none";
    previewCont.style.display = "none";
    loading.style.display = "flex";
    progressBar.style.width = "0%";

    loadingText.textContent = "Preparando foto…";
    try {
      const url = await uploadAdminImage(file, `productos/${crypto.randomUUID()}.jpg`, pct => {
        progressBar.style.width = `${pct}%`;
        loadingText.textContent = `Subiendo: ${pct}%`;
      });
      window.adminSetImagePreview(url);
      toast("Imagen cargada ✓");
    } catch (error) {
      window.adminResetImageUI();
      if (previousUrl) window.adminSetImagePreview(previousUrl);
      toast("No se pudo subir la imagen: " + (error.code || error.message), "error");
    } finally {
      uploading = false;
      $("saveProduct").disabled = false;
    }
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
    const btn = e.target.closest("#productsList [data-action]");
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
  setupGallery();
});

let galleryCursor = null;
let galleryBusy = false;
let galleryFiles = [];

async function loadAdminGallery(reset = false) {
  const list = $("adminGalleryGrid");
  const more = $("adminGalleryMore");
  if (!list || more.disabled) return;
  more.disabled = true;
  if (reset) { galleryCursor = null; list.replaceChildren(); }
  try {
    requireImageAdmin();
    const clauses = [orderBy("createdAt", "desc"), limit(12)];
    if (galleryCursor) clauses.push(startAfter(galleryCursor));
    const snap = await getDocs(query(collection(db, "gallery"), ...clauses));
    for (const item of snap.docs) {
      const photo = item.data();
      const card = document.createElement("div");
      card.className = "gallery-item";
      const image = document.createElement("img");
      image.src = photo.imageUrl;
      image.alt = "Trabajo personalizado MCM";
      image.loading = "lazy";
      const button = document.createElement("button");
      button.className = "btn ghost";
      button.textContent = "Eliminar foto";
      button.type = "button";
      button.addEventListener("click", async () => {
        if (galleryBusy || !confirm("¿Eliminar esta foto de la galería?")) return;
        button.disabled = true;
        try {
          await removeAdminImage(photo.storagePath);
          await deleteDoc(doc(db, "gallery", item.id));
          card.remove();
          toast("Foto eliminada");
        } catch (error) { toast("No se pudo eliminar: " + (error.code || error.message), "error"); }
        finally { button.disabled = false; }
      });
      card.append(image, button);
      list.append(card);
    }
    if (snap.docs.length) galleryCursor = snap.docs.at(-1);
    more.hidden = snap.docs.length < 12;
    $("adminGalleryStatus").textContent = list.childElementCount ? "" : "Aún no hay trabajos en la galería.";
  } catch (error) {
    $("adminGalleryStatus").textContent = "No se pudo cargar la galería: " + (error.code || error.message);
    more.hidden = false;
  } finally { more.disabled = false; }
}

function setupGallery() {
  const input = $("galleryFiles");
  const save = $("uploadGallery");
  if (!input || !save) return;
  input.addEventListener("change", () => {
    galleryFiles = Array.from(input.files).map(file => ({file, ref: doc(collection(db, "gallery"))}));
    $("adminGalleryStatus").textContent = `${galleryFiles.length} fotos seleccionadas.`;
  });
  $("adminGalleryMore").addEventListener("click", () => loadAdminGallery());
  save.addEventListener("click", async () => {
    if (galleryBusy) return;
    if (!galleryFiles.length || galleryFiles.length > 20) { toast("Selecciona entre 1 y 20 fotos por subida.", "error"); return; }
    try { requireImageAdmin(); } catch (error) { toast(error.message, "error"); return; }
    galleryBusy = true;
    input.disabled = save.disabled = true;
    const failed = [];
    const errors = [];
    let uploaded = 0;
    for (const [index, entry] of galleryFiles.entries()) {
      const path = `galeria/${entry.ref.id}.jpg`;
      try {
        const imageUrl = await uploadAdminImage(entry.file, path, pct => {
          $("adminGalleryStatus").textContent = `Foto ${index + 1} de ${galleryFiles.length}: ${pct}%`;
        });
        await setDoc(entry.ref, {imageUrl, storagePath: path, createdAt: serverTimestamp()});
        uploaded++;
      } catch (error) {
        // Keep the same ID on retry; an uncertain save cannot create a second gallery entry.
        failed.push(entry);
        errors.push(`${entry.file.name}: ${error.code || error.message}`);
      }
    }
    galleryFiles = failed;
    galleryBusy = false;
    input.disabled = save.disabled = false;
    if (!failed.length) input.value = "";
    await loadAdminGallery(true);
    $("adminGalleryStatus").textContent = `${uploaded} fotos publicadas.` + (failed.length ? ` ${failed.length} pendientes; pulsa Subir fotos para reintentar sólo esas fotos. ${errors.join(" · ")}` : "");
  });
}
