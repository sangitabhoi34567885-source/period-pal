/*
  storage.js — PeriodPal, Stage 3

  This is the ONLY file that touches the browser's local storage.

  HOW LOCAL STORAGE WORKS (simple version)
  ----------------------------------------
  Every browser can keep a small "notebook" for each website, right on the
  visitor's own device. The notebook holds pairs of text:  a name (the "key")
  and a value. We use one key, "periodpal.records.v1".

  - setItem(key, text)  writes into the notebook
  - getItem(key)        reads it back (or gives null if nothing is there)
  - removeItem(key)     rips that page out

  Facts worth knowing:
  - It stays after you refresh or close the page.
  - It is stored only in THIS browser on THIS device. Another browser or
    another phone has its own, separate (empty) notebook.
  - It is NOT sent to any server, and it is NOT encrypted. Anyone who can use
    this browser on this device could look at it.
  - Clearing the browser's site data or history can erase it.
  - It only stores TEXT, so we turn our list into text with JSON.stringify
    and back into a list with JSON.parse.
  - It can fail (private browsing, blocked storage, full storage), so every
    call below is wrapped in try/catch and reports success or failure.

  WHAT WE SAVE (only what the tracker needs):
    { "version": 1,
      "periods": [ { "startDate": "2026-03-01", "endDate": "2026-03-05" }, ... ],
      "typicalCycleDays": 28 }          <- only present if the person entered one
  Notes are not saved.
*/
(function (root) {
  "use strict";

  // In the browser, cycle-calculation.js has already created PeriodCalc.
  // In Node (our tests) we load it with require.
  const Calc = (typeof module !== "undefined" && module.exports)
    ? require("./cycle-calculation.js")
    : root.PeriodCalc;

  const STORAGE_KEY = "periodpal.records.v1";

  // Returns the browser's localStorage if it really works, otherwise null.
  // Even looking at window.localStorage can throw an error when storage is blocked,
  // and some browsers allow reading but refuse writing, so we do a tiny test write.
  function getBrowserStorage() {
    try {
      const storage = root.localStorage;
      const testKey = "periodpal.storage-test";
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  // Reads and checks everything saved earlier. Never throws.
  // Returns { periods, typicalCycleDays, status, droppedCount } where status is:
  //   "unavailable" - the browser gave us no storage
  //   "empty"       - nothing saved yet
  //   "unreadable"  - something was saved but it is damaged or in an unknown format
  //   "loaded"      - saved data was read (droppedCount says how many records were skipped)
  function loadSavedData(storage) {
    const result = { periods: [], typicalCycleDays: null, status: "empty", droppedCount: 0 };

    if (storage === null) {
      result.status = "unavailable";
      return result;
    }

    let savedText;
    try {
      savedText = storage.getItem(STORAGE_KEY);
    } catch (error) {
      result.status = "unavailable";
      return result;
    }

    if (savedText === null) {
      return result;
    }

    let parsed;
    try {
      parsed = JSON.parse(savedText);
    } catch (error) {
      result.status = "unreadable";      // the text is not valid JSON
      return result;
    }

    const clean = Calc.sanitizeStoredData(parsed);
    if (clean.wasUnreadable) {
      result.status = "unreadable";
      return result;
    }

    result.periods = clean.periods;
    result.typicalCycleDays = clean.typicalCycleDays;
    result.droppedCount = clean.droppedCount;
    result.status = "loaded";
    return result;
  }

  // Saves the current records. Returns true if it worked, false if the browser refused.
  function saveData(storage, periods, typicalCycleDays) {
    if (storage === null) {
      return false;
    }
    try {
      if (periods.length === 0 && typicalCycleDays === null) {
        storage.removeItem(STORAGE_KEY);          // nothing to remember, so keep nothing
        return true;
      }

      const payload = {
        version: 1,
        // We copy only the two dates. The temporary id numbers are not saved.
        periods: periods.map(function (period) {
          return { startDate: period.startDate, endDate: period.endDate };
        })
      };
      if (typicalCycleDays !== null) {
        payload.typicalCycleDays = typicalCycleDays;
      }

      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Deletes everything PeriodPal saved. Returns true if it worked.
  function clearSavedData(storage) {
    if (storage === null) {
      return false;
    }
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      return false;
    }
  }

  const api = {
    STORAGE_KEY: STORAGE_KEY,
    getBrowserStorage: getBrowserStorage,
    loadSavedData: loadSavedData,
    saveData: saveData,
    clearSavedData: clearSavedData
  };

  root.PeriodStore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);