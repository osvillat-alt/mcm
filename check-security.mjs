// Run: node check-security.mjs. No packages, network calls or real customer data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function page(file, saved = null) {
  const elements = new Map();
  const createElement = () => ({value: '', style: {setProperty() {}}, classList: {add() {}, remove() {}}, children: [],
    addEventListener(type, callback) {this[type] = callback;}, setAttribute(name, value) {this[name] = value;},
    append(child) {this.children.push(child);}, get childElementCount() {return this.children.length;}});
  const element = id => {if (!elements.has(id)) elements.set(id, createElement()); return elements.get(id);};
  const sandbox = {console: {warn() {}, error() {}}, setTimeout: () => 0, clearTimeout() {}, window: {scrollTo() {}},
    document: {getElementById: element, querySelectorAll: () => [], addEventListener() {}, createElement,
      documentElement: {style: {setProperty() {}}}},
    localStorage: {getItem: () => saved}, auth: {}, db: {}, storage: {}, GoogleAuthProvider: class {}, onAuthStateChanged() {},
    crypto: {randomUUID: () => '11111111-1111-4111-8111-111111111111'},
    URL: {createObjectURL: () => 'blob:preview', revokeObjectURL() {}},
    alert() {}, collection: (_, name) => name, doc: value => value, serverTimestamp: () => 'SERVER_TIME',
    where: (...parts) => ({where: parts}), orderBy: (...parts) => ({orderBy: parts}), query: (...parts) => parts,
    limit: value => value, getDocs: async () => ({docs: []}),
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/^import[\s\S]*?;\s*/gm, '') + '\nobserveReveal = () => {};', sandbox);
  return {sandbox, element, run: code => vm.runInContext(code, sandbox)};
}

for (const saved of ['{bad JSON', '{}', '[null]', JSON.stringify([{id: 'x', name: 'x', imagePath: '', price: 1, qty: '<img src=x>'}])]) {
  const test = page('app.js', saved);
  assert.equal(test.run('cart.length'), 0);
}
const hostile = 'x" onerror="alert(1)';
const cart = page('app.js', JSON.stringify([{id: hostile, name: '<img src=x>', imagePath: hostile, price: 5, qty: 2}]));
cart.run('renderCart()');
assert.ok(cart.element('cartItems').innerHTML.includes('src="x&quot; onerror=&quot;alert(1)"'));
assert.ok(cart.element('cartItems').innerHTML.includes('data-id="x&quot; onerror=&quot;alert(1)"'));
assert.ok(!cart.element('cartItems').innerHTML.includes('<img src=x>'));
assert.equal(cart.element('cartTotal').textContent, '$10');
const catalog = page('app.js');
catalog.sandbox.list = [{id: hostile, imagePath: hostile, name: '<script>bad</script>', price: 5}];
catalog.run('renderProducts(list)');
assert.ok(catalog.element('productsGrid').innerHTML.includes('src="x&quot; onerror=&quot;alert(1)"'));
assert.ok(catalog.element('productsGrid').innerHTML.includes('data-id="x&quot; onerror=&quot;alert(1)"'));
assert.ok(!catalog.element('productsGrid').innerHTML.includes('<script>bad</script>'));

const queries = [];
catalog.sandbox.getDocs = async q => {
  queries.push(q);
  if (queries.length === 1) throw new Error('Missing index');
  return {docs: [{id: 'real-id', data: () => ({id: 'forged-id', name: 'Pastel', active: true})}]};
};
await catalog.run('loadProducts()');
assert.equal(queries.length, 2);
for (const query of queries) assert.ok(query.some(part => JSON.stringify(part) === '{"where":["active","==",true]}'));
assert.ok(catalog.element('productsGrid').innerHTML.includes('data-id="real-id"'));
assert.ok(!catalog.element('productsGrid').innerHTML.includes('forged-id'));

const gallery = page('app.js');
gallery.sandbox.getDocs = async () => ({docs: [
  {data: () => ({imageUrl: 'javascript:alert(1)'})},
  {data: () => ({imageUrl: 'https://firebasestorage.googleapis.com.evil.example/photo.jpg'})},
  {data: () => ({imageUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/photo.jpg'})},
]});
gallery.run('setupGallery()');
await new Promise(setImmediate);
assert.equal(gallery.element('galleryGrid').children.length, 1);
assert.equal(gallery.element('galleryGrid').children[0].href, 'https://firebasestorage.googleapis.com/v0/b/demo/o/photo.jpg');

const uploads = page('app.js');
const destinations = [];
uploads.sandbox.ref = (_, path) => path;
uploads.sandbox.uploadBytesResumable = path => {destinations.push(path); return {on() {}, cancel() {}};};
uploads.run('setupCakeImageUpload()');
for (const file of [{type: 'image/svg+xml', size: 5}, {type: 'image/png', size: 0}, {type: 'image/jpeg', size: 6 * 1024 * 1024}]) {
  uploads.element('fileInput').files = [file]; uploads.element('fileInput').change();
}
assert.equal(destinations.length, 0);
uploads.element('fileInput').files = [{type: 'image/png', size: 100, name: 'private-customer-name.svg'}];
uploads.element('fileInput').change();
assert.deepEqual(destinations, ['referencias/11111111-1111-4111-8111-111111111111.png']);

const admin = page('admin.js');
admin.sandbox.getDocs = async () => ({docs: [{id: hostile, data: () => ({id: 'forged-id', name: 'Pastel', imagePath: hostile, active: hostile})}]});
await admin.run('loadAdminProducts()');
assert.ok(admin.element('productsList').innerHTML.includes('data-id="x&quot; onerror=&quot;alert(1)"'));
assert.ok(!admin.element('productsList').innerHTML.includes('forged-id'));
assert.ok(admin.element('productsList').innerHTML.includes('data-active="true"'));
admin.run('setupForm()');
const writes = [];
admin.sandbox.addDoc = async (_, data) => writes.push(data);
admin.element('pName').value = 'x'.repeat(201);
await admin.element('saveProduct').click();
assert.equal(writes.length, 0);
admin.element('pName').value = 'Pastel'; admin.element('pPrice').value = '-1';
await admin.element('saveProduct').click();
assert.equal(writes.length, 0);
admin.element('pPrice').value = '500';
await admin.element('saveProduct').click();
assert.equal(writes.length, 1);
assert.equal(writes[0].createdAt, 'SERVER_TIME');
assert.equal(writes[0].active, true);
console.log('Security checks passed: malformed cart, escaped catalog/admin HTML, query fallback, document identity, safe gallery links, reference uploads and product validation.');
