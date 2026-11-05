"use strict";
const el = id => document.getElementById(id);
const groupSelect = el("group"), scenarioSelect = el("scenario"), fieldsRoot = el("fields"), message = el("status");
let current = {version: 1, groups: []};
let dirty = false, busy = false, ready = false, revision = null;

function activeGroup() {return current.groups[Number(groupSelect.value)];}
function activeScenario() {return activeGroup()?.scenarios[Number(scenarioSelect.value)];}
function notify(text, kind = "") {message.textContent = text; message.className = kind;}
function changed() {dirty = true; notify("Tallentamattomia muutoksia. Tallenna pohjat, kun olet valmis.", "pending");}
function updateControls() {
  const group = activeGroup(), scenario = activeScenario();
  el("workspace").disabled = busy;
  for (const id of ["save", "export", "importButton", "addGroup"]) el(id).disabled = !ready;
  groupSelect.disabled = !group;
  scenarioSelect.disabled = !scenario;
  el("groupName").disabled = !group;
  el("delGroup").disabled = !group;
  el("scenarioName").disabled = !scenario;
  el("delScenario").disabled = !scenario;
  el("addScenario").disabled = !ready || !group || group.scenarios.length >= 100;
  el("addField").disabled = !ready || !scenario || scenario.fields.length >= 70;
  el("addGroup").disabled = !ready || current.groups.length >= 100;
}
function setBusy(value) {busy = value; updateControls();}
function displayGroups(targetIndex = 0, scenarioIndex = 0) {
  groupSelect.replaceChildren();
  current.groups.forEach((g, i) => groupSelect.append(makeOption(g.name, i)));
  if (current.groups.length) groupSelect.value = String(Math.min(targetIndex, current.groups.length - 1));
  else groupSelect.append(makeOption("Ei toimenpiteitä", ""));
  displayScenarios(scenarioIndex);
}
function displayScenarios(targetIndex = 0) {
  const group = activeGroup();
  scenarioSelect.replaceChildren();
  group?.scenarios.forEach((s, i) => scenarioSelect.append(makeOption(s.name, i)));
  if (group?.scenarios.length) scenarioSelect.value = String(Math.min(targetIndex, group.scenarios.length - 1));
  else scenarioSelect.append(makeOption("Ei lopputuloksia", ""));
  displayFields();
}
function displayFields() {
  const group = activeGroup(), scenario = activeScenario();
  el("groupName").value = group?.name || "";
  el("scenarioName").value = scenario?.name || "";
  updateControls();
  fieldsRoot.replaceChildren();
  if (!scenario || !scenario.fields.length) {
    const p = document.createElement("p"); p.className = "sub";
    p.textContent = !group ? "Lisää ensin toimenpide." : !scenario ? "Lisää toimenpiteelle lopputulos." : "Lisää tekstiboksi ja kirjoita kopioitava teksti.";
    fieldsRoot.append(p);
    return;
  }
  scenario.fields.forEach((field, index) => {
    const card = document.createElement("div"); card.className = "field";
    const head = document.createElement("div"); head.className = "field-title";
    const title = document.createElement("strong"); title.textContent = "Tekstiboksi " + (index + 1);
    const controls = document.createElement("div"); controls.className = "field-controls";
    for (const [text, step] of [["↑", -1], ["↓", 1]]) {
      const button = document.createElement("button"); button.type = "button"; button.className = "btn secondary"; button.textContent = text;
      const label = "Siirrä tekstiboksia " + (index + 1) + (step < 0 ? " ylemmäs" : " alemmas");
      button.title = label; button.setAttribute("aria-label", label);
      button.disabled = index + step < 0 || index + step >= scenario.fields.length;
      button.addEventListener("click", () => {
        const next = index + step;
        [scenario.fields[index], scenario.fields[next]] = [scenario.fields[next], scenario.fields[index]];
        changed(); displayFields();
        fieldsRoot.querySelectorAll(".field")[next].querySelector("input").focus();
      });
      controls.append(button);
    }
    const del = document.createElement("button"); del.type = "button"; del.className = "btn danger"; del.textContent = "Poista";
    del.setAttribute("aria-label", "Poista tekstiboksi " + (index + 1));
    del.addEventListener("click", () => {
      if (!confirm("Poistetaanko tekstiboksi? Muutos tulee voimaan vasta tallennettaessa.")) return;
      scenario.fields.splice(index, 1); changed(); displayFields();
      const next = fieldsRoot.querySelectorAll("input")[Math.min(index, scenario.fields.length - 1)];
      (next || el("addField")).focus();
    });
    controls.append(del); head.append(title, controls);
    const label = document.createElement("label"); label.textContent = "Otsikko"; label.htmlFor = "title-" + index;
    const input = document.createElement("input"); input.id = label.htmlFor; input.value = field.title; input.maxLength = 150;
    input.spellcheck = false; input.autocomplete = "off";
    input.addEventListener("input", () => {field.title = input.value; changed();});
    const textLabel = document.createElement("label"); textLabel.textContent = "Kopioitava teksti"; textLabel.htmlFor = "text-" + index;
    const area = document.createElement("textarea"); area.id = textLabel.htmlFor; area.value = field.text; area.maxLength = 50000;
    // Avoid requesting browser spellcheck services for potentially private template text.
    area.spellcheck = false; area.autocomplete = "off";
    area.addEventListener("input", () => {field.text = area.value; changed();});
    card.append(head, label, input, textLabel, area); fieldsRoot.append(card);
  });
}
async function assertUnchanged() {
  const saved = await chrome.storage.local.get(STORE_KEY);
  // Chromium storage may reorder object keys. Compare the canonical version-1 shape.
  const latest = Object.hasOwn(saved, STORE_KEY) ? JSON.stringify(validateData(saved[STORE_KEY])) : null;
  if (latest !== revision) throw new Error("Tallennettu kirjasto muuttui toisessa näkymässä. Vie omat muutoksesi JSON-tiedostoksi ja valitse Lataa tallennetut.");
}
async function loadSaved() {
  if (busy) return;
  setBusy(true);
  try {
    const loaded = await readActive();
    current = loaded.data; revision = loaded.revision; ready = true; dirty = false;
    displayGroups(); notify("Pohjat avattu. Voit luoda uusia pohjia tai tuoda JSON-tiedoston.");
  } catch (error) {
    notify("Pohjien avaaminen epäonnistui. Tallennettuja tietoja ei muutettu. " + error.message, "error");
  } finally {setBusy(false);}
}
groupSelect.addEventListener("change", () => displayScenarios());
scenarioSelect.addEventListener("change", displayFields);
for (const [id, getItem, select] of [["groupName", activeGroup, groupSelect], ["scenarioName", activeScenario, scenarioSelect]]) {
  el(id).addEventListener("input", event => {
    const item = getItem();
    if (item) {item.name = event.target.value; select.selectedOptions[0].textContent = item.name || "(nimetön)"; changed();}
  });
}
el("addGroup").addEventListener("click", () => {
  if (current.groups.length >= 100) return;
  current.groups.push({name: "Uusi toimenpide", scenarios: []}); changed(); displayGroups(current.groups.length - 1);
  el("groupName").focus(); el("groupName").select();
});
el("delGroup").addEventListener("click", () => {
  const index = Number(groupSelect.value);
  if (activeGroup() && confirm("Poistetaanko toimenpide ja kaikki sen lopputulokset ja tekstit?")) {
    current.groups.splice(index, 1); changed(); displayGroups(Math.max(0, index - 1)); el("addGroup").focus();
  }
});
el("addScenario").addEventListener("click", () => {
  const group = activeGroup(); if (!group || group.scenarios.length >= 100) return;
  group.scenarios.push({name: "Uusi lopputulos", fields: []}); changed(); displayScenarios(group.scenarios.length - 1);
  el("scenarioName").focus(); el("scenarioName").select();
});
el("delScenario").addEventListener("click", () => {
  const group = activeGroup(), scenario = activeScenario(), index = Number(scenarioSelect.value);
  if (group && scenario && confirm("Poistetaanko lopputulos ja kaikki sen tekstiboksit?")) {
    group.scenarios.splice(index, 1); changed(); displayScenarios(Math.max(0, index - 1)); el("addScenario").focus();
  }
});
el("addField").addEventListener("click", () => {
  const scenario = activeScenario(); if (!scenario || scenario.fields.length >= 70) return;
  scenario.fields.push({title: "Uusi tekstiosio", text: ""}); changed(); displayFields();
  const input = fieldsRoot.querySelectorAll("input")[scenario.fields.length - 1]; input.focus(); input.select();
});
el("save").addEventListener("click", async () => {
  if (busy || !ready) return;
  setBusy(true);
  try {
    const data = validateData(current);
    await assertUnchanged();
    await chrome.storage.local.set({[STORE_KEY]: data});
    const groupIndex = Number(groupSelect.value), scenarioIndex = Number(scenarioSelect.value);
    current = data; revision = JSON.stringify(data); dirty = false;
    // Rebind field listeners to the validated object after saving.
    displayGroups(groupIndex, scenarioIndex); notify("Pohjat tallennettu tähän Edge-profiiliin.");
  } catch (error) {notify("Tallennus ei onnistunut. Muutokset ovat yhä tässä näkymässä. " + error.message, "error");}
  finally {setBusy(false);}
});
el("export").addEventListener("click", () => {
  try {
    const data = validateData(current);
    let blob = new Blob([JSON.stringify(data, null, 2) + "\n"], {type: "application/json"});
    if (blob.size > MAX_IMPORT_BYTES) blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    if (blob.size > MAX_IMPORT_BYTES) throw new Error("Kirjasto ylittää tuonnin 32 MiB:n rajan. Jaa se pienempiin kirjastoihin ennen vientiä.");
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "pohjat.json"; document.body.append(link);
    try {link.click();} finally {link.remove(); setTimeout(() => URL.revokeObjectURL(url), 6000);}
    notify("JSON-tiedoston lataus käynnistetty. Tarkista tiedosto selaimen latauksista.");
  } catch (error) {notify("Vienti ei onnistunut: " + error.message, "error");}
});
el("importButton").addEventListener("click", () => el("import").click());
el("import").addEventListener("change", async event => {
  const file = event.target.files[0]; event.target.value = "";
  if (!file || busy || !ready) return;
  setBusy(true);
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Tiedosto on liian suuri (enintään 32 MiB).");
    let parsed;
    try {parsed = JSON.parse(await file.text());}
    catch (_error) {throw new Error("Tiedostoa ei voitu lukea kelvollisena JSON-tiedostona.");}
    const data = validateData(parsed);
    if ((dirty || current.groups.length) && !confirm("Tuonti korvaa tämän muokkausnäkymän sisällön. Tallennettu kirjasto muuttuu vasta Tallenna pohjat -painikkeesta. Jatketaanko?")) return;
    current = data; dirty = true; displayGroups();
    notify("Pohjat tuotu muokkausnäkymään. Ota ne käyttöön painamalla Tallenna pohjat.", "pending");
  } catch (error) {notify("Tuonti epäonnistui. Nykyisiä pohjia ei muutettu. " + error.message, "error");}
  finally {setBusy(false);}
});
el("reload").addEventListener("click", () => {
  if (!dirty || confirm("Hylätäänkö tämän näkymän tallentamattomat muutokset ja ladataan tallennetut pohjat?")) void loadSaved();
});
el("reset").addEventListener("click", async () => {
  if (busy || !confirm("Poistetaanko koko tämän Edge-profiilin tekstikirjasto ja tämän näkymän muutokset? Vie tarvittaessa JSON-varmuuskopio ensin.")) return;
  setBusy(true);
  try {
    if (ready) await assertUnchanged();
    await chrome.storage.local.remove(STORE_KEY);
    current = {version: 1, groups: []}; revision = null; dirty = false; ready = true;
    displayGroups(); notify("Tämän Edge-profiilin kirjasto tyhjennetty. JSON-tiedostoja tai leikepöytää ei poistettu.");
  } catch (error) {notify("Tyhjennys ei onnistunut: " + error.message, "error");}
  finally {setBusy(false);}
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[STORE_KEY] || busy) return;
  if (dirty) notify("Tallennettu kirjasto muuttui toisessa näkymässä. Vie omat muutoksesi JSON-tiedostoksi ennen tallennettujen lataamista.", "pending");
  else void loadSaved();
});
window.addEventListener("beforeunload", event => {
  if (dirty || busy) {event.preventDefault(); event.returnValue = "";}
});
void loadSaved();
