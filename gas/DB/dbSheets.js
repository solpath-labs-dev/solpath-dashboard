/**
 * 스프레드시트 open / 시트·헤더 보장. (read-only for humans: 쓰기는 이 모듈 + 동기 루틴만)
 *
 * **CRITICAL — `Sheet.getRange(row, col, numRows, numCols)`**: 3·4번째는 **개수**.
 * 2행부터 N행 데이터 → `getRange(2, 1, N, cols)` — `1+N` / `2+N-1` 금지 → setValues 행 불일치 오류.
 * 프로젝트 규칙: `.cursor/rules/gas-sheet-getrange.mdc`
 */

/**
 * Properties에 남은 id는 “살아 있는 파일 핸들”이 아니라 **예전에 setProperty 해 둔 문자열**뿐이다.
 * 새 파일을 만들면 그때 나온 id로 **다시 setProperty** 하는 게 정상 경로이고, 여기서 하는 일은 **그 문자열이 아직 쓸 만한지**만 본다(삭제·휴지통이면 무효 처리 후 재생성 분기).
 * @param {string} fileId
 * @return {boolean}
 */
function dbDriveSpreadsheetIdIsUsableNow_(fileId) {
  var s = fileId != null ? String(fileId).trim() : '';
  if (!s) {
    return false;
  }
  try {
    var f = DriveApp.getFileById(s);
    if (f.isTrashed && typeof f.isTrashed === 'function' && f.isTrashed()) {
      return false;
    }
    if (f.getMimeType() !== 'application/vnd.google-apps.spreadsheet') {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Properties의 `SHEETS_MASTER_ID`로 원천 DB를 연다.
 * Drive에서 id가 무효/열기 실패면 **자동으로 새 DB를 만들지 않는다**.
 * (자동 재생성은 원천DB가 여러 개로 갈라져 데이터가 꼬이는 원인이므로 금지)
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function dbOpenMaster_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_MASTER_ID);
  if (id == null || !String(id).trim().length) {
    throw new Error('SHEETS_MASTER_ID 가 비어 있음. 먼저 dbSetupMasterDatabase() 실행.');
  }
  var sid = String(id).trim();
  if (!dbDriveSpreadsheetIdIsUsableNow_(sid)) {
    throw new Error('NO_SHEETS_MASTER: SHEETS_MASTER_ID 가 Drive에서 유효하지 않습니다(삭제·휴지통·권한·mime).');
  }
  try {
    return SpreadsheetApp.openById(sid);
  } catch (e) {
    throw new Error(
      'NO_SHEETS_MASTER: SHEETS_MASTER_ID openById 실패. ' + (e && e.message != null ? e.message : String(e))
    );
  }
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
 * 헤더·데이터가 `nKeep`열을 넘어 남아 있으면 그 열만 비움(스키마 축소 시 구 열 이름·값 제거)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} nKeep
 */
function dbSheetClearColumnsAfter_(sheet, nKeep) {
  if (!sheet || typeof nKeep !== 'number' || !isFinite(nKeep) || nKeep < 1) {
    return;
  }
  var lc = sheet.getLastColumn();
  if (lc <= nKeep) {
    return;
  }
  var lr = Math.max(sheet.getLastRow(), 1);
  sheet.getRange(1, nKeep + 1, lr, lc).clearContent();
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
  /** GAS `getRange(r,c,numRows,numCols)` — 3·4번째는 **개수**. 2행~lr행 = (lr-2+1)행 */
  sheet.getRange(2, 1, lr - 2 + 1, nCols).clearContent();
}

/**
 * 1행=헤더, 2행부터 n행 데이터 쓰기.
 * GAS `getRange(row,col,numRows,numCols)` — **3번째는 행 개수**(끝 행 인덱스 아님).
 * 예: 데이터 102행이면 `numRows=102` — `1+102`로 넣으면 103행 범위가 되어 102/103 오류 남.
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
  sheet.getRange(2, 1, n, nCols).setValues(norm);
}
