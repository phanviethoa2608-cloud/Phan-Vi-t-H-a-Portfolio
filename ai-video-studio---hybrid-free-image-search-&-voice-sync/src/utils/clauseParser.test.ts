import test from "node:test";
import assert from "node:assert/strict";
import {
  splitSentenceIntoClauses,
  extractKeywords,
  generateHeadline,
  splitScriptIntoScenes
} from "./clauseParser.js";

test("splitSentenceIntoClauses splits conditional sentence into subordinate and main clause", () => {
  const sentence = "Khi bạn bắt đầu ngày mới với một kế hoạch rõ ràng, năng suất làm việc sẽ tăng gấp đôi.";
  const clauses = splitSentenceIntoClauses(sentence);

  assert.equal(clauses.length, 2);
  assert.equal(clauses[0].type, "subordinate");
  assert.match(clauses[0].role || "", /Thời gian/);
  assert.equal(clauses[1].type, "main");
  assert.match(clauses[1].text, /năng suất làm việc sẽ tăng gấp đôi/);
});

test("splitSentenceIntoClauses handles single clause sentence gracefully", () => {
  const sentence = "AI VIDEO STUDIO mang lại giải pháp đột phá.";
  const clauses = splitSentenceIntoClauses(sentence);

  assert.equal(clauses.length, 1);
  assert.equal(clauses[0].type, "main");
});

test("splitSentenceIntoClauses detects condition (nếu... thì...)", () => {
  const sentence = "Nếu bạn áp dụng quy tắc 80/20, kết quả đạt được sẽ vượt ngoài mong đợi.";
  const clauses = splitSentenceIntoClauses(sentence);

  assert.equal(clauses.length, 2);
  assert.equal(clauses[0].type, "subordinate");
  assert.match(clauses[0].role || "", /Điều kiện/);
  assert.equal(clauses[1].type, "main");
});

test("extractKeywords captures numbers, glass acronyms, and editorial phrases", () => {
  const text = "Chỉ cần 3 bước đơn giản, tiết kiệm 50% thời gian với AI VIDEO STUDIO.";
  const kws = extractKeywords(text, 5);

  const hasNumber = kws.some(k => k.style === "number");
  assert.equal(hasNumber, true);

  const hasGlassOrEditorial = kws.some(k => k.style === "glass" || k.style === "editorial");
  assert.equal(hasGlassOrEditorial, true);
});

test("generateHeadline creates structured headline from text and keywords", () => {
  const text = "Bí quyết gấp đôi hiệu suất trong 7 ngày.";
  const kws = extractKeywords(text, 4);
  const headline = generateHeadline(text, "INTRO", kws);

  assert.equal(headline.small, "INTRO");
  assert.ok(headline.main.length > 0);
});

test("splitScriptIntoScenes creates valid scene structures with clauses", () => {
  const script = "Bí quyết gấp đôi hiệu suất trong 7 ngày.\nChỉ cần 3 bước đơn giản, tiết kiệm 50% thời gian.";
  const scenes = splitScriptIntoScenes(script);

  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].title, "INTRO");
  assert.equal(scenes[1].title, "OUTRO");
  assert.ok(scenes[0].clauses && scenes[0].clauses.length > 0);
  assert.ok(scenes[1].keywords.length > 0);
});
