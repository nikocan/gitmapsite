import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = name => readFileSync(new URL("../skills/" + name, import.meta.url), "utf8");
const catalog = runInNewContext([source("sectors.js"), source("catalog.js"), "GitmappSkills"].join("\n"));

test("every sector has distinct workflows and 200 addressable skills", () => {
  assert.equal(catalog.sectors.length, 24);
  assert.equal(new Set(catalog.sectors.map(sector => sector.nace)).size, 22);
  assert.equal(catalog.workflows.length, 240);
  assert.equal(catalog.workflowById.size, catalog.workflows.length);
  assert.equal(catalog.skills.length, 4800);
  assert.equal(catalog.bySkill.size, catalog.skills.length);

  for (const sector of catalog.sectors) {
    assert.equal(sector.workflows.length, 10, sector.id);
    assert.equal(catalog.skills.filter(skill => skill.sector === sector.id).length, 200, sector.id);
    for (const workflow of sector.workflows) {
      assert.ok(workflow.inputs && workflow.states && workflow.check);
      assert.equal(new URL(workflow.source).protocol, "https:");
      const skills = catalog.skillsByWorkflow.get(workflow.id);
      assert.equal(skills.length, 20, workflow.id);
      assert.equal(new Set(skills.map(catalog.skillPrompt)).size, 20, workflow.id);
    }
  }
});

test("Turkish goal search ranks relevant plans with and without accents", () => {
  assert.equal(catalog.findWorkflows("Kuaförüm için randevu uygulaması istiyorum")[0].id, "salon/randevu");
  assert.equal(catalog.findWorkflows("Kuaforum icin randevu uygulamasi istiyorum")[0].id, "salon/randevu");
  assert.equal(catalog.findWorkflows("okul yoklaması", "egitim")[0].id, "egitim/yoklama");
  assert.equal(catalog.findWorkflows("xqzw")[0], undefined);
  const model = catalog.bySkill.get("salon/randevu/veri/model");
  assert.ok(catalog.matchesSkill(model, catalog.tokens("kuafor veri modeli")));
  assert.ok(!catalog.matchesSkill(model, catalog.tokens("kargo")));
});

test("stage transfer and enabled guidance include workflow requirements within the request budget", () => {
  const id = "salon/randevu/veri/model";
  const workflow = catalog.workflowById.get("salon/randevu");
  const stage = catalog.stages.find(step => step.id === "veri");
  const prompt = catalog.planPrompt(workflow, stage);

  assert.match(prompt, /Veriyi kur/);
  assert.match(prompt, /çakışan iki randevu/);
  assert.doesNotMatch(prompt, /Yayın ve devir kontrolü/);
  assert.match(catalog.assistantPrompt(workflow, stage), /en fazla üç soru/);
  assert.match(catalog.activeGuidance([id], "Kuaför randevu veri modeli", 3000), /Görev: Veri modeli/);
  assert.equal(catalog.activeGuidance([id], "Toptancı için stok raporu", 3000), "");
  assert.equal(catalog.activeGuidance([id], workflow.name, 40), "");
});
