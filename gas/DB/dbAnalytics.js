/**
 * 집계·분석(매출·건수 목표) — `SHEETS_ANALYTICS_ID` 전용 스프레드시트
 */

/**
 * 마스터 `orders.order_time` 스캔 — 대시보드 기간 선택의 **연도 하한·상한**·**가장 이른 주문일(서울)** (데이터 없으면 null).
 * @return {{ minYear: ?number, maxYear: ?number, minYmd: ?string }}
 */
function dbAnalyticsOrderYearBoundsForUi_() {
  var empty = { minYear: null, maxYear: null, minYmd: null };
  var ss;
  try {
    ss = dbOpenMaster_();
  } catch (e) {
    return empty;
  }
  var sh = ss.getSheetByName(DB_SHEET_ORDERS);
  if (!sh || sh.getLastRow() < 2) {
    return empty;
  }
  var lr = sh.getLastRow();
  var colTime = 2;
  var minY = 100000;
  var maxY = 0;
  var minYmd = /** @type {string|null} */ (null);
  var BATCH = 4000;
  var r0;
  for (r0 = 2; r0 <= lr; r0 += BATCH) {
    var r1 = Math.min(r0 + BATCH - 1, lr);
    var vals = sh.getRange(r0, colTime, r1, colTime).getValues();
    var j;
    for (j = 0; j < vals.length; j++) {
      var ymd = dbAnAnyToSeoulYmd_(vals[j][0]);
      if (!ymd || ymd.length < 8) {
        continue;
      }
      var yy = parseInt(ymd.slice(0, 4), 10);
      if (!isFinite(yy)) {
        continue;
      }
      if (yy < minY) {
        minY = yy;
      }
      if (yy > maxY) {
        maxY = yy;
      }
      if (!minYmd || ymd < minYmd) {
        minYmd = ymd;
      }
    }
  }
  if (minY === 100000) {
    return empty;
  }
  return { minYear: minY, maxYear: maxY, minYmd: minYmd };
}

/**
 * `dbProductMappingState_` 응답 data에 합칠 필드
 * @param {Object} data
 * @return {Object}
 */
function dbMergeAnalyticsIntoPmData_(data) {
  var yb = dbAnalyticsOrderYearBoundsForUi_();
  if (yb.minYear != null) {
    data.analyticsOrderMinYear = yb.minYear;
  }
  if (yb.maxYear != null) {
    data.analyticsOrderMaxYear = yb.maxYear;
  }
  if (yb.minYmd != null && String(yb.minYmd).length >= 8) {
    data.analyticsOrderMinYmd = yb.minYmd;
  }
  var a = dbAnalyticsStateFields_();
  data.analyticsReady = a.analyticsReady;
  data.analyticsReason = a.reason != null ? a.reason : '';
  data.analyticsSpreadsheetUrl = a.analyticsSpreadsheetUrl != null ? a.analyticsSpreadsheetUrl : '';
  data.analyticsKpiSheetName = a.analyticsKpiSheetName != null ? a.analyticsKpiSheetName : DB_SHEET_ANALYTICS_GOALS;
  data.analyticsFactSheetName = a.analyticsFactSheetName != null ? a.analyticsFactSheetName : DB_SHEET_ANALYTICS_ORDER_LINES;
  data.analyticsOrderLinesSheetName = a.analyticsOrderLinesSheetName != null ? a.analyticsOrderLinesSheetName : DB_SHEET_ANALYTICS_ORDER_LINES;
  return data;
}

/**
 * @return {{ analyticsReady: boolean, reason: string, analyticsSpreadsheetUrl: string, analyticsKpiSheetName: string, analyticsFactSheetName: string, analyticsOrderLinesSheetName: string }}
 */
function dbAnalyticsStateFields_() {
  var p = PropertiesService.getScriptProperties();
  var aId = p.getProperty(DB_PROP_SHEETS_ANALYTICS_ID);
  aId = aId != null ? String(aId).trim() : '';
  var empty = {
    analyticsReady: false,
    reason: 'NO_ANALYTICS_SHEET',
    analyticsSpreadsheetUrl: '',
    analyticsKpiSheetName: DB_SHEET_ANALYTICS_GOALS,
    analyticsFactSheetName: DB_SHEET_ANALYTICS_ORDER_LINES,
    analyticsOrderLinesSheetName: DB_SHEET_ANALYTICS_ORDER_LINES
  };
  if (!aId) {
    return empty;
  }
  if (!dbDriveSpreadsheetIdIsUsableNow_(aId)) {
    try {
      p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
    } catch (d) {}
    return empty;
  }
  try {
    var ss = SpreadsheetApp.openById(aId);
    if (!ss) {
      try {
        p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
      } catch (d) {}
      return empty;
    }
    return {
      analyticsReady: true,
      reason: '',
      analyticsSpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + aId + '/edit',
      analyticsKpiSheetName: DB_SHEET_ANALYTICS_GOALS,
      analyticsFactSheetName: DB_SHEET_ANALYTICS_ORDER_LINES,
      analyticsOrderLinesSheetName: DB_SHEET_ANALYTICS_ORDER_LINES
    };
  } catch (x) {
    Logger.log('dbAnalyticsStateFields_: ' + (x && x.message != null ? x.message : String(x)));
    try {
      p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
    } catch (d) {}
    return empty;
  }
}

/**
 * @param {string|number} a
 * @param {string|number} b
 * @return {string}
 */
function dbAnLineKey_(a, b) {
  return String(a != null ? a : '').trim() + '\t' + String(b != null ? b : '').trim();
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function dbAnGetGoalsSheet_(ss) {
  if (!ss) {
    return null;
  }
  var sh = ss.getSheetByName(DB_SHEET_ANALYTICS_GOALS);
  if (sh) {
    dbEnsureHeaderRow1_(sh, DB_ANALYTICS_GOALS_HEADERS);
    return sh;
  }
  var old = ss.getSheetByName(DB_SHEET_ANALYTICS_KPI_OLD);
  if (old) {
    try {
      old.setName(DB_SHEET_ANALYTICS_GOALS);
    } catch (rn) {
      Logger.log('dbAnGetGoalsSheet_ ' + (rn && rn.message != null ? rn.message : String(rn)));
    }
  }
  sh = ss.getSheetByName(DB_SHEET_ANALYTICS_GOALS);
  if (sh) {
    dbEnsureHeaderRow1_(sh, DB_ANALYTICS_GOALS_HEADERS);
    return sh;
  }
  if (DB_SHEET_ANALYTICS_KPI_LEGACY) {
    var leg = ss.getSheetByName(DB_SHEET_ANALYTICS_KPI_LEGACY);
    if (leg) {
      try {
        leg.setName(DB_SHEET_ANALYTICS_GOALS);
      } catch (rn2) {
        Logger.log('dbAnGetGoalsSheet_ ' + (rn2 && rn2.message != null ? rn2.message : String(rn2)));
      }
      sh = ss.getSheetByName(DB_SHEET_ANALYTICS_GOALS);
      if (sh) {
        dbEnsureHeaderRow1_(sh, DB_ANALYTICS_GOALS_HEADERS);
        return sh;
      }
    }
  }
  return dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_ANALYTICS_GOALS, DB_ANALYTICS_GOALS_HEADERS);
}

/**
 * `02_주문라인_실적` — 예 `fact_매출건수_일별` 탭이 있으면 이름만 바꿈
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function dbAnGetOrderLinesSheet_(ss) {
  if (!ss) {
    return null;
  }
  var sh = ss.getSheetByName(DB_SHEET_ANALYTICS_ORDER_LINES);
  if (sh) {
    dbEnsureHeaderRow1_(sh, DB_ANALYTICS_ORDER_LINE_HEADERS);
    dbSheetClearColumnsAfter_(sh, DB_ANALYTICS_ORDER_LINE_HEADERS.length);
    return sh;
  }
  var old = ss.getSheetByName(DB_SHEET_ANALYTICS_FACT_LEGACY);
  if (old) {
    try {
      old.setName(DB_SHEET_ANALYTICS_ORDER_LINES);
    } catch (e0) {
      Logger.log('dbAnGetOrderLinesSheet_ rename: ' + (e0 && e0.message));
    }
  }
  sh = ss.getSheetByName(DB_SHEET_ANALYTICS_ORDER_LINES);
  if (sh) {
    dbEnsureHeaderRow1_(sh, DB_ANALYTICS_ORDER_LINE_HEADERS);
    dbSheetClearColumnsAfter_(sh, DB_ANALYTICS_ORDER_LINE_HEADERS.length);
    return sh;
  }
  sh = dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_ANALYTICS_ORDER_LINES, DB_ANALYTICS_ORDER_LINE_HEADERS);
  dbSheetClearColumnsAfter_(sh, DB_ANALYTICS_ORDER_LINE_HEADERS.length);
  return sh;
}

/**
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function dbAnOpenOrThrow_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_ANALYTICS_ID);
  if (id == null || !String(id).trim()) {
    throw new Error('NO_ANALYTICS_SHEET');
  }
  var sid = String(id).trim();
  if (!dbDriveSpreadsheetIdIsUsableNow_(sid)) {
    try {
      p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
    } catch (d) {}
    throw new Error('NO_ANALYTICS_SHEET');
  }
  try {
    return SpreadsheetApp.openById(sid);
  } catch (e) {
    Logger.log('dbAnOpenOrThrow_: ' + (e && e.message != null ? e.message : String(e)));
    try {
      p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
    } catch (d) {}
    throw new Error('NO_ANALYTICS_SHEET');
  }
}

/**
 * 주문일 `yyyy-MM-dd`가 `sales_end` **다음 날 이후**이면 true (종료일 당일은 인정)
 * @param {string} orderYmd
 * @param {string} salesEndYmd
 * @return {boolean}
 */
function dbAnOrderYmdAfterSalesEndExclusive_(orderYmd, salesEndYmd) {
  var y = orderYmd != null ? String(orderYmd).trim() : '';
  var e = salesEndYmd != null ? String(salesEndYmd).trim() : '';
  if (y.length < 8 || e.length < 8) {
    return false;
  }
  return y > e;
}

/**
 * members 시트 `group_titles` 셀(JSON 배열 문자열) → 표시명 배열
 * @param {*} cell
 * @return {string[]}
 */
function dbAnParseGroupTitlesCell_(cell) {
  if (cell == null || cell === '') {
    return [];
  }
  var t = String(cell).trim();
  if (!t.length) {
    return [];
  }
  try {
    var j = JSON.parse(t);
    if (Array.isArray(j)) {
      var out = [];
      var k;
      for (k = 0; k < j.length; k++) {
        var s = j[k] != null ? String(j[k]).trim() : '';
        if (s.length) {
          out.push(s);
        }
      }
      return out;
    }
  } catch (e) {
    // ignore
  }
  return [];
}

/**
 * `02_주문라인_실적`에 쓰지 않음(솔루션편입_집계_매출건수) — **여기서만** 제외(원천 order_items/orders/members는 그대로).
 * - `product_mapping.lifecycle === test`
 * - 회원 `group_titles`에 **관리자** 이거나, 그룹명에 **테스트** 포함(테스트 계정 등)
 * @param {string} lifecycle
 * @param {string[]} groupTitleStrings
 * @return {boolean}
 */
function dbAnOrderLineSkipForAnalytics_(lifecycle, groupTitleStrings) {
  var life = lifecycle != null ? String(lifecycle).trim().toLowerCase() : '';
  if (life === 'test') {
    return true;
  }
  var arr = groupTitleStrings || [];
  var i;
  for (i = 0; i < arr.length; i++) {
    var t = arr[i] != null ? String(arr[i]).trim() : '';
    if (!t.length) {
      continue;
    }
    if (t === '관리자') {
      return true;
    }
    if (t.indexOf('테스트') !== -1) {
      return true;
    }
  }
  return false;
}

/**
 * 마스터 `order_items` 전체(테스트 `lifecycle` 포함) + `orders` + `products` + (읽기) `product_mapping` → `02_주문라인_실적` 전면 덮기
 * (제외: `internal_category === unmapped`, `dbAnOrderLineSkipForAnalytics_` — product_mapping lifecycle test 또는 회원 그룹명 관리자·「테스트」)
 * @return {{ ok: true, data: { written: number, excluded: number, batchId: string } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsOrderLinesRebuildFromMaster_() {
  var master;
  try {
    master = dbOpenMaster_();
  } catch (e0) {
    return { ok: false, error: { code: 'NO_SHEETS_MASTER', message: '원천 DB(SHEETS_MASTER_ID)를 열 수 없습니다.' } };
  }
  var shI = master.getSheetByName(DB_SHEET_ORDER_ITEMS);
  if (!shI || shI.getLastRow() < 2) {
    return { ok: false, error: { code: 'NO_ORDER_DATA', message: 'order_items이 비어 있습니다. 먼저 주문을 동기화하세요.' } };
  }
  var ssA;
  try {
    ssA = dbAnOpenOrThrow_();
  } catch (e1) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '집계·분석 시트가 없습니다. 먼저 준비합니다.' } };
  }
  var shO = master.getSheetByName(DB_SHEET_ORDERS);
  var orderMap = {};
  var orderToMember = {};
  if (shO && shO.getLastRow() >= 2) {
    var oLr = shO.getLastRow();
    var ov = shO.getRange(2, 1, oLr, 3).getValues();
    var oi;
    for (oi = 0; oi < ov.length; oi++) {
      var ol = ov[oi] || [];
      var on0 = String(ol[0] != null ? ol[0] : '').trim();
      if (on0) {
        orderMap[on0] = ol[1];
        orderToMember[on0] = String(ol[2] != null ? ol[2] : '').trim();
      }
    }
  }
  var memberToGroupTitles = {};
  var shMem = master.getSheetByName(DB_SHEET_MEMBERS);
  if (shMem && shMem.getLastRow() >= 2) {
    var mLr = shMem.getLastRow();
    var mW = DB_MEMBERS_HEADERS.length;
    var mVals = shMem.getRange(2, 1, mLr, mW).getValues();
    var ixMc = DB_MEMBERS_HEADERS.indexOf('member_code');
    var ixGt = DB_MEMBERS_HEADERS.indexOf('group_titles');
    if (ixMc < 0) {
      ixMc = 0;
    }
    var mx;
    for (mx = 0; mx < mVals.length; mx++) {
      var mRow = mVals[mx] || [];
      var mcode = String(mRow[ixMc] != null ? mRow[ixMc] : '').trim();
      if (!mcode.length) {
        continue;
      }
      var gCell = ixGt >= 0 ? mRow[ixGt] : '';
      memberToGroupTitles[mcode] = dbAnParseGroupTitlesCell_(gCell);
    }
  }
  var shP = master.getSheetByName(DB_SHEET_PRODUCTS);
  var addByProd = {};
  if (shP && shP.getLastRow() >= 2) {
    var pLr = shP.getLastRow();
    var pv = shP.getRange(2, 1, pLr, 11).getValues();
    var pi;
    for (pi = 0; pi < pv.length; pi++) {
      var pLine = pv[pi] || [];
      var pkk = dbPmRowKey_(pLine[0]);
      if (pkk) {
        addByProd[pkk] = pLine[9];
      }
    }
  }
  var pmMap = dbPmReadMappingMap_();
  var iLr = shI.getLastRow();
  var nCol = 11;
  var iVals = shI.getRange(2, 1, iLr, nCol).getValues();
  var out = [];
  var skipped = 0;
  var j;
  for (j = 0; j < iVals.length; j++) {
    var L = iVals[j] || [];
    var ordNo = String(L[2] != null ? L[2] : '').trim();
    var pkey = dbPmRowKey_(L[7]);
    var cat = 'unmapped';
    var life = 'active';
    if (pkey && pmMap[pkey]) {
      cat = String(pmMap[pkey].internal_category || 'unmapped').trim() || 'unmapped';
      life = String(pmMap[pkey].lifecycle || 'active').trim() || 'active';
    }
    var memCode = ordNo && orderToMember[ordNo] != null ? String(orderToMember[ordNo]).trim() : '';
    var gTitles = memCode.length && memberToGroupTitles[memCode] ? memberToGroupTitles[memCode] : [];
    if (cat === 'unmapped') {
      skipped++;
      continue;
    }
    if (dbAnOrderLineSkipForAnalytics_(life, gTitles)) {
      skipped++;
      continue;
    }
    var lineNet = dbNumO_(L[9]) - dbNumO_(L[10]);
    var sec = String(L[4] != null ? L[4] : '');
    out.push([
      L[0],
      L[1],
      ordNo,
      orderMap[ordNo] != null ? orderMap[ordNo] : '',
      L[7],
      String(L[8] != null ? L[8] : ''),
      lineNet,
      sec,
      cat,
      life,
      pkey && addByProd[pkey] != null && addByProd[pkey] !== undefined ? addByProd[pkey] : ''
    ]);
  }
  var shOut = dbAnGetOrderLinesSheet_(ssA);
  var w0 = DB_ANALYTICS_ORDER_LINE_HEADERS.length;
  dbClearDataRows2Plus_(shOut, w0);
  if (out.length) {
    /** `getRange` 3번째=행 **개수** — `1+out.length`면 261행 데이터에 262행 범위가 되어 setValues 실패 */
    shOut.getRange(2, 1, out.length, w0).setValues(out);
  }
  var batchId = 'ol-' + new Date().getTime();
  return { ok: true, data: { written: out.length, excluded: skipped, batchId: batchId } };
}

/**
 * @return {{ id: string, url: string, already: boolean, createdNew: boolean }|{ error: { code: string, message: string } }}
 */
function dbInitAnalyticsSheets_() {
  try {
    var p = PropertiesService.getScriptProperties();
    var existing = p.getProperty(DB_PROP_SHEETS_ANALYTICS_ID);
    existing = existing != null ? String(existing).trim() : '';
    if (existing) {
      if (!dbDriveSpreadsheetIdIsUsableNow_(existing)) {
        try {
          p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
        } catch (del) {}
        existing = '';
      } else {
        try {
          var ss0 = SpreadsheetApp.openById(existing);
          dbAnGetGoalsSheet_(ss0);
          dbAnGetOrderLinesSheet_(ss0);
          try {
            dbAnalyticsOrderLinesRebuildFromMaster_();
          } catch (eR) {
            Logger.log('dbInitAnalyticsSheets_ rebuild: ' + (eR && eR.message));
          }
          return {
            id: existing,
            url: 'https://docs.google.com/spreadsheets/d/' + existing + '/edit',
            already: true,
            createdNew: false
          };
        } catch (e0) {
          Logger.log('dbInitAnalyticsSheets_: existing open fail ' + (e0 && e0.message));
          try {
            p.deleteProperty(DB_PROP_SHEETS_ANALYTICS_ID);
          } catch (del) {}
          existing = '';
        }
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
      return {
        error: {
          code: 'ANALYTICS_NO_DRIVE_PARENT',
          message:
            '집계(마스터) 시트가 있는 Drive 위치를 정하지 못했습니다. 먼저 「데이터 동기화」 탭에서 집계를 한 번 실행해 마스터 파일·폴더를 잡은 뒤 다시 누르세요. (스크립트에 마스터가 없으면 이 단계가 필요합니다.)'
        }
      };
    }

    var title = '솔루션편입_일월간_매출_인원_지표';
    var file = dbDriveCreateSpreadsheetInFolder_(title, folderId);
    if (!file || !file.id) {
      return {
        error: {
          code: 'ANALYTICS_DRIVE_CREATE_FAILED',
          message:
            'Google Drive에 새 스프레드시트를 만들지 못했습니다. 실행 계정의 Drive 권한·팀(공유) 드라이브·API 할당량을 확인하세요. (Apps Script 실행(Executions) 로그에 HTTP 오류가 있을 수 있습니다.)'
        }
      };
    }

    var id = String(file.id).trim();
    var ss = dbOpenNewSpreadsheetByIdWithRetry_(id);
    if (!ss) {
      return {
        error: {
          code: 'ANALYTICS_OPEN_AFTER_CREATE',
          message:
            '만든 집계·분석 시트를 열지 못했습니다. 잠시 뒤 다시 시도하거나, GAS 웹앱 배포가 최신인지와 실행 계정 권한을 확인하세요.'
        }
      };
    }

    dbAnGetGoalsSheet_(ss);
    dbAnGetOrderLinesSheet_(ss);
    dbDeleteOrphanDefaultSheetIfAny_(ss);
    p.setProperty(DB_PROP_SHEETS_ANALYTICS_ID, id);
    try {
      dbAnalyticsOrderLinesRebuildFromMaster_();
    } catch (eR) {
      Logger.log('dbInitAnalyticsSheets_ new file rebuild: ' + (eR && eR.message));
    }

    return {
      id: id,
      url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      already: false,
      createdNew: true
    };
  } catch (x) {
    Logger.log('dbInitAnalyticsSheets_ exception: ' + (x && x.message != null ? x.message : String(x)));
    return {
      error: {
        code: 'ANALYTICS_INIT_EXCEPTION',
        message: '집계·분석 시트 준비 중 예외: ' + (x && x.message != null ? String(x.message) : String(x))
      }
    };
  }
}

/**
 * 기존 집계 스프레드시트(예전 탭명 포함) — `01/02`로 이행·헤더 맞춘 뒤 마스터 → `02_주문라인_실적` 전면 재구축. **목표 행은 지우지 않음.**
 * @return {{ ok: true, data: { written: number, batchId: string, goalsSheet: string, orderLinesSheet: string } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsSheetsRepair_() {
  var ss;
  try {
    ss = dbAnOpenOrThrow_();
  } catch (e0) {
    return {
      ok: false,
      error: {
        code: 'NO_ANALYTICS_SHEET',
        message: '집계·분석 시트가 없습니다. 먼저「집계용 드라이브 시트 생성」을 누릅니다.'
      }
    };
  }
  dbAnGetGoalsSheet_(ss);
  dbAnGetOrderLinesSheet_(ss);
  var rb = dbAnalyticsOrderLinesRebuildFromMaster_();
  if (!rb || !rb.ok) {
    return rb;
  }
  var d0 = rb.data || {};
  return {
    ok: true,
    data: {
      written: d0.written != null ? d0.written : 0,
      batchId: d0.batchId != null ? d0.batchId : '',
      goalsSheet: DB_SHEET_ANALYTICS_GOALS,
      orderLinesSheet: DB_SHEET_ANALYTICS_ORDER_LINES
    }
  };
}

/**
 * @param {number} y
 * @param {number} m
 * @return {boolean}
 */
/** `01_연월_목표.goal_target` — 전체 + 일별 매출 표와 같은 네 상품군만 허용 */
var _DB_ANALYTICS_GOAL_TARGETS_ALLOWED = ['entire', 'solpass', 'challenge', 'solutine'];

function dbAnValidYearMonth_(y, m) {
  if (typeof y !== 'number' || !isFinite(y) || y < 2000 || y > 2100) {
    return false;
  }
  if (typeof m !== 'number' || !isFinite(m) || m < 0 || m > 12) {
    return false;
  }
  return true;
}

/**
 * @param {Object} r
 * @return {boolean}
 */
function dbAnValidateTargetRow_(r) {
  if (!r || typeof r !== 'object') {
    return false;
  }
  var y = Number(r.year);
  var mo = Number(r.month);
  if (!dbAnValidYearMonth_(y, mo)) {
    return false;
  }
  var gt = String(
    r.goal_target != null ? r.goal_target : r.goalTarget != null ? r.goalTarget : ''
  )
    .trim()
    .toLowerCase();
  if (!gt.length) {
    return false;
  }
  if (_DB_ANALYTICS_GOAL_TARGETS_ALLOWED.indexOf(gt) < 0) {
    return false;
  }
  var sRaw =
    r.sales_target != null
      ? r.sales_target
      : r.salesTarget != null
        ? r.salesTarget
        : r.targetAmount != null
          ? r.targetAmount
          : r.target_amount;
  var pRaw =
    r.people_target != null
      ? r.people_target
      : r.peopleTarget != null
        ? r.peopleTarget
        : r.targetCount != null
          ? r.targetCount
          : r.target_count;
  if (sRaw !== null && sRaw !== undefined && String(sRaw).length) {
    var sa = Number(sRaw);
    if (!isFinite(sa) || sa < 0) {
      return false;
    }
  }
  if (pRaw !== null && pRaw !== undefined && String(pRaw).length) {
    var pa = Number(pRaw);
    if (!isFinite(pa) || pa < 0) {
      return false;
    }
  }
  return true;
}

/**
 * @return {{ ok: true, data: { rows: Object[] } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsTargetsRead_() {
  try {
    var ss = dbAnOpenOrThrow_();
  } catch (e) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '집계·분석 시트가 없습니다. 먼저 준비합니다.' } };
  }
  var sh = dbAnGetGoalsSheet_(ss);
  if (!sh) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '목표 시트를 못 열었습니다.' } };
  }
  var lr = sh.getLastRow();
  if (lr < 2) {
    return { ok: true, data: { rows: [] } };
  }
  var w = DB_ANALYTICS_GOALS_HEADERS.length;
  var vals = sh.getRange(2, 1, lr, w).getValues();
  var rows = [];
  var i;
  for (i = 0; i < vals.length; i++) {
    var line = vals[i] || [];
    rows.push({
      year: line[0],
      month: line[1],
      goal_target: String(line[2] != null ? line[2] : '')
        .trim()
        .toLowerCase(),
      sales_target: line[3],
      people_target: line[4]
    });
  }
  return { ok: true, data: { rows: rows } };
}

/**
 * @param {Object[]} rows
 * @return {{ ok: true, data: { written: number } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsTargetsApply_(rows) {
  if (!rows) {
    rows = [];
  }
  if (!Array.isArray(rows)) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'rows 배열이 아닙니다.' } };
  }
  var i;
  for (i = 0; i < rows.length; i++) {
    if (!dbAnValidateTargetRow_(rows[i])) {
      return {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            '목표 행 오류: year·month·goal_target(전체=entire, 솔패스·챌린지·솔루틴만)·매출·건수 (행 ' +
            (i + 1) +
            ')'
        }
      };
    }
  }
  try {
    var ss = dbAnOpenOrThrow_();
  } catch (e) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '집계·분석 시트가 없습니다.' } };
  }
  var sh = dbAnGetGoalsSheet_(ss);
  if (!sh) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '목표 시트를 못 열었습니다.' } };
  }
  var w = DB_ANALYTICS_GOALS_HEADERS.length;
  dbClearDataRows2Plus_(sh, w);
  if (!rows.length) {
    return { ok: true, data: { written: 0 } };
  }
  var out = [];
  for (i = 0; i < rows.length; i++) {
    var r = rows[i];
    var y2 = Number(r.year);
    var mo2 = Number(r.month);
    var gta = String(r.goal_target != null ? r.goal_target : r.goalTarget != null ? r.goalTarget : '')
      .trim()
      .toLowerCase();
    var sW =
      r.sales_target != null
        ? r.sales_target
        : r.salesTarget != null
          ? r.salesTarget
          : r.targetAmount != null
            ? r.targetAmount
            : r.target_amount;
    var pW =
      r.people_target != null
        ? r.people_target
        : r.peopleTarget != null
          ? r.peopleTarget
          : r.targetCount != null
            ? r.targetCount
            : r.target_count;
    out.push([y2, mo2, gta, sW, pW]);
  }
  dbSetValuesFromRow2_(sh, out, w);
  return { ok: true, data: { written: out.length } };
}

/**
 * 목표 + (예약) fact 본문 전부 비움
 * @return {{ ok: true, data: { reset: true } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsResetAll_() {
  try {
    var ss = dbAnOpenOrThrow_();
  } catch (e) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '집계·분석 시트가 없습니다.' } };
  }
  var shK = dbAnGetGoalsSheet_(ss);
  var shOl = dbAnGetOrderLinesSheet_(ss);
  if (!shK || !shOl) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '탭을 못 열었습니다.' } };
  }
  dbClearDataRows2Plus_(shK, DB_ANALYTICS_GOALS_HEADERS.length);
  dbClearDataRows2Plus_(shOl, DB_ANALYTICS_ORDER_LINE_HEADERS.length);
  var rb = dbAnalyticsOrderLinesRebuildFromMaster_();
  if (!rb || !rb.ok) {
    return { ok: true, data: { reset: true, rebuildMessage: rb && rb.error && rb.error.message ? rb.error.message : '' } };
  }
  return { ok: true, data: { reset: true, orderLinesWritten: rb.data && rb.data.written != null ? rb.data.written : 0 } };
}

/**
 * 주문(연,월)이 (a,b) **이전**이면 true — add_time **시작월** 미만
 * @param {number} oy
 * @param {number} om
 * @param {number} sy
 * @param {number} sm
 * @return {boolean}
 */
function dbAnOrderYmBefore_(oy, om, sy, sm) {
  if (oy < sy) {
    return true;
  }
  if (oy > sy) {
    return false;
  }
  return om < sm;
}

/**
 * 원천 `products.add_time` → 상품 **첫 판매 인정** 연·월(서울)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} master
 * @return {Object<string, { y: number, m: number }>} key: prodKey
 */
function dbAnReadMasterProductAddTimeYm_(master) {
  var o = {};
  if (!master) {
    return o;
  }
  var sh = master.getSheetByName(DB_SHEET_PRODUCTS);
  if (!sh || sh.getLastRow() < 2) {
    return o;
  }
  var lr = sh.getLastRow();
  var vals = sh.getRange(2, 1, lr, 11).getValues();
  var i;
  for (i = 0; i < vals.length; i++) {
    var L = vals[i] || [];
    var pk = dbPmRowKey_(L[0]);
    if (!pk) {
      continue;
    }
    var ymd = dbAnAnyToSeoulYmd_(L[9]);
    if (!ymd || ymd.length < 8) {
      continue;
    }
    var p = String(ymd).split('-');
    if (p.length < 2) {
      continue;
    }
    o[pk] = { y: parseInt(p[0], 10), m: parseInt(p[1], 10) };
  }
  return o;
}

/**
 * 주문시각 문자열 → { y, m } (월 1–12). 파싱 실패 시 y=NaN
 * @param {string|Date|number} s
 * @return {{ y: number, m: number }}
 */
function dbAnOrderTimeToYearMonth_(s) {
  if (s == null) {
    return { y: NaN, m: NaN };
  }
  if (s instanceof Date) {
    if (isNaN(s.getTime())) {
      return { y: NaN, m: NaN };
    }
    return { y: s.getFullYear(), m: s.getMonth() + 1 };
  }
  s = String(s).trim();
  if (!s.length) {
    return { y: NaN, m: NaN };
  }
  var m0 = s.match(/(\d{4})-(\d{1,2})/);
  if (m0) {
    return { y: parseInt(m0[1], 10), m: parseInt(m0[2], 10) };
  }
  var d = new Date(s);
  if (isNaN(d.getTime())) {
    return { y: NaN, m: NaN };
  }
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

/**
 * 주문시각 → 비교용 ms (최신 라인 선택). 파싱 실패 시 -Infinity
 * @param {string|Date|number} v
 * @return {number}
 */
function dbAnOrderTimeToMs_(v) {
  if (v == null || v === '') {
    return Number.NEGATIVE_INFINITY;
  }
  if (v instanceof Date) {
    var tx = v.getTime();
    return isNaN(tx) ? Number.NEGATIVE_INFINITY : tx;
  }
  var ds = new Date(String(v).trim());
  if (!isNaN(ds.getTime())) {
    return ds.getTime();
  }
  var ym = dbAnOrderTimeToYearMonth_(v);
  if (isFinite(ym.y) && isFinite(ym.m)) {
    return new Date(ym.y, ym.m - 1, 15).getTime();
  }
  return Number.NEGATIVE_INFINITY;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {number} y
 * @param {number} m 0=해당 연도 전체, 1–12=그 달
 * @return {{ totalSales: number, orderCount: number, uniqueMemberCount: number }}
 */
function dbAnAggregateOrdersForYm_(ss, y, m) {
  var empty = { totalSales: 0, orderCount: 0, uniqueMemberCount: 0 };
  if (!ss) {
    return empty;
  }
  var sh = ss.getSheetByName(DB_SHEET_ORDERS);
  if (!sh) {
    return empty;
  }
  var lr = sh.getLastRow();
  if (lr < 2) {
    return empty;
  }
  /** B: order_time, C: member, L: payment — getRange(2,2, lr, 12) */
  var data = sh.getRange(2, 2, lr, 12).getValues();
  var totalSales = 0;
  var orderCount = 0;
  var memSet = {};
  var i;
  for (i = 0; i < data.length; i++) {
    var line = data[i] || [];
    var t = line[0];
    var mem = line[1];
    var pay = line[10];
    var om = dbAnOrderTimeToYearMonth_(t);
    if (!isFinite(om.y) || !isFinite(om.m)) {
      continue;
    }
    if (m === 0) {
      if (om.y !== y) {
        continue;
      }
    } else {
      if (om.y !== y || om.m !== m) {
        continue;
      }
    }
    orderCount += 1;
    totalSales += dbNumO_(pay);
    var mstr = mem != null ? String(mem).trim() : '';
    if (mstr.length) {
      memSet[mstr] = 1;
    }
  }
  var u = 0;
  for (var k in memSet) {
    if (memSet.hasOwnProperty(k)) {
      u += 1;
    }
  }
  return { totalSales: totalSales, orderCount: orderCount, uniqueMemberCount: u };
}

/** 가상 fact·상단 실적 카드에서 빼는 대분류(미분류·자소서). 교재는 일별 순매출·구매 건수에 포함 — `lifecycle test`·관리자/테스트 그룹은 02 재구축 시 제외 */
var DB_AN_AGG_EXCLUDE_CATEGORY = { unmapped: true, jasoseo: true };

/**
 * `02_주문라인_실적` — `dbAnVirtualFactRowsFromOrderLines_`와 동일한 행 선별 후,
 * `DB_AN_AGG_EXCLUDE_CATEGORY` 대분류 줄 제외 후 순매출(매출−환불)·주문 건수(고유 order_no). (교재 포함)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssA 집계 스프레드시트
 * @param {number} y
 * @param {number} m 0 = 해당 연도 1–12월 전부, 1–12 = 해당 월만
 * @return {{ netSales: number, orderCount: number }}
 */
function dbAnSalesCardsMetricsFrom02_(ssA, y, m) {
  var z = { netSales: 0, orderCount: 0 };
  if (!ssA || !isFinite(y) || !isFinite(m) || m < 0 || m > 12) {
    return z;
  }
  var sh = dbAnGetOrderLinesSheet_(ssA);
  var lr = sh.getLastRow();
  if (lr < 2) {
    return z;
  }
  var w0 = DB_ANALYTICS_ORDER_LINE_HEADERS.length;
  var vals = sh.getRange(2, 1, lr, w0).getValues();

  var master = null;
  try {
    master = dbOpenMaster_();
  } catch (eM) {
    master = null;
  }
  var addMap = master ? dbAnReadMasterProductAddTimeYm_(master) : {};
  var pmMap = dbPmReadMappingMap_();

  var salesSum = 0;
  var refundSum = 0;
  var ordSet = {};

  var j;
  for (j = 0; j < vals.length; j++) {
    var L2 = vals[j] || [];
    var ordN = String(L2[2] != null ? L2[2] : '').trim();
    if (!ordN) {
      continue;
    }
    var ymd0 = dbAnAnyToSeoulYmd_(L2[3]);
    if (!ymd0) {
      continue;
    }
    var pr2 = ymd0.split('-');
    if (pr2.length < 2) {
      continue;
    }
    if (parseInt(pr2[0], 10) !== y) {
      continue;
    }
    if (m !== 0) {
      if (parseInt(pr2[1], 10) !== m) {
        continue;
      }
    }
    var claim2 = String(L2[7] != null ? L2[7] : '').trim();
    var isRe = claim2 === 'cancel' || claim2 === 'return';
    var pRaw2 = L2[4];
    var pkey2 = dbPmRowKey_(pRaw2);
    var cat2 = String(L2[8] != null ? L2[8] : 'unmapped').trim() || 'unmapped';
    var life2 = String(L2[9] != null ? L2[9] : '').trim();
    if (life2 === 'test') {
      continue;
    }
    if (DB_AN_AGG_EXCLUDE_CATEGORY[cat2]) {
      continue;
    }
    var ymdP2 = ymd0.split('-');
    if (ymdP2.length < 2) {
      continue;
    }
    var oy2 = parseInt(ymdP2[0], 10);
    var om02 = parseInt(ymdP2[1], 10);
    var st2 = pkey2 ? addMap[pkey2] : null;
    if (st2 && dbAnOrderYmBefore_(oy2, om02, st2.y, st2.m)) {
      continue;
    }
    var pmR2 = pkey2 ? pmMap[pkey2] : null;
    var seY2 = pmR2 && pmR2.sales_end ? String(pmR2.sales_end).trim() : '';
    if (seY2.length >= 8 && dbAnOrderYmdAfterSalesEndExclusive_(ymd0, seY2)) {
      continue;
    }
    var rawAmt2 = dbNumO_(L2[6]);
    if (isRe) {
      var ra2 = Math.abs(rawAmt2);
      if (ra2 > 0) {
        refundSum += ra2;
      }
    } else {
      if (rawAmt2 > 0) {
        salesSum += rawAmt2;
      }
    }
    ordSet[ordN] = 1;
  }
  var oc = 0;
  for (var ko in ordSet) {
    if (ordSet.hasOwnProperty(ko)) {
      oc++;
    }
  }
  z.netSales = salesSum - refundSum;
  z.orderCount = oc;
  return z;
}

/**
 * 상단 실적 카드 — 집계 시트 `02_주문라인_실적` 기준 (마스터 orders 아님).
 * m이 1–12면 해당 월·전년 동월, m이 0이면 해당 연도·전년도 각각 1–12월 합계.
 * @param {number} y
 * @param {number} m 0 = 연도 합계, 1–12 = 해당 월
 * @return {{ ok: true, data: Object }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsMasterActualsGet_(y, m) {
  if (typeof y !== 'number' || !isFinite(y) || y < 2000 || y > 2100) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'year(2000–2100)이 필요합니다.' } };
  }
  if (typeof m !== 'number' || !isFinite(m) || m < 0 || m > 12 || Math.floor(m) !== m) {
    return {
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'month는 0(연도 합계) 또는 1–12가 필요합니다. (집계 02 기준)' }
    };
  }
  var ssA;
  try {
    ssA = dbAnOpenOrThrow_();
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'NO_ANALYTICS_SHEET',
        message:
          '집계·분석 시트(매출건수)를 열지 못했습니다. 집계용 드라이브 파일을 연 뒤 다시 시도합니다.'
      }
    };
  }
  var cur = dbAnSalesCardsMetricsFrom02_(ssA, y, m);
  var py = y - 1;
  var pm = m;
  var prev = dbAnSalesCardsMetricsFrom02_(ssA, py, pm);
  return {
    ok: true,
    data: {
      year: y,
      month: m,
      actualSales: cur.netSales,
      orderCount: cur.orderCount,
      uniqueMemberCount: 0,
      prevYear: {
        year: py,
        month: pm,
        actualSales: prev.netSales,
        orderCount: prev.orderCount,
        uniqueMemberCount: 0
      }
    }
  };
}

/* ----- 집계 전용 `fact_매출건수_일별` — **일 단위만** 저장. 누적·전년·주 합은 조회·리포트에서 **연산**. ----- */

var DB_AN_FACT_SALES = 'sales_amount';
var DB_AN_FACT_REFUND = 'refund_amount';
var DB_AN_FACT_LINES = 'line_count';
var DB_AN_FACT_UM = 'unique_members';
/** 분류(대분류)별 그 달 **고유** 구매자 수 — 일별 `um` 합이 아님 */
var DB_AN_FACT_UM_MONTH_CAT = 'unique_members_month_category';

/**
 * 주문시각(문자) → Asia/Seoul `yyyy-MM-dd` (빈 문자면 파싱 실패)
 * @param {string} s
 * @return {string}
 */
function dbAnOrderTimeToSeoulYmd_(s) {
  s = s != null ? String(s).trim() : '';
  if (!s.length) {
    return '';
  }
  var d = new Date(s);
  if (isNaN(d.getTime())) {
    return '';
  }
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
}

/**
 * 시트/셀 `Date` 또는 문자 — 서울 `yyyy-MM-dd`
 * @param {string|Date|number} v
 * @return {string}
 */
function dbAnAnyToSeoulYmd_(v) {
  if (v == null) {
    return '';
  }
  if (v instanceof Date) {
    if (isNaN(v.getTime())) {
      return '';
    }
    return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  }
  return dbAnOrderTimeToSeoulYmd_(v);
}

/**
 * `YYYY-MM-DD`가 `year`·`month` 범위에 들어가는지. `m===0`이면 그 해 전체 월.
 * @param {string} ymd
 * @param {number} y
 * @param {number} m
 * @return {boolean}
 */
function dbAnYmdInScope_(ymd, y, m) {
  if (ymd == null || String(ymd).length < 8) {
    return false;
  }
  var p = String(ymd).split('-');
  if (p.length < 3) {
    return false;
  }
  var yy = parseInt(p[0], 10);
  var mm = parseInt(p[1], 10);
  if (yy !== y) {
    return false;
  }
  if (m === 0) {
    return isFinite(mm) && mm >= 1 && mm <= 12;
  }
  return mm === m;
}

/**
 * @param {number} y
 * @param {number} m
 * @return {{ first: string, last: string }}
 */
function dbAnBoundsYmdKst_(y, m) {
  if (m < 1 || m > 12) {
    return { first: y + '-01-01', last: y + '-12-31' };
  }
  var lastDay = new Date(y, m, 0).getDate();
  var pad = m < 10 ? '0' + m : String(m);
  return {
    first: y + '-' + pad + '-01',
    last: y + '-' + pad + '-' + (lastDay < 10 ? '0' : '') + lastDay
  };
}

/**
 * fact 롱 뷰 — 실제 시트는 `02_주문라인_실적`(구 fact 이름 이행)과 동일
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function dbAnGetFactSheetOrThrow_() {
  return dbAnGetOrderLinesSheet_(dbAnOpenOrThrow_());
}

/**
 * `order_time` 열(4) 기준 `YYYY-MM-` prefix — 02_주문라인_실적 **부분** 삭제용(수선 보조)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} shF
 * @param {string} pfx
 */
function dbAnFactDeleteRowsYmdInMonth_(shF, pfx) {
  var lr = shF.getLastRow();
  if (lr < 2) {
    return 0;
  }
  var w = DB_ANALYTICS_ORDER_LINE_HEADERS.length;
  var colT = 4;
  var tVals = shF.getRange(2, colT, lr, colT).getValues();
  var keepRows = [];
  var r;
  var removed = 0;
  for (r = 0; r < tVals.length; r++) {
    var a = dbAnAnyToSeoulYmd_(tVals[r][0]);
    if (pfx && pfx.length && a.indexOf(pfx) === 0) {
      removed++;
    } else {
      keepRows.push(r);
    }
  }
  if (removed < 1) {
    return 0;
  }
  if (keepRows.length < 1) {
    shF.getRange(2, 1, lr, w).clearContent();
    return removed;
  }
  var all = shF.getRange(2, 1, lr, w).getValues();
  var newRows = [];
  for (r = 0; r < keepRows.length; r++) {
    newRows.push(all[keepRows[r]]);
  }
  shF.getRange(2, 1, lr, w).clearContent();
  shF.getRange(2, 1, newRows.length, w).setValues(newRows);
  return removed;
}

/**
 * `02_주문라인_실적` + (읽기) 마스터 `orders` + 상품 `add_time` — 기존 fact 롱과 동일한 **가상** 행(리포트는 시트 fact가 아님)
 * @param {number} y
 * @param {number} m
 * @return {{ ok: true, data: { rows: Object[] } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnVirtualFactRowsFromOrderLines_(y, m) {
  var ssA;
  try {
    ssA = dbAnOpenOrThrow_();
  } catch (e) {
    return { ok: false, error: { code: 'NO_ANALYTICS_SHEET', message: '집계·분석 시트가 없습니다.' } };
  }
  var sh = dbAnGetOrderLinesSheet_(ssA);
  var lr = sh.getLastRow();
  if (lr < 2) {
    return { ok: true, data: { rows: [] } };
  }
  var w0 = DB_ANALYTICS_ORDER_LINE_HEADERS.length;
  var vals = sh.getRange(2, 1, lr, w0).getValues();

  var master = null;
  try {
    master = dbOpenMaster_();
  } catch (eM) {
    master = null;
  }
  var orderMem = {};
  if (master) {
    var shO = master.getSheetByName(DB_SHEET_ORDERS);
    if (shO && shO.getLastRow() >= 2) {
      var oLr2 = shO.getLastRow();
      var oVals2 = shO.getRange(2, 1, oLr2, 3).getValues();
      var oi2;
      for (oi2 = 0; oi2 < oVals2.length; oi2++) {
        var oLn = oVals2[oi2] || [];
        var on0 = String(oLn[0] != null ? oLn[0] : '').trim();
        if (on0) {
          orderMem[on0] = String(oLn[2] != null ? oLn[2] : '').trim();
        }
      }
    }
  }
  var addMap = master ? dbAnReadMasterProductAddTimeYm_(master) : {};
  var pmMapV = dbPmReadMappingMap_();
  var monthMemByCat = {};
  var agg = {};
  var um2 = {};
  function addAgg(ymd, cat, pno, metric, val) {
    var pk = pno + '\t' + ymd + '\t' + cat + '\t' + metric;
    if (!agg[pk]) {
      agg[pk] = 0;
    }
    agg[pk] += val;
  }
  var j;
  for (j = 0; j < vals.length; j++) {
    var L2 = vals[j] || [];
    var ordN = String(L2[2] != null ? L2[2] : '').trim();
    if (!ordN) {
      continue;
    }
    var ymd0 = dbAnAnyToSeoulYmd_(L2[3]);
    if (!ymd0) {
      continue;
    }
    var pr2 = ymd0.split('-');
    if (pr2.length < 2) {
      continue;
    }
    if (parseInt(pr2[0], 10) !== y) {
      continue;
    }
    if (m >= 1 && m <= 12) {
      if (parseInt(pr2[1], 10) !== m) {
        continue;
      }
    }
    var claim2 = String(L2[7] != null ? L2[7] : '').trim();
    var isRe = claim2 === 'cancel' || claim2 === 'return';
    var pRaw2 = L2[4];
    var pkey2 = dbPmRowKey_(pRaw2);
    var cat2 = String(L2[8] != null ? L2[8] : 'unmapped').trim() || 'unmapped';
    var pnum2 = parseInt(pRaw2, 10);
    var pnoS2 = isNaN(pnum2) ? '' : String(pnum2);
    var life2 = String(L2[9] != null ? L2[9] : '').trim();
    if (life2 === 'test') {
      continue;
    }
    if (DB_AN_AGG_EXCLUDE_CATEGORY[cat2]) {
      continue;
    }
    var ymdP2 = ymd0.split('-');
    if (ymdP2.length < 2) {
      continue;
    }
    var oy2 = parseInt(ymdP2[0], 10);
    var om02 = parseInt(ymdP2[1], 10);
    var st2 = pkey2 ? addMap[pkey2] : null;
    if (st2 && dbAnOrderYmBefore_(oy2, om02, st2.y, st2.m)) {
      continue;
    }
    var pmRv = pkey2 ? pmMapV[pkey2] : null;
    var seYv = pmRv && pmRv.sales_end ? String(pmRv.sales_end).trim() : '';
    if (seYv.length >= 8 && dbAnOrderYmdAfterSalesEndExclusive_(ymd0, seYv)) {
      continue;
    }
    var rawAmt2 = dbNumO_(L2[6]);
    if (isRe) {
      var ra2 = Math.abs(rawAmt2);
      if (ra2 > 0) {
        addAgg(ymd0, cat2, pnoS2, DB_AN_FACT_REFUND, ra2);
      }
    } else {
      if (rawAmt2 > 0) {
        addAgg(ymd0, cat2, pnoS2, DB_AN_FACT_SALES, rawAmt2);
      }
      addAgg(ymd0, cat2, pnoS2, DB_AN_FACT_LINES, 1);
    }
    if (!isRe) {
      var mem2 = orderMem[ordN];
      if (mem2) {
        var uu2 = ymd0 + '\t' + cat2;
        if (!um2[uu2]) {
          um2[uu2] = {};
        }
        um2[uu2][mem2] = 1;
        var mck2 = String(oy2) + '|' + String(om02) + '|' + cat2;
        if (!monthMemByCat[mck2]) {
          monthMemByCat[mck2] = {};
        }
        monthMemByCat[mck2][mem2] = 1;
      }
    }
  }
  var batchId = 'v02-' + new Date().getTime();
  var nowIso2 = new Date().toISOString();
  var out2 = [];
  for (var key2 in agg) {
    if (!agg.hasOwnProperty(key2)) {
      continue;
    }
    if (!agg[key2]) {
      continue;
    }
    var parts2 = String(key2).split('\t');
    if (parts2.length < 4) {
      continue;
    }
    out2.push([parts2[1], parts2[3], parts2[2], parts2[0], agg[key2], batchId, nowIso2]);
  }
  for (var uk2 in um2) {
    if (!um2.hasOwnProperty(uk2)) {
      continue;
    }
    var p2b = String(uk2).split('\t');
    if (p2b.length < 2) {
      continue;
    }
    var ymdU2 = p2b[0];
    var catU2 = p2b[1];
    var cnt2b = 0;
    for (var mk2b in um2[uk2]) {
      if (um2[uk2].hasOwnProperty(mk2b)) {
        cnt2b++;
      }
    }
    if (cnt2b > 0) {
      out2.push([ymdU2, DB_AN_FACT_UM, catU2, '', cnt2b, batchId, nowIso2]);
    }
  }
  for (var mck2b in monthMemByCat) {
    if (!monthMemByCat.hasOwnProperty(mck2b)) {
      continue;
    }
    var pe2 = String(mck2b).split('|');
    if (pe2.length < 3) {
      continue;
    }
    var oyy2 = parseInt(pe2[0], 10);
    var omm2 = parseInt(pe2[1], 10);
    var catt2 = pe2[2];
    var cnt2c = 0;
    for (var mk2c in monthMemByCat[mck2b]) {
      if (monthMemByCat[mck2b].hasOwnProperty(mk2c)) {
        cnt2c++;
      }
    }
    if (cnt2c < 1) {
      continue;
    }
    var padM2 = omm2 < 10 ? '0' + omm2 : String(omm2);
    out2.push([oyy2 + '-' + padM2 + '-01', DB_AN_FACT_UM_MONTH_CAT, catt2, '', cnt2c, batchId, nowIso2]);
  }
  var rows2 = [];
  for (var r2 = 0; r2 < out2.length; r2++) {
    var ln2 = out2[r2];
    rows2.push({
      date_ymd: ln2[0],
      metric: ln2[1],
      internal_category: ln2[2],
      prod_no: ln2[3],
      value: ln2[4],
      batch_id: ln2[5],
      updated_at: ln2[6]
    });
  }
  return { ok: true, data: { rows: rows2 } };
}

/**
 * API 호환: 마스터 → `02_주문라인_실적` **전면** 재구축(연·월은 검증만, 부분 갱신 아님)
 * @param {number} y
 * @param {number} m
 * @return {{ ok: true, data: { written: number, excluded: number, removed: number, batchId: string } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsFactRebuildFromMaster_(y, m) {
  if (typeof y !== 'number' || !isFinite(y) || y < 2000 || y > 2100) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'year(2000–2100)이 필요합니다.' } };
  }
  if (typeof m !== 'number' || !isFinite(m) || m < 0 || m > 12) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'month(0–12) — 0이면 그 해 1~12월 전부' } };
  }
  var r = dbAnalyticsOrderLinesRebuildFromMaster_();
  if (!r.ok) {
    return r;
  }
  var ex = r.data && r.data.excluded != null ? r.data.excluded : 0;
  return { ok: true, data: { written: r.data.written, excluded: ex, removed: 0, batchId: r.data.batchId } };
}

/**
 * fact 롱 — 02_주문라인_실적을 집계한 **가상** 행(HTTP·리포트 호환)
 * @param {number} y
 * @param {number} m
 * @return {{ ok: true, data: { rows: Object[] } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbAnalyticsFactRowsGet_(y, m) {
  return dbAnVirtualFactRowsFromOrderLines_(y, m);
}

/**
 * 매출=대분류→상품, 건수=상품별, 월 고유 인원=대분류(`unique_members_month_category`)
 * @param {Object[]} rows
 * @return {Object}
 */
function dbAnBuildSalesCountHierarchy_(rows) {
  var salesByCat = {};
  var salesByProd = {};
  var linesByProd = {};
  var umMonthCat = {};
  var k;
  for (k = 0; k < rows.length; k++) {
    var r = rows[k];
    var cat = String(r.internal_category);
    var met = String(r.metric);
    var v0 = dbNumO_(r.value);
    var pno = String(r.prod_no != null ? r.prod_no : '').trim();
    if (met === DB_AN_FACT_SALES) {
      if (!salesByCat[cat]) {
        salesByCat[cat] = 0;
      }
      salesByCat[cat] += v0;
      if (pno.length) {
        var pk = cat + '\t' + pno;
        if (!salesByProd[pk]) {
          salesByProd[pk] = 0;
        }
        salesByProd[pk] += v0;
      }
    } else if (met === DB_AN_FACT_LINES) {
      if (pno.length) {
        if (!linesByProd[pno]) {
          linesByProd[pno] = 0;
        }
        linesByProd[pno] += v0;
      }
    } else if (met === DB_AN_FACT_UM_MONTH_CAT) {
      umMonthCat[cat] = v0;
    }
  }
  var salesTree = {};
  var c;
  for (c in salesByCat) {
    if (salesByCat.hasOwnProperty(c)) {
      salesTree[c] = { categoryTotal: salesByCat[c], products: {} };
    }
  }
  for (var pk2 in salesByProd) {
    if (!salesByProd.hasOwnProperty(pk2)) {
      continue;
    }
    var se = String(pk2).split('\t');
    if (se.length < 2) {
      continue;
    }
    var c0 = se[0];
    var pr0 = se[1];
    if (!salesTree[c0]) {
      salesTree[c0] = { categoryTotal: salesByCat[c0] != null ? salesByCat[c0] : 0, products: {} };
    }
    salesTree[c0].products[pr0] = salesByProd[pk2];
  }
  return {
    salesByCategoryThenProduct: salesTree,
    lineCountsByProduct: linesByProd,
    uniqueMembersMonthByCategory: umMonthCat
  };
}

/**
 * `02_주문라인_실적`에서 prod_no → prod_name (프론트 격자 라벨용)
 * 같은 상품번호라도 **order_time이 가장 늦은 라인**의 스냅샷 이름을 쓴다(시트 행 순서 무관).
 * @return {Object<string, string>}
 */
function dbAnalytics02ProdNameMap_() {
  var out = {};
  var bestMs = {};
  var ssA;
  try {
    ssA = dbAnOpenOrThrow_();
  } catch (e) {
    return out;
  }
  var sh = dbAnGetOrderLinesSheet_(ssA);
  if (!sh || sh.getLastRow() < 2) {
    return out;
  }
  var lr = sh.getLastRow();
  var nR = Math.max(0, lr - 1);
  /** 열 4~6: order_time, prod_no, prod_name */
  var v = nR > 0 ? sh.getRange(2, 4, nR, 3).getValues() : [];
  var j;
  for (j = 0; j < v.length; j++) {
    var row = v[j] || [];
    var pk = dbPmRowKey_(row[1]);
    if (!pk.length) {
      continue;
    }
    var tMs = dbAnOrderTimeToMs_(row[0]);
    var nm = String(row[2] != null ? row[2] : '').trim() || '상품 ' + pk;
    var cur = bestMs[pk];
    if (cur === undefined || tMs >= cur) {
      bestMs[pk] = tMs;
      out[pk] = nm;
    }
  }
  return out;
}

/**
 * 누적·전년(동월) **연산** — DB에 `누적` 행을 쌓지 않음
 * @param {number} y
 * @param {number} m
 * @return {Object}
 */
function dbAnalyticsFactReportComputed_(y, m) {
  var cur = dbAnalyticsFactRowsGet_(y, m);
  var pr = dbAnalyticsFactRowsGet_(y - 1, m);
  var aCur = cur && cur.ok && cur.data && cur.data.rows ? cur.data.rows : [];
  var aPr = pr && pr.ok && pr.data && pr.data.rows ? pr.data.rows : [];
  var hierC = dbAnBuildSalesCountHierarchy_(aCur);
  var hierP = dbAnBuildSalesCountHierarchy_(aPr);
  function roll(rows) {
    var byDay = {};
    var tot = {};
    var k;
    for (k = 0; k < rows.length; k++) {
      var r = rows[k];
      var d = String(r.date_ymd);
      var cat = String(r.internal_category);
      var met = String(r.metric);
      if (met === DB_AN_FACT_UM_MONTH_CAT) {
        continue;
      }
      var v0 = dbNumO_(r.value);
      if (!byDay[d]) {
        byDay[d] = {};
      }
      if (!byDay[d][cat]) {
        byDay[d][cat] = { sales: 0, refund: 0, lines: 0, um: 0 };
      }
      if (met === DB_AN_FACT_SALES) {
        byDay[d][cat].sales += v0;
        if (!tot[cat]) {
          tot[cat] = { sales: 0, refund: 0, lines: 0, um: 0 };
        }
        tot[cat].sales += v0;
      } else if (met === DB_AN_FACT_REFUND) {
        byDay[d][cat].refund += v0;
        if (!tot[cat]) {
          tot[cat] = { sales: 0, refund: 0, lines: 0, um: 0 };
        }
        tot[cat].refund += v0;
      } else if (met === DB_AN_FACT_LINES) {
        byDay[d][cat].lines += v0;
        if (!tot[cat]) {
          tot[cat] = { sales: 0, refund: 0, lines: 0, um: 0 };
        }
        tot[cat].lines += v0;
      } else if (met === DB_AN_FACT_UM) {
        byDay[d][cat].um = v0;
        if (!tot[cat]) {
          tot[cat] = { sales: 0, refund: 0, lines: 0, um: 0 };
        }
        tot[cat].um += v0;
      }
    }
    return { byDay: byDay, monthTotals: tot };
  }
  var c = roll(aCur);
  var pR = roll(aPr);
  var bounds = m > 0 && m < 13 ? dbAnBoundsYmdKst_(y, m) : { first: y + '-01-01', last: y + '-12-31' };
  var daysSorted = Object.keys(c.byDay).sort();
  var runningByDate = [];
  var runCat = {};
  for (var di2 = 0; di2 < daysSorted.length; di2++) {
    var ds2 = daysSorted[di2];
    var daySlice = { date: ds2, netByCategory: {} };
    var cats2 = c.byDay[ds2] || {};
    for (var catn2 in cats2) {
      if (!cats2.hasOwnProperty(catn2)) {
        continue;
      }
      if (!runCat[catn2]) {
        runCat[catn2] = 0;
      }
      var dd2 = cats2[catn2];
      var n02 = (dd2.sales != null ? dd2.sales : 0) - (dd2.refund != null ? dd2.refund : 0);
      runCat[catn2] += n02;
      daySlice.netByCategory[catn2] = runCat[catn2];
    }
    runningByDate.push(daySlice);
  }
  var nameMap = dbAnalytics02ProdNameMap_();
  return {
    year: y,
    month: m,
    bounds: bounds,
    current: c,
    previousYear: { year: y - 1, month: m, roll: pR },
    runningNetByDate: runningByDate,
    salesAndCountsHierarchy: { current: hierC, previousYear: hierP },
    categoryOrder: _DB_PM_CATEGORIES,
    prodNameByNo: nameMap,
    previousYearDataAvailable: aPr.length > 0,
    note:
      '매출: salesByCategoryThenProduct(대분류→상품). 건수: lineCountsByProduct(상품). 누적(순액): runningNetByDate. uniqueMembersMonthByCategory=월간 분류별 고유 인원(일별 um 합 아님). 상품별 판매 종료: product_mapping.sales_end(당일 포함), 그 이후 주문·줄은 집계 제외.'
  };
}
