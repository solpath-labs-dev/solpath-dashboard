/**
 * 스프레드시트 open / 시트·헤더 보장. (read-only for humans: 쓰기는 이 모듈 + 동기 루틴만)
 */

/**
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function dbOpenMaster_() {
  var id = PropertiesService.getScriptProperties().getProperty(DB_PROP_SHEETS_MASTER_ID);
  if (id == null || !String(id).trim().length) {
    throw new Error('SHEETS_MASTER_ID 가 비어 있음. 먼저 dbSetupMasterDatabase() 실행.');
  }
  return SpreadsheetApp.openById(String(id).trim());
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string[]} headers
 */
function dbEnsureHeaderRow1_(sheet, headers) {
  var w = headers.length;
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, w).setValues([headers]);
  } else {
    var existing = sheet.getRange(1, 1, 1, w).getValues()[0];
    var i;
    for (i = 0; i < w; i++) {
      if (String(existing[i] || '').trim() !== String(headers[i] || '')) {
        break;
      }
    }
    if (i < w) {
      sheet.getRange(1, 1, 1, w).setValues([headers]);
    }
  }
  sheet.setFrozenRows(1);
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} name
 * @param {string[]} headers
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function dbGetOrCreateSheetWithHeaders_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  dbEnsureHeaderRow1_(sh, headers);
  return sh;
}

/**
 * 2행부터 본문만 비움(헤더 유지)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} nCols
 */
function dbClearDataRows2Plus_(sheet, nCols) {
  var lr = sheet.getLastRow();
  if (lr < 2) {
    return;
  }
  sheet.getRange(2, 1, lr, nCols).clearContent();
}

/**
 * 1행=헤더, 2행부터 values 붙이기. 끝 행 = 1 + values.length (2…1+n행 = n행).
 * 열은 nCols에 맞게 패딩 — 가변 길이 행·setHeader 오해로 생기는 102/103 불일치 방지
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {any[][]|null|undefined} values
 * @param {number} nCols
 */
function dbSetValuesFromRow2_(sheet, values, nCols) {
  if (!values || !values.length) {
    return;
  }
  var n = values.length;
  var norm = [];
  var i, c;
  for (i = 0; i < n; i++) {
    var row = values[i] || [];
    var line = [];
    for (c = 0; c < nCols; c++) {
      line.push(c < row.length ? row[c] : '');
    }
    norm.push(line);
  }
  sheet.getRange(2, 1, 1 + n, nCols).setValues(norm);
}
