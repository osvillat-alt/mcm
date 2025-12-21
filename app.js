const WHATSAPP = "528718940806";

const sampleProducts = [
  { name:"Pastel personalizado", category:"Pasteles", description:"Elige sabor, relleno y diseño. Ideal para cumpleaños.", price:"Cotizar", image:"./assets/logo.png" },
  { name:"Rol de canela", category:"Roles", description:"Suave, glaseado y perfecto para compartir.", price:"Cotizar", image:"./assets/logo.png" },
  { name:"Galletas", category:"Galletas", description:"Personalizadas para eventos y regalos.", price:"Cotizar", image:"./assets/logo.png" },
  { name:"Pay", category:"Pays", description:"Clásicos y especiales, con topping a tu gusto.", price:"Cotizar", image:"./assets/logo.png" },
];

function wa(text){
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
}

function renderProducts(){
  const grid = document.getElementById("grid");
  const catSel = document.getElementById("category");
  const search = document.getElementById("search");

  const categories = ["Todos", ...new Set(sampleProducts.map(p => p.category))];
  catSel.innerHTML = categories.map(c => `<option>${c}</option>`).join("");

  function draw(){
    const cat = catSel.value;
    const q = search.value.toLowerCase().trim();

    const items = sampleProducts.filter(p => {
      const okCat = cat === "Todos" || p.category === cat;
      const okQ = !q || (p.name + " " + p.description).toLowerCase().includes(q);
      return okCat && okQ;
    });

    grid.innerHTML = items.map(p => `
      <div class="card product">
        <img src="${p.image}" alt="${p.name}">
        <div class="row">
          <span class="badge">${p.category}</span>
          <strong>${p.price}</strong>
        </div>
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div style="display:flex; justify-content:flex-end; margin-top:10px;">
          <a class="btn btn--primary" target="_blank" rel="noreferrer"
             href="${wa(`Hola! Quiero pedir: ${p.name} (${p.category}). ¿Me compartes opciones y precio?`)}">
             Pedir
          </a>
        </div>
      </div>
    `).join("");
  }

  catSel.addEventListener("change", draw);
  search.addEventListener("input", draw);
  draw();
}

function setupWhatsApp(){
  document.getElementById("wa").href = wa("Hola! Quiero información de MCM Repostería 😊");
  document.getElementById("year").textContent = new Date().getFullYear();

  document.getElementById("send").addEventListener("click", () => {
    const msg =
`Hola! Quiero personalizar un pastel 🍰

• Tamaño: ${val("tamano")}
• Sabor: ${val("sabor")}
• Consistencia: ${val("consistencia")}
• Betún: ${val("betun")}
• Relleno: ${val("relleno")}
• Frase: ${val("frase")}
• Diseño: ${val("diseno")}

Cliente:
• Nombre: ${val("nombre")}
• Tel: ${val("tel")}
`;
    window.open(wa(msg), "_blank");
  });
}

function val(id){
  const el = document.getElementById(id);
  return (el?.value || "").trim() || "—";
}

renderProducts();
setupWhatsApp();
