/**
 * 스프레드시트 open / 시트·헤더 보장. (read-only for humans: 쓰기는 이 모듈 + 동기 루틴만)
 */

/**
 * Properties의 `SHEETS_MASTER_ID`로 원천 DB를 연다.
 * 파일이 삭제·이동돼 `openById`가 실패하면 Property를 비우고 `dbSetupMasterDatabase()`로 **빈 원천 DB를 새로 만든 뒤** 다시 연다(수동 키 삭제 대신).
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function dbOpenMaster_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_MASTER_ID);
  if (id == null || !String(id).trim().length) {
    throw new Error('SHEETS_MASTER_ID 가 비어 있음. 먼저 dbSetupMasterDatabase() 실행.');
  }
  var sid = String(id).trim();
  try {
    return SpreadsheetApp.openById(sid);
  } catch (e) {
    Logger.log(
      'dbOpenMaster_: openById 실패(삭제·권한 등) — SHEETS_MASTER_ID 제거 후 dbSetupMasterDatabase. ' +
        (e && e.message != null ? e.message : String(e))
    );
    try {
      p.deleteProperty(DB_PROP_SHEETS_MASTER_ID);
    } catch (d) {}
    var info = dbSetupMasterDatabase();
    if (!info || !info.id) {
      throw new Error('원천 DB를 열 수 없고 재생성도 실패했습니다. Drive 폴더·`SHEETS_MASTER_PARENT_FOLDER_ID`·권한을 확인하세요.');
    }
    return SpreadsheetApp.openById(String(info.id).trim());
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
