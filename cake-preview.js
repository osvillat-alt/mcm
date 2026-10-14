const PAN_COLORS = {
  Vainilla: ["#efce91", "#bb8447"], Chocolate: ["#70402d", "#3d211c"],
  "Red velvet": ["#be4b53", "#7b2936"], Almendra: ["#dfbd88", "#a87746"],
  Zanahoria: ["#da9950", "#a25c32"]
};
const FILLING_COLORS = {
  Chantilly: "#fff8ef", Fruta: "#f5ae5c", Chocolate: "#633524", Almendra: "#e2bc87",
  Nuez: "#b88d60", "Fresas con crema": "#f3a0b5", Nutella: "#85482e", Cajeta: "#c38343",
  "Queso Philadelphia": "#fff0d6"
};
const ICING_COLORS = {Chantilly: ["#fff8f1", "#d9c1b5"], "Queso crema": ["#f4e7ce", "#cfb999"], Chocolate: ["#603624", "#321d19"]};

export function setupCakePreview() {
  const preview = document.getElementById("cakePreview");
  const form = document.querySelector("#personaliza .form-wrap");
  if (!preview || !form) return;
  const get = id => document.getElementById(id);
  const value = id => get(id)?.value.trim() || "";
  const fields = new Set(["tamano", "saborPan", "consistencia", "betun", "detalleFruta", "detallesLogo", "fraseFondant"]);
  const header = document.querySelector(".topbar");
  const fitHeader = () => preview.style.setProperty("--cake-header-height", `${header?.getBoundingClientRect().height || 80}px`);
  fitHeader();
  if (header && typeof ResizeObserver !== "undefined") new ResizeObserver(fitHeader).observe(header);
  const fitViewport = () => preview.classList.toggle("cake-short-view", (window.visualViewport?.height || window.innerHeight) < 480);
  window.visualViewport?.addEventListener("resize", fitViewport);
  fitViewport();

  function render() {
    const pan = value("saborPan");
    const size = value("tamano");
    const icing = value("betun");
    const consistency = value("consistencia");
    const fillings = [...form.querySelectorAll(".relleno:checked")].map(input => input.value).filter(name => Object.hasOwn(FILLING_COLORS, name));
    const ready = Object.hasOwn(PAN_COLORS, pan);
    const [light, dark] = ready ? PAN_COLORS[pan] : PAN_COLORS.Vainilla;
    preview.style.setProperty("--cake-pan", light);
    preview.style.setProperty("--cake-pan-dark", dark);
    const [icingLight, icingDark] = Object.hasOwn(ICING_COLORS, icing) ? ICING_COLORS[icing] : ICING_COLORS.Chantilly;
    preview.style.setProperty("--cake-icing", icingLight);
    preview.style.setProperty("--cake-icing-shadow", icingDark);
    const scale = {"16 cm": 0.78, "18 cm": 0.86, "20 cm": 0.93, "22 cm": 1}[size] || 0.86;
    get("cakeModel").style.transform = `translateY(${(1 - scale) * 90}px) scale(${scale})`;
    get("cakeModel").style.opacity = ready ? "1" : "0";
    get("cakeEmpty").style.opacity = ready ? "0" : "1";
    get("cakeIcing").style.opacity = Object.hasOwn(ICING_COLORS, icing) ? "1" : "0";
    get("cakeCutaway").style.opacity = fillings.length || icing ? "1" : "0";
    get("cakeMoisture").style.opacity = ready && ["Tres leches", "Húmedo"].includes(consistency) ? "0.6" : "0";
    get("cakeFillingBand").style.opacity = fillings.length ? "1" : "0";
    const gradient = get("cakeFillingGradient");
    gradient.replaceChildren();
    for (const [index, filling] of fillings.entries()) {
      for (const offset of [index / fillings.length, (index + 1) / fillings.length]) {
        const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop.setAttribute("offset", `${offset * 100}%`);
        stop.setAttribute("stop-color", FILLING_COLORS[filling]);
        gradient.append(stop);
      }
    }
    const phrase = Array.from(value("fraseFondant"));
    const message = phrase.length > 28 ? phrase.slice(0, 27).join("") + "…" : phrase.join("");
    get("cakeMessage").textContent = message;
    get("cakeMessage").style.fontSize = `${Math.min(17, 170 / Math.max(1, Array.from(message).length * 0.6))}px`;
    get("cakeMessage").style.fill = icing === "Chocolate" ? "#fff5df" : "#4b2f24";
    get("cakeMessage").style.opacity = icing && message ? "1" : "0";
    get("cakeSizeLabel").textContent = size || "Elige un tamaño";
    const choices = [pan, consistency, icing ? "Betún de " + icing.toLowerCase() : ""].filter(Boolean);
    get("cakePreviewSummary").textContent = choices.join(" · ") || "Elige el pan para empezar.";
    get("cakeFillingsLabel").textContent = fillings.length ? "Relleno: " + fillings.join(" + ") + (fillings.includes("Fruta") && value("detalleFruta") ? " (" + value("detalleFruta") + ")" : "") : "Agrega los rellenos que prefieras.";
    get("cakeDesignNote").textContent = value("detallesLogo") ? "Diseño anotado para MCM" : "";
    get("cakeSvgDescription").textContent = ["Vista ilustrativa de tu pastel", size, ...choices, ...fillings, value("fraseFondant")].filter(Boolean).join(". ");
  }
  form.addEventListener("input", event => {
    if (fields.has(event.target.id) || event.target.classList.contains("relleno")) render();
  });
  form.addEventListener("change", event => {
    if (fields.has(event.target.id) || event.target.classList.contains("relleno")) render();
  });
  // ponytail: text design requests stay descriptive; a reference image is not an exact cake render.
  render();
  preview.hidden = false;
}
