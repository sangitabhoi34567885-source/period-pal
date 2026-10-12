/*
  script.js — PeriodPal, Stage 3

  What this file does:
    1. Turns on the mobile menu
    2. Writes the current year in the footer
    3. Finds the parts of the page it needs
    4. Loads saved records and keeps them in memory (and saves them again on every change)
    5. Shows and clears form messages
    6. Fills in the dashboard cards (average cycle, next estimate, ...)
    7. Draws the monthly calendar
    8. Draws the period history, and handles Delete
    9. Handles the period form: add a record, or edit one
   10. Handles the optional "typical cycle length" form
   11. Handles the "Clear All Data" button

  The date maths lives in cycle-calculation.js and the browser saving lives in
  storage.js. Both are loaded before this file.

  The pattern used throughout:  change the list of records -> save it ->
  redraw everything from the list (renderEverything). Because every screen is
  redrawn from the same list, the dashboard, calendar and history always agree.
*/
"use strict";

// This class tells the CSS "JavaScript is working, so you may use the dropdown menu".
// If JavaScript fails, the full menu simply stays visible instead of being hidden.
document.body.classList.add("js-enabled");


/* =====================================================
   1. MOBILE MENU
   ===================================================== */
const menuToggleButton = document.getElementById("menu-toggle");
const menuToggleLabel = document.getElementById("menu-toggle-label");
const siteNavigation = document.getElementById("site-nav");
const desktopWidthQuery = window.matchMedia("(min-width: 769px)");

// Open or close the menu, and tell screen readers what happened (aria-expanded).
function setMenuOpen(shouldBeOpen) {
  siteNavigation.classList.toggle("is-open", shouldBeOpen);
  menuToggleButton.setAttribute("aria-expanded", String(shouldBeOpen));
  menuToggleLabel.textContent = shouldBeOpen ? "Close" : "Menu";
}

menuToggleButton.addEventListener("click", function () {
  const isOpenNow = menuToggleButton.getAttribute("aria-expanded") === "true";
  setMenuOpen(!isOpenNow);
});

// Choosing a link closes the menu so it doesn't cover the page.
siteNavigation.addEventListener("click", function (event) {
  if (event.target.closest("a")) {
    setMenuOpen(false);
  }
});

// Pressing Escape closes the menu and returns focus to the button.
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape" && menuToggleButton.getAttribute("aria-expanded") === "true") {
    setMenuOpen(false);
    menuToggleButton.focus();
  }
});

// If the window grows to desktop size, reset the menu.
desktopWidthQuery.addEventListener("change", function (event) {
  if (event.matches) {
    setMenuOpen(false);
  }
});


/* =====================================================
   2. FOOTER YEAR
   ===================================================== */
document.getElementById("current-year").textContent = new Date().getFullYear();


/* =====================================================
   3. FINDING THE PARTS OF THE PAGE
   ===================================================== */

// cycle-calculation.js (loaded before this file) shares its tools as window.PeriodCalc.
const Calc = window.PeriodCalc;

function byId(id) {
  return document.getElementById(id);
}

// The period form
const periodForm = byId("period-form");
const startDateInput = byId("start-date");
const endDateInput = byId("end-date");
const notesInput = byId("period-notes");
const startDateError = byId("start-date-error");
const endDateError = byId("end-date-error");
const errorSummary = byId("form-error-summary");
const successMessage = byId("form-success");

// The dashboard cards
const latestValue = byId("stat-latest-value");
const latestDetail = byId("stat-latest-detail");
const durationValue = byId("stat-duration-value");
const durationDetail = byId("stat-duration-detail");
const averageValue = byId("stat-average-value");
const averageDetail = byId("stat-average-detail");
const nextValue = byId("stat-next-value");
const nextDetail = byId("stat-next-detail");

// The optional "typical cycle length" form (inside the estimate card)
const typicalCycleForm = byId("typical-cycle-form");
const typicalCycleInput = byId("typical-cycle-length");
const typicalCycleError = byId("typical-cycle-error");
const typicalCycleStatus = byId("typical-cycle-status");

// Saving, editing, calendar and history
const Store = window.PeriodStore;
const storageNotice = byId("storage-notice");
const editingNotice = byId("editing-notice");
const formHeading = byId("track-heading");
const savePeriodButton = byId("save-period-button");
const cancelEditButton = byId("cancel-edit-button");
const calendarMonthLabel = byId("calendar-month-label");
const calendarCaption = byId("calendar-caption");
const calendarBody = byId("calendar-body");
const calendarPrevButton = byId("calendar-prev");
const calendarNextButton = byId("calendar-next");
const calendarTodayButton = byId("calendar-today");
const historyStatus = byId("history-status");
const historyEmpty = byId("history-empty");
const historyTable = byId("history-table");
const historyBody = byId("history-body");
const clearAllButton = byId("clear-all-button");
const dataStatus = byId("data-status");

// "Start Tracking" and "Track My Period" scroll to the form (the link does that),
// and we also place the cursor in the first field.
document.querySelectorAll("[data-focus-form]").forEach(function (link) {
  link.addEventListener("click", function () {
    startDateInput.focus({ preventScroll: true });
  });
});


/* =====================================================
   4. SAVED RECORDS AND MEMORY
   On start-up we ask storage.js for whatever was saved earlier. It checks the
   data and hands back a clean list. From then on the list lives in
   "recordedPeriods", and persistChanges() copies it back into the browser's
   local storage after every add, edit or delete.
   ===================================================== */
const browserStorage = Store.getBrowserStorage();      // null when the browser won't allow storage
const savedData = Store.loadSavedData(browserStorage);

const recordedPeriods = savedData.periods;             // each item: { id, startDate, endDate }
let typicalCycleDays = savedData.typicalCycleDays;     // the optional number, or null
let nextPeriodId = recordedPeriods.reduce(function (highest, period) {
  return Math.max(highest, period.id);
}, 0) + 1;
let editingPeriodId = null;                            // id of the record being edited, or null
let lastSaveFailed = false;
let startupNotice = "";

if (savedData.status === "unreadable") {
  startupNotice = "Your previously saved data couldn't be read, so PeriodPal started with an empty list. " +
                  "Anything you record from now on will replace it.";
} else if (savedData.droppedCount > 0) {
  startupNotice = plural(savedData.droppedCount, "saved record") + " could not be used (invalid or overlapping dates) and " +
                  (savedData.droppedCount === 1 ? "was" : "were") + " skipped.";
}

const STORAGE_UNAVAILABLE_TEXT = "Your browser isn't letting PeriodPal save data (this can happen in private browsing or when storage " +
  "is blocked). You can still use PeriodPal, but your records will be lost when you refresh or close this page.";
const STORAGE_SAVE_FAILED_TEXT = "PeriodPal couldn't save your latest change to this browser (storage may be full or blocked). " +
  "Your records are still shown here, but they may be lost when you refresh or close this page.";

// Small helper: "1 day", "5 days"
function plural(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}

// Shows a notice near the form only when something is wrong with saving.
function refreshStorageNotice() {
  if (browserStorage === null) {
    storageNotice.textContent = STORAGE_UNAVAILABLE_TEXT;
  } else if (lastSaveFailed) {
    storageNotice.textContent = STORAGE_SAVE_FAILED_TEXT;
  } else {
    storageNotice.textContent = startupNotice;
  }
}

// Copies the records into local storage. Returns true if it worked.
function persistChanges() {
  const saved = Store.saveData(browserStorage, recordedPeriods, typicalCycleDays);
  lastSaveFailed = !saved && browserStorage !== null;
  if (saved) {
    startupNotice = "";    // the old problem is gone: damaged data has now been replaced
  }
  refreshStorageNotice();
  return saved;
}

function recordsAreBeingSaved() {
  return browserStorage !== null && !lastSaveFailed;
}


/* =====================================================
   5. SHOWING AND CLEARING MESSAGES
   We build messages with textContent (not innerHTML) so typed text
   can never be treated as code.
   ===================================================== */
function showFieldError(inputElement, errorElement, message) {
  errorElement.textContent = "";
  if (message === "") {
    inputElement.setAttribute("aria-invalid", "false");
    return;
  }
  inputElement.setAttribute("aria-invalid", "true");

  const icon = document.createElement("span");
  icon.className = "field-error-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "!";

  const words = document.createElement("span");
  words.textContent = message;

  errorElement.append(icon, words);
}

function clearAllMessages() {
  showFieldError(startDateInput, startDateError, "");
  showFieldError(endDateInput, endDateError, "");
  errorSummary.textContent = "";
  successMessage.textContent = "";
}

function showErrorSummary(messages) {
  errorSummary.textContent = "";

  const intro = document.createElement("p");
  intro.textContent = "Please fix the following before continuing:";

  const list = document.createElement("ul");
  messages.forEach(function (message) {
    const item = document.createElement("li");
    item.textContent = message;
    list.append(item);
  });

  errorSummary.append(intro, list);
}

// Lines of text that describe how the NEW period fits with the periods already recorded.
// "summary" is the freshly calculated summary that already includes the new period.
function describeCyclesAroundNewPeriod(summary, newStartDate) {
  const lines = [];
  summary.cycles.forEach(function (cycle) {
    if (cycle.toStartDate === newStartDate) {
      lines.push("Cycle length: " + plural(cycle.lengthDays, "day") + " from the previous period's first day (" +
                 Calc.formatDateForDisplay(cycle.fromStartDate) + ") to this one.");
    }
    if (cycle.fromStartDate === newStartDate) {
      lines.push("Cycle length: " + plural(cycle.lengthDays, "day") + " from this period's first day to the next recorded period (" +
                 Calc.formatDateForDisplay(cycle.toStartDate) + ").");
    }
  });
  return lines;
}

function showSuccessMessage(period, summary, wasEditing) {
  successMessage.textContent = "";

  function addParagraph(text, makeBold) {
    const paragraph = document.createElement("p");
    if (makeBold) {
      const strong = document.createElement("strong");
      strong.textContent = text;
      paragraph.append(strong);
    } else {
      paragraph.textContent = text;
    }
    successMessage.append(paragraph);
    return paragraph;
  }

  const duration = Calc.calculateBleedingDuration(period.startDate, period.endDate);

  addParagraph(wasEditing ? "Success: your changes were saved." : "Success: period recorded.", true);
  addParagraph("Period: " + Calc.formatDateForDisplay(period.startDate) + " to " + Calc.formatDateForDisplay(period.endDate) +
               " (" + plural(duration, "day") + " of bleeding, counting both the first and last day).");

  describeCyclesAroundNewPeriod(summary, period.startDate).forEach(function (line) {
    addParagraph(line);
  });

  // Links to the three places that just updated
  const linkParagraph = addParagraph("Updated: ");
  [["#results", "summary"], ["#calendar", "calendar"], ["#history", "history"]].forEach(function (item, index) {
    if (index > 0) {
      linkParagraph.append(" \u00b7 ");
    }
    const link = document.createElement("a");
    link.href = item[0];
    link.textContent = item[1];
    linkParagraph.append(link);
  });

  addParagraph(recordsAreBeingSaved()
    ? "Your records are saved in this browser on this device. They are not sent anywhere."
    : "Your browser isn't saving data right now, so these records will be lost if you refresh or close the page.");

  successMessage.scrollIntoView({ block: "nearest" });
}


/* =====================================================
   6. THE DASHBOARD CARDS
   renderDashboard() asks cycle-calculation.js for a summary of all the
   recorded periods, then writes the answers into the four cards.
   ===================================================== */

// Put a big value into a card. "isEmpty" gives it the quieter "no data yet" style.
function setCardValue(valueElement, text, isEmpty) {
  valueElement.textContent = text;
  valueElement.classList.toggle("is-empty", isEmpty);
}

// Put one or more short paragraphs into a card.
// A line can be plain text, or { text, isWarning: true } to make it stand out.
function setCardDetails(detailElement, lines) {
  detailElement.textContent = "";
  lines.forEach(function (line) {
    const paragraph = document.createElement("p");
    if (typeof line === "string") {
      paragraph.textContent = line;
    } else {
      paragraph.textContent = line.text;
      if (line.isWarning) {
        paragraph.className = "detail-warning";
      }
    }
    detailElement.append(paragraph);
  });
}

function renderLatestPeriodCard(summary) {
  if (summary.mostRecentPeriod === null) {
    setCardValue(latestValue, "Not yet available", true);
    setCardDetails(latestDetail, ["Record a period above to see it here."]);
    return;
  }
  setCardValue(latestValue, Calc.formatDateForDisplay(summary.mostRecentPeriod.startDate), false);
  setCardDetails(latestDetail, ["You have recorded " + plural(summary.periodCount, "period") + "."]);
}

function renderDurationCard(summary) {
  if (summary.mostRecentPeriod === null) {
    setCardValue(durationValue, "Not yet available", true);
    setCardDetails(durationDetail, ["Record a period above to see it here."]);
    return;
  }
  const period = summary.mostRecentPeriod;
  setCardValue(durationValue, plural(period.durationDays, "day"), false);
  setCardDetails(durationDetail, [
    "From " + Calc.formatDateForDisplay(period.startDate) + " to " + Calc.formatDateForDisplay(period.endDate) +
    ". The first and last day both count."
  ]);
}

function renderAverageCard(summary) {
  if (summary.cycleCount === 0) {
    setCardValue(averageValue, "Not enough data yet", true);
    setCardDetails(averageDetail, [
      summary.periodCount === 0
        ? "Record at least two periods. A cycle needs two different start dates."
        : "You have recorded one period. Record a second one so PeriodPal can measure a cycle."
    ]);
    return;
  }

  // "About" reminds people this is a rounded average, not an exact promise.
  setCardValue(averageValue, "About " + plural(summary.averageCycleDays, "day"), false);

  const lines = [
    "Average of " + plural(summary.cycleCount, "recorded cycle") + ", rounded to the nearest day.",
    "Most recent cycle: " + plural(summary.mostRecentCycle.lengthDays, "day") + ", from " +
      Calc.formatDateForDisplay(summary.mostRecentCycle.fromStartDate) + " to " +
      Calc.formatDateForDisplay(summary.mostRecentCycle.toStartDate) + "."
  ];
  if (summary.cycleCount >= 2 && summary.shortestCycleDays !== summary.longestCycleDays) {
    lines.push("Your recorded cycles ranged from " + summary.shortestCycleDays + " to " + summary.longestCycleDays + " days.");
  }
  if (summary.hasLongGap) {
    lines.push({
      text: "One gap between recorded periods is longer than " + Calc.LONG_GAP_DAYS +
            " days. If a period is missing from your records, adding it will make the average more accurate.",
      isWarning: true
    });
  }
  setCardDetails(averageDetail, lines);
}

function renderEstimateCard(summary) {
  const estimate = summary.estimate;

  if (estimate === null) {
    setCardValue(nextValue, "Not enough data yet", true);
    setCardDetails(nextDetail, [
      summary.needsTypicalCycle
        ? "You have recorded one period, so there is no cycle to measure yet. Record a second period, " +
          "or enter a typical cycle length below to get a rough estimate."
        : "Record a period above to get started."
    ]);
    return;
  }

  // "Around" is deliberate: it tells the reader this is an estimate, not an exact day.
  setCardValue(nextValue, "Around " + Calc.formatDateForDisplay(estimate.date), false);

  const lines = [];
  if (estimate.basis === "recorded") {
    lines.push("Based on " + plural(estimate.cyclesUsed, "recorded cycle") +
               " with an average of about " + plural(estimate.cycleDaysUsed, "day") + ".");
    if (estimate.cyclesUsed === 1) {
      lines.push("With only one cycle recorded, this estimate is rough. It improves as you record more.");
    }
    if (estimate.earliestDate !== null) {
      lines.push("Your recorded cycles suggest it could fall anywhere between " +
                 Calc.formatDateForDisplay(estimate.earliestDate) + " and " +
                 Calc.formatDateForDisplay(estimate.latestDate) + ".");
    }
  } else {
    lines.push("Based on the typical cycle length you entered (" + plural(estimate.cycleDaysUsed, "day") +
               "), not on your own recorded cycles. Record a second period and PeriodPal will use your own dates instead.");
  }
  if (estimate.hasPassed) {
    lines.push({
      text: "This estimated date has already passed. If your period has started, record it to update your estimates.",
      isWarning: true
    });
  }
  lines.push("This is an estimate, not a guaranteed date.");
  setCardDetails(nextDetail, lines);
}

// The "typical cycle length" form is only useful while exactly one period is recorded.
function renderTypicalCycleForm(summary) {
  const shouldShow = summary.periodCount > 0 && summary.cycleCount === 0;
  typicalCycleForm.hidden = !shouldShow;
  if (!shouldShow) {
    typicalCycleStatus.textContent = "";
    showFieldError(typicalCycleInput, typicalCycleError, "");
  }
}

function renderDashboard(summary) {
  renderLatestPeriodCard(summary);
  renderDurationCard(summary);
  renderAverageCard(summary);
  renderEstimateCard(summary);
  renderTypicalCycleForm(summary);
}

// Recalculates everything from the list of records and redraws the dashboard, calendar and history.
function renderEverything() {
  const summary = Calc.buildCycleSummary(recordedPeriods, typicalCycleDays, Calc.getTodayAsText());
  renderDashboard(summary);
  renderCalendar(summary);
  renderHistory();
  return summary;
}


/* =====================================================
   7. THE CALENDAR
   The calendar shows ONE month at a time. We remember which month with two
   numbers (year and month index: 0 = January ... 11 = December). The Previous
   and Next buttons change those numbers and redraw. Going back from January
   lands in December of the year before (the maths is in shiftMonth).
   ===================================================== */
const CALENDAR_FIRST_YEAR = 2000;
const CALENDAR_LAST_YEAR = 2100;

const todayAtStart = Calc.getTodayAsText();
let calendarYear = Number(todayAtStart.slice(0, 4));
let calendarMonthIndex = Number(todayAtStart.slice(5, 7)) - 1;

// Make the calendar show the month that contains a date like "2026-03-14".
function showMonthOf(dateText) {
  calendarYear = Number(dateText.slice(0, 4));
  calendarMonthIndex = Number(dateText.slice(5, 7)) - 1;
}

function renderCalendar(summary) {
  const todayText = Calc.getTodayAsText();
  const monthName = Calc.getMonthLabel(calendarYear, calendarMonthIndex);

  calendarMonthLabel.textContent = monthName;
  calendarCaption.textContent = "Calendar for " + monthName +
    ". Recorded period days, today and estimated dates are marked.";

  // Stop at the first and last supported month instead of going on forever.
  calendarPrevButton.disabled = calendarYear <= CALENDAR_FIRST_YEAR && calendarMonthIndex === 0;
  calendarNextButton.disabled = calendarYear >= CALENDAR_LAST_YEAR && calendarMonthIndex === 11;

  calendarBody.textContent = "";   // empty the old month before drawing the new one

  Calc.buildMonthGrid(calendarYear, calendarMonthIndex).forEach(function (week) {
    const row = document.createElement("tr");

    week.forEach(function (dateText) {
      const cell = document.createElement("td");

      if (dateText === null) {            // empty cell before the 1st or after the last day
        cell.className = "is-empty";
        row.append(cell);
        return;
      }

      const marks = Calc.describeCalendarDay(dateText, recordedPeriods, summary.estimate, todayText);
      const classes = [];
      const spokenNotes = [];

      // A recorded period always wins over an estimate on the same day.
      if (marks.isPeriodDay) {
        classes.push(marks.isPeriodStart ? "is-period-start" : "is-period");
        spokenNotes.push(marks.isPeriodStart ? "first day of a recorded period" : "recorded period day");
      } else if (marks.isEstimatedDate) {
        classes.push("is-estimated-date");
        spokenNotes.push("estimated next period start, an estimate and not guaranteed");
      } else if (marks.isEstimatedRange) {
        classes.push("is-estimated-range");
        spokenNotes.push("possible range for the next period, an estimate");
      }
      if (marks.isToday) {
        classes.push("is-today");
        spokenNotes.push("today");
      }
      cell.className = classes.join(" ");

      const dayNumber = document.createElement("span");
      dayNumber.textContent = String(Number(dateText.slice(8)));
      cell.append(dayNumber);

      // Marked days get a full spoken description, because colour and shape can't be heard.
      if (spokenNotes.length > 0) {
        dayNumber.setAttribute("aria-hidden", "true");
        const spoken = document.createElement("span");
        spoken.className = "sr-only";
        spoken.textContent = Calc.formatDateForDisplay(dateText) + ", " + spokenNotes.join(", ");
        cell.append(spoken);
      }
      row.append(cell);
    });

    calendarBody.append(row);
  });
}

function moveCalendar(step) {
  const moved = Calc.shiftMonth(calendarYear, calendarMonthIndex, step);
  calendarYear = moved.year;
  calendarMonthIndex = moved.monthIndex;
  renderEverything();
}

calendarPrevButton.addEventListener("click", function () { moveCalendar(-1); });
calendarNextButton.addEventListener("click", function () { moveCalendar(1); });
calendarTodayButton.addEventListener("click", function () {
  showMonthOf(Calc.getTodayAsText());
  renderEverything();
});


/* =====================================================
   8. THE PERIOD HISTORY (and deleting)
   ===================================================== */
function setHistoryMessage(text) {
  dataStatus.textContent = "";
  historyStatus.textContent = text;
}

function setDataMessage(text) {
  historyStatus.textContent = "";
  dataStatus.textContent = text;
}

function renderHistory() {
  const rows = Calc.buildHistoryRows(recordedPeriods);   // oldest first

  historyBody.textContent = "";
  historyEmpty.hidden = rows.length > 0;
  historyTable.hidden = rows.length === 0;

  rows.forEach(function (rowData) {
    const row = document.createElement("tr");
    const isBeingEdited = rowData.id === editingPeriodId;
    if (isBeingEdited) {
      row.className = "is-editing";
    }

    // Adds one cell. data-label is the heading shown beside the value on phones.
    function addCell(label, text) {
      const cell = document.createElement("td");
      cell.setAttribute("data-label", label);
      cell.textContent = text;
      row.append(cell);
      return cell;
    }

    const firstCell = addCell("First day", Calc.formatDateForDisplay(rowData.startDate));
    if (isBeingEdited) {
      const tag = document.createElement("span");
      tag.className = "editing-tag";
      tag.textContent = "Editing";
      firstCell.append(tag);
    }
    addCell("Last day", Calc.formatDateForDisplay(rowData.endDate));
    addCell("Bleeding days", String(rowData.durationDays));
    // The newest period has no "next period" yet, so there is no cycle length to show.
    addCell("Cycle length", rowData.cycleLengthDays === null ? "Not available yet" : plural(rowData.cycleLengthDays, "day"));

    const actionsCell = document.createElement("td");
    actionsCell.className = "cell-actions";
    const buttons = document.createElement("div");
    buttons.className = "row-actions";

    const dateWords = "period starting " + Calc.formatDateForDisplay(rowData.startDate);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "button button-secondary button-small";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-label", "Edit " + dateWords);
    editButton.addEventListener("click", function () { startEditing(rowData.id); });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-danger button-small";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", "Delete " + dateWords);
    deleteButton.addEventListener("click", function () { deletePeriod(rowData.id); });

    buttons.append(editButton, deleteButton);
    actionsCell.append(buttons);
    row.append(actionsCell);
    historyBody.append(row);
  });
}

function deletePeriod(periodId) {
  const index = recordedPeriods.findIndex(function (period) { return period.id === periodId; });
  if (index === -1) {
    return;
  }
  const period = recordedPeriods[index];
  const dateWords = Calc.formatDateForDisplay(period.startDate) + " to " + Calc.formatDateForDisplay(period.endDate);

  // The confirmation step: nothing is deleted unless the person agrees.
  if (!window.confirm("Delete the period from " + dateWords + "? This can't be undone.")) {
    return;
  }

  recordedPeriods.splice(index, 1);
  if (editingPeriodId === periodId) {
    exitEditMode();
  }
  persistChanges();
  renderEverything();       // dashboard, calendar and history all recalculate
  clearAllMessages();
  setHistoryMessage("Deleted the period from " + dateWords + ". Your summary and calendar have been updated.");
  historyStatus.focus();    // keyboard users land somewhere sensible, since the button they used has gone
}


/* =====================================================
   9. HANDLING THE PERIOD FORM (adding AND editing)
   One form does both jobs. When "editingPeriodId" is null we add a new record;
   otherwise we update that record.
   ===================================================== */

// Today's date limits what the date pickers offer (the checks still run if someone types).
startDateInput.max = Calc.getTodayAsText();
endDateInput.max = Calc.getTodayAsText();

// When someone starts fixing a field, remove that field's old error.
startDateInput.addEventListener("input", function () { showFieldError(startDateInput, startDateError, ""); });
endDateInput.addEventListener("input", function () { showFieldError(endDateInput, endDateError, ""); });

// Changes the form's wording between "add" and "edit".
function setEditModeAppearance(isEditing, period) {
  formHeading.textContent = isEditing ? "Edit Your Period" : "Record Your Period";
  savePeriodButton.textContent = isEditing ? "Save Changes" : "Save Period Dates";
  cancelEditButton.hidden = !isEditing;
  editingNotice.textContent = isEditing
    ? "You are editing the period from " + Calc.formatDateForDisplay(period.startDate) + " to " +
      Calc.formatDateForDisplay(period.endDate) + ". Change the dates, then choose Save Changes, or cancel to leave it as it was."
    : "";
}

function startEditing(periodId) {
  const period = recordedPeriods.find(function (item) { return item.id === periodId; });
  if (!period) {
    return;
  }

  clearAllMessages();
  setHistoryMessage("");
  editingPeriodId = periodId;
  startDateInput.value = period.startDate;      // fill the form with the existing values
  endDateInput.value = period.endDate;
  notesInput.value = "";
  setEditModeAppearance(true, period);

  showMonthOf(period.startDate);
  renderEverything();                           // highlights the row being edited

  byId("track").scrollIntoView({ block: "start" });
  startDateInput.focus({ preventScroll: true });
}

// Leaves edit mode and empties the form (it does not touch the success message).
function exitEditMode() {
  editingPeriodId = null;
  setEditModeAppearance(false, null);
  periodForm.reset();
  showFieldError(startDateInput, startDateError, "");
  showFieldError(endDateInput, endDateError, "");
}

cancelEditButton.addEventListener("click", function () {
  exitEditMode();
  clearAllMessages();
  renderEverything();
  setHistoryMessage("Editing cancelled. The record was not changed.");
});

periodForm.addEventListener("submit", function (event) {
  event.preventDefault();   // stop the browser from reloading the page
  clearAllMessages();
  setHistoryMessage("");

  const problems = Calc.validatePeriodDates(
    startDateInput.value,
    endDateInput.value,
    startDateInput.validity.badInput,   // true if the browser couldn't read what was typed
    endDateInput.validity.badInput,
    Calc.getTodayAsText()
  );

  // Only look for duplicates and overlaps once the dates themselves are fine.
  // While editing, the record being edited is ignored so it can't clash with itself.
  if (problems.startMessage === "" && problems.endMessage === "") {
    const clash = Calc.findClashWithRecordedPeriods(startDateInput.value, endDateInput.value, recordedPeriods, editingPeriodId);
    if (clash !== null) {
      problems.startMessage = Calc.describeClash(clash);
    }
  }

  showFieldError(startDateInput, startDateError, problems.startMessage);
  showFieldError(endDateInput, endDateError, problems.endMessage);

  const messages = [problems.startMessage, problems.endMessage].filter(function (text) {
    return text !== "";
  });

  if (messages.length > 0) {
    showErrorSummary(messages);
    // Move to the first field that needs attention.
    (problems.startMessage !== "" ? startDateInput : endDateInput).focus();
    return;
  }

  handleValidPeriod({
    startDate: startDateInput.value,
    endDate: endDateInput.value
  });
});

// Every valid submission arrives here as { startDate, endDate }.
function handleValidPeriod(period) {
  const wasEditing = editingPeriodId !== null;

  if (wasEditing) {
    const existing = recordedPeriods.find(function (item) { return item.id === editingPeriodId; });
    existing.startDate = period.startDate;
    existing.endDate = period.endDate;
  } else {
    recordedPeriods.push({ id: nextPeriodId, startDate: period.startDate, endDate: period.endDate });
    nextPeriodId += 1;
  }

  persistChanges();                    // save to the browser
  showMonthOf(period.startDate);       // show the saved period in the calendar
  const summary = renderEverything();  // recalculate and redraw everything
  showSuccessMessage(period, summary, wasEditing);

  exitEditMode();                      // empties the form and leaves edit mode
  renderHistory();                     // removes the "Editing" highlight
}


/* =====================================================
   10. THE OPTIONAL "TYPICAL CYCLE LENGTH" FORM
   Only shown while one period is recorded. Once a second period is
   recorded, PeriodPal uses the person's own dates and ignores this number.
   ===================================================== */
typicalCycleInput.addEventListener("input", function () {
  showFieldError(typicalCycleInput, typicalCycleError, "");
  typicalCycleStatus.textContent = "";
});

typicalCycleForm.addEventListener("submit", function (event) {
  event.preventDefault();
  typicalCycleStatus.textContent = "";

  const result = Calc.validateTypicalCycleLength(typicalCycleInput.value, typicalCycleInput.validity.badInput);
  showFieldError(typicalCycleInput, typicalCycleError, result.message);
  if (!result.valid) {
    typicalCycleInput.focus();
    return;
  }

  typicalCycleDays = result.days;
  persistChanges();
  renderEverything();
  typicalCycleStatus.textContent = "Estimate updated using a typical cycle length of " + plural(result.days, "day") + ".";
});


/* =====================================================
   11. CLEAR ALL DATA
   ===================================================== */
clearAllButton.addEventListener("click", function () {
  if (recordedPeriods.length === 0 && typicalCycleDays === null) {
    setDataMessage("There is no saved data to clear.");
    return;
  }

  const confirmed = window.confirm(
    "Delete ALL of your recorded periods from this browser? This can't be undone.\n\n" +
    "(Records saved in other browsers or on other devices are separate and won't be affected.)"
  );
  if (!confirmed) {
    return;
  }

  recordedPeriods.length = 0;       // empty the list
  typicalCycleDays = null;
  nextPeriodId = 1;
  typicalCycleInput.value = "";
  const cleared = Store.clearSavedData(browserStorage) || browserStorage === null;

  exitEditMode();
  clearAllMessages();
  showMonthOf(Calc.getTodayAsText());
  renderEverything();
  setDataMessage(cleared
    ? "All of your records have been cleared from this browser."
    : "Your records were cleared from this page, but the browser wouldn't let PeriodPal remove the saved copy. You may need to clear this site's data in your browser settings.");
});


/* =====================================================
   START UP
   Show a notice if saving isn't possible, fill in anything loaded from storage,
   and draw the dashboard, calendar and history once.
   ===================================================== */
if (typicalCycleDays !== null) {
  typicalCycleInput.value = String(typicalCycleDays);
}
refreshStorageNotice();
renderEverything();