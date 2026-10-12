// Run from the project folder with:   node test-cycle-calculation.js
//
// Each test says what we EXPECT. If the code gives a different answer, the test
// prints both so you can see exactly what went wrong.
// The expected values were worked out by hand from the calendar.

const assert = require("assert");
const C = require("./cycle-calculation.js");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok    " + name);
  } catch (error) {
    failed++;
    console.log("  FAIL  " + name + "\n        " + error.message.split("\n").join("\n        "));
  }
}

// Shortcut to build a recorded period.
function period(id, startDate, endDate) {
  return { id: id, startDate: startDate, endDate: endDate, notes: "" };
}

const TODAY = "2026-06-15";


console.log("\nA. Date arithmetic (month changes, year changes, leap years, clock changes)");

test("days between two dates in the same month: 1 Mar -> 30 Mar = 29", () => {
  assert.strictEqual(C.countDaysBetween("2026-03-01", "2026-03-30"), 29);
});
test("month change: 31 Jan -> 1 Feb = 1", () => {
  assert.strictEqual(C.countDaysBetween("2026-01-31", "2026-02-01"), 1);
});
test("year change: 31 Dec 2025 -> 1 Jan 2026 = 1", () => {
  assert.strictEqual(C.countDaysBetween("2025-12-31", "2026-01-01"), 1);
});
test("leap year: 28 Feb -> 1 Mar 2024 = 2 (29 Feb exists)", () => {
  assert.strictEqual(C.countDaysBetween("2024-02-28", "2024-03-01"), 2);
});
test("non-leap year: 28 Feb -> 1 Mar 2023 = 1", () => {
  assert.strictEqual(C.countDaysBetween("2023-02-28", "2023-03-01"), 1);
});
test("same day = 0", () => {
  assert.strictEqual(C.countDaysBetween("2026-03-01", "2026-03-01"), 0);
});
test("clock changes never add or remove a day (UK, EU and US switch dates)", () => {
  assert.strictEqual(C.countDaysBetween("2026-03-28", "2026-03-30"), 2);
  assert.strictEqual(C.countDaysBetween("2026-10-24", "2026-10-26"), 2);
  assert.strictEqual(C.countDaysBetween("2026-03-07", "2026-03-09"), 2);
  assert.strictEqual(C.countDaysBetween("2026-10-31", "2026-11-02"), 2);
});
test("a span that INCLUDES a leap day is 366 days; one that stops before it is 365", () => {
  assert.strictEqual(C.countDaysBetween("2023-03-01", "2024-03-01"), 366);   // includes 29 Feb 2024
  assert.strictEqual(C.countDaysBetween("2023-02-27", "2024-02-27"), 365);   // 29 Feb 2024 comes after 27 Feb
  assert.strictEqual(C.countDaysBetween("2024-03-01", "2025-03-01"), 365);   // 2025 is not a leap year
});
test("addDaysToDate across a month end: 31 Jan + 1 = 1 Feb", () => {
  assert.strictEqual(C.addDaysToDate("2026-01-31", 1), "2026-02-01");
});
test("addDaysToDate across a year end: 31 Dec 2025 + 1 = 1 Jan 2026", () => {
  assert.strictEqual(C.addDaysToDate("2025-12-31", 1), "2026-01-01");
});
test("addDaysToDate in a leap year: 28 Feb 2024 + 1 = 29 Feb, + 2 = 1 Mar", () => {
  assert.strictEqual(C.addDaysToDate("2024-02-28", 1), "2024-02-29");
  assert.strictEqual(C.addDaysToDate("2024-02-28", 2), "2024-03-01");
});
test("addDaysToDate in a normal year: 28 Feb 2023 + 1 = 1 Mar", () => {
  assert.strictEqual(C.addDaysToDate("2023-02-28", 1), "2023-03-01");
});
test("addDaysToDate backwards: 1 Mar 2026 - 1 = 28 Feb", () => {
  assert.strictEqual(C.addDaysToDate("2026-03-01", -1), "2026-02-28");
});
test("addDaysToDate over a year end: 20 Dec 2026 + 28 = 17 Jan 2027", () => {
  assert.strictEqual(C.addDaysToDate("2026-12-20", 28), "2027-01-17");
});
test("real and fake dates", () => {
  assert.strictEqual(C.isRealDate("2024-02-29"), true);   // leap day
  assert.strictEqual(C.isRealDate("2000-02-29"), true);   // divisible by 400: leap year
  assert.strictEqual(C.isRealDate("2023-02-29"), false);
  assert.strictEqual(C.isRealDate("2100-02-29"), false);  // century year not divisible by 400
  assert.strictEqual(C.isRealDate("2026-04-31"), false);
  assert.strictEqual(C.isRealDate("2026-13-01"), false);
  assert.strictEqual(C.isRealDate("26-03-01"), false);
  assert.strictEqual(C.isRealDate(""), false);
  assert.strictEqual(C.isRealDate(undefined), false);
});


console.log("\nB. Bleeding duration (first and last day both count)");

test("1 Mar -> 5 Mar = 5 days", () => {
  assert.strictEqual(C.calculateBleedingDuration("2026-03-01", "2026-03-05"), 5);
});
test("a one-day period = 1 day", () => {
  assert.strictEqual(C.calculateBleedingDuration("2026-03-01", "2026-03-01"), 1);
});
test("across a month end: 27 Feb -> 2 Mar 2026 = 4", () => {
  assert.strictEqual(C.calculateBleedingDuration("2026-02-27", "2026-03-02"), 4);
});
test("across a leap-year month end: 27 Feb -> 1 Mar 2024 = 4", () => {
  assert.strictEqual(C.calculateBleedingDuration("2024-02-27", "2024-03-01"), 4);
});
test("across a year end: 30 Dec 2025 -> 2 Jan 2026 = 4", () => {
  assert.strictEqual(C.calculateBleedingDuration("2025-12-30", "2026-01-02"), 4);
});


console.log("\nC. Cycle length (start date to next start date)");

const sample = [
  period("c", "2026-03-01", "2026-03-05"),   // deliberately NOT in date order
  period("a", "2026-01-03", "2026-01-07"),
  period("d", "2026-03-30", "2026-04-03"),
  period("b", "2026-01-31", "2026-02-04")
];

test("cycles are measured start-to-start, in date order: 28, 29, 29", () => {
  const lengths = C.calculateCycles(sample).map(c => c.lengthDays);
  assert.deepStrictEqual(lengths, [28, 29, 29]);
});
test("the first cycle runs 3 Jan -> 31 Jan", () => {
  const first = C.calculateCycles(sample)[0];
  assert.strictEqual(first.fromStartDate, "2026-01-03");
  assert.strictEqual(first.toStartDate, "2026-01-31");
});
test("end dates make no difference to cycle length", () => {
  const withLongPeriods = [period("a", "2026-03-01", "2026-03-10"), period("b", "2026-03-30", "2026-04-08")];
  assert.strictEqual(C.calculateCycles(withLongPeriods)[0].lengthDays, 29);
});
test("cycle across a year end: 20 Dec 2025 -> 17 Jan 2026 = 28", () => {
  const list = [period("a", "2025-12-20", "2025-12-24"), period("b", "2026-01-17", "2026-01-21")];
  assert.strictEqual(C.calculateCycles(list)[0].lengthDays, 28);
});
test("cycle across a leap February: 10 Feb -> 9 Mar 2024 = 28", () => {
  const list = [period("a", "2024-02-10", "2024-02-14"), period("b", "2024-03-09", "2024-03-13")];
  assert.strictEqual(C.calculateCycles(list)[0].lengthDays, 28);
});
test("same cycle in a non-leap year: 10 Feb -> 9 Mar 2023 = 27", () => {
  const list = [period("a", "2023-02-10", "2023-02-14"), period("b", "2023-03-09", "2023-03-13")];
  assert.strictEqual(C.calculateCycles(list)[0].lengthDays, 27);
});
test("no records or one record -> no cycles", () => {
  assert.deepStrictEqual(C.calculateCycles([]), []);
  assert.deepStrictEqual(C.calculateCycles([sample[0]]), []);
});
test("two records with the SAME start date -> no cycle (needs two distinct starts)", () => {
  const same = [period("a", "2026-03-01", "2026-03-04"), period("b", "2026-03-01", "2026-03-06")];
  assert.deepStrictEqual(C.calculateCycles(same), []);
});
test("a repeated start date is skipped, the other cycle still counts", () => {
  const list = [period("a", "2026-03-01", "2026-03-04"), period("b", "2026-03-01", "2026-03-06"), period("c", "2026-03-30", "2026-04-02")];
  const cycles = C.calculateCycles(list);
  assert.strictEqual(cycles.length, 1);
  assert.strictEqual(cycles[0].lengthDays, 29);
});
test("calculateCycles does not reorder the original list", () => {
  const copy = sample.map(p => p.id).join("");
  C.calculateCycles(sample);
  assert.strictEqual(sample.map(p => p.id).join(""), copy);
});


console.log("\nD. Average cycle length");

test("average of 28, 29, 29 = 28.666...", () => {
  const avg = C.calculateAverageCycleLength(C.calculateCycles(sample));
  assert.ok(Math.abs(avg - 28.6667) < 0.001, "got " + avg);
});
test("no cycles -> null (never divides by zero)", () => {
  assert.strictEqual(C.calculateAverageCycleLength([]), null);
});


console.log("\nE. Summary and estimated next start (buildCycleSummary)");

test("no periods: everything empty", () => {
  const s = C.buildCycleSummary([], null, TODAY);
  assert.strictEqual(s.periodCount, 0);
  assert.strictEqual(s.mostRecentPeriod, null);
  assert.strictEqual(s.estimate, null);
  assert.strictEqual(s.needsTypicalCycle, false);
});
test("one period, no typical length: no estimate, asks for more data", () => {
  const s = C.buildCycleSummary([period("a", "2026-03-01", "2026-03-05")], null, TODAY);
  assert.strictEqual(s.cycleCount, 0);
  assert.strictEqual(s.averageCycleDays, null);
  assert.strictEqual(s.estimate, null);
  assert.strictEqual(s.needsTypicalCycle, true);
  assert.deepStrictEqual(s.mostRecentPeriod, { startDate: "2026-03-01", endDate: "2026-03-05", durationDays: 5 });
});
test("one period + typical 28 days: 1 Mar + 28 = 29 Mar, labelled as 'typical'", () => {
  const s = C.buildCycleSummary([period("a", "2026-03-01", "2026-03-05")], 28, TODAY);
  assert.strictEqual(s.estimate.basis, "typical");
  assert.strictEqual(s.estimate.date, "2026-03-29");
  assert.strictEqual(s.estimate.earliestDate, null);   // no range from a guess
  assert.strictEqual(s.needsTypicalCycle, false);
});
test("two periods (one cycle of 29): average 29, estimate 28 Apr, no range", () => {
  const list = [period("a", "2026-03-01", "2026-03-05"), period("b", "2026-03-30", "2026-04-03")];
  const s = C.buildCycleSummary(list, null, TODAY);
  assert.strictEqual(s.cycleCount, 1);
  assert.strictEqual(s.averageCycleDays, 29);
  assert.strictEqual(s.estimate.date, "2026-04-28");
  assert.strictEqual(s.estimate.basis, "recorded");
  assert.strictEqual(s.estimate.cyclesUsed, 1);
  assert.strictEqual(s.estimate.earliestDate, null);
});
test("recorded cycles take priority over a typical length", () => {
  const list = [period("a", "2026-03-01", "2026-03-05"), period("b", "2026-03-30", "2026-04-03")];
  const s = C.buildCycleSummary(list, 40, TODAY);
  assert.strictEqual(s.estimate.basis, "recorded");
  assert.strictEqual(s.estimate.cycleDaysUsed, 29);
});
test("four periods (28, 29, 29): average rounds 28.67 -> 29, estimate 28 Apr, range 27-28 Apr", () => {
  const s = C.buildCycleSummary(sample, null, TODAY);
  assert.strictEqual(s.periodCount, 4);
  assert.strictEqual(s.cycleCount, 3);
  assert.strictEqual(s.averageCycleDays, 29);
  assert.strictEqual(s.shortestCycleDays, 28);
  assert.strictEqual(s.longestCycleDays, 29);
  assert.strictEqual(s.estimate.date, "2026-04-28");
  assert.strictEqual(s.estimate.earliestDate, "2026-04-27");
  assert.strictEqual(s.estimate.latestDate, "2026-04-28");
});
test("most recent period and cycle use the LATEST start date, whatever order they were entered", () => {
  const s = C.buildCycleSummary(sample, null, TODAY);
  assert.deepStrictEqual(s.mostRecentPeriod, { startDate: "2026-03-30", endDate: "2026-04-03", durationDays: 5 });
  assert.strictEqual(s.mostRecentCycle.fromStartDate, "2026-03-01");
  assert.strictEqual(s.mostRecentCycle.toStartDate, "2026-03-30");
  assert.strictEqual(s.mostRecentCycle.lengthDays, 29);
});
test("rounding down: cycles 28, 28, 29 -> average 28.33 -> 28; estimate 27 Mar + 28 = 24 Apr; range 24-25 Apr", () => {
  const list = [
    period("a", "2026-01-01", "2026-01-05"), period("b", "2026-01-29", "2026-02-02"),
    period("c", "2026-02-26", "2026-03-02"), period("d", "2026-03-27", "2026-03-31")
  ];
  const s = C.buildCycleSummary(list, null, TODAY);
  assert.strictEqual(s.averageCycleDays, 28);
  assert.strictEqual(s.estimate.date, "2026-04-24");
  assert.strictEqual(s.estimate.earliestDate, "2026-04-24");
  assert.strictEqual(s.estimate.latestDate, "2026-04-25");
});
test("rounding .5 up: cycles 28 and 29 -> 28.5 -> 29", () => {
  const list = [period("a", "2026-01-01", "2026-01-05"), period("b", "2026-01-29", "2026-02-02"), period("c", "2026-02-27", "2026-03-03")];
  const s = C.buildCycleSummary(list, null, TODAY);
  assert.deepStrictEqual(s.cycles.map(c => c.lengthDays), [28, 29]);
  assert.strictEqual(s.averageCycleDays, 29);
});
test("identical cycles (28, 28): estimate 26 Mar, and NO range is shown", () => {
  const list = [period("a", "2026-01-01", "2026-01-05"), period("b", "2026-01-29", "2026-02-02"), period("c", "2026-02-26", "2026-03-02")];
  const s = C.buildCycleSummary(list, null, TODAY);
  assert.strictEqual(s.estimate.date, "2026-03-26");
  assert.strictEqual(s.estimate.earliestDate, null);
  assert.strictEqual(s.estimate.latestDate, null);
});
test("estimate that crosses a year end: starts 20 Nov and 18 Dec 2026 (28) -> 15 Jan 2027", () => {
  const list = [period("a", "2026-11-20", "2026-11-24"), period("b", "2026-12-18", "2026-12-22")];
  const s = C.buildCycleSummary(list, null, "2026-12-30");
  assert.strictEqual(s.averageCycleDays, 28);
  assert.strictEqual(s.estimate.date, "2027-01-15");
});
test("estimate that crosses a leap day: starts 1 Jan and 29 Jan 2028 (28) -> 26 Feb 2028", () => {
  const list = [period("a", "2028-01-01", "2028-01-05"), period("b", "2028-01-29", "2028-02-02")];
  const s = C.buildCycleSummary(list, null, "2028-02-10");
  assert.strictEqual(s.estimate.date, "2028-02-26");
  // and one more cycle after it would land on 25 Mar (Feb has 29 days in 2028)
  assert.strictEqual(C.addDaysToDate("2028-02-26", 28), "2028-03-25");
});
test("estimate in the past is flagged (hasPassed), a future one is not", () => {
  const list = [period("a", "2026-03-01", "2026-03-05"), period("b", "2026-03-30", "2026-04-03")];
  assert.strictEqual(C.buildCycleSummary(list, null, "2026-06-15").estimate.hasPassed, true);
  assert.strictEqual(C.buildCycleSummary(list, null, "2026-04-01").estimate.hasPassed, false);
  assert.strictEqual(C.buildCycleSummary(list, null, "2026-04-28").estimate.hasPassed, false); // the day itself is not "passed"
});
test("a very long gap (120 days) is flagged so the screen can warn about a missing record", () => {
  const list = [period("a", "2026-01-01", "2026-01-05"), period("b", "2026-05-01", "2026-05-05")];
  const s = C.buildCycleSummary(list, null, "2026-06-01");
  assert.strictEqual(s.cycles[0].lengthDays, 120);
  assert.strictEqual(s.hasLongGap, true);
  assert.strictEqual(C.buildCycleSummary(sample, null, TODAY).hasLongGap, false);
});


console.log("\nF. Validation of the period dates");

function check(start, end, startBad, endBad) {
  return C.validatePeriodDates(start, end, Boolean(startBad), Boolean(endBad), TODAY);
}

test("valid dates give no messages", () => {
  const r = check("2026-06-01", "2026-06-05");
  assert.strictEqual(r.startMessage, "");
  assert.strictEqual(r.endMessage, "");
});
test("empty fields are rejected", () => {
  const r = check("", "");
  assert.ok(r.startMessage.includes("start date") && r.endMessage.includes("end date"));
});
test("a fake date like 30 Feb is rejected", () => {
  assert.ok(check("2026-02-30", "2026-03-02").startMessage.includes("real date"));
});
test("29 Feb is accepted in a leap year, rejected otherwise", () => {
  assert.strictEqual(C.validatePeriodDates("2024-02-27", "2024-02-29", false, false, "2024-06-01").endMessage, "");
  assert.ok(C.validatePeriodDates("2023-02-27", "2023-02-29", false, false, "2023-06-01").endMessage.includes("real date"));
});
test("an unreadable date (browser could not parse it) is rejected", () => {
  assert.ok(check("", "2026-06-05", true, false).startMessage.includes("complete, real date"));
});
test("end date before start date is rejected", () => {
  const r = check("2026-06-05", "2026-06-01");
  assert.ok(r.endMessage.includes("earlier than the start date"));
  assert.strictEqual(r.startMessage, "");
});
test("future dates are rejected; today is accepted", () => {
  assert.ok(check("2026-06-20", "2026-06-22").startMessage.includes("future"));
  assert.ok(check("2026-06-10", "2026-06-20").endMessage.includes("future"));
  assert.strictEqual(check("2026-06-15", "2026-06-15").endMessage, "");
});
test("years before 2000 are rejected", () => {
  assert.ok(check("1999-12-31", "2000-01-02").startMessage.includes("2000"));
});
test("a period longer than 31 days is rejected, exactly 31 days is accepted", () => {
  assert.strictEqual(check("2026-05-01", "2026-05-31").endMessage, "");        // 31 days
  assert.ok(check("2026-05-01", "2026-06-05").endMessage.includes("31 days"));  // 36 days
});


console.log("\nG. Duplicate and overlapping records");

const recorded = [period("x1", "2026-05-01", "2026-05-05")];
function clashKind(start, end) {
  const clash = C.findClashWithRecordedPeriods(start, end, recorded);
  return clash === null ? null : clash.kind;
}

test("exactly the same dates -> duplicate", () => {
  assert.strictEqual(clashKind("2026-05-01", "2026-05-05"), "duplicate");
});
test("same start, different end -> same-start", () => {
  assert.strictEqual(clashKind("2026-05-01", "2026-05-08"), "same-start");
});
test("overlaps the end of an existing period", () => {
  assert.strictEqual(clashKind("2026-05-04", "2026-05-08"), "overlap");
});
test("overlaps the start of an existing period", () => {
  assert.strictEqual(clashKind("2026-04-28", "2026-05-02"), "overlap");
});
test("sits inside an existing period", () => {
  assert.strictEqual(clashKind("2026-05-02", "2026-05-03"), "overlap");
});
test("completely contains an existing period", () => {
  assert.strictEqual(clashKind("2026-04-25", "2026-05-10"), "overlap");
});
test("shares only one day (new period ends on the existing start day)", () => {
  assert.strictEqual(clashKind("2026-04-27", "2026-05-01"), "overlap");
});
test("shares only one day (new period starts on the existing end day)", () => {
  assert.strictEqual(clashKind("2026-05-05", "2026-05-08"), "overlap");
});
test("the day after an existing period ends is NOT an overlap", () => {
  assert.strictEqual(clashKind("2026-05-06", "2026-05-09"), null);
});
test("ending the day before an existing period starts is NOT an overlap", () => {
  assert.strictEqual(clashKind("2026-04-26", "2026-04-30"), null);
});
test("a clash across a month boundary is found: 30 Apr - 2 May overlaps 1-5 May", () => {
  assert.strictEqual(clashKind("2026-04-30", "2026-05-02"), "overlap");
});
test("with no records saved there is never a clash", () => {
  assert.strictEqual(C.findClashWithRecordedPeriods("2026-05-01", "2026-05-05", []), null);
});
test("clash messages are friendly sentences", () => {
  const clash = C.findClashWithRecordedPeriods("2026-05-04", "2026-05-08", recorded);
  const message = C.describeClash(clash);
  assert.ok(message.includes("overlap") && message.includes("2026"), message);
});


console.log("\nH. Typical cycle length (used when only one period is recorded)");

test("28 is accepted", () => {
  const r = C.validateTypicalCycleLength("28", false);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.days, 28);
});
test("limits 15 and 90 are accepted", () => {
  assert.strictEqual(C.validateTypicalCycleLength("15", false).valid, true);
  assert.strictEqual(C.validateTypicalCycleLength("90", false).valid, true);
});
test("14 and 91 are rejected with the allowed range explained", () => {
  assert.ok(C.validateTypicalCycleLength("14", false).message.includes("between 15 and 90"));
  assert.ok(C.validateTypicalCycleLength("91", false).message.includes("between 15 and 90"));
});
test("empty, text, decimals and unreadable input are rejected", () => {
  assert.strictEqual(C.validateTypicalCycleLength("", false).valid, false);
  assert.strictEqual(C.validateTypicalCycleLength("abc", false).valid, false);
  assert.strictEqual(C.validateTypicalCycleLength("28.5", false).valid, false);
  assert.strictEqual(C.validateTypicalCycleLength("-28", false).valid, false);
  assert.strictEqual(C.validateTypicalCycleLength("", true).valid, false);
});



console.log("\nI. History rows (chronological, cycle length only when a next period exists)");

test("rows are oldest first, with 5-day durations and cycle lengths 28, 29, 29, none", () => {
  const rows = C.buildHistoryRows(sample);
  assert.deepStrictEqual(rows.map(r => r.id), ["a", "b", "c", "d"]);
  assert.deepStrictEqual(rows.map(r => r.durationDays), [5, 5, 5, 5]);
  assert.deepStrictEqual(rows.map(r => r.cycleLengthDays), [28, 29, 29, null]);
});
test("a single period has no cycle length", () => {
  const rows = C.buildHistoryRows([period("a", "2026-03-01", "2026-03-05")]);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].cycleLengthDays, null);
});
test("no periods -> no rows", () => {
  assert.deepStrictEqual(C.buildHistoryRows([]), []);
});
test("a row's cycle length is the gap to the NEXT start, even across a year end and leap day", () => {
  const rows = C.buildHistoryRows([
    period("a", "2023-12-20", "2023-12-24"),   // -> 2024-01-17 = 28
    period("b", "2024-01-17", "2024-01-21"),   // -> 2024-03-01 = 44 (Jan 17 to Mar 1 in a leap year)
    period("c", "2024-03-01", "2024-03-03")
  ]);
  assert.deepStrictEqual(rows.map(r => r.cycleLengthDays), [28, 44, null]);
});


console.log("\nJ. Calendar grid, month navigation and day marking");

test("days in each month, including leap years and century years", () => {
  assert.strictEqual(C.getDaysInMonth(2024, 1), 29);   // Feb 2024 (leap)
  assert.strictEqual(C.getDaysInMonth(2023, 1), 28);   // Feb 2023
  assert.strictEqual(C.getDaysInMonth(2000, 1), 29);   // divisible by 400
  assert.strictEqual(C.getDaysInMonth(2100, 1), 28);   // century, not divisible by 400
  assert.strictEqual(C.getDaysInMonth(2026, 0), 31);
  assert.strictEqual(C.getDaysInMonth(2026, 3), 30);
  assert.strictEqual(C.getDaysInMonth(2025, 11), 31);
});
test("February 2024 (leap): 29 days, 1 Feb is a Thursday (column 5), 5 weeks", () => {
  const weeks = C.buildMonthGrid(2024, 1);
  const days = weeks.flat().filter(Boolean);
  assert.strictEqual(days.length, 29);
  assert.strictEqual(days[0], "2024-02-01");
  assert.strictEqual(days[28], "2024-02-29");
  assert.strictEqual(weeks[0].indexOf("2024-02-01"), 4);   // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4
  assert.strictEqual(weeks.length, 5);
  assert.ok(weeks.every(w => w.length === 7));
});
test("February 2023 (not leap): 28 days, 1 Feb is a Wednesday (column 4), no 29th", () => {
  const weeks = C.buildMonthGrid(2023, 1);
  const days = weeks.flat().filter(Boolean);
  assert.strictEqual(days.length, 28);
  assert.strictEqual(days[27], "2023-02-28");
  assert.strictEqual(weeks[0].indexOf("2023-02-01"), 3);
  assert.ok(!days.includes("2023-02-29"));
});
test("February 2026 starts on a Sunday and fills exactly 4 weeks", () => {
  const weeks = C.buildMonthGrid(2026, 1);
  assert.strictEqual(weeks.length, 4);
  assert.strictEqual(weeks[0][0], "2026-02-01");
  assert.strictEqual(weeks[3][6], "2026-02-28");
  assert.ok(weeks.flat().every(cell => cell !== null));
});
test("December 2025 starts on a Monday; January 2026 starts on a Thursday", () => {
  assert.strictEqual(C.buildMonthGrid(2025, 11)[0].indexOf("2025-12-01"), 1);
  assert.strictEqual(C.buildMonthGrid(2026, 0)[0].indexOf("2026-01-01"), 4);
  assert.strictEqual(C.buildMonthGrid(2025, 11).flat().filter(Boolean).length, 31);
});
test("March 2026 starts on a Sunday and has 31 days", () => {
  const weeks = C.buildMonthGrid(2026, 2);
  assert.strictEqual(weeks[0][0], "2026-03-01");
  assert.strictEqual(weeks.flat().filter(Boolean).length, 31);
});
test("every grid cell is a real date in the right month", () => {
  C.buildMonthGrid(2028, 1).flat().filter(Boolean).forEach(d => {
    assert.ok(C.isRealDate(d) && d.startsWith("2028-02-"), d);
  });
});
test("shiftMonth crosses December <-> January correctly", () => {
  assert.deepStrictEqual(C.shiftMonth(2025, 11, 1), { year: 2026, monthIndex: 0 });
  assert.deepStrictEqual(C.shiftMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
  assert.deepStrictEqual(C.shiftMonth(2026, 5, 1), { year: 2026, monthIndex: 6 });
  assert.deepStrictEqual(C.shiftMonth(2026, 0, -13), { year: 2024, monthIndex: 11 });
  assert.deepStrictEqual(C.shiftMonth(2024, 11, 14), { year: 2026, monthIndex: 1 });
});
test("month labels", () => {
  assert.strictEqual(C.getMonthLabel(2026, 2, "en-US"), "March 2026");
  assert.strictEqual(C.getMonthLabel(2024, 1, "en-US"), "February 2024");
  assert.strictEqual(C.getMonthLabel(2025, 11, "en-US"), "December 2025");
});

const calendarPeriods = [period("a", "2026-05-01", "2026-05-05")];
const calendarEstimate = { date: "2026-06-10", earliestDate: "2026-06-08", latestDate: "2026-06-11", hasPassed: false };
function mark(date, estimate, today) {
  return C.describeCalendarDay(date, calendarPeriods, estimate, today);
}

test("recorded days are marked; the first day is marked as a start", () => {
  assert.strictEqual(mark("2026-05-01", null, "2026-05-20").isPeriodStart, true);
  assert.strictEqual(mark("2026-05-01", null, "2026-05-20").isPeriodDay, true);
  assert.strictEqual(mark("2026-05-03", null, "2026-05-20").isPeriodDay, true);
  assert.strictEqual(mark("2026-05-03", null, "2026-05-20").isPeriodStart, false);
  assert.strictEqual(mark("2026-05-05", null, "2026-05-20").isPeriodDay, true);   // last day counts
  assert.strictEqual(mark("2026-05-06", null, "2026-05-20").isPeriodDay, false);
  assert.strictEqual(mark("2026-04-30", null, "2026-05-20").isPeriodDay, false);
});
test("today is marked separately from period days", () => {
  const r = mark("2026-05-03", null, "2026-05-03");
  assert.strictEqual(r.isToday, true);
  assert.strictEqual(r.isPeriodDay, true);
  assert.strictEqual(mark("2026-05-04", null, "2026-05-03").isToday, false);
});
test("estimated date and range are marked differently from recorded days", () => {
  assert.strictEqual(mark("2026-06-10", calendarEstimate, "2026-05-20").isEstimatedDate, true);
  assert.strictEqual(mark("2026-06-10", calendarEstimate, "2026-05-20").isPeriodDay, false);
  assert.strictEqual(mark("2026-06-08", calendarEstimate, "2026-05-20").isEstimatedRange, true);
  assert.strictEqual(mark("2026-06-09", calendarEstimate, "2026-05-20").isEstimatedRange, true);
  assert.strictEqual(mark("2026-06-11", calendarEstimate, "2026-05-20").isEstimatedRange, true);
  assert.strictEqual(mark("2026-06-12", calendarEstimate, "2026-05-20").isEstimatedRange, false);
  assert.strictEqual(mark("2026-06-07", calendarEstimate, "2026-05-20").isEstimatedRange, false);
});
test("an estimate with no range marks only the single date", () => {
  const single = { date: "2026-06-10", earliestDate: null, latestDate: null, hasPassed: false };
  assert.strictEqual(mark("2026-06-10", single, "2026-05-20").isEstimatedDate, true);
  assert.strictEqual(mark("2026-06-09", single, "2026-05-20").isEstimatedRange, false);
});
test("estimated days before today are not marked", () => {
  // today is 9 June: the range day 8 June is behind us, 9 June and 10 June still count
  assert.strictEqual(mark("2026-06-08", calendarEstimate, "2026-06-09").isEstimatedRange, false);
  assert.strictEqual(mark("2026-06-09", calendarEstimate, "2026-06-09").isEstimatedRange, true);
  assert.strictEqual(mark("2026-06-10", calendarEstimate, "2026-06-09").isEstimatedDate, true);
});
test("an estimate that has already passed is not marked at all", () => {
  const passed = { date: "2026-04-28", earliestDate: null, latestDate: null, hasPassed: true };
  assert.strictEqual(mark("2026-04-28", passed, "2026-06-15").isEstimatedDate, false);
});
test("no estimate -> nothing estimated", () => {
  assert.strictEqual(mark("2026-06-10", null, "2026-05-20").isEstimatedDate, false);
});


console.log("\nK. Editing: the record being edited is ignored by the clash check");

const twoRecords = [period("x1", "2026-05-01", "2026-05-05"), period("x2", "2026-05-10", "2026-05-14")];
function editClash(id, start, end) {
  const clash = C.findClashWithRecordedPeriods(start, end, twoRecords, id);
  return clash === null ? null : clash.kind;
}

test("saving a record with unchanged dates is NOT a duplicate of itself", () => {
  assert.strictEqual(editClash("x1", "2026-05-01", "2026-05-05"), null);
});
test("without ignoring it, the same dates ARE a duplicate (adding, not editing)", () => {
  assert.strictEqual(editClash(undefined, "2026-05-01", "2026-05-05"), "duplicate");
  assert.strictEqual(editClash(null, "2026-05-01", "2026-05-05"), "duplicate");
});
test("editing may lengthen, shorten or move a record into free days", () => {
  assert.strictEqual(editClash("x1", "2026-05-01", "2026-05-08"), null);
  assert.strictEqual(editClash("x1", "2026-05-02", "2026-05-03"), null);
  assert.strictEqual(editClash("x1", "2026-04-20", "2026-04-24"), null);
});
test("editing into another record's days is still rejected", () => {
  assert.strictEqual(editClash("x1", "2026-05-08", "2026-05-12"), "overlap");
  assert.strictEqual(editClash("x1", "2026-05-14", "2026-05-16"), "overlap");
});
test("editing a record to exactly match ANOTHER record is a duplicate", () => {
  assert.strictEqual(editClash("x2", "2026-05-01", "2026-05-05"), "duplicate");
});
test("editing a record to share another's start date is rejected", () => {
  assert.strictEqual(editClash("x2", "2026-05-01", "2026-05-12"), "same-start");
});


console.log("\nL. Checking saved data before using it (sanitizeStoredData)");

test("good data is accepted, sorted by date and given fresh ids", () => {
  const r = C.sanitizeStoredData({
    version: 1,
    periods: [{ startDate: "2026-03-30", endDate: "2026-04-03" }, { startDate: "2026-03-01", endDate: "2026-03-05" }],
    typicalCycleDays: 28
  });
  assert.strictEqual(r.wasUnreadable, false);
  assert.strictEqual(r.droppedCount, 0);
  assert.strictEqual(r.typicalCycleDays, 28);
  assert.deepStrictEqual(r.periods, [
    { id: 1, startDate: "2026-03-01", endDate: "2026-03-05" },
    { id: 2, startDate: "2026-03-30", endDate: "2026-04-03" }
  ]);
});
test("data in the wrong shape is reported as unreadable (never throws)", () => {
  [null, undefined, "hello", 42, [], {}, { version: 2, periods: [] }, { version: 1 }, { version: 1, periods: "x" }, { version: 1, periods: {} }]
    .forEach(bad => assert.strictEqual(C.sanitizeStoredData(bad).wasUnreadable, true, JSON.stringify(bad)));
});
test("invalid records are skipped and counted; valid ones survive", () => {
  const r = C.sanitizeStoredData({ version: 1, periods: [
    null, 5, "text",
    { startDate: "2026-02-30", endDate: "2026-03-02" },   // fake date
    { startDate: "2026-03-05", endDate: "2026-03-01" },   // end before start
    { startDate: "1999-01-01", endDate: "1999-01-03" },   // before 2000
    { startDate: "2026-01-01" },                          // missing end
    { startDate: "<script>alert(1)</script>", endDate: "2026-01-05" },
    { startDate: "2026-01-01", endDate: "2026-03-01" },   // 60 days long
    { startDate: "2026-06-01", endDate: "2026-06-05" }    // fine
  ] });
  assert.strictEqual(r.periods.length, 1);
  assert.strictEqual(r.droppedCount, 9);
  assert.strictEqual(r.wasUnreadable, false);
});
test("duplicate and overlapping saved records are dropped so calculations stay safe", () => {
  const r = C.sanitizeStoredData({ version: 1, periods: [
    { startDate: "2026-03-01", endDate: "2026-03-05" },
    { startDate: "2026-03-03", endDate: "2026-03-08" },   // overlaps the first
    { startDate: "2026-03-01", endDate: "2026-03-05" },   // duplicate
    { startDate: "2026-03-10", endDate: "2026-03-12" }
  ] });
  assert.deepStrictEqual(r.periods.map(p => p.startDate), ["2026-03-01", "2026-03-10"]);
  assert.strictEqual(r.droppedCount, 2);
});
test("extra fields (such as notes) are not carried over", () => {
  const r = C.sanitizeStoredData({ version: 1, periods: [{ startDate: "2026-03-01", endDate: "2026-03-05", notes: "private" }] });
  assert.deepStrictEqual(Object.keys(r.periods[0]).sort(), ["endDate", "id", "startDate"]);
});
test("a bad typical cycle length is ignored", () => {
  [5, "28", 28.5, 200, null, true, {}].forEach(bad => {
    const r = C.sanitizeStoredData({ version: 1, periods: [], typicalCycleDays: bad });
    assert.strictEqual(r.typicalCycleDays, null, String(bad));
  });
});
test("an enormous list is capped instead of freezing the page", () => {
  const junk = new Array(1005).fill({ startDate: "nope", endDate: "nope" });
  const r = C.sanitizeStoredData({ version: 1, periods: junk });
  assert.strictEqual(r.periods.length, 0);
  assert.strictEqual(r.droppedCount, 1005);
});

console.log("\n" + passed + " passed, " + failed + " failed");
if (failed > 0) {
  process.exitCode = 1;
}