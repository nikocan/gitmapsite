import test from "node:test";
import assert from "node:assert/strict";
import { connRules, connUse, scopeRule, profileRelevant, KIND_RULES, GEN_SYSTEM } from "./prompts.mjs";

const list = [
  { id: "whatsapp", cfg: { phone: "+90 555 111 22 33" } },
  { id: "form", cfg: { url: "https://formspree.io/f/abc" } },
  { id: "analytics", cfg: { id: "G-ABCD1234" } },
  { id: "gmdb", cfg: {} },
];

test("oyunlara istenmeden WhatsApp, form ya da ölçüm kodu eklenmez", () => {
  assert.equal(connRules(list, { kind: "game", prompt: "uzay gemisiyle meteorlardan kaçılan bir oyun" }), "");
});

test("ilgisiz uygulamaya WhatsApp ve form gitmez, veri servisleri koşullu gider", () => {
  const r = connRules(list, { kind: "app", prompt: "kalori ve su takip uygulaması" });
  assert.doesNotMatch(r, /WhatsApp|Form gönderimi/);
  assert.match(r, /YALNIZCA uygulamanın amacına doğal olarak uyuyorsa/);
  assert.match(r, /GitmappDB/);
});

test("konusu uygun uygulamada WhatsApp isteğe bağlı kural olarak gider", () => {
  assert.equal(connUse("whatsapp", { kind: "app", prompt: "restoran sipariş uygulaması" }), "fits");
  assert.match(connRules(list, { kind: "app", prompt: "restoran sipariş uygulaması" }), /uyuyorsa[\s\S]*wa\.me\/905551112233/);
});

test("kullanıcı açıkça isterse oyunda bile kullanılır", () => {
  const r = connRules(list, { kind: "game", prompt: "skoru WhatsApp ile paylaşma düğmesi olsun" });
  assert.match(r, /istediği bağlı servisler[\s\S]*wa\.me/);
});

test("küçük düzenlemelerde istenmeyen servis kuralı gönderilmez", () => {
  assert.equal(connRules(list, { kind: "app", prompt: "başlığı büyüt", edit: true }), "");
  assert.match(connRules(list, { kind: "app", prompt: "WhatsApp düğmesi ekle", edit: true }), /wa\.me/);
});

test("oyun kuralları ve kapsam: web sitesi öğeleri yasak, profil alanı oyuna taşınmaz", () => {
  assert.match(KIND_RULES.game, /WhatsApp, form/);
  assert.match(scopeRule("game"), /yalnızca oyunu yap/);
  assert.equal(profileRelevant("game"), false);
  assert.equal(profileRelevant("app"), true);
  assert.match(GEN_SYSTEM, /istenmeyen bölüm ve özellik EKLEME/);
  assert.doesNotMatch(KIND_RULES.site, /iletişim formu ve alt bilgi olsun/);
});
