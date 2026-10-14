import { auth, storage } from "./firebase_config.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

export function requireImageAdmin() {
  if (!auth.currentUser?.emailVerified || !["osvillat@gmail.com", "calderamoralesmarisol@gmail.com"].includes(auth.currentUser.email)) {
    throw new Error("Inicia sesión con una de las dos cuentas administradoras verificadas.");
  }
}

export async function compressImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error("Máximo 12 MB por foto original.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("No se pudo leer la imagen.");
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Este navegador no puede preparar la foto.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.65, 0.5, 0.35]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob?.size && blob.size <= 500 * 1024) return blob;
    }
    throw new Error("La foto sigue siendo demasiado grande. Elige una versión más pequeña.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadAdminImage(file, path, progress = () => {}) {
  requireImageAdmin();
  if (!/^(productos|galeria)\/[A-Za-z0-9_-]+\.jpg$/.test(path)) throw new Error("Destino de imagen inválido.");
  const blob = await compressImage(file);
  requireImageAdmin();
  const task = uploadBytesResumable(ref(storage, path), blob, {contentType: "image/jpeg", cacheControl: "public,max-age=31536000,immutable"});
  // ponytail: one optimized photo per work; add separate thumbnails if the portfolio becomes large.
  const timeout = setTimeout(() => task.cancel(), 60000);
  try {
    await new Promise((resolve, reject) => task.on("state_changed", snap => progress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)), reject, resolve));
  } finally { clearTimeout(timeout); }
  return getDownloadURL(task.snapshot.ref);
}

export async function removeAdminImage(path) {
  requireImageAdmin();
  if (!/^(productos|galeria)\/[A-Za-z0-9_-]+\.jpg$/.test(path)) throw new Error("Destino de imagen inválido.");
  try { await deleteObject(ref(storage, path)); }
  catch (error) { if (error.code !== "storage/object-not-found") throw error; }
}
