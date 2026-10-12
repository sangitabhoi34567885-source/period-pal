/*
  cycle-calculation.js — PeriodPal, Stage 3

  All the date maths lives in this file. Nothing here touches the web page,
  which means we can test every calculation on its own (see tests/).

  THE BIG IDEA: "date-only" arithmetic
  ------------------------------------
  Dates are kept as plain text such as "2026-03-14" (year-month-day).
  To do maths, each date becomes a "day number": how many whole days have
  passed since 1 January 1970. Subtracting two day numbers gives the exact
  number of days between them.

  We always work in UTC. UTC has no daylight-saving changes, so a day is
  always exactly 24 hours long and we can never be "off by one day"
  because of a clock change or the visitor's time zone.

  Month changes, year changes and leap years need no special code: the
  built-in Date tool already knows how long every month is.
*/
(function (root) {
  "use strict";

  /* ---------- Settings you can change ---------- */
  const MS_PER_DAY = 24 * 60 * 60 * 1000;   // milliseconds in one day
  const EARLIEST_YEAR = 2000;               // earliest year accepted
  const MAX_PERIOD_DAYS = 31;               // longest period accepted (catches typing mistakes)
  const MIN_TYPICAL_CYCLE_DAYS = 15;        // allowed range for "typical cycle length"
  const MAX_TYPICAL_CYCLE_DAYS = 90;
  const LONG_GAP_DAYS = 90;                 // a gap longer than this may mean a missing record


  /* =====================================================
     A. BASIC DATE TOOLS
     ===================================================== */

  // Today as text like "2026-03-14", using the visitor's own calendar day.
  function getTodayAsText() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  // Is this text a REAL calendar date? "2026-02-30" is not.
  // We build a date from its parts and check that the parts didn't change.
  function isRealDate(dateText) {
    if (typeof dateText !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      return false;
    }
    const parts = dateText.split("-").map(Number);
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    const check = new Date(Date.UTC(year, month - 1, day));
    return check.getUTCFullYear() === year &&
           check.getUTCMonth() === month - 1 &&
           check.getUTCDate() === day;
  }

  // "2026-03-14" -> a whole number of days since 1 Jan 1970.
  function dateTextToDayNumber(dateText) {
    const parts = dateText.split("-").map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]) / MS_PER_DAY;
  }

  // A day number -> "2026-03-14".
  function dayNumberToDateText(dayNumber) {
    return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
  }

  // FORMULA: days between two dates = later day number - earlier day number.
  // Example: countDaysBetween("2026-03-01", "2026-03-30") is 29.
  function countDaysBetween(earlierText, laterText) {
    return dateTextToDayNumber(laterText) - dateTextToDayNumber(earlierText);
  }

  // Move a date forward (or backward, with a negative number) by some days.
  // Example: addDaysToDate("2026-01-31", 1) is "2026-02-01".
  function addDaysToDate(dateText, numberOfDays) {
    return dayNumberToDateText(dateTextToDayNumber(dateText) + numberOfDays);
  }

  // "2026-03-14" -> "14 Mar 2026" (the wording follows the visitor's language settings).
  // We split the text ourselves instead of using new Date("2026-03-14"),
  // because that can show the wrong day in some time zones.
  function formatDateForDisplay(dateText, locale) {
    const parts = dateText.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return date.toLocaleDateString(locale, {
      timeZone: "UTC", day: "numeric", month: "short", year: "numeric"
    });
  }


  /* =====================================================
     B. BLEEDING DURATION
     ===================================================== */

  // FORMULA: bleeding duration = (end - start) + 1
  // The "+ 1" is there because BOTH the first and the last day count.
  // Example: 1 March to 5 March is 5 days, not 4.
  function calculateBleedingDuration(startText, endText) {
    return countDaysBetween(startText, endText) + 1;
  }


  /* =====================================================
     C. CHECKING THE DATES THE PERSON TYPED
     ===================================================== */

  // Checks ONE date field. Returns a friendly message, or "" when the date is fine.
  // "wasUnreadable" is true when the browser couldn't turn what was typed into a date.
  function findProblemWithSingleDate(dateText, wasUnreadable, whichDate, todayText) {
    if (wasUnreadable) {
      return "The " + whichDate + " isn't a complete, real date. Please check the day, month and year.";
    }
    if (dateText === "") {
      return "Please choose your period " + whichDate + ".";
    }
    if (!isRealDate(dateText)) {
      return "The " + whichDate + " isn't a real date. Please choose it from the calendar.";
    }
    if (Number(dateText.slice(0, 4)) < EARLIEST_YEAR) {
      return "Please choose a " + whichDate + " from the year " + EARLIEST_YEAR + " onwards.";
    }
    if (dateText > todayText) {
      return "The " + whichDate + " can't be in the future. Please choose today or an earlier day.";
    }
    return "";
  }

  // Checks BOTH dates together. Returns { startMessage, endMessage } ("" means no problem).
  function validatePeriodDates(startText, endText, startUnreadable, endUnreadable, todayText) {
    const result = {
      startMessage: findProblemWithSingleDate(startText, startUnreadable, "start date", todayText),
      endMessage: findProblemWithSingleDate(endText, endUnreadable, "end date", todayText)
    };

    // Only compare the two dates when each one is fine on its own.
    // Text in the form YYYY-MM-DD sorts correctly, so "<" works for comparing dates.
    if (result.startMessage === "" && result.endMessage === "") {
      if (endText < startText) {
        result.endMessage = "The end date can't be earlier than the start date. Please check both dates.";
      } else if (calculateBleedingDuration(startText, endText) > MAX_PERIOD_DAYS) {
        result.endMessage = "That period would last more than " + MAX_PERIOD_DAYS +
          " days, which is probably a typing mistake. Please check both dates.";
      }
    }
    return result;
  }

  // Looks through the periods already recorded and finds one that clashes with the new dates.
  // Returns null when there is no clash, otherwise { kind, period } where kind is
  //   "duplicate"  - exactly the same start and end dates
  //   "same-start" - the same start date, different end date
  //   "overlap"    - the date ranges share at least one day
  //
  // FORMULA: two date ranges overlap when each one STARTS on or before the day the other ENDS.
  //   newStart <= otherEnd  AND  newEnd >= otherStart
  //
  // "ignoreId" is used when EDITING: the record being edited must not be compared
  // with itself, otherwise saving it without changes would look like a duplicate.
  function findClashWithRecordedPeriods(startText, endText, recordedPeriods, ignoreId) {
    for (let i = 0; i < recordedPeriods.length; i++) {
      const other = recordedPeriods[i];
      if (ignoreId !== undefined && ignoreId !== null && other.id === ignoreId) {
        continue;
      }

      if (startText === other.startDate && endText === other.endDate) {
        return { kind: "duplicate", period: other };
      }
      if (startText === other.startDate) {
        return { kind: "same-start", period: other };
      }
      if (startText <= other.endDate && endText >= other.startDate) {
        return { kind: "overlap", period: other };
      }
    }
    return null;
  }

  // Turns a clash into a friendly sentence.
  function describeClash(clash) {
    const first = formatDateForDisplay(clash.period.startDate);
    const last = formatDateForDisplay(clash.period.endDate);
    if (clash.kind === "duplicate") {
      return "You've already recorded this period (" + first + " to " + last + ").";
    }
    if (clash.kind === "same-start") {
      return "A period starting on " + first + " is already recorded. Each period needs its own start date.";
    }
    return "These dates overlap a period you already recorded (" + first + " to " + last + "). Please check the dates.";
  }

  // Checks the "typical cycle length" a person types when only one period is recorded.
  // Returns { valid, days, message }.
  function validateTypicalCycleLength(text, wasUnreadable) {
    const trimmed = String(text).trim();
    const days = Number(trimmed);

    if (wasUnreadable || trimmed === "" || !Number.isInteger(days)) {
      return { valid: false, days: null, message: "Please enter a whole number of days, like 28." };
    }
    if (days < MIN_TYPICAL_CYCLE_DAYS || days > MAX_TYPICAL_CYCLE_DAYS) {
      return {
        valid: false, days: null,
        message: "Please enter a whole number between " + MIN_TYPICAL_CYCLE_DAYS + " and " + MAX_TYPICAL_CYCLE_DAYS +
                 ". If your cycle is outside this range, record more periods instead and PeriodPal will use your own dates."
      };
    }
    return { valid: true, days: days, message: "" };
  }


  /* =====================================================
     D. CYCLES, AVERAGE AND ESTIMATE
     ===================================================== */

  // Returns a sorted COPY (oldest start first). The original list is left unchanged.
  function sortPeriodsByStart(periods) {
    return periods.slice().sort(function (a, b) {
      return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0;
    });
  }

  // FORMULA: cycle length = start date of the NEXT period - start date of this period.
  // A cycle is measured from the FIRST day of one period to the FIRST day of the next.
  // The end date plays no part in it.
  //
  // With N periods there are N - 1 cycles. A cycle needs two DIFFERENT start dates,
  // so the code skips any pair with the same start (this should never happen,
  // because duplicates are rejected, but it keeps the maths safe).
  function calculateCycles(periods) {
    const sorted = sortPeriodsByStart(periods);
    const cycles = [];
    let previous = null;

    sorted.forEach(function (period) {
      if (previous !== null && period.startDate !== previous.startDate) {
        cycles.push({
          fromStartDate: previous.startDate,
          toStartDate: period.startDate,
          lengthDays: countDaysBetween(previous.startDate, period.startDate)
        });
      }
      previous = period;
    });
    return cycles;
  }

  // FORMULA: average = (all cycle lengths added together) / (how many cycles).
  // Returns null when there are no cycles, so we never divide by zero.
  function calculateAverageCycleLength(cycles) {
    if (cycles.length === 0) {
      return null;
    }
    let total = 0;
    cycles.forEach(function (cycle) { total += cycle.lengthDays; });
    return total / cycles.length;
  }

  // Gathers everything the dashboard needs into one tidy object.
  //   periods          - the recorded periods, in any order
  //   typicalCycleDays - the number the person entered, or null
  //   todayText        - today's date as text
  //
  // FORMULA for the estimated next start:
  //   latest start date + average cycle length (rounded to a whole day)
  // We round because showing "28.67 days" would pretend to be more exact than
  // real cycles are.
  function buildCycleSummary(periods, typicalCycleDays, todayText) {
    const sorted = sortPeriodsByStart(periods);
    const summary = {
      periodCount: sorted.length,
      mostRecentPeriod: null,   // { startDate, endDate, durationDays }
      cycles: [],
      cycleCount: 0,
      mostRecentCycle: null,    // { fromStartDate, toStartDate, lengthDays }
      averageCycleDays: null,   // whole days (rounded)
      shortestCycleDays: null,
      longestCycleDays: null,
      hasLongGap: false,
      estimate: null,           // see below
      needsTypicalCycle: false
    };

    if (sorted.length === 0) {
      return summary;
    }

    const latest = sorted[sorted.length - 1];
    summary.mostRecentPeriod = {
      startDate: latest.startDate,
      endDate: latest.endDate,
      durationDays: calculateBleedingDuration(latest.startDate, latest.endDate)
    };

    const cycles = calculateCycles(sorted);
    summary.cycles = cycles;
    summary.cycleCount = cycles.length;

    if (cycles.length > 0) {
      const lengths = cycles.map(function (cycle) { return cycle.lengthDays; });
      const shortest = Math.min.apply(null, lengths);
      const longest = Math.max.apply(null, lengths);
      const average = Math.round(calculateAverageCycleLength(cycles));

      summary.mostRecentCycle = cycles[cycles.length - 1];
      summary.averageCycleDays = average;
      summary.shortestCycleDays = shortest;
      summary.longestCycleDays = longest;
      summary.hasLongGap = longest > LONG_GAP_DAYS;

      summary.estimate = {
        basis: "recorded",
        date: addDaysToDate(latest.startDate, average),
        cycleDaysUsed: average,
        cyclesUsed: cycles.length,
        // A range only makes sense when the recorded cycles actually differ.
        earliestDate: cycles.length >= 2 && shortest !== longest ? addDaysToDate(latest.startDate, shortest) : null,
        latestDate: cycles.length >= 2 && shortest !== longest ? addDaysToDate(latest.startDate, longest) : null,
        hasPassed: false
      };
    } else if (typicalCycleDays !== null) {
      summary.estimate = {
        basis: "typical",
        date: addDaysToDate(latest.startDate, typicalCycleDays),
        cycleDaysUsed: typicalCycleDays,
        cyclesUsed: 0,
        earliestDate: null,
        latestDate: null,
        hasPassed: false
      };
    } else {
      summary.needsTypicalCycle = true;
    }

    if (summary.estimate !== null) {
      // If the estimated day is already behind us, the dashboard says so instead of
      // showing a date in the past as if it were still coming.
      summary.estimate.hasPassed = summary.estimate.date < todayText;
    }
    return summary;
  }


  /* =====================================================
     E. HISTORY ROWS
     ===================================================== */

  // One row per recorded period, oldest first (chronological order).
  //
  // The cycle length shown on a row is the length of the cycle that BEGAN with that
  // period: the days from its first day to the first day of the NEXT distinct period.
  // The newest period has no next period yet, so its cycleLengthDays is null.
  function buildHistoryRows(periods) {
    const sorted = sortPeriodsByStart(periods);
    const cycleLengthByStartDate = {};
    calculateCycles(sorted).forEach(function (cycle) {
      cycleLengthByStartDate[cycle.fromStartDate] = cycle.lengthDays;
    });

    return sorted.map(function (period) {
      const knownLength = cycleLengthByStartDate[period.startDate];
      return {
        id: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        durationDays: calculateBleedingDuration(period.startDate, period.endDate),
        cycleLengthDays: knownLength === undefined ? null : knownLength
      };
    });
  }


  /* =====================================================
     F. CALENDAR
     ===================================================== */

  // How many days are in a month? monthIndex: 0 = January ... 11 = December.
  // Asking for "day 0 of the NEXT month" gives the last day of THIS month,
  // so leap years (29 days in February) are handled automatically.
  function getDaysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  // Builds one month as rows (weeks) of 7 cells. Each cell is "YYYY-MM-DD" or null (an empty cell).
  // Weeks start on Sunday.
  function buildMonthGrid(year, monthIndex) {
    const weekdayOfFirstDay = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();   // 0 = Sunday
    const dayCount = getDaysInMonth(year, monthIndex);
    const monthText = String(monthIndex + 1).padStart(2, "0");
    const cells = [];

    for (let i = 0; i < weekdayOfFirstDay; i++) {
      cells.push(null);                                   // empty cells before the 1st
    }
    for (let day = 1; day <= dayCount; day++) {
      cells.push(year + "-" + monthText + "-" + String(day).padStart(2, "0"));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);                                   // empty cells after the last day
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }

  // Move to the previous (-1) or next (+1) month. December + 1 gives January of the next year.
  // Trick: turn "year + month" into one running count of months, add the step, then split it again.
  function shiftMonth(year, monthIndex, step) {
    const totalMonths = year * 12 + monthIndex + step;
    const newYear = Math.floor(totalMonths / 12);
    return { year: newYear, monthIndex: totalMonths - newYear * 12 };
  }

  // "March 2026"
  function getMonthLabel(year, monthIndex, locale) {
    return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString(locale, {
      timeZone: "UTC", month: "long", year: "numeric"
    });
  }

  // Works out how ONE calendar day should be marked.
  //   recorded period days  - any day from a period's start to its end
  //   estimated date        - the estimated next start (only if it is still today or later)
  //   estimated range       - days between the shortest and longest recorded cycle (today or later)
  function describeCalendarDay(dateText, periods, estimate, todayText) {
    const result = {
      isPeriodDay: false,
      isPeriodStart: false,
      isToday: dateText === todayText,
      isEstimatedDate: false,
      isEstimatedRange: false
    };

    periods.forEach(function (period) {
      if (dateText >= period.startDate && dateText <= period.endDate) {
        result.isPeriodDay = true;
        if (dateText === period.startDate) {
          result.isPeriodStart = true;
        }
      }
    });

    if (estimate !== null && !estimate.hasPassed && dateText >= todayText) {
      if (dateText === estimate.date) {
        result.isEstimatedDate = true;
      } else if (estimate.earliestDate !== null && dateText >= estimate.earliestDate && dateText <= estimate.latestDate) {
        result.isEstimatedRange = true;
      }
    }
    return result;
  }


  /* =====================================================
     G. CHECKING SAVED DATA
     Data read back from the browser could be missing, edited by hand, from an
     older version, or damaged. We never trust it: every record is re-checked,
     and anything unusable is skipped instead of crashing the website.
     ===================================================== */
  const MAX_SAVED_RECORDS = 1000;

  // Takes whatever JSON.parse produced and returns clean data:
  //   { periods, typicalCycleDays, droppedCount, wasUnreadable }
  // Periods get fresh ids (1, 2, 3 ...) in date order. Records that are invalid,
  // duplicated or overlapping are dropped and counted in droppedCount.
  function sanitizeStoredData(rawData) {
    const clean = { periods: [], typicalCycleDays: null, droppedCount: 0, wasUnreadable: false };

    if (rawData === null || typeof rawData !== "object" || Array.isArray(rawData) ||
        rawData.version !== 1 || !Array.isArray(rawData.periods)) {
      clean.wasUnreadable = true;
      return clean;
    }

    const earliestAllowed = EARLIEST_YEAR + "-01-01";
    const usable = [];

    rawData.periods.slice(0, MAX_SAVED_RECORDS).forEach(function (item) {
      const looksFine = item !== null && typeof item === "object" &&
        isRealDate(item.startDate) && isRealDate(item.endDate) &&
        item.startDate >= earliestAllowed &&
        item.endDate >= item.startDate &&
        calculateBleedingDuration(item.startDate, item.endDate) <= MAX_PERIOD_DAYS;

      if (looksFine) {
        usable.push({ startDate: item.startDate, endDate: item.endDate });
      } else {
        clean.droppedCount += 1;
      }
    });
    clean.droppedCount += Math.max(0, rawData.periods.length - MAX_SAVED_RECORDS);

    // Keep records in date order and skip any that duplicate or overlap one we already kept.
    usable.sort(function (a, b) { return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0; });
    usable.forEach(function (candidate) {
      if (findClashWithRecordedPeriods(candidate.startDate, candidate.endDate, clean.periods) === null) {
        clean.periods.push({ id: clean.periods.length + 1, startDate: candidate.startDate, endDate: candidate.endDate });
      } else {
        clean.droppedCount += 1;
      }
    });

    const typical = rawData.typicalCycleDays;
    if (Number.isInteger(typical) && typical >= MIN_TYPICAL_CYCLE_DAYS && typical <= MAX_TYPICAL_CYCLE_DAYS) {
      clean.typicalCycleDays = typical;
    }
    return clean;
  }


  const api = {
    MAX_PERIOD_DAYS: MAX_PERIOD_DAYS,
    MIN_TYPICAL_CYCLE_DAYS: MIN_TYPICAL_CYCLE_DAYS,
    MAX_TYPICAL_CYCLE_DAYS: MAX_TYPICAL_CYCLE_DAYS,
    LONG_GAP_DAYS: LONG_GAP_DAYS,
    getTodayAsText: getTodayAsText,
    isRealDate: isRealDate,
    countDaysBetween: countDaysBetween,
    addDaysToDate: addDaysToDate,
    formatDateForDisplay: formatDateForDisplay,
    calculateBleedingDuration: calculateBleedingDuration,
    validatePeriodDates: validatePeriodDates,
    findClashWithRecordedPeriods: findClashWithRecordedPeriods,
    describeClash: describeClash,
    validateTypicalCycleLength: validateTypicalCycleLength,
    sortPeriodsByStart: sortPeriodsByStart,
    calculateCycles: calculateCycles,
    calculateAverageCycleLength: calculateAverageCycleLength,
    buildCycleSummary: buildCycleSummary,
    buildHistoryRows: buildHistoryRows,
    getDaysInMonth: getDaysInMonth,
    buildMonthGrid: buildMonthGrid,
    shiftMonth: shiftMonth,
    getMonthLabel: getMonthLabel,
    describeCalendarDay: describeCalendarDay,
    sanitizeStoredData: sanitizeStoredData
  };

  // In the browser this becomes window.PeriodCalc. In Node (our tests) it is exported.
  root.PeriodCalc = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);