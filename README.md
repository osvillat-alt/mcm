# MCM Repostería — Sitio + Admin (Firestore + imágenes locales)

Este paquete está listo para subir a GitHub Pages (deploy desde branch /root).

## Estructura
- index.html (sitio público)
- admin.html (panel admin)
- styles.css
- app.js (catálogo + WhatsApp)
- admin.js (admin + manifest)
- firebase.js (config + Firestore)
- assets/
  - logo.png
  - manifest.json
  - products/ (carpetas para tus fotos)

## Nivel 2 (sin pagar Storage)
1) Sube imágenes a `assets/products/<categoria>/...`
2) Agrega la ruta a `assets/manifest.json` en el arreglo correspondiente.
   Ejemplo:
   {
     "pasteles": ["assets/products/pasteles/pastel-001.jpg"]
   }
3) Entra a `admin.html` y recarga manifest (botón "Recargar manifest").

## Firestore (Reglas sugeridas)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /orders/{id} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}

> Nota: por ahora el admin NO está protegido con login; si quieres, lo conectamos con Google Auth y restringimos por UID.

## GitHub Pages
- Settings → Pages → Source: Deploy from a branch
- Branch: main
- Folder: /(root)

URLs:
- Sitio: https://<tu-usuario>.github.io/<repo>/
- Admin: https://<tu-usuario>.github.io/<repo>/admin.html
