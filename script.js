document.querySelectorAll(".chip input").forEach((input) => {
  input.addEventListener("change", () => {
    const chip = input.closest(".chip");
    chip.classList.toggle("selected", input.checked);
  });
});

function obtenerRellenos() {
  const seleccionados = [];
  document.querySelectorAll(".relleno-opcion:checked").forEach((chk) => {
    seleccionados.push(chk.value);
  });

  let detalle = "";
  const fruta = document.getElementById("detalleFruta").value.trim();
  const sugiere = document.getElementById("detalleSugiere").value.trim();

  if (fruta) detalle += `\n  • Fruta: ${fruta}`;
  if (sugiere) detalle += `\n  • Sugerencia: ${sugiere}`;

  return { lista: seleccionados, detalle };
}

function generarResumen() {
  const tamano = document.getElementById("tamano").value || "No especificado";
  const sabor = document.getElementById("saborPan").value || "No especificado";
  const consistencia = document.getElementById("consistencia").value || "No especificado";
  const betun = document.getElementById("betun").value || "No especificado";

  const rellenoInfo = obtenerRellenos();
  const rellenos = rellenoInfo.lista.length ? rellenoInfo.lista.join(", ") : "No especificado";

  const resumen = `
🍰 PEDIDO DE PASTEL

🔹 Tamaño: ${tamano}
🔹 Sabor del pan: ${sabor}
🔹 Consistencia: ${consistencia}
🔹 Relleno(s): ${rellenos}${rellenoInfo.detalle}
🔹 Betún: ${betun}

🎨 DISEÑO
• Logo: ${document.getElementById("disenoLogo").checked ? "Sí" : "No"}
• Frase en fondant: ${document.getElementById("fraseFondant").value || "No especificada"}
• Detalles del logo/diseño: ${document.getElementById("detallesLogo").value || "No especificado"}

🧍 CLIENTE
• Nombre: ${document.getElementById("nombreCliente").value || "No especificado"}
• Teléfono: ${document.getElementById("telefonoCliente").value || "No especificado"}
• Fecha/hora deseada: ${document.getElementById("fechaEntrega").value || "No especificado"}
• Comentarios adicionales: ${document.getElementById("comentariosAdicionales").value || "Sin comentarios"}
`;

  document.getElementById("resumenPedido").textContent = resumen;
  return resumen;
}

function enviarWhatsApp() {
  const resumen = generarResumen();
  
  // Cambia tu número aquí
  const numero = "5210000000000";

  const mensaje = encodeURIComponent(resumen);
  const url = `https://wa.me/${numero}?text=${mensaje}`;
  window.open(url, "_blank");
}
