/**
 * 수강생 관리 DB — `솔루션편입_수강생_마스터` (docs/SCHEMA_STUDENT_MANAGEMENT.md)
 * 원천 `order_items`·`orders`·`members`·`product_mapping` 읽기 → 이벤트·마스터 전면 재구축.
 */

/** 원천에 그대로 있어도 수강생 이벤트에 올리지 않음 — 키: `order_item_code` */
var DB_STU_FORCE_SKIP_ORDER_ITEM_CODES_ = {
  oi20260221610510d93a19c: true
};

/**
 * 원천에 없는 특이 케이스 고정 이벤트(리빌드 시 항상 병합).
 * 날짜 입력은 `yyyy.MM.dd`/`yyyy-MM-dd`/`yyyy/MM/dd` 모두 허용.
 */
var DB_STU_FIXED_MANUAL_EVENTS_ = [
  {
    manual_key: 'fixed_hongboyoung_20260209_challenge',
    member_code: '',
    name: '홍보영',
    internal_category: 'challenge',
    lifecycle: 'active',
    order_time: '2026.02.09',
    product_start_date: '2026.02.09',
    product_end_date: '2026.02.14',
    order_status: 'closed',
    section_status: 'PURCHASE_CONFIRMATION',
    prod_no: '79',
    prod_name: '일주일 만에 영어 노베이스 탈출하기 챌린지'
  },
  {
    manual_key: 'fixed_kimtaeyun_20260209_challenge',
    member_code: 'm2026020743093367f2541',
    name: '김태윤',
    internal_category: 'challenge',
    lifecycle: 'active',
    order_time: '2026.02.09',
    product_start_date: '2026.02.09',
    product_end_date: '2026.02.14',
    order_status: 'closed',
    section_status: 'PURCHASE_CONFIRMATION',
    prod_no: '79',
    prod_name: '일주일 만에 영어 노베이스 탈출하기 챌린지'
  },
  {
    manual_key: 'fixed_leeminje_20260209_challenge',
    member_code: 'm20260209d1920f53cc5da',
    name: '이민제',
    internal_category: 'challenge',
    lifecycle: 'active',
    order_time: '2026.02.09',
    product_start_date: '2026.02.09',
    product_end_date: '2026.02.14',
    order_status: 'closed',
    section_status: 'PURCHASE_CONFIRMATION',
    prod_no: '79',
    prod_name: '일주일 만에 영어 노베이스 탈출하기 챌린지'
  },
  {
    manual_key: 'fixed_hwangseoyoung_20260209_challenge',
    member_code: 'm202602090b4074ae8656d',
    name: '황서영',
    internal_category: 'challenge',
    lifecycle: 'active',
    order_time: '2026.02.09',
    product_start_date: '2026.02.09',
    product_end_date: '2026.02.14',
    order_status: 'closed',
    section_status: 'PURCHASE_CONFIRMATION',
    prod_no: '79',
    prod_name: '일주일 만에 영어 노베이스 탈출하기 챌린지'
  }
];

/**
 * @param {*} input
 * @param {boolean} endOfDay
 * @return {string}
 */
function dbStuNormalizeManualDateTime_(input, endOfDay) {
  var s = input != null ? String(input).trim() : '';
  if (!s.length) {
    return '';
  }
  var m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) {
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    if (isFinite(y) && isFinite(mo) && isFinite(d)) {
      var dt = new Date(y, mo - 1, d);
      return (
        Utilities.formatDate(dt, 'Asia/Seoul', 'yyyy-MM-dd') +
        (endOfDay ? ' 23:59:59' : ' 00:00:00')
      );
    }
  }
  var ymd = s.slice(0, 10).replace(/[.\/]/g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return ymd + (endOfDay ? ' 23:59:59' : ' 00:00:00');
  }
  return s;
}

/**
 * --- STUDENT `product_end_date` 기본 가산 일수 ---
 * 운영 정책이 바뀌면 **이 함수만** 고치면 됨. (스키마 문서와 주석을 함께 맞출 것.)
 * `jasoseo` 는 종료일 없음(빈 칸).
 *
 * @param {string} internalCategory
 * @return {number} 0 이면 종료일 비움
 */
function dbStuDefaultDurationDaysForCategory_(internalCategory) {
  var c = internalCategory != null ? String(internalCategory).trim().toLowerCase() : '';
  if (c === 'jasoseo') {
    return 0;
  }
  if (c === 'challenge') {
    return 14;
  }
  if (c === 'solpass') {
    return 28;
  }
  /** 솔루틴: 시작일 포함 26일(예: 4/6 시작 → 5/1 종료) — `dbStuEndDateFromStartYmd_` 와 동일 규칙 */
  if (c === 'solutine') {
    return 26;
  }
  return 28;
}

/**
 * 구매일(서울) 다음 날 00:00:00 현지 표시 문자열
 * @param {string|Date} orderTimeRaw
 * @return {string}
 */
function dbStuNextDayMidnightSeoulString_(orderTimeRaw) {
  var ymd = dbAnOrderTimeToSeoulYmd_(orderTimeRaw);
  if (!ymd || ymd.length < 10) {
    return orderTimeRaw != null ? String(orderTimeRaw) : '';
  }
  var p = ymd.split('-');
  var y = parseInt(p[0], 10);
  var mo = parseInt(p[1], 10) - 1;
  var d = parseInt(p[2], 10);
  var dt = new Date(y, mo, d);
  dt.setDate(dt.getDate() + 1);
  return Utilities.formatDate(dt, 'Asia/Seoul', 'yyyy-MM-dd') + ' 00:00:00';
}

/**
 * 시작일(날짜, 앞 10자 yyyy-MM-dd)을 **1일째로 포함**한 N일권의 **마지막 날** 23:59:59 서울.
 * 예: 3/27 시작·28일권 → 3/27~4/23 → 종료 4/23 23:59:59 (시작 + (N-1)일).
 * @param {string} startCell
 * @param {number} nDays
 * @return {string}
 */
function dbStuEndDateFromStartYmd_(startCell, nDays) {
  if (!nDays || nDays < 1) {
    return '';
  }
  var s = startCell != null ? String(startCell).trim() : '';
  if (!s.length) {
    return '';
  }
  var ymd = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return '';
  }
  var p = ymd.split('-');
  var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  dt.setDate(dt.getDate() + (nDays - 1));
  return Utilities.formatDate(dt, 'Asia/Seoul', 'yyyy-MM-dd') + ' 23:59:59';
}

/**
 * 수강생 DB 전용 구매자 제외 — **전화번호 규칙 없음** (이름만 집계와 동일 strict)
 * @param {string} orderNo
 * @param {Object} ordererNameMap
 * @return {boolean}
 */
function dbStuSkipByPurchaser_(orderNo, ordererNameMap) {
  return Boolean(orderNo && ordererNameMap[orderNo] === '솔루션편입');
}

/**
 * @param {string} cat
 * @return {boolean}
 */
function dbStuIsAllowedCategory_(cat) {
  var c = cat != null ? String(cat).trim().toLowerCase() : '';
  return c === 'solpass' || c === 'challenge' || c === 'solutine' || c === 'jasoseo';
}

/**
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet|null}
 */
function dbStuOpen_() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_STUDENT_ID);
  id = id != null ? String(id).trim() : '';
  if (!id || !dbDriveSpreadsheetIdIsUsableNow_(id)) {
    return null;
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    Logger.log('dbStuOpen_: ' + (e && e.message != null ? e.message : String(e)));
    return null;
  }
}

/**
 * @return {{ studentMgmtReady: boolean, studentMgmtReason: string, studentMgmtSpreadsheetUrl: string, studentMemberRowCount: number, studentEventRowCount: number }}
 */
function dbStudentStateFields_() {
  var empty = {
    studentMgmtReady: false,
    studentMgmtReason: 'NO_STUDENT_SHEET',
    studentMgmtSpreadsheetUrl: '',
    studentMemberRowCount: 0,
    studentEventRowCount: 0
  };
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_STUDENT_ID);
  id = id != null ? String(id).trim() : '';
  if (!id) {
    return empty;
  }
  if (!dbDriveSpreadsheetIdIsUsableNow_(id)) {
    return empty;
  }
  try {
    var ss = SpreadsheetApp.openById(id);
    if (!ss) {
      return empty;
    }
    var shM = ss.getSheetByName(DB_SHEET_STUDENT_MEMBER_MASTER);
    var shE = ss.getSheetByName(DB_SHEET_STUDENT_ORDER_EVENTS);
    var mCount = shM && shM.getLastRow() >= 2 ? shM.getLastRow() - 1 : 0;
    var eCount = shE && shE.getLastRow() >= 2 ? shE.getLastRow() - 1 : 0;
    return {
      studentMgmtReady: true,
      studentMgmtReason: '',
      studentMgmtSpreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      studentMemberRowCount: mCount,
      studentEventRowCount: eCount
    };
  } catch (x) {
    Logger.log('dbStudentStateFields_: ' + (x && x.message != null ? x.message : String(x)));
    return empty;
  }
}

/**
 * 기존 이벤트 시트에서 `product_start_date`·`product_end_date` 만 보존 (order_item_code 키)
 * @param {GoogleAppsScript.Spreadsheet.Sheet} shE
 * @return {Object<string, {start: *, end: *, updated: *}>}
 */
function dbStuReadPreserveDates_(shE) {
  var out = {};
  if (!shE || shE.getLastRow() < 2) {
    return out;
  }
  var w = DB_STUDENT_ORDER_EVENT_HEADERS.length;
  var hdr = shE.getRange(1, 1, 1, w).getValues()[0];
  var ixCode = -1;
  var ixStart = -1;
  var ixEnd = -1;
  var ixUpdated = -1;
  var i;
  for (i = 0; i < hdr.length; i++) {
    var h = String(hdr[i] != null ? hdr[i] : '').trim();
    if (h === 'order_item_code') {
      ixCode = i;
    }
    if (h === 'product_start_date') {
      ixStart = i;
    }
    if (h === 'product_end_date') {
      ixEnd = i;
    }
    if (h === 'updated_at') {
      ixUpdated = i;
    }
  }
  if (ixCode < 0) {
    return out;
  }
  var lr = shE.getLastRow();
  var vals = shE.getRange(2, 1, lr - 1, w).getValues();
  var j;
  for (j = 0; j < vals.length; j++) {
    var row = vals[j] || [];
    var code = String(row[ixCode] != null ? row[ixCode] : '').trim();
    if (!code.length) {
      continue;
    }
    out[code] = {
      start: ixStart >= 0 ? row[ixStart] : '',
      end: ixEnd >= 0 ? row[ixEnd] : '',
      updated: ixUpdated >= 0 ? row[ixUpdated] : ''
    };
  }
  return out;
}

/**
 * @param {string} s
 * @return {string}
 */
function dbStuNormalizeYmd_(s) {
  var t = s != null ? String(s).trim() : '';
  if (!t.length) {
    return '';
  }
  var m = t.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    var y = m[1];
    var mo = ('0' + String(parseInt(m[2], 10))).slice(-2);
    var d = ('0' + String(parseInt(m[3], 10))).slice(-2);
    return y + '-' + mo + '-' + d;
  }
  var p = t.slice(0, 10).replace(/[.\/]/g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : '';
}

/**
 * @param {*} v
 * @return {Date|null}
 */
function dbStuDateFromAny_(v) {
  var ymd = dbStuNormalizeYmd_(v != null ? String(v) : '');
  if (!ymd) {
    return null;
  }
  var p = ymd.split('-');
  var dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  return isFinite(dt.getTime()) ? dt : null;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh
 * @param {string[]} headers
 * @return {Object}
 */
function dbStuHeaderIndexMap_(sh, headers) {
  var out = {};
  var w = headers.length;
  var hdr = sh.getRange(1, 1, 1, w).getValues()[0];
  var i;
  for (i = 0; i < hdr.length; i++) {
    out[String(hdr[i] != null ? hdr[i] : '').trim()] = i;
  }
  return out;
}

/**
 * @param {Object<string, {start: *, end: *, updated: *}>} preserve
 * @param {string} nowIso
 * @param {string} batchId
 * @return {{ rows: Array<Array<*>>, manualNameByMemberCode: Object<string, string> }}
 */
function dbStuBuildFixedManualRows_(preserve, nowIso, batchId) {
  var rows = [];
  var manualNameByMemberCode = {};
  var i;
  for (i = 0; i < DB_STU_FIXED_MANUAL_EVENTS_.length; i++) {
    var m = DB_STU_FIXED_MANUAL_EVENTS_[i] || {};
    var itemCode = 'manual_' + String(m.manual_key != null ? m.manual_key : '').trim();
    if (!itemCode || itemCode === 'manual_') {
      continue;
    }
    var memberCode = String(m.member_code != null ? m.member_code : '').trim();
    var memberName = String(m.name != null ? m.name : '').trim();
    if (memberCode.length && memberName.length) {
      manualNameByMemberCode[memberCode] = memberName;
    }
    var pStart = dbStuNormalizeManualDateTime_(m.product_start_date, false);
    var pEnd = dbStuNormalizeManualDateTime_(m.product_end_date, true);
    var rowEv = [
      itemCode,
      'manual_' + String(i + 1),
      memberCode,
      dbStuNormalizeManualDateTime_(m.order_time, false),
      String(m.internal_category != null ? m.internal_category : '').trim().toLowerCase() || 'challenge',
      String(m.lifecycle != null ? m.lifecycle : '').trim().toLowerCase() || 'active',
      pStart,
      pEnd,
      String(m.order_status != null ? m.order_status : '').trim() || 'closed',
      String(m.section_status != null ? m.section_status : '').trim() || 'PURCHASE_CONFIRMATION',
      '',
      '',
      '',
      String(m.prod_no != null ? m.prod_no : '').trim(),
      String(m.prod_name != null ? m.prod_name : '').trim(),
      '',
      '',
      JSON.stringify({
        source: 'manual_fixed',
        manual_key: String(m.manual_key != null ? m.manual_key : ''),
        name: memberName
      }),
      '',
      nowIso,
      batchId
    ];
    var prev = preserve[itemCode];
    if (prev) {
      if (prev.start !== '' && prev.start != null) {
        rowEv[6] = prev.start;
      }
      if (prev.end !== '' && prev.end != null) {
        rowEv[7] = prev.end;
      }
      if (prev.updated !== '' && prev.updated != null) {
        rowEv[18] = prev.updated;
      }
    }
    rows.push(rowEv);
  }
  return { rows: rows, manualNameByMemberCode: manualNameByMemberCode };
}

/**
 * 수강 시작/종료일 편집 목록: (member_code, category)별 최신 1건만 반환.
 * 종료일이 현재 기준 14일 초과 지난 건은 제외.
 * @return {{ ok: true, data: { rows: Object[] } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbStudentMgmtDateEditorList_() {
  var ssStu = dbStuOpen_();
  if (!ssStu) {
    return { ok: false, error: { code: 'NO_STUDENT_SHEET', message: '수강생 DB가 없습니다.' } };
  }
  var shEv = ssStu.getSheetByName(DB_SHEET_STUDENT_ORDER_EVENTS);
  var shM = ssStu.getSheetByName(DB_SHEET_STUDENT_MEMBER_MASTER);
  if (!shEv || shEv.getLastRow() < 2) {
    return { ok: true, data: { rows: [] } };
  }
  var evIdx = dbStuHeaderIndexMap_(shEv, DB_STUDENT_ORDER_EVENT_HEADERS);
  var rows = shEv.getRange(2, 1, shEv.getLastRow() - 1, DB_STUDENT_ORDER_EVENT_HEADERS.length).getValues();
  var nameByMemberCode = {};
  if (shM && shM.getLastRow() >= 2) {
    var mIdx = dbStuHeaderIndexMap_(shM, DB_STUDENT_MEMBER_HEADERS);
    var mVals = shM.getRange(2, 1, shM.getLastRow() - 1, DB_STUDENT_MEMBER_HEADERS.length).getValues();
    var mi;
    for (mi = 0; mi < mVals.length; mi++) {
      var mr = mVals[mi] || [];
      var mc = String(mr[mIdx.member_code] != null ? mr[mIdx.member_code] : '').trim();
      if (!mc.length) {
        continue;
      }
      var nm = String(mr[mIdx.name] != null ? mr[mIdx.name] : '').trim();
      if (nm.length) {
        nameByMemberCode[mc] = nm;
      }
    }
  }
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  var bestByKey = {};
  var i;
  for (i = 0; i < rows.length; i++) {
    var r = rows[i] || [];
    var cat = String(r[evIdx.internal_category] != null ? r[evIdx.internal_category] : '').trim().toLowerCase();
    if (!dbStuIsAllowedCategory_(cat)) {
      continue;
    }
    if (cat === 'jasoseo') {
      continue;
    }
    var claimStatus = String(r[evIdx.claim_status] != null ? r[evIdx.claim_status] : '').trim().toLowerCase();
    if (claimStatus === 'cancel') {
      continue;
    }
    var endRaw = r[evIdx.product_end_date];
    if (String(endRaw != null ? endRaw : '').trim().length) {
      var endDt = dbStuDateFromAny_(endRaw);
      if (endDt && endDt.getTime() < cutoff.getTime()) {
        continue;
      }
    }
    var memberCode = String(r[evIdx.member_code] != null ? r[evIdx.member_code] : '').trim();
    var itemCode = String(r[evIdx.order_item_code] != null ? r[evIdx.order_item_code] : '').trim();
    if (!itemCode.length) {
      continue;
    }
    var key = (memberCode.length ? memberCode : '__guest__' + itemCode) + '|' + cat;
    var ot = String(r[evIdx.order_time] != null ? r[evIdx.order_time] : '').trim();
    var otKey = dbStuNormalizeYmd_(ot) + '|' + ot;
    var prev = bestByKey[key];
    if (!prev || otKey > prev.orderTimeKey || (otKey === prev.orderTimeKey && itemCode > prev.orderItemCode)) {
      var nm0 = memberCode.length && nameByMemberCode[memberCode] ? nameByMemberCode[memberCode] : '';
      if (!nm0.length) {
        nm0 = memberCode.length ? memberCode + '(비회원)' : '비회원';
      }
      bestByKey[key] = {
        orderItemCode: itemCode,
        memberCode: memberCode,
        memberName: nm0,
        internalCategory: cat,
        orderTime: ot,
        productStartDate: String(r[evIdx.product_start_date] != null ? r[evIdx.product_start_date] : ''),
        productEndDate: String(r[evIdx.product_end_date] != null ? r[evIdx.product_end_date] : ''),
        updatedAt: String(evIdx.updated_at >= 0 && r[evIdx.updated_at] != null ? r[evIdx.updated_at] : ''),
        prodName: String(r[evIdx.prod_name] != null ? r[evIdx.prod_name] : ''),
        orderTimeKey: otKey
      };
    }
  }
  var out = [];
  var keys = Object.keys(bestByKey);
  var ki;
  for (ki = 0; ki < keys.length; ki++) {
    var it = bestByKey[keys[ki]];
    delete it.orderTimeKey;
    out.push(it);
  }
  out.sort(function (a, b) {
    var an = String(a.memberName || '');
    var bn = String(b.memberName || '');
    if (an !== bn) {
      return an.localeCompare(bn);
    }
    var ac = String(a.internalCategory || '');
    var bc = String(b.internalCategory || '');
    if (ac !== bc) {
      return ac.localeCompare(bc);
    }
    return String(b.orderTime || '').localeCompare(String(a.orderTime || ''));
  });
  return { ok: true, data: { rows: out } };
}

/**
 * @param {Object} payload
 * @return {{ ok: true, data: { orderItemCode: string, productStartDate: string, productEndDate: string, updatedAt: string } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbStudentMgmtDateEditorSave_(payload) {
  payload = payload || {};
  var orderItemCode = payload.orderItemCode != null ? String(payload.orderItemCode).trim() : '';
  if (!orderItemCode.length) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'orderItemCode가 필요합니다.' } };
  }
  var ssStu = dbStuOpen_();
  if (!ssStu) {
    return { ok: false, error: { code: 'NO_STUDENT_SHEET', message: '수강생 DB가 없습니다.' } };
  }
  var shEv = ssStu.getSheetByName(DB_SHEET_STUDENT_ORDER_EVENTS);
  if (!shEv || shEv.getLastRow() < 2) {
    return { ok: false, error: { code: 'NO_EVENT_ROWS', message: '수강생 이벤트 데이터가 없습니다.' } };
  }
  var idx = dbStuHeaderIndexMap_(shEv, DB_STUDENT_ORDER_EVENT_HEADERS);
  var vals = shEv.getRange(2, 1, shEv.getLastRow() - 1, DB_STUDENT_ORDER_EVENT_HEADERS.length).getValues();
  var rowNo = -1;
  var found = null;
  var i;
  for (i = 0; i < vals.length; i++) {
    var r = vals[i] || [];
    if (String(r[idx.order_item_code] != null ? r[idx.order_item_code] : '').trim() === orderItemCode) {
      rowNo = i + 2;
      found = r;
      break;
    }
  }
  if (rowNo < 2 || !found) {
    return { ok: false, error: { code: 'NOT_FOUND', message: '수정할 주문 항목을 찾지 못했습니다.' } };
  }
  var changedStart = Boolean(payload.changedStart);
  var changedEnd = Boolean(payload.changedEnd);
  if (!changedStart && !changedEnd) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: '변경된 값이 없습니다.' } };
  }
  var cat = String(found[idx.internal_category] != null ? found[idx.internal_category] : '').trim().toLowerCase();
  var startCurrent = String(found[idx.product_start_date] != null ? found[idx.product_start_date] : '');
  var endCurrent = String(found[idx.product_end_date] != null ? found[idx.product_end_date] : '');
  var startOut = startCurrent;
  var endOut = endCurrent;
  if (changedStart) {
    var startYmd = dbStuNormalizeYmd_(payload.productStartDate != null ? String(payload.productStartDate) : '');
    if (!startYmd) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: '시작일 형식이 올바르지 않습니다.' } };
    }
    startOut = startYmd + ' 00:00:00';
    if (!changedEnd) {
      if (cat === 'jasoseo') {
        endOut = '';
      } else {
        var nd = dbStuDefaultDurationDaysForCategory_(cat);
        endOut = dbStuEndDateFromStartYmd_(startOut, nd);
      }
    }
  }
  if (changedEnd) {
    var endYmd = dbStuNormalizeYmd_(payload.productEndDate != null ? String(payload.productEndDate) : '');
    endOut = endYmd ? endYmd + ' 23:59:59' : '';
  }
  if (cat !== 'jasoseo' && endOut) {
    var sDt = dbStuDateFromAny_(startOut);
    var eDt = dbStuDateFromAny_(endOut);
    if (sDt && eDt && eDt.getTime() < sDt.getTime()) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: '종료일은 시작일보다 빠를 수 없습니다.' } };
    }
  }
  var nowIso = new Date().toISOString();
  shEv.getRange(rowNo, idx.product_start_date + 1, 1, 1).setValue(startOut);
  shEv.getRange(rowNo, idx.product_end_date + 1, 1, 1).setValue(endOut);
  if (idx.updated_at >= 0) {
    shEv.getRange(rowNo, idx.updated_at + 1, 1, 1).setValue(nowIso);
  }
  return {
    ok: true,
    data: {
      orderItemCode: orderItemCode,
      productStartDate: startOut,
      productEndDate: endOut,
      updatedAt: nowIso
    }
  };
}

/**
 * @param {Object} payload
 * @return {{ ok: true, data: { saved: number, rows: Object[] } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbStudentMgmtDateEditorSaveBatch_(payload) {
  payload = payload || {};
  var rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) {
    return { ok: false, error: { code: 'BAD_REQUEST', message: 'rows가 비어 있습니다.' } };
  }
  var out = [];
  var i;
  for (i = 0; i < rows.length; i++) {
    var one = rows[i] || {};
    var r = dbStudentMgmtDateEditorSave_(one);
    if (!r || !r.ok) {
      return r || { ok: false, error: { code: 'SAVE_FAILED', message: '저장 실패' } };
    }
    out.push(r.data || {});
  }
  return { ok: true, data: { saved: out.length, rows: out } };
}

/**
 * @return {{ id: string, url: string, already: boolean, createdNew: boolean }|{ error: { code: string, message: string } }}
 */
function dbInitStudentMgmtSheets_() {
  try {
    var p = PropertiesService.getScriptProperties();
    var existing = p.getProperty(DB_PROP_SHEETS_STUDENT_ID);
    existing = existing != null ? String(existing).trim() : '';
    if (existing) {
      if (!dbDriveSpreadsheetIdIsUsableNow_(existing)) {
        existing = '';
      } else {
        try {
          var ss0 = SpreadsheetApp.openById(existing);
          dbGetOrCreateSheetWithHeaders_(ss0, DB_SHEET_STUDENT_MEMBER_MASTER, DB_STUDENT_MEMBER_HEADERS);
          dbGetOrCreateSheetWithHeaders_(ss0, DB_SHEET_STUDENT_ORDER_EVENTS, DB_STUDENT_ORDER_EVENT_HEADERS);
          dbSheetClearColumnsAfter_(ss0.getSheetByName(DB_SHEET_STUDENT_MEMBER_MASTER), DB_STUDENT_MEMBER_HEADERS.length);
          dbSheetClearColumnsAfter_(ss0.getSheetByName(DB_SHEET_STUDENT_ORDER_EVENTS), DB_STUDENT_ORDER_EVENT_HEADERS.length);
          try {
            dbStudentMgmtRebuildFromMaster_();
          } catch (eR) {
            Logger.log('dbInitStudentMgmtSheets_ rebuild: ' + (eR && eR.message));
          }
          return {
            id: existing,
            url: 'https://docs.google.com/spreadsheets/d/' + existing + '/edit',
            already: true,
            createdNew: false
          };
        } catch (e0) {
          Logger.log('dbInitStudentMgmtSheets_: existing open fail ' + (e0 && e0.message));
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
          code: 'STUDENT_NO_DRIVE_PARENT',
          message:
            '수강생 DB를 둘 Drive 위치를 정하지 못했습니다. 먼저 「데이터 동기화」로 마스터 파일을 만든 뒤 다시 시도하세요.'
        }
      };
    }

    if (!existing) {
      var reusedId = dbAnFindSpreadsheetIdByNamesInFolder_(folderId, [DB_STUDENT_SPREADSHEET_TITLE]);
      if (reusedId) {
        var ssReuse = SpreadsheetApp.openById(reusedId);
        dbGetOrCreateSheetWithHeaders_(ssReuse, DB_SHEET_STUDENT_MEMBER_MASTER, DB_STUDENT_MEMBER_HEADERS);
        dbGetOrCreateSheetWithHeaders_(ssReuse, DB_SHEET_STUDENT_ORDER_EVENTS, DB_STUDENT_ORDER_EVENT_HEADERS);
        p.setProperty(DB_PROP_SHEETS_STUDENT_ID, reusedId);
        dbDeleteOrphanDefaultSheetIfAny_(ssReuse);
        try {
          dbStudentMgmtRebuildFromMaster_();
        } catch (eRR) {
          Logger.log('dbInitStudentMgmtSheets_ reused rebuild: ' + (eRR && eRR.message));
        }
        return {
          id: reusedId,
          url: 'https://docs.google.com/spreadsheets/d/' + reusedId + '/edit',
          already: true,
          createdNew: false
        };
      }
    }

    var file = dbDriveCreateSpreadsheetInFolder_(DB_STUDENT_SPREADSHEET_TITLE, folderId);
    if (!file || !file.id) {
      return {
        error: {
          code: 'STUDENT_DRIVE_CREATE_FAILED',
          message:
            '수강생 DB 스프레드시트를 만들지 못했습니다. Drive 권한·할당량을 확인하세요.'
        }
      };
    }

    var id = String(file.id).trim();
    var ss = dbOpenNewSpreadsheetByIdWithRetry_(id);
    if (!ss) {
      return {
        error: {
          code: 'STUDENT_OPEN_AFTER_CREATE',
          message: '만든 수강생 시트를 열지 못했습니다. 잠시 뒤 다시 시도하세요.'
        }
      };
    }

    dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_STUDENT_MEMBER_MASTER, DB_STUDENT_MEMBER_HEADERS);
    dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_STUDENT_ORDER_EVENTS, DB_STUDENT_ORDER_EVENT_HEADERS);
    dbDeleteOrphanDefaultSheetIfAny_(ss);
    p.setProperty(DB_PROP_SHEETS_STUDENT_ID, id);
    try {
      dbStudentMgmtRebuildFromMaster_();
    } catch (eR2) {
      Logger.log('dbInitStudentMgmtSheets_ new file rebuild: ' + (eR2 && eR2.message));
    }

    return {
      id: id,
      url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
      already: false,
      createdNew: true
    };
  } catch (x) {
    Logger.log('dbInitStudentMgmtSheets_ exception: ' + (x && x.message != null ? x.message : String(x)));
    return {
      error: {
        code: 'STUDENT_INIT_EXCEPTION',
        message: '수강생 DB 준비 중 예외: ' + (x && x.message != null ? String(x.message) : String(x))
      }
    };
  }
}

/**
 * 이벤트·마스터 전면 재구축 (수동 동기화 마지막 단계에서 호출)
 * @return {{ ok: true, data: { writtenEvents: number, writtenMembers: number, excluded: number, batchId: string } }|{ ok: false, error: { code: string, message: string } }}
 */
function dbStudentMgmtRebuildFromMaster_() {
  var master;
  try {
    master = dbOpenMaster_();
  } catch (e0) {
    return {
      ok: false,
      error: {
        code: 'NO_SHEETS_MASTER',
        message: '원천 DB(SHEETS_MASTER_ID)를 열 수 없습니다.'
      }
    };
  }
  var ssStu = dbStuOpen_();
  if (!ssStu) {
    return {
      ok: false,
      error: {
        code: 'NO_STUDENT_SHEET',
        message: '수강생 DB가 없습니다. 수강생 탭에서 「데이터 초기화」로 먼저 만듭니다.'
      }
    };
  }

  var shI = master.getSheetByName(DB_SHEET_ORDER_ITEMS);
  if (!shI || shI.getLastRow() < 2) {
    return { ok: false, error: { code: 'NO_ORDER_DATA', message: 'order_items 이 비어 있습니다. 먼저 주문을 동기화하세요.' } };
  }

  var shO = master.getSheetByName(DB_SHEET_ORDERS);
  var orderMap = {};
  var orderToMember = {};
  var ordererNameMap = {};
  /** 회원 코드별 주문자 표시 이름 — `members`에 없는 비회원·게스트 마스터 `name` 보강용 (같은 코드 여러 주문이면 마지막 값) */
  var ordererNameByMemberCode = {};
  if (shO && shO.getLastRow() >= 2) {
    var oLr = shO.getLastRow();
    var ov = shO.getRange(2, 1, oLr - 1, 5).getValues();
    var oi;
    for (oi = 0; oi < ov.length; oi++) {
      var ol = ov[oi] || [];
      var on0 = String(ol[0] != null ? ol[0] : '').trim();
      if (on0) {
        orderMap[on0] = ol[1];
        var mcOrd = String(ol[2] != null ? ol[2] : '').trim();
        orderToMember[on0] = mcOrd;
        ordererNameMap[on0] = ol[3];
        if (mcOrd.length && ol[3] != null && String(ol[3]).trim().length) {
          ordererNameByMemberCode[mcOrd] = String(ol[3]).trim();
        }
      }
    }
  }

  var memberToGroupTitles = {};
  var memberRowByCode = {};
  var shMem = master.getSheetByName(DB_SHEET_MEMBERS);
  if (shMem && shMem.getLastRow() >= 2) {
    var mLr = shMem.getLastRow();
    var mW = DB_MEMBERS_HEADERS.length;
    var mVals = shMem.getRange(2, 1, mLr - 1, mW).getValues();
    var ixMc = DB_MEMBERS_HEADERS.indexOf('member_code');
    var ixUid = DB_MEMBERS_HEADERS.indexOf('uid');
    var ixName = DB_MEMBERS_HEADERS.indexOf('name');
    var ixCall = DB_MEMBERS_HEADERS.indexOf('callnum');
    var ixLast = DB_MEMBERS_HEADERS.indexOf('last_login_time');
    var ixGt = DB_MEMBERS_HEADERS.indexOf('group_titles');
    var mx;
    for (mx = 0; mx < mVals.length; mx++) {
      var mRow = mVals[mx] || [];
      var mcode = String(mRow[ixMc] != null ? mRow[ixMc] : '').trim();
      if (!mcode.length) {
        continue;
      }
      memberToGroupTitles[mcode] = dbAnParseGroupTitlesCell_(ixGt >= 0 ? mRow[ixGt] : '');
      memberRowByCode[mcode] = {
        uid: ixUid >= 0 ? mRow[ixUid] : '',
        name: ixName >= 0 ? mRow[ixName] : '',
        callnum: ixCall >= 0 ? mRow[ixCall] : '',
        last_login_time: ixLast >= 0 ? mRow[ixLast] : '',
        group_titles: ixGt >= 0 ? mRow[ixGt] : ''
      };
    }
  }

  var pmMap = dbPmReadMappingMap_();
  var wI = DB_ORDER_ITEMS_HEADERS.length;
  var iLr = shI.getLastRow();
  var iVals = shI.getRange(2, 1, iLr - 1, wI).getValues();

  var shEv = ssStu.getSheetByName(DB_SHEET_STUDENT_ORDER_EVENTS);
  if (!shEv) {
    shEv = dbGetOrCreateSheetWithHeaders_(ssStu, DB_SHEET_STUDENT_ORDER_EVENTS, DB_STUDENT_ORDER_EVENT_HEADERS);
  }
  var preserve = dbStuReadPreserveDates_(shEv);

  var evHeaders = DB_STUDENT_ORDER_EVENT_HEADERS;
  var ixEvStart = evHeaders.indexOf('product_start_date');
  var ixEvEnd = evHeaders.indexOf('product_end_date');

  var outEv = [];
  var skipped = 0;
  var batchId = 'stu-' + new Date().getTime();
  var nowIso = new Date().toISOString();

  var j;
  for (j = 0; j < iVals.length; j++) {
    var L = iVals[j] || [];
    var itemSkip = String(L[1] != null ? L[1] : '').trim();
    if (itemSkip && DB_STU_FORCE_SKIP_ORDER_ITEM_CODES_[itemSkip]) {
      skipped++;
      continue;
    }
    var ordNo = String(L[2] != null ? L[2] : '').trim();
    var pkey = dbPmRowKey_(L[8]);
    var cat = 'unmapped';
    var life = 'active';
    if (pkey && pmMap[pkey]) {
      cat = String(pmMap[pkey].internal_category || 'unmapped').trim() || 'unmapped';
      life = String(pmMap[pkey].lifecycle || 'active').trim() || 'active';
    }
    var memCode = ordNo && orderToMember[ordNo] != null ? String(orderToMember[ordNo]).trim() : '';
    var gTitles = memCode.length && memberToGroupTitles[memCode] ? memberToGroupTitles[memCode] : [];

    if (dbStuSkipByPurchaser_(ordNo, ordererNameMap)) {
      skipped++;
      continue;
    }
    if (!dbStuIsAllowedCategory_(cat) || cat === 'unmapped' || cat === 'textbook') {
      skipped++;
      continue;
    }
    if (dbAnOrderLineSkipForAnalytics_(life, gTitles)) {
      skipped++;
      continue;
    }
    if (!memCode.length) {
      skipped++;
      continue;
    }

    var orderTimeRaw = orderMap[ordNo] != null ? orderMap[ordNo] : '';
    var orderTimeStr = orderTimeRaw != null ? String(orderTimeRaw) : '';

    var pStart;
    var pEnd;
    var catLo = cat.toLowerCase();
    if (catLo === 'jasoseo') {
      pStart = orderTimeStr;
      pEnd = '';
    } else {
      pStart = dbStuNextDayMidnightSeoulString_(orderTimeRaw);
      var nd = dbStuDefaultDurationDaysForCategory_(cat);
      pEnd = dbStuEndDateFromStartYmd_(pStart, nd);
    }

    var rowEv = [
      L[1],
      ordNo,
      memCode,
      orderTimeStr,
      cat,
      life,
      pStart,
      pEnd,
      L[3],
      L[4],
      L[5],
      L[6],
      L[7],
      L[8],
      L[9],
      L[15],
      L[16],
      L[17],
      '',
      nowIso,
      batchId
    ];

    var itemCode = String(L[1] != null ? L[1] : '').trim();
    var prev = itemCode.length ? preserve[itemCode] : null;
    if (prev) {
      if (prev.start !== '' && prev.start != null) {
        rowEv[ixEvStart] = prev.start;
      }
      if (prev.end !== '' && prev.end != null) {
        rowEv[ixEvEnd] = prev.end;
      }
      if (prev.updated !== '' && prev.updated != null) {
        rowEv[18] = prev.updated;
      }
    }
    if (catLo === 'jasoseo') {
      rowEv[ixEvEnd] = '';
    }

    outEv.push(rowEv);
  }
  var fixedPack = dbStuBuildFixedManualRows_(preserve, nowIso, batchId);
  var fixedRows = fixedPack.rows || [];
  var manualNameByMemberCode = fixedPack.manualNameByMemberCode || {};
  var fr;
  for (fr = 0; fr < fixedRows.length; fr++) {
    outEv.push(fixedRows[fr]);
  }

  var memberCodes = {};
  var k;
  for (k = 0; k < outEv.length; k++) {
    var mc = String(outEv[k][2] != null ? outEv[k][2] : '').trim();
    if (mc.length) {
      memberCodes[mc] = 1;
    }
  }
  var outMem = [];
  var mcList = Object.keys(memberCodes);
  var mi;
  for (mi = 0; mi < mcList.length; mi++) {
    var code = mcList[mi];
    var mr = memberRowByCode[code];
    if (!mr) {
      var nmGuest =
        manualNameByMemberCode[code] != null
          ? String(manualNameByMemberCode[code]).trim()
          : ordererNameByMemberCode[code] != null ? String(ordererNameByMemberCode[code]).trim() : '';
      var nameGuest = nmGuest.length ? nmGuest + '(비회원)' : '';
      var groupTitlesGuest = JSON.stringify(['비회원']);
      outMem.push([code, '', nameGuest, '', '', groupTitlesGuest, nowIso, batchId]);
    } else {
      outMem.push([
        code,
        mr.uid,
        mr.name,
        mr.callnum,
        mr.last_login_time,
        mr.group_titles,
        nowIso,
        batchId
      ]);
    }
  }
  outMem.sort(function (a, b) {
    return String(a[0]).localeCompare(String(b[0]));
  });

  var shM = ssStu.getSheetByName(DB_SHEET_STUDENT_MEMBER_MASTER);
  if (!shM) {
    shM = dbGetOrCreateSheetWithHeaders_(ssStu, DB_SHEET_STUDENT_MEMBER_MASTER, DB_STUDENT_MEMBER_HEADERS);
  }
  dbEnsureHeaderRow1_(shEv, DB_STUDENT_ORDER_EVENT_HEADERS);
  dbEnsureHeaderRow1_(shM, DB_STUDENT_MEMBER_HEADERS);
  dbSheetClearColumnsAfter_(shEv, DB_STUDENT_ORDER_EVENT_HEADERS.length);
  dbSheetClearColumnsAfter_(shM, DB_STUDENT_MEMBER_HEADERS.length);

  var wE = DB_STUDENT_ORDER_EVENT_HEADERS.length;
  var wM = DB_STUDENT_MEMBER_HEADERS.length;
  dbClearDataRows2Plus_(shEv, wE);
  dbClearDataRows2Plus_(shM, wM);
  if (outEv.length) {
    shEv.getRange(2, 1, outEv.length, wE).setValues(outEv);
  }
  if (outMem.length) {
    shM.getRange(2, 1, outMem.length, wM).setValues(outMem);
  }

  if (outEv.length) {
    var nEv = outEv.length;
    shEv.getRange(2, 4, nEv, 1).setNumberFormat('@');
    shEv.getRange(2, 7, nEv, 2).setNumberFormat('@');
    shEv.getRange(2, 13, nEv, 1).setNumberFormat('@');
  }

  return {
    ok: true,
    data: {
      writtenEvents: outEv.length,
      writtenMembers: outMem.length,
      excluded: skipped,
      batchId: batchId
    }
  };
}
