// Run from the project folder with:   node test-storage.js
// Uses a pretend "notebook" instead of a real browser, so we can also test the failure cases.

const assert = require("assert");
const Store = require("./storage.js");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ok    " + name); }
  catch (error) { failed++; console.log("  FAIL  " + name + "\n        " + error.message); }
}

// A pretend localStorage that keeps its data in a plain object.
function makeFakeStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value); },
    removeItem: key => { delete data[key]; },
    raw: () => data
  };
}
// A pretend localStorage where every call fails (blocked, full or private mode).
function makeBrokenStorage() {
  const fail = () => { throw new Error("storage blocked"); };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

const KEY = Store.STORAGE_KEY;
const periods = [
  { id: 9, startDate: "2026-03-30", endDate: "2026-04-03", notes: "private note" },
  { id: 5, startDate: "2026-03-01", endDate: "2026-03-05", notes: "" }
];

console.log("\nLoading");
test("no storage at all -> 'unavailable', no crash", () => {
  const r = Store.loadSavedData(null);
  assert.strictEqual(r.status, "unavailable");
  assert.deepStrictEqual(r.periods, []);
});
test("empty storage -> 'empty'", () => {
  const r = Store.loadSavedData(makeFakeStorage());
  assert.strictEqual(r.status, "empty");
  assert.deepStrictEqual(r.periods, []);
});
test("storage that throws when read -> 'unavailable', no crash", () => {
  assert.strictEqual(Store.loadSavedData(makeBrokenStorage()).status, "unavailable");
});

console.log("\nSaving and loading back (a page refresh)");
test("what we save is what we get back, in date order, with typical cycle length", () => {
  const storage = makeFakeStorage();
  assert.strictEqual(Store.saveData(storage, periods, 28), true);
  const r = Store.loadSavedData(storage);
  assert.strictEqual(r.status, "loaded");
  assert.strictEqual(r.typicalCycleDays, 28);
  assert.deepStrictEqual(r.periods.map(p => [p.startDate, p.endDate]),
    [["2026-03-01", "2026-03-05"], ["2026-03-30", "2026-04-03"]]);
});
test("only the necessary data is stored: no notes, no ids", () => {
  const storage = makeFakeStorage();
  Store.saveData(storage, periods, null);
  const text = storage.raw()[KEY];
  assert.ok(!text.includes("private note"), "notes must not be stored");
  assert.ok(!text.includes('"id"'), "ids must not be stored");
  assert.ok(!text.includes("typicalCycleDays"), "no typical length was set");
  assert.deepStrictEqual(Object.keys(JSON.parse(text)).sort(), ["periods", "version"]);
});
test("saving again replaces the old data (edit / delete)", () => {
  const storage = makeFakeStorage();
  Store.saveData(storage, periods, null);
  Store.saveData(storage, [periods[1]], null);
  assert.strictEqual(Store.loadSavedData(storage).periods.length, 1);
});
test("saving an empty list with no typical length removes the key completely", () => {
  const storage = makeFakeStorage();
  Store.saveData(storage, periods, 28);
  assert.strictEqual(Store.saveData(storage, [], null), true);
  assert.strictEqual(KEY in storage.raw(), false);
});
test("saving into broken or missing storage returns false instead of crashing", () => {
  assert.strictEqual(Store.saveData(makeBrokenStorage(), periods, null), false);
  assert.strictEqual(Store.saveData(null, periods, null), false);
});

console.log("\nDamaged or unexpected saved data");
[
  ["not JSON at all", "{this is not json"],
  ["the word null", "null"],
  ["a plain string", '"hello"'],
  ["an array", "[]"],
  ["an object without periods", '{"version":1}'],
  ["an unknown version", '{"version":99,"periods":[]}'],
  ["empty text", ""]
].forEach(([label, text]) => {
  test("corrupted: " + label + " -> 'unreadable', no crash, empty list", () => {
    const r = Store.loadSavedData(makeFakeStorage({ [KEY]: text }));
    assert.strictEqual(r.status, "unreadable");
    assert.deepStrictEqual(r.periods, []);
    assert.strictEqual(r.typicalCycleDays, null);
  });
});
test("partly damaged data keeps the good records and reports how many were skipped", () => {
  const text = JSON.stringify({ version: 1, periods: [
    { startDate: "2026-03-01", endDate: "2026-03-05" },
    { startDate: "oops", endDate: "2026-03-05" },
    { startDate: "2026-03-30", endDate: "2026-03-28" }
  ] });
  const r = Store.loadSavedData(makeFakeStorage({ [KEY]: text }));
  assert.strictEqual(r.status, "loaded");
  assert.strictEqual(r.periods.length, 1);
  assert.strictEqual(r.droppedCount, 2);
});

console.log("\nClearing");
test("clearSavedData removes everything, and a refresh then finds nothing", () => {
  const storage = makeFakeStorage();
  Store.saveData(storage, periods, 28);
  assert.strictEqual(Store.clearSavedData(storage), true);
  assert.strictEqual(Store.loadSavedData(storage).status, "empty");
});
test("clearing broken or missing storage reports failure instead of crashing", () => {
  assert.strictEqual(Store.clearSavedData(makeBrokenStorage()), false);
  assert.strictEqual(Store.clearSavedData(null), false);
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;