// Run from the project folder (after installing jsdom) with:   node test-page.js
// It opens your real index.html in a simulated browser and clicks through the app.
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");
const root = __dirname + path.sep;
let fails = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fails++; };
const baseHtml = fs.readFileSync(root + "index.html", "utf8").replace(/<script src[^>]*><\/script>/g, "");
const KEY = "periodpal.records.v1";

// "Open the website". `preload` = what the browser's local storage already holds (a refresh keeps it).
function boot(preload, tweak) {
  const dom = new JSDOM(baseHtml, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  const w = dom.window;
  Object.entries(preload || {}).forEach(([k, v]) => w.localStorage.setItem(k, v));
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {} }));
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.__confirmAnswer = true; w.__confirmMessages = [];
  w.confirm = (m) => { w.__confirmMessages.push(m); return w.__confirmAnswer; };
  if (tweak) tweak(w);
  let error = null;
  try { ["cycle-calculation.js", "storage.js", "script.js"].forEach(f => w.eval(fs.readFileSync(root + f, "utf8"))); }
  catch (e) { error = e; }
  w.__bootError = error;
  return w;
}
const stored = w => ({ [KEY]: w.localStorage.getItem(KEY) });
const hasStored = w => w.localStorage.getItem(KEY) !== null;
const $ = (w, id) => w.document.getElementById(id);
const rows = w => [...w.document.querySelectorAll("#history-body tr")];
const rowText = (w, i) => [...rows(w)[i].querySelectorAll("td")].slice(0, 4).map(td => td.textContent.replace("Editing", "").trim());
const day = (w, n) => w.PeriodCalc.addDaysToDate(w.PeriodCalc.getTodayAsText(), n);
const submit = (w, s, e) => { $(w, "start-date").value = s; $(w, "end-date").value = e; $(w, "period-form").dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); };
const cells = w => [...w.document.querySelectorAll("#calendar-body td")].filter(td => !td.classList.contains("is-empty"));
const marked = (w, cls) => cells(w).filter(td => td.classList.contains(cls));
const dayNum = td => td.children[0].textContent;
function gotoMonth(w, year, monthIndex) {
  $(w, "calendar-today").click();
  const t = w.PeriodCalc.getTodayAsText();
  const diff = (year - Number(t.slice(0, 4))) * 12 + (monthIndex - (Number(t.slice(5, 7)) - 1));
  for (let i = 0; i < Math.abs(diff); i++) $(w, diff < 0 ? "calendar-prev" : "calendar-next").click();
}
const monthLabel = w => $(w, "calendar-month-label").textContent;
const daysInRangeInMonth = (w, start, end, ym) => { let n = 0; for (let d = start; d <= end; d = w.PeriodCalc.addDaysToDate(d, 1)) if (d.startsWith(ym)) n++; return n; };

(function main() {
  console.log("Start-up");
  let w = boot();
  ok(w.__bootError === null, "page starts without errors");
  ok($(w, "history-empty").hidden === false && $(w, "history-table").hidden === true, "friendly 'no records' message shown");
  ok($(w, "storage-notice").textContent === "", "no storage warning when storage works");
  ok(cells(w).length >= 28 && marked(w, "is-today").length === 1, "calendar draws the current month with today highlighted once");

  console.log("\n1. Add a period -> calendar + history");
  const A1 = day(w, -45), A2 = day(w, -41), B1 = day(w, -16), B2 = day(w, -12);
  submit(w, A1, A2);
  ok(rows(w).length === 1, "history shows 1 row");
  ok(rowText(w, 0)[2] === "5" && rowText(w, 0)[3] === "Not available yet", "row: 5 bleeding days, cycle length 'Not available yet'");
  const ymA = A1.slice(0, 7);
  ok(monthLabel(w) === w.PeriodCalc.getMonthLabel(+A1.slice(0, 4), +A1.slice(5, 7) - 1), "calendar jumped to the saved period's month");
  ok(marked(w, "is-period-start").length + marked(w, "is-period").length === daysInRangeInMonth(w, A1, A2, ymA), "calendar marks exactly the period's days in that month");
  ok(marked(w, "is-period-start").length === 1 && dayNum(marked(w, "is-period-start")[0]) === String(Number(A1.slice(8))), "first day marked as the start");
  ok($(w, "stat-duration-value").textContent === "5 days", "dashboard updated");
  ok($(w, "form-success").textContent.includes("Success: period recorded."), "success message shown");
  ok($(w, "form-success").textContent.includes("saved in this browser"), "message says records are saved in the browser");
  const raw = JSON.parse(w.localStorage.getItem(KEY));
  ok(raw.version === 1 && raw.periods.length === 1 && Object.keys(raw.periods[0]).sort().join() === "endDate,startDate", "storage holds only start and end dates");
  $(w, "period-notes").value = "secret note"; submit(w, B1, B2);
  ok(!w.localStorage.getItem(KEY).includes("secret"), "notes are never stored");
  ok(rows(w).length === 2 && rowText(w, 0)[3] === "29 days" && rowText(w, 1)[3] === "Not available yet", "2 rows, oldest first; cycle length 29 shown only on the first");
  ok($(w, "stat-average-value").textContent === "About 29 days", "average cycle 29");

  console.log("\n2. Refresh -> records remain");
  const pre = stored(w);
  w = boot(pre);
  ok(w.__bootError === null && rows(w).length === 2, "after refresh: 2 records still in history");
  ok(rowText(w, 0)[3] === "29 days", "after refresh: cycle length recalculated");
  ok($(w, "stat-average-value").textContent === "About 29 days" && $(w, "stat-next-value").textContent.startsWith("Around"), "after refresh: dashboard and estimate restored");
  ok($(w, "storage-notice").textContent === "", "no warning after a normal reload");

  console.log("\n3. Edit a period");
  rows(w)[0].querySelectorAll("button")[0].click();
  ok($(w, "start-date").value === A1 && $(w, "end-date").value === A2, "form is filled with the existing dates");
  ok($(w, "track-heading").textContent === "Edit Your Period" && $(w, "save-period-button").textContent === "Save Changes" && $(w, "cancel-edit-button").hidden === false, "form switches to edit mode");
  ok(rows(w)[0].classList.contains("is-editing") && rows(w)[0].textContent.includes("Editing"), "row being edited is highlighted with a text tag");
  ok($(w, "editing-notice").textContent.includes("You are editing"), "editing notice shown");
  const A1new = day(w, -46);
  submit(w, A1new, A2);
  ok($(w, "start-date-error").textContent === "", "saving an edit does not clash with the record itself");
  ok(rows(w).length === 2, "edit did not create a duplicate (still 2 records)");
  ok(rowText(w, 0)[2] === "6" && rowText(w, 0)[3] === "30 days", "history: now 6 bleeding days, 30-day cycle");
  ok($(w, "stat-average-value").textContent === "About 30 days", "dashboard average recalculated to 30");
  const newEst = day(w, -16 + 30);
  ok($(w, "stat-next-value").textContent === "Around " + w.PeriodCalc.formatDateForDisplay(newEst), "estimated next start recalculated (last start + 30)");
  ok($(w, "form-success").textContent.includes("your changes were saved"), "edit success message");
  ok($(w, "track-heading").textContent === "Record Your Period" && $(w, "cancel-edit-button").hidden === true && $(w, "start-date").value === "", "form returns to add mode and empties");
  gotoMonth(w, +newEst.slice(0, 4), +newEst.slice(5, 7) - 1);
  const est = marked(w, "is-estimated-date");
  ok(est.length === 1 && dayNum(est[0]) === String(Number(newEst.slice(8))), "calendar marks the new estimated date (dashed, not a recorded colour)");
  ok(est[0].textContent.includes("not guaranteed"), "estimated day is described as an estimate for screen readers");
  gotoMonth(w, +A1new.slice(0, 4), +A1new.slice(5, 7) - 1);
  ok(marked(w, "is-period-start").some(td => dayNum(td) === String(Number(A1new.slice(8)))), "calendar shows the edited start day");
  ok(JSON.parse(w.localStorage.getItem(KEY)).periods[0].startDate === A1new, "edit saved to storage");
  w = boot(stored(w));
  ok(rowText(w, 0)[2] === "6", "edit survives a refresh");

  // edit edge cases
  rows(w)[1].querySelectorAll("button")[0].click(); submit(w, B1, B2);
  ok($(w, "start-date-error").textContent === "" && rows(w).length === 2, "saving an UNCHANGED edit is accepted, not a duplicate");
  rows(w)[1].querySelectorAll("button")[0].click(); submit(w, A1new, A2);
  ok($(w, "start-date-error").textContent.includes("already recorded"), "editing a record to match another is rejected as a duplicate");
  ok(rowText(w, 1)[0] === w.PeriodCalc.formatDateForDisplay(B1) && $(w, "cancel-edit-button").hidden === false, "rejected edit leaves the record unchanged and stays in edit mode");
  submit(w, day(w, -44), day(w, -40));
  ok($(w, "start-date-error").textContent.includes("overlap"), "editing into another record's days is rejected as an overlap");
  $(w, "cancel-edit-button").click();
  ok($(w, "track-heading").textContent === "Record Your Period" && $(w, "start-date").value === "" && rows(w).length === 2, "Cancel leaves edit mode without changing anything");
  ok($(w, "history-status").textContent.includes("cancelled"), "cancel is confirmed in words");

  console.log("\n4. Delete a period");
  w.__confirmAnswer = false;
  rows(w)[0].querySelectorAll("button")[1].click();
  ok(rows(w).length === 2 && w.__confirmMessages.length === 1 && w.__confirmMessages[0].includes("Delete the period"), "delete asks for confirmation; 'Cancel' keeps the record");
  w.__confirmAnswer = true;
  rows(w)[0].querySelectorAll("button")[1].click();
  ok(rows(w).length === 1, "after confirming, the record disappears from history");
  gotoMonth(w, +A1new.slice(0, 4), +A1new.slice(5, 7) - 1);
  ok(marked(w, "is-period-start").length + marked(w, "is-period").length === daysInRangeInMonth(w, B1, B2, A1new.slice(0, 7)), "deleted period's days are gone from the calendar (only the remaining record's days stay)");
  ok($(w, "stat-average-value").textContent === "Not enough data yet" && $(w, "typical-cycle-form").hidden === false, "statistics recalculated with one record left");
  ok($(w, "history-status").textContent.includes("Deleted"), "deletion is confirmed in words");
  ok(JSON.parse(w.localStorage.getItem(KEY)).periods.length === 1, "deletion saved to storage");
  rows(w)[0].querySelectorAll("button")[1].click();
  ok(rows(w).length === 0 && $(w, "history-empty").hidden === false, "deleting the last record shows the friendly empty message");
  ok(!hasStored(w), "nothing left to store -> storage key removed");
  ok($(w, "stat-latest-value").textContent === "Not yet available", "dashboard back to its empty state");

  console.log("\n5. Invalid, duplicate and overlapping records");
  w = boot();
  submit(w, "", ""); ok($(w, "start-date-error").textContent !== "" && $(w, "end-date-error").textContent !== "", "empty fields rejected");
  submit(w, day(w, -10), day(w, -14)); ok($(w, "end-date-error").textContent.includes("earlier than the start"), "end before start rejected");
  submit(w, day(w, 2), day(w, 4)); ok($(w, "start-date-error").textContent.includes("future"), "future dates rejected");
  submit(w, "1999-01-01", "1999-01-03"); ok($(w, "start-date-error").textContent.includes("2000"), "year before 2000 rejected");
  submit(w, day(w, -60), day(w, -10)); ok($(w, "end-date-error").textContent.includes("31 days"), "a 51-day 'period' rejected as a likely typo");
  ok(rows(w).length === 0 && !hasStored(w), "none of the invalid entries were recorded or saved");
  submit(w, day(w, -20), day(w, -16));
  submit(w, day(w, -20), day(w, -16)); ok($(w, "start-date-error").textContent.includes("already recorded"), "exact duplicate rejected");
  submit(w, day(w, -20), day(w, -12)); ok($(w, "start-date-error").textContent.includes("already recorded"), "same start date rejected");
  submit(w, day(w, -18), day(w, -14)); ok($(w, "start-date-error").textContent.includes("overlap"), "overlap rejected");
  submit(w, day(w, -16), day(w, -13)); ok($(w, "start-date-error").textContent.includes("overlap"), "sharing only the last day is an overlap");
  ok(rows(w).length === 1, "still exactly 1 record after all the rejected entries");
  ok($(w, "form-error-summary").textContent.includes("Please fix"), "error summary shown");

  console.log("\n6. December / January navigation");
  w = boot();
  gotoMonth(w, 2025, 11);
  ok(monthLabel(w) === w.PeriodCalc.getMonthLabel(2025, 11), "reached December 2025: '" + monthLabel(w) + "'");
  ok(cells(w).length === 31 && cells(w)[0].parentElement.children[1] === cells(w)[0], "December 2025: 31 days, 1st falls on Monday (column 2)");
  $(w, "calendar-next").click();
  ok(monthLabel(w) === w.PeriodCalc.getMonthLabel(2026, 0), "Next from December -> January 2026: '" + monthLabel(w) + "'");
  ok(cells(w).length === 31 && cells(w)[0].parentElement.children[4] === cells(w)[0], "January 2026: 31 days, 1st falls on Thursday (column 5)");
  $(w, "calendar-prev").click();
  ok(monthLabel(w) === w.PeriodCalc.getMonthLabel(2025, 11), "Previous from January -> December 2025 again");
  gotoMonth(w, 2001, 0);
  $(w, "calendar-prev").click();
  ok(monthLabel(w) === w.PeriodCalc.getMonthLabel(2000, 11), "Previous from Jan 2001 -> Dec 2000");
  ok(true, "(limits) " + ((() => { gotoMonth(w, 2000, 0); return $(w, "calendar-prev").disabled; })() ? "Previous is disabled at January 2000" : "NOT DISABLED"));
  gotoMonth(w, 2000, 0); ok($(w, "calendar-prev").disabled === true, "Previous button disabled at the first supported month");

  console.log("\n7. February: leap year and non-leap year");
  gotoMonth(w, 2024, 1);
  ok(cells(w).length === 29 && dayNum(cells(w)[28]) === "29", "February 2024: 29 days");
  ok(cells(w)[0].parentElement.children[4] === cells(w)[0], "February 2024: 1st is a Thursday");
  gotoMonth(w, 2023, 1);
  ok(cells(w).length === 28 && dayNum(cells(w)[27]) === "28", "February 2023: 28 days");
  gotoMonth(w, 2026, 1);
  ok(cells(w).length === 28 && [...w.document.querySelectorAll("#calendar-body tr")].length === 4, "February 2026 fits exactly 4 weeks");
  submit(w, "2024-02-27", "2024-03-01");
  ok(rowText(w, 0)[2] === "4", "27 Feb to 1 Mar 2024 (leap year) = 4 bleeding days");
  ok(monthLabel(w) === w.PeriodCalc.getMonthLabel(2024, 1) && marked(w, "is-period-start").length + marked(w, "is-period").length === 3, "calendar marks 27, 28 and 29 Feb");
  $(w, "calendar-next").click();
  ok(marked(w, "is-period").length === 1 && dayNum(marked(w, "is-period")[0]) === "1", "the period continues onto 1 March");
  submit(w, "2023-02-27", "2023-03-01");
  ok(rowText(w, 0)[2] === "3", "27 Feb to 1 Mar 2023 (non-leap year) = 3 bleeding days");
  ok(rowText(w, 0)[3] === "Not available yet" || rowText(w, 0)[3].endsWith("days"), "history sorted: 2023 record first");
  ok(rowText(w, 0)[3] === "365 days", "cycle 27 Feb 2023 -> 27 Feb 2024 = 365 days (the leap day comes after 27 Feb) (shown: " + rowText(w, 0)[3] + ")");

  console.log("\n8. Clear all data");
  w = boot();
  submit(w, day(w, -45), day(w, -41)); submit(w, day(w, -16), day(w, -12));
  $(w, "typical-cycle-length").value = "";
  w.__confirmAnswer = false; $(w, "clear-all-button").click();
  ok(rows(w).length === 2 && hasStored(w), "'Cancel' in the confirmation keeps everything");
  ok(w.__confirmMessages[0].includes("can't be undone") && w.__confirmMessages[0].includes("other browsers"), "confirmation explains it can't be undone and is per-browser");
  w.__confirmAnswer = true; $(w, "clear-all-button").click();
  ok(rows(w).length === 0 && $(w, "history-empty").hidden === false, "records removed from history");
  ok(!hasStored(w), "storage key removed");
  ok($(w, "data-status").textContent.includes("cleared"), "clear is confirmed in words");
  ok($(w, "stat-latest-value").textContent === "Not yet available" && marked(w, "is-period").length + marked(w, "is-period-start").length === 0, "dashboard and calendar are empty");
  w = boot(stored(w));
  ok(rows(w).length === 0, "after refresh: records are still gone");
  $(w, "clear-all-button").click();
  ok($(w, "data-status").textContent.includes("no saved data"), "clearing when empty gives a friendly message, no confirmation");
  ok(/not encrypted/i.test($(w, "data-controls") ? "" : w.document.querySelector(".data-controls").textContent) && /erase/i.test(w.document.querySelector(".data-controls").textContent), "page explains local storage is not encrypted and clearing browser data can erase records");

  console.log("\nTyped cycle length (Stage 2 feature) survives a refresh");
  w = boot(); submit(w, day(w, -20), day(w, -16));
  $(w, "typical-cycle-length").value = "28"; $(w, "typical-cycle-form").dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true }));
  ok($(w, "stat-next-value").textContent.startsWith("Around"), "estimate from typical length shown");
  w = boot(stored(w));
  ok($(w, "typical-cycle-length").value === "28" && $(w, "stat-next-value").textContent.startsWith("Around"), "typical length restored after refresh");

  console.log("\nDamaged, blocked and full storage");
  w = boot({ [KEY]: "{this is not json" });
  ok(w.__bootError === null && rows(w).length === 0 && $(w, "storage-notice").textContent.includes("couldn't be read"), "corrupted text: no crash, friendly notice, empty list");
  submit(w, day(w, -20), day(w, -16));
  ok(rows(w).length === 1 && $(w, "storage-notice").textContent === "" && JSON.parse(w.localStorage.getItem(KEY)).periods.length === 1, "next save replaces the damaged data and clears the notice");
  w = boot({ [KEY]: JSON.stringify({ version: 1, periods: [{ startDate: "2026-03-01", endDate: "2026-03-05" }, { startDate: "bad", endDate: "x" }, { startDate: "2026-03-03", endDate: "2026-03-09" }] }) });
  ok(w.__bootError === null && rows(w).length === 1 && $(w, "storage-notice").textContent.includes("2 saved records"), "partly bad data: good record kept, 2 skipped, notice shown");
  w = boot({ [KEY]: "null" }); ok(w.__bootError === null && rows(w).length === 0, "'null' in storage: no crash");
  w = boot({ [KEY]: JSON.stringify({ version: 1, periods: [{ startDate: "<img src=x onerror=alert(1)>", endDate: "2026-01-01" }] }) });
  ok(w.__bootError === null && rows(w).length === 0 && w.document.querySelectorAll("img").length === 0, "HTML in saved data is ignored, not run");

  w = boot({}, win => { win.Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
  ok(w.__bootError === null && $(w, "storage-notice").textContent.includes("isn't letting PeriodPal save"), "blocked storage: friendly message at start-up");
  submit(w, day(w, -20), day(w, -16)); submit(w, day(w, -45), day(w, -41));
  ok(rows(w).length === 2 && $(w, "stat-average-value").textContent !== "Not enough data yet", "blocked storage: app still works for this visit");
  ok($(w, "form-success").textContent.includes("isn't saving data right now"), "success message is honest that nothing is being saved");
  $(w, "clear-all-button").click();
  ok(rows(w).length === 0, "Clear All still works when storage is blocked");

  w = boot(); submit(w, day(w, -20), day(w, -16));
  w.Storage.prototype.setItem = () => { throw new Error("quota"); };
  submit(w, day(w, -45), day(w, -41));
  ok(rows(w).length === 2 && $(w, "storage-notice").textContent.includes("couldn't save your latest change"), "storage fills up later: record still shown, warning displayed");
  ok($(w, "form-success").textContent.includes("isn't saving data right now"), "success message does not claim it was saved");

  console.log("\nStage 1 and 2 features still work");
  w = boot(); $(w, "menu-toggle").click();
  ok($(w, "menu-toggle").getAttribute("aria-expanded") === "true", "mobile menu opens");
  ok($(w, "current-year").textContent === String(new Date().getFullYear()), "footer year");
  submit(w, day(w, -20), day(w, -16));
  ok($(w, "stat-next-detail").textContent.includes("typical cycle length") && $(w, "typical-cycle-form").hidden === false, "one period: asks for typical length");
  const ids = new Set([...w.document.querySelectorAll("[id]")].map(e => e.id));
  ok([...w.document.querySelectorAll('a[href^="#"]')].every(a => ids.has(a.getAttribute("href").slice(1))), "every # link points to a real section");
  ok([...w.document.querySelectorAll("input, textarea")].every(i => w.document.querySelector('label[for="' + i.id + '"]')), "every field has a visible label");
  ok(w.document.querySelectorAll("h1").length === 1, "one h1");
  ok(["Estimated next period start"].every(t => w.document.body.textContent.includes(t)) && w.document.body.textContent.includes("not a guaranteed date") || w.document.body.textContent.includes("not guaranteed"), "estimates are labelled as estimates");


  console.log("\nCode rules");
  const read = f => fs.readFileSync(root + f, "utf8");
  ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(read("script.js") + read("cycle-calculation.js")), "only storage.js touches browser storage");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\beval\(|\.innerHTML/.test(read("script.js") + read("cycle-calculation.js") + read("storage.js")), "no network calls, no innerHTML, no eval");
  ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(read("style.css")), "CSS makes the hidden attribute always win (checked in the CSS text only; jsdom cannot verify real rendering)");
  ok(!/https?:\/\//.test(read("index.html").replace(/http:\/\/www\.w3\.org[^"]*/g, "")) && !/@import|url\(/.test(read("style.css")), "nothing loaded from outside");

  console.log(fails ? "\n" + fails + " FAILED" : "\nAll Stage 3 page checks passed");
  process.exit(fails ? 1 : 0);
})();