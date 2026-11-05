"use strict";
const STORE_KEY = "omatPohjatV3";
// Room for pretty-printed 0.3.1 backups of a quota-sized local library.
const MAX_IMPORT_BYTES = 32 * 1024 * 1024;
function requireString(value, location) {
  if (typeof value !== "string") throw new Error(location + ": oltava teksti.");
  return value;
}
function validateData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1 || !Array.isArray(value.groups)) {
    throw new Error("Tiedoston muodossa on virhe: tarvitaan version 1 ja groups-taulukko.");
  }
  if (value.groups.length > 100) throw new Error("Kategorioita on liikaa (enintään 100).");
  const groups = value.groups.map((g, gi) => {
    if (!g || typeof g !== "object" || Array.isArray(g) || !Array.isArray(g.scenarios)) throw new Error(`Kategorian ${gi + 1} vaihtoehdot puuttuvat.`);
    const name = requireString(g.name, `Kategoria ${gi + 1}`).trim();
    if (!name || name.length > 150) throw new Error(`Kategorian ${gi + 1} nimi puuttuu tai on liian pitkä.`);
    if (g.scenarios.length > 100) throw new Error("Yhdellä kategorialla voi olla enintään 100 vaihtoehtoa.");
    return {name, scenarios: g.scenarios.map((s, si) => {
      if (!s || typeof s !== "object" || Array.isArray(s) || !Array.isArray(s.fields)) throw new Error(`Vaihtoehdon ${si + 1} tekstiosiot puuttuvat.`);
      const sn = requireString(s.name, `Vaihtoehto ${si + 1}`).trim();
      if (!sn || sn.length > 150) throw new Error("Vaihtoehdon nimi puuttuu tai on liian pitkä.");
      if (s.fields.length > 70) throw new Error("Yhdellä vaihtoehdolla voi olla enintään 70 tekstiboksia.");
      return {name: sn, fields: s.fields.map((f, fi) => {
        if (!f || typeof f !== "object" || Array.isArray(f)) throw new Error(`Tekstiboksi ${fi + 1} ei ole kelvollinen.`);
        const title = requireString(f.title, `Tekstiboksi ${fi + 1}`).trim();
        const content = requireString(f.text, `Tekstiboksin ${fi + 1} sisältö`);
        if (!title || title.length > 150 || content.length > 50000) throw new Error("Tekstiboksin otsikko puuttuu tai sisältö on liian pitkä.");
        return {title, text: content};
      })};
    })};
  });
  return {version: 1, groups};
}
async function readFileDefaults() {
  const response = await fetch(chrome.runtime.getURL("pohjat.json"));
  if (!response.ok) throw new Error("pohjat.json-tiedostoa ei löytynyt.");
  return validateData(await response.json());
}
async function readActive() {
  const result = await chrome.storage.local.get(STORE_KEY);
  // A damaged saved value must never silently fall back to an empty library.
  if (Object.hasOwn(result, STORE_KEY)) {
    const data = validateData(result[STORE_KEY]);
    return {data, source: "local", revision: JSON.stringify(data)};
  }
  return {data: await readFileDefaults(), source: "file", revision: null};
}
function makeOption(label, value) {
  const opt = document.createElement("option");
  opt.value = String(value);
  opt.textContent = label;
  return opt;
}
