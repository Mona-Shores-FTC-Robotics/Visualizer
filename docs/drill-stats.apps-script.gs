// Driver Drill stats: appends the drill's finished runs to this spreadsheet, one row each.
// Paste into the spreadsheet's Extensions > Apps Script, then deploy as a web app (docs/drill-stats.md).
//
// The drill posts { columns: [...], rows: [{ id, date, driver, ... }] }. Rows go on the "Runs" tab under a
// header made from `columns` (a column the header lacks is added at the end), and a row whose id is
// already there is skipped, so a run sent twice is kept once.

const SHEET = "Runs";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    const columns = Array.isArray(body.columns) ? body.columns.map(String) : [];
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book.getSheetByName(SHEET) || book.insertSheet(SHEET);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(columns);
      sheet.setFrozenRows(1);
    }
    const header = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0]
      .map(String);
    for (const c of columns) {
      if (header.indexOf(c) < 0) {
        header.push(c);
        sheet.getRange(1, header.length).setValue(c);
      }
    }
    const idCol = header.indexOf("id") + 1;
    const count = sheet.getLastRow() - 1;
    const have = new Set(
      idCol > 0 && count > 0
        ? sheet
            .getRange(2, idCol, count, 1)
            .getValues()
            .map((r) => String(r[0]))
        : [],
    );
    const out = [];
    for (const r of rows) {
      if (!r || !r.id || have.has(String(r.id))) continue;
      have.add(String(r.id));
      // Plain values only: text is kept short and never starts a formula.
      out.push(
        header.map((h) => {
          const v = r[h];
          if (v === undefined || v === null) return "";
          if (typeof v === "number" || typeof v === "boolean") return v;
          const s = String(v).slice(0, 200);
          return /^[=+\-@]/.test(s) ? "'" + s : s;
        }),
      );
    }
    if (out.length)
      sheet
        .getRange(sheet.getLastRow() + 1, 1, out.length, header.length)
        .setValues(out);
    return ContentService.createTextOutput(
      JSON.stringify({ added: out.length }),
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app's URL in a browser shows this: a quick check that the deployment works.
function doGet() {
  return ContentService.createTextOutput("Driver Drill stats: ready");
}
