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

import { buildBudget } from "./prompts.mjs";
test("yanıt bütçesi kullanıcının kısa ayarıyla yeni oyunu kesmez", () => {
  assert.ok(buildBudget(6000, { strong: true, kind: "game" }) >= 24000);
  assert.ok(buildBudget(12000, { cur: "x".repeat(8000) }) >= 16000);
  assert.ok(buildBudget(12000, { model: "openai/gpt-5" }) >= 24000);
  assert.ok(buildBudget(99999, {}) <= 40000);
});
test("dönüşüm isteklerinde eski yerleşim zorunlu değil, özet dürüst olmalı", () => {
  assert.match(GEN_SYSTEM, /bambaşka bir şeye dönüştürüyorsa/);
  assert.match(GEN_SYSTEM, /yapmadığın özelliği yazma/);
});
test("görseller: göreli yol yasak, güvenilir kaynak ve yedek zorunlu; tema adı uygulama adı olmaz", () => {
  assert.match(GEN_SYSTEM, /göreli yol/);
  assert.match(GEN_SYSTEM, /picsum\.photos\/seed/);
  assert.match(GEN_SYSTEM, /onerror/);
  assert.match(GEN_SYSTEM, /tasarım temasının adını uygulama adı yapma/);
});
test("sonuç raporu: sonuç önce, maddeler, Kontrol ve Sıradaki; övgü yok", () => {
  assert.match(GEN_SYSTEM, /İlk cümle sonucu söyler/);
  assert.match(GEN_SYSTEM, /Kontrol:/);
  assert.match(GEN_SYSTEM, /Sıradaki:/);
  assert.match(GEN_SYSTEM, /övgüler ve ünlem kullanma/);
});
