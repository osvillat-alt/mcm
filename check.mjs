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

// The media checks run in memory; no Storage uploads, Firestore requests or new packages.
const adminUser = {email:'osvillat@gmail.com',emailVerified:true};
let mediaWrites = 0;
let removed = 0;
let released = 0;
let blobSize = 600 * 1024;
const canvas = {width:0,height:0,getContext:()=>({fillRect(){},drawImage(){}}),toBlob(callback){callback({size:blobSize,type:'image/jpeg'}); blobSize = 100 * 1024;}};
const mediaSandbox = {auth:{currentUser:adminUser},storage:{},setTimeout,clearTimeout,
  URL:{createObjectURL:()=> 'blob:local-test',revokeObjectURL(){released++;}},
  Image:class {naturalWidth=4000; naturalHeight=3000; async decode(){}},
  document:{createElement:()=>canvas},ref:(_,path)=>({path}),
  uploadBytesResumable(ref,blob,metadata){mediaWrites++;return {snapshot:{ref},on(_,progress,error,done){progress({bytesTransferred:blob.size,totalBytes:blob.size});done();},cancel(){}};},
  getDownloadURL:async ref=>'https://firebasestorage.googleapis.com/'+ref.path,
  deleteObject:async()=>{removed++;}};
vm.createContext(mediaSandbox);
const mediaCode = fs.readFileSync(new URL('admin-images.js', import.meta.url), 'utf8').replace(/^import[^;]+;\s*/gm,'').replace(/^export /gm,'');
vm.runInContext(mediaCode,mediaSandbox);
mediaSandbox.file = {type:'image/jpeg',size:4*1024*1024,name:'pastel.jpg'};
const mediaRun = code=>vm.runInContext(code,mediaSandbox);
assert.equal((await mediaRun('compressImage(file)')).size,100*1024);
assert.equal(canvas.width,1600);
assert.equal(canvas.height,1200);
assert.equal(released,1);
assert.equal(await mediaRun('uploadAdminImage(file,"productos/test.jpg")'),'https://firebasestorage.googleapis.com/productos/test.jpg');
mediaSandbox.auth.currentUser = {email:'calderamoralesmarisol@gmail.com',emailVerified:true};
assert.equal(await mediaRun('uploadAdminImage(file,"galeria/test.jpg")'),'https://firebasestorage.googleapis.com/galeria/test.jpg');
await mediaRun('removeAdminImage("galeria/test.jpg")');
assert.equal(removed,1);
assert.equal(mediaWrites,2);
for (const user of [{email:adminUser.email,emailVerified:false},{email:'visitor@example.com',emailVerified:true},null]) {
  mediaSandbox.auth.currentUser=user;
  await assert.rejects(mediaRun('uploadAdminImage(file,"productos/test.jpg")'));
}
assert.equal(mediaWrites,2);
mediaSandbox.auth.currentUser=adminUser;
await assert.rejects(mediaRun('uploadAdminImage(file,"referencias/test.jpg")'));
await assert.rejects(mediaRun('compressImage({...file,type:"image/svg+xml"})'));
await assert.rejects(mediaRun('compressImage({...file,size:13*1024*1024})'));

const adminElements=new Map();
const adminEl=id=>{
  if(!adminElements.has(id))adminElements.set(id,{style:{},value:'',files:[],children:[],disabled:false,
    addEventListener(type,fn){this[type]=fn;},append(...items){this.children.push(...items);},replaceChildren(){this.children=[];},
    get childElementCount(){return this.children.length;},classList:{add(){},remove(){}}});
  return adminElements.get(id);
};
let galleryCount=0;
let failGallery=true;
let photoUploads=0;
const photoWrites=[];
const adminSandbox={console,auth:mediaSandbox.auth,db:{},setTimeout:()=>0,clearTimeout(){},crypto:{randomUUID:()=> 'uuid-test'},
  document:{getElementById:adminEl,addEventListener(){},createElement:()=>({append(){},addEventListener(){}})},window:{},confirm:()=>true,
  GoogleAuthProvider:class{},onAuthStateChanged(){},signInWithPopup(){},signOut(){},
  collection:(_,name)=>name,doc:collection=>({collection,id:String(++galleryCount)}),
  orderBy:field=>({orderBy:field}),limit:count=>({limit:count}),startAfter:cursor=>({cursor}),query:(...parts)=>parts,
  serverTimestamp:()=> 'server-time',getDocs:async()=>({docs:[]}),
  requireImageAdmin:()=>mediaRun('requireImageAdmin()'),removeAdminImage:async()=>{},
  uploadAdminImage:async(file,path)=>{photoUploads++; return 'https://firebasestorage.googleapis.com/'+path;},
  setDoc:async(ref,data)=>{photoWrites.push({ref,data});if(failGallery&&ref.id==='2')throw {code:'permission-denied'};},
};
vm.createContext(adminSandbox);
vm.runInContext(fs.readFileSync(new URL('admin.js',import.meta.url),'utf8').replace(/^import[\s\S]*?;\s*/gm,'')+'\nsetupGallery();',adminSandbox);
adminEl('galleryFiles').files=[{name:'uno.jpg'},{name:'dos.jpg'}];
adminEl('galleryFiles').change();
await adminEl('uploadGallery').click();
assert.equal(photoWrites.length,2);
assert.ok(adminEl('adminGalleryStatus').textContent.includes('1 pendientes'));
failGallery=false;
await adminEl('uploadGallery').click();
assert.equal(photoWrites.length,3);
assert.equal(photoWrites[1].ref.id,photoWrites[2].ref.id);
assert.equal(photoUploads,3); // Retry only the failed photo.
assert.deepEqual(Object.keys(photoWrites[0].data).sort(),['createdAt','imageUrl','storagePath']);
assert.equal(adminEl('uploadGallery').disabled,false);
await adminEl('uploadGallery').click();
assert.equal(photoWrites.length,3); // Already completed selection cannot be uploaded again.
console.log('Both image admins, compression and format/size limits, access denials, image-only gallery saves and retry without duplicates verified locally.');
