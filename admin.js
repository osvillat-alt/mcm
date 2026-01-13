import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let manifest = {};

async function loadManifest(){
  const res = await fetch("./assets/manifest.json?v=1");
  manifest = await res.json();
}

function fillImagesForCategory(cat){
  const sel = document.getElementById("pImagePath");
  const list = manifest?.[cat] || [];
  sel.innerHTML = list.map(p => `<option value="${p}">${p}</option>`).join("");
}

document.getElementById("pCategory").addEventListener("change", e=>{
  fillImagesForCategory(e.target.value);
});

document.getElementById("saveProduct").addEventListener("click", async ()=>{

  const data = {
    name: document.getElementById("pName").value,
    price: Number(document.getElementById("pPrice").value),
    category: document.getElementById("pCategory").value,
    imagePath: document.getElementById("pImagePath").value,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db,"products"), data);

  alert("Producto guardado 🎉");
});

await loadManifest();
