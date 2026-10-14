// Run: node check.mjs. No packages required; no real customer data or Firebase writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {value:'', disabled:false, addEventListener(type,fn) {this[type] = fn;}});
  return elements.get(id);
};
let count = 0;
let fail = false;
const writes = [];
const opened = [];
const sandbox = {console:{error() {}}, setTimeout, clearTimeout, db:{}, storage:{},
  document:{getElementById:element, querySelectorAll:() => [{value:'Nuez'}, {value:'Nutella'}], addEventListener() {}},
  localStorage:{getItem:() => null}, alert() {}, window:{open(...args) {opened.push(args);}},
  collection:(_,name) => name, doc:collection => ({id:String(++count),collection}), serverTimestamp:() => 'server-time',
  async setDoc(ref,data) {writes.push({ref,data}); if (fail) throw {code:'permission-denied'};}};
vm.createContext(sandbox);
const script = fs.readFileSync(new URL('app.js', import.meta.url), 'utf8').replace(/^import[\s\S]*?;\s*/gm, '');
vm.runInContext(script + '\nsetupCakeWhatsApp();', sandbox);
const button = element('sendCakeWhatsApp');
await button.click();
assert.equal(opened.length, 0);
assert.equal(writes.length, 0);
for (const [id,value] of Object.entries({tamano:'18 cm', saborPan:'Vainilla', consistencia:'Seco', betun:'Chantilly',
  nombreCliente:'Cliente de prueba', telefonoCliente:'8711234567', fechaEntrega:'2026-10-20', horaEntrega:'16:30'})) element(id).value = value;
await button.click();
assert.equal(writes.length, 1);
assert.equal(writes[0].ref.collection, 'orderRequests');
assert.deepEqual(Array.from(writes[0].data.rellenos), ['Nuez','Nutella']);
assert.equal(writes[0].data.version, 1);
assert.equal(writes[0].data.createdAt, 'server-time');
assert.equal(new URL(opened[0][0]).hostname, 'wa.me');
assert.ok(new URL(opened[0][0]).searchParams.get('text').includes('Nombre: Cliente de prueba'));
assert.equal(opened[0][2], 'noopener,noreferrer');
await button.click();
assert.equal(writes.length, 1); // Unchanged resend only opens WhatsApp.
element('comentariosAdicionales').value = 'Cambio de diseño';
fail = true;
await button.click();
assert.equal(opened.length, 3); // Firebase failure still preserves WhatsApp.
assert.ok(element('cakeRequestStatus').textContent.includes('no se guardó'));
assert.equal(button.disabled, false);
const failedId = writes[1].ref.id;
fail = false;
await button.click();
assert.equal(writes[2].ref.id, failedId); // Retry reuses the request ID.
const before = writes.length;
element('comentariosAdicionales').value = 'x'.repeat(1001);
await button.click();
assert.equal(writes.length, before);
element('comentariosAdicionales').value = 'Cambio adicional';
let finish;
sandbox.setDoc = (ref,data) => {writes.push({ref,data}); return new Promise(resolve => {finish = resolve;});};
const pending = button.click();
await button.click();
assert.equal(writes.length, before + 1); // Double click during save cannot create another request.
finish();
await pending;
assert.equal(button.disabled, false);
console.log('Form validation, WhatsApp preservation, Firebase payload, resend deduplication, failure feedback, stable retry and double-click protection verified.');
