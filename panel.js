"use strict";
const groupSelect = document.getElementById("group");
const scenarioSelect = document.getElementById("scenario");
const cards = document.getElementById("cards");
const status = document.getElementById("status");
let active = {version: 1, groups: []};

function currentGroup() {return active.groups[Number(groupSelect.value)];}
function currentScenario() {return currentGroup()?.scenarios[Number(scenarioSelect.value)];}
function populateGroups(oldGroupName, oldScenarioName) {
  groupSelect.replaceChildren();
  active.groups.forEach((g, i) => groupSelect.append(makeOption(g.name, i)));
  if (!active.groups.length) groupSelect.append(makeOption("Ei toimenpiteitä", ""));
  const index = active.groups.findIndex(g => g.name === oldGroupName);
  groupSelect.value = active.groups.length ? String(index >= 0 ? index : 0) : "";
  groupSelect.disabled = !active.groups.length;
  populateScenarios(oldScenarioName);
}
function populateScenarios(wantedName) {
  scenarioSelect.replaceChildren();
  const group = currentGroup();
  group?.scenarios.forEach((s, i) => scenarioSelect.append(makeOption(s.name, i)));
  if (!group?.scenarios.length) scenarioSelect.append(makeOption("Ei lopputuloksia", ""));
  const index = group?.scenarios.findIndex(s => s.name === wantedName) ?? -1;
  scenarioSelect.value = group?.scenarios.length ? String(index >= 0 ? index : 0) : "";
  scenarioSelect.disabled = !group?.scenarios.length;
  renderCards();
}
async function copyText(text, button) {
  button.disabled = true;
  status.className = "";
  status.textContent = "";
  try {
    // Write only the clicked text; never read the clipboard.
    await navigator.clipboard.writeText(text);
    status.textContent = "Teksti kopioitu leikepöydälle.";
    button.textContent = "Kopioitu";
    setTimeout(() => {button.textContent = "Kopioi"; button.disabled = false;}, 1400);
  } catch (_error) {
    button.disabled = false;
    status.className = "error";
    status.textContent = "Kopiointi ei onnistunut. Valitse teksti ja kopioi Ctrl+C (Mac: ⌘C).";
  }
}
function renderCards() {
  status.textContent = "";
  status.className = "";
  cards.replaceChildren();
  const scenario = currentScenario();
  if (!scenario || !scenario.fields.length) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = !active.groups.length
      ? "Kirjasto on tyhjä. Aloita alaosan Luo tai tuo pohjia -painikkeesta."
      : !scenario ? "Tähän toimenpiteeseen ei ole vielä lisätty lopputuloksia." : "Tässä pohjassa ei ole vielä tekstibokseja.";
    cards.append(p);
    return;
  }
  for (const field of scenario.fields) {
    const article = document.createElement("article"); article.className = "card";
    const top = document.createElement("div"); top.className = "card-head";
    const h = document.createElement("h2"); h.textContent = field.title;
    const button = document.createElement("button");
    button.type = "button"; button.className = "btn"; button.textContent = "Kopioi";
    button.setAttribute("aria-label", "Kopioi: " + field.title);
    button.addEventListener("click", () => copyText(field.text, button));
    const p = document.createElement("p"); p.className = "sample"; p.textContent = field.text;
    p.tabIndex = 0; p.setAttribute("aria-label", field.title + ": teksti");
    top.append(h, button); article.append(top, p); cards.append(article);
  }
}
let loadSequence = 0;
async function reloadData() {
  const sequence = ++loadSequence;
  const oldGroup = currentGroup()?.name, oldScenario = currentScenario()?.name;
  try {
    const {data} = await readActive();
    if (sequence !== loadSequence) return;
    active = data;
    populateGroups(oldGroup, oldScenario);
  } catch (error) {
    if (sequence !== loadSequence) return;
    active = {version: 1, groups: []}; populateGroups(); cards.replaceChildren();
    status.className = "error";
    status.textContent = "Pohjien lataaminen epäonnistui. Tallennettuja tietoja ei muutettu. " + error.message;
  }
}
groupSelect.addEventListener("change", () => populateScenarios());
scenarioSelect.addEventListener("change", renderCards);
document.getElementById("edit").addEventListener("click", async () => {
  try {await chrome.tabs.create({url: chrome.runtime.getURL("editor.html")});}
  catch (_error) {status.className = "error"; status.textContent = "Muokkausnäkymää ei voitu avata. Yritä uudelleen.";}
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORE_KEY]) void reloadData();
});
void reloadData();
