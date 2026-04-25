/**
 * product_mapping (층1) — 상태 조회, 운영 스프레드시트 생성, 목록(원천+병합), 배치 upsert
 */

/** @type {string[]} */
var _DB_PM_CATEGORIES = ['unmapped', 'solpass', 'solutine', 'challenge', 'textbook'];
/** @type {string[]} */
var _DB_PM_LIFECYCLES = ['active', 'archived', 'test'];

/**
 * @param {string} v
 * @param {string[]} allow
 * @return {string}
 */
function dbPmAssertEnum_(v, allow) {
  var s = v != null ? String(v).trim() : '';
  var a;
  for (a = 0; a < allow.length; a++) {
    if (allow[a] === s) {
      return s;
    }
  }
  return '';
}

/**
 * @return {string}
 */
function dbPmGetMasterParentFolderId_() {
  var p = PropertiesService.getScriptProperties();
  var mid = p.getProperty(DB_PROP_SHEETS_MASTER_ID);
  if (mid == null || !String(mid).trim()) {
    return '';
  }
  try {
    var f = DriveApp.getFileById(String(mid).trim());
    var it = f.getParents();
    if (it.hasNext()) {
      return it.next().getId();
    }
  } catch (e) {
    Logger.log('dbPmGetMasterParentFolderId_: ' + (e && e.message != null ? e.message : String(e)));
  }
  return '';
}

/**
 * @return {{ id: string, url: string, already: boolean, createdNew: boolean }|{ error: { code: string, message: string } }}
 */
function dbInitOperationsSheets_() {
  var p = PropertiesService.getScriptProperties();
  var existing = p.getProperty(DB_PROP_SHEETS_OPERATIONS_ID);
  existing = existing != null ? String(existing).trim() : '';
  if (existing) {
    try {
      var ss0 = SpreadsheetApp.openById(existing);
      dbGetOrCreateSheetWithHeaders_(ss0, DB_SHEET_PRODUCT_MAPPING, DB_PRODUCT_MAPPING_HEADERS);
      return {
        id: existing,
        url: 'https://docs.google.com/spreadsheets/d/' + existing + '/edit',
        already: true,
        createdNew: false,
        productMappingHeadersApplied: true
      };
    } catch (e0) {
      Logger.log('dbInitOperationsSheets_: existing id open fail, will recreate. ' + (e0 && e0.message));
      try {
        p.deleteProperty(DB_PROP_SHEETS_OPERATIONS_ID);
      } catch (del) {}
      existing = '';
    }
  }

  var folderId = dbPmGetMasterParentFolderId_();
  if (!folderId) {
    var base = dbResolveMasterParentFolderId_();
    if (base) {
      folderId = dbGetOrCreateDbSubfolder_(base) || '';
    }
  }
  if (!folderId) {
    return { error: { code: 'BAD_REQUEST', message: '원천 DB(SHEETS_MASTER_ID) 또는 Drive 부모 결정 실패' } };
  }

  var title = '솔루션편입_운영DB_아임웹';
  var file = dbDriveCreateSpreadsheetInFolder_(title, folderId);
  if (!file || !file.id) {
    return { error: { code: 'INTERNAL', message: 'Drive에 스프레드시트를 만들지 못했습니다.' } };
  }

  var id = String(file.id).trim();
  var ss = dbOpenNewSpreadsheetByIdWithRetry_(id);
  if (!ss) {
    return { error: { code: 'INTERNAL', message: '생성한 스프레드시트를 열지 못했습니다.' } };
  }

  dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_PRODUCT_MAPPING, DB_PRODUCT_MAPPING_HEADERS);
  dbDeleteOrphanDefaultSheetIfAny_(ss);
  p.setProperty(DB_PROP_SHEETS_OPERATIONS_ID, id);

  return {
    id: id,
    url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
    already: false,
    createdNew: true,
    productMappingHeadersApplied: true
  };
}

/**
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function dbPmOpenOpsOrThrow_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_OPERATIONS_ID);
  if (id == null || !String(id).trim()) {
    throw new Error('NO_OPERATIONS_SHEET');
  }
  var sid = String(id).trim();
  try {
    return SpreadsheetApp.openById(sid);
  } catch (e) {
    Logger.log('dbPmOpenOpsOrThrow_: openById 실패 — SHEETS_OPERATIONS_ID 제거. ' + (e && e.message != null ? e.message : String(e)));
    try {
      p.deleteProperty(DB_PROP_SHEETS_OPERATIONS_ID);
    } catch (d) {}
    throw new Error('NO_OPERATIONS_SHEET');
  }
}

/**
 * @return {Object}
 */
function dbProductMappingState_() {
  var masterUrl = openSyncMasterSpreadsheetUrl_();
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_OPERATIONS_ID);
  id = id != null ? String(id).trim() : '';
  if (!id) {
    return { ok: true, data: { ready: false, reason: 'NO_OPERATIONS_SHEET', masterSpreadsheetUrl: masterUrl, productMappingSheetName: DB_SHEET_PRODUCT_MAPPING } };
  }
  try {
    var ss = SpreadsheetApp.openById(id);
    if (!ss) {
      try {
        p.deleteProperty(DB_PROP_SHEETS_OPERATIONS_ID);
      } catch (d) {}
      return { ok: true, data: { ready: false, reason: 'NO_OPERATIONS_SHEET', masterSpreadsheetUrl: masterUrl, productMappingSheetName: DB_SHEET_PRODUCT_MAPPING } };
    }
    return {
      ok: true,
      data: {
        ready: true,
        operationsSpreadsheetId: id,
        operationsSpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
        productMappingSheetName: DB_SHEET_PRODUCT_MAPPING
      }
    };
  } catch (x) {
    try {
      p.deleteProperty(DB_PROP_SHEETS_OPERATIONS_ID);
    } catch (d) {}
    return { ok: true, data: { ready: false, reason: 'NO_OPERATIONS_SHEET', masterSpreadsheetUrl: masterUrl, productMappingSheetName: DB_SHEET_PRODUCT_MAPPING } };
  }
}

/**
 * @param {string|number} n
 * @return {string}
 */
function dbPmRowKey_(n) {
  if (n == null) {
    return '';
  }
  if (typeof n === 'number' && isFinite(n)) {
    return String(n);
  }
  var t = String(n).replace(/[,\s]/g, '');
  if (!t.length) {
    return '';
  }
  if (/^-?\d+(\.?\d+)?$/.test(t)) {
    return String(parseInt(t, 10));
  }
  return t;
}

/**
 * products 시트에서 2행~ 데이터, prod_no(인덱스0)·name(인덱스3) 사용
 * @return {{ ok: true, data: { rows: Object[], counts: Object } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbProductMappingList_() {
  var st = dbProductMappingState_();
  if (!st.ok || !st.data) {
    return { ok: false, error: { code: 'INTERNAL', message: 'state' } };
  }
  if (!st.data.ready) {
    return { ok: false, error: { code: 'NO_OPERATIONS_SHEET', message: '운영 DB가 아직 없습니다. 상품 불러오기로 생성합니다.' } };
  }

  var master;
  try {
    master = dbOpenMaster_();
  } catch (em) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: '원천 DB(SHEETS_MASTER_ID) 없음: ' + (em && em.message != null ? em.message : String(em)) } };
  }

  var ps = master.getSheetByName(DB_SHEET_PRODUCTS);
  if (!ps) {
    return { ok: true, data: { rows: [], counts: { unmapped: 0, solpass: 0, solutine: 0, challenge: 0, textbook: 0 } } };
  }
  var lr = ps.getLastRow();
  if (lr < 2) {
    return { ok: true, data: { rows: [], counts: { unmapped: 0, solpass: 0, solutine: 0, challenge: 0, textbook: 0 } } };
  }
  var nColsP = DB_PRODUCTS_HEADERS.length;
  var pVals = ps.getRange(2, 1, lr, nColsP).getValues();
  var idxProdNo = 0;
  var idxName = 3;

  var mapM = dbPmReadMappingMap_();
  var rows = [];
  var r;
  for (r = 0; r < pVals.length; r++) {
    var line = pVals[r] || [];
    var pk = dbPmRowKey_(line[idxProdNo]);
    if (!pk) {
      continue;
    }
    var prodNo = parseInt(line[idxProdNo], 10);
    if (isNaN(prodNo)) {
      continue;
    }
    var fromProductsName = String(line[idxName] != null ? line[idxName] : '').trim();
    var m = mapM[pk];
    var internal_category = m ? m.internal_category : 'unmapped';
    var lifecycle = m && m.lifecycle ? m.lifecycle : 'active';
    var product_name = m && m.product_name && String(m.product_name).length ? m.product_name : fromProductsName;
    var notes = m && m.notes != null ? String(m.notes) : '';
    var created_at = m && m.created_at != null ? String(m.created_at) : '';
    var updated_at = m && m.updated_at != null ? String(m.updated_at) : '';
    if (_DB_PM_CATEGORIES.indexOf(internal_category) < 0) {
      internal_category = 'unmapped';
    }
    if (_DB_PM_LIFECYCLES.indexOf(lifecycle) < 0) {
      lifecycle = 'active';
    }
    var disp = dbPmDisplayName20_(product_name);
    rows.push({
      prod_no: prodNo,
      product_name: product_name,
      product_name_display: disp,
      internal_category: internal_category,
      lifecycle: lifecycle,
      notes: notes,
      created_at: created_at,
      updated_at: updated_at
    });
  }

  var counts = { unmapped: 0, solpass: 0, solutine: 0, challenge: 0, textbook: 0 };
  for (r = 0; r < rows.length; r++) {
    var c = rows[r].internal_category;
    if (c === 'unmapped' || c === 'solpass' || c === 'solutine' || c === 'challenge' || c === 'textbook') {
      counts[c]++;
    }
  }

  return { ok: true, data: { rows: rows, counts: counts } };
}

/**
 * @return {Object<string, { product_name: string, internal_category: string, lifecycle: string, notes: string, created_at: string, updated_at: string }>}
 */
function dbPmReadMappingMap_() {
  var o = {};
  var ss;
  try {
    ss = dbPmOpenOpsOrThrow_();
  } catch (e) {
    return o;
  }
  var sh = ss.getSheetByName(DB_SHEET_PRODUCT_MAPPING);
  if (!sh) {
    return o;
  }
  var lr = sh.getLastRow();
  if (lr < 2) {
    return o;
  }
  var nCols = DB_PRODUCT_MAPPING_HEADERS.length;
  var v = sh.getRange(2, 1, lr, nCols).getValues();
  var i;
  for (i = 0; i < v.length; i++) {
    var line = v[i] || [];
    var pk = dbPmRowKey_(line[0]);
    if (!pk) {
      continue;
    }
    o[pk] = {
      product_name: String(line[1] != null ? line[1] : '').trim(),
      internal_category: String(line[2] != null ? line[2] : '').trim() || 'unmapped',
      lifecycle: String(line[3] != null ? line[3] : '').trim() || 'active',
      created_at: String(line[4] != null ? line[4] : ''),
      updated_at: String(line[5] != null ? line[5] : ''),
      notes: String(line[6] != null ? line[6] : '')
    };
  }
  return o;
}

/**
 * @param {string} s
 * @return {string}
 */
function dbPmDisplayName20_(s) {
  var t = s != null ? String(s) : '';
  if (t.length <= 20) {
    return t;
  }
  return t.slice(0, 20) + '…';
}

/**
 * @param {Object[]} inputRows
 * @return {Object}
 */
function dbProductMappingApply_(inputRows) {
  if (!inputRows || !inputRows.length) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'rows 비어 있음' } };
  }
  var ss;
  try {
    ss = dbPmOpenOpsOrThrow_();
  } catch (e) {
    return { ok: false, error: { code: 'NO_OPERATIONS_SHEET', message: '운영 DB가 없습니다.' } };
  }
  var sh = dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_PRODUCT_MAPPING, DB_PRODUCT_MAPPING_HEADERS);
  var lr = sh.getLastRow();
  var nCols = DB_PRODUCT_MAPPING_HEADERS.length;
  var colProdNo = 0;
  var indexByKey = {};
  if (lr >= 2) {
    var aVals = sh.getRange(2, 1, lr, 1).getValues();
    var a;
    for (a = 0; a < aVals.length; a++) {
      var k0 = dbPmRowKey_(aVals[a] != null && aVals[a].length ? aVals[a][0] : aVals[a]);
      if (k0) {
        indexByKey[k0] = 2 + a;
      }
    }
  }
  var now = new Date().toISOString();
  var w;
  for (w = 0; w < inputRows.length; w++) {
    var row = inputRows[w] || {};
    var pno = row.prod_no;
    var pnum = parseInt(pno, 10);
    if (isNaN(pnum)) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'prod_no 오류' } };
    }
    var ic = dbPmAssertEnum_(row.internal_category, _DB_PM_CATEGORIES);
    if (!ic) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'internal_category 허용 범위 아님' } };
    }
    var life = dbPmAssertEnum_(row.lifecycle, _DB_PM_LIFECYCLES);
    if (!life) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'lifecycle 허용 범위 아님' } };
    }
    var pname = String(row.product_name != null ? row.product_name : '').trim();
    var nnotes = String(row.notes != null ? row.notes : '');

    var k = String(pnum);
    var rowIdx = indexByKey[k];
    var created0 = now;
    if (rowIdx) {
      var old = sh.getRange(rowIdx, 1, rowIdx, nCols).getValues()[0] || [];
      if (old[4] && String(old[4]).length) {
        created0 = String(old[4]);
      }
    }
    var line = [pnum, pname, ic, life, created0, now, nnotes];
    if (rowIdx) {
      sh.getRange(rowIdx, 1, 1, nCols).setValues([line]);
    } else {
      sh.appendRow(line);
      indexByKey[k] = sh.getLastRow();
    }
  }
  return { ok: true, data: { upserted: inputRows.length, updated_at: now } };
}
