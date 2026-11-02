// Local Firebase emulators only. Test tools: firebase-tools, firebase, @firebase/rules-unit-testing.
// Run: firebase emulators:exec --project demo-mcm-security --only firestore,storage "node check-rules.cjs"
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, query, where, limit, serverTimestamp} = require('firebase/firestore');
const {ref, uploadBytes, getBytes, listAll, deleteObject} = require('firebase/storage');

async function main() {
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-mcm-security', 'Run with the demo project, never production.');
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
    assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Emulators must be local.');
  }
  const env = await initializeTestEnvironment({projectId: 'demo-mcm-security',
    firestore: {rules: fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8')},
    storage: {rules: fs.readFileSync(path.join(__dirname, 'storage.rules'), 'utf8')}});
  let checks = 0;
  const ok = async promise => {await assertSucceeds(promise); checks++;};
  const denied = async promise => {await assertFails(promise); checks++;};
  const admin = env.authenticatedContext('admin-one', {email: 'osvillat@gmail.com', email_verified: true});
  const secondAdmin = env.authenticatedContext('admin-two', {email: 'calderamoralesmarisol@gmail.com', email_verified: true});
  const visitor = env.authenticatedContext('visitor', {email: 'visitor@example.com', email_verified: true});
  const unverified = env.authenticatedContext('unverified', {email: 'osvillat@gmail.com', email_verified: false});
  const guest = env.unauthenticatedContext();
  const product = {name: 'Pastel de prueba', price: '500', category: 'pasteles', description: '', imagePath: '', active: true, createdAt: serverTimestamp()};
  const request = {version: 1, createdAt: serverTimestamp(), tamano: '18 cm', saborPan: 'Vainilla', consistencia: 'Seco', betun: 'Chantilly', rellenos: ['Nuez'],
    detalleFruta: '', detallesLogo: '', imagenReferencia: '', fraseFondant: '', fechaEntrega: '', horaEntrega: '', nombreCliente: 'Cliente sintético', telefonoCliente: '0000000000', comentariosAdicionales: ''};
  try {
    await env.clearFirestore();
    await env.clearStorage();
    await ok(setDoc(doc(admin.firestore(), 'products/public'), product));
    await ok(setDoc(doc(secondAdmin.firestore(), 'products/draft'), {...product, active: false}));
    await ok(getDoc(doc(guest.firestore(), 'products/public')));
    await denied(getDoc(doc(guest.firestore(), 'products/draft')));
    await ok(getDocs(query(collection(guest.firestore(), 'products'), where('active', '==', true))));
    await denied(getDocs(collection(guest.firestore(), 'products')));
    await ok(getDocs(collection(admin.firestore(), 'products')));
    for (const actor of [guest, visitor, unverified]) await denied(setDoc(doc(actor.firestore(), 'products/forbidden'), product));
    for (const change of [{price: -1}, {price: '1e100'}, {name: ''}, {description: 'x'.repeat(4001)}, {role: 'admin'}, {active: 'true'}, {imagePath: 'javascript:alert(1)'}, {createdAt: 1}]) {
      await denied(updateDoc(doc(admin.firestore(), 'products/public'), change));
    }
    await denied(setDoc(doc(admin.firestore(), 'products/missing'), {name: 'Incompleto'}));
    await ok(updateDoc(doc(admin.firestore(), 'products/public'), {price: 550}));
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'products/legacy'), {...product, createdAt: 1700000000000});
    });
    await ok(updateDoc(doc(admin.firestore(), 'products/legacy'), {description: 'Fecha histórica preservada'}));
    await denied(updateDoc(doc(admin.firestore(), 'products/legacy'), {createdAt: serverTimestamp()}));
    await denied(setDoc(doc(visitor.firestore(), 'users/visitor'), {role: 'admin'}));
    const photo = {imageUrl: 'https://firebasestorage.googleapis.com/v0/b/demo-mcm-security.appspot.com/o/galeria%2Fphoto.jpg', storagePath: 'galeria/photo.jpg', createdAt: serverTimestamp()};
    await ok(setDoc(doc(admin.firestore(), 'gallery/photo'), photo));
    await ok(getDocs(query(collection(guest.firestore(), 'gallery'), limit(12))));
    await denied(getDocs(collection(guest.firestore(), 'gallery')));
    await denied(setDoc(doc(visitor.firestore(), 'gallery/photo'), photo));
    await denied(updateDoc(doc(admin.firestore(), 'gallery/photo'), {imageUrl: 'javascript:alert(1)', createdAt: serverTimestamp()}));
    await denied(updateDoc(doc(admin.firestore(), 'gallery/photo'), {storagePath: 'productos/photo.jpg', createdAt: serverTimestamp()}));
    await ok(setDoc(doc(guest.firestore(), 'orderRequests/quote'), request));
    await denied(getDoc(doc(guest.firestore(), 'orderRequests/quote')));
    await denied(getDoc(doc(visitor.firestore(), 'orderRequests/quote')));
    await ok(getDoc(doc(admin.firestore(), 'orderRequests/quote')));
    await denied(updateDoc(doc(guest.firestore(), 'orderRequests/quote'), {nombreCliente: 'Otro'}));
    for (const change of [{price: 1}, {nombreCliente: ''}, {telefonoCliente: 'x'.repeat(1001)}, {rellenos: [1]}, {tamano: 'enorme'}, {createdAt: 1}]) {
      await denied(setDoc(doc(guest.firestore(), 'orderRequests/invalid'), {...request, ...change}));
    }
    await denied(deleteDoc(doc(visitor.firestore(), 'orderRequests/quote')));
    await ok(deleteDoc(doc(admin.firestore(), 'orderRequests/quote')));
    const image = new Uint8Array([255, 216, 255, 217]); // Synthetic bytes: rules validate metadata, not image decoding.
    const name = 'referencias/11111111-1111-4111-8111-111111111111.jpg';
    await ok(uploadBytes(ref(guest.storage(), name), image, {contentType: 'image/jpeg'}));
    await ok(getBytes(ref(guest.storage(), name)));
    await denied(listAll(ref(guest.storage(), 'referencias')));
    await denied(uploadBytes(ref(guest.storage(), name), new Uint8Array([255, 216, 1, 2, 255, 217]), {contentType: 'image/jpeg'}));
    await denied(deleteObject(ref(guest.storage(), name)));
    await ok(listAll(ref(admin.storage(), 'referencias')));
    await ok(deleteObject(ref(admin.storage(), name)));
    await denied(uploadBytes(ref(guest.storage(), 'referencias/old-name.svg'), image, {contentType: 'image/svg+xml'}));
    await denied(uploadBytes(ref(guest.storage(), name), image, {contentType: 'image/svg+xml'}));
    await denied(uploadBytes(ref(guest.storage(), name), new Uint8Array(0), {contentType: 'image/jpeg'}));
    await denied(uploadBytes(ref(guest.storage(), name), new Uint8Array(5 * 1024 * 1024 + 1), {contentType: 'image/jpeg'}));
    for (const actor of [guest, visitor, unverified]) await denied(uploadBytes(ref(actor.storage(), 'productos/test.jpg'), image, {contentType: 'image/jpeg'}));
    await ok(uploadBytes(ref(admin.storage(), 'productos/test.jpg'), image, {contentType: 'image/jpeg'}));
    await ok(uploadBytes(ref(secondAdmin.storage(), 'galeria/test.jpg'), image, {contentType: 'image/jpeg'}));
    await denied(uploadBytes(ref(admin.storage(), 'galeria/oversize.jpg'), new Uint8Array(500 * 1024 + 1), {contentType: 'image/jpeg'}));
    console.log(`${checks} Firebase permission and schema checks passed against local demo emulators.`);
  } finally { await env.cleanup(); }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
