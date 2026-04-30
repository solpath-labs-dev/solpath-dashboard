/**
 * 대시보드 — Open API 전체 시트 스냅샷. Web App
 * dbSyncOpenAll() = members → products(1p) → orders (시작 시 `imwebEnsureAccessTokenForOpenSync_`로 refresh)
 *
 * POST: 본문 `text/plain` 또는 `application/x-www-form-urlencoded` — `action=ping|syncOpenFull`
 * GET+JSONP(브라우저): `?format=jsonp&callback=NAME&action=...` — TextOutput엔 CORS(setHeader) API가 **없어**
 *   fetch는 크로스 오리진 읽기에 CORS가 필요 → JSONP는 `<script src>`로 우회(임웹/솔루션편입 대시보드)
 */

function openSyncTextOutputJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * JSONP: `NAME({...json...});` — setHeader 불필요
 * @param {Object} obj
 * @param {string} callbackName
 */
function openSyncTextOutputJsonp_(obj, callbackName) {
  var safe = String(callbackName != null ? callbackName : '')
    .replace(/[^0-9a-zA-Z_$]/g, '')
    .replace(/^([0-9])/, '_$1');
  if (safe.length < 1) {
    safe = '_solpathCb';
  }
  if (safe.length > 64) {
    safe = safe.slice(0, 64);
  }
  var json = JSON.stringify(obj);
  if (json == null) {
    json = '{}';
  }
  /** script src로 삽입될 때 문자열 안의 `</script>` 등이 HTML 파서에 먹혀 조기 종료 → JSONP 실패. */
  json = openSyncJsonpSanitizeJsonForScript_(json);
  var t = safe + '(' + json + ');';
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/**
 * JSONP 본문을 &lt;script&gt; 안에 넣을 때 안전하게 (XSS·조기 &lt;/script&gt; 종료 방지)
 * @param {string} jsonStr
 * @return {string}
 */
function openSyncJsonpSanitizeJsonForScript_(jsonStr) {
  return String(jsonStr).replace(/</g, '\\u003c');
}

/**
 * doGet: `?format=jsonp&callback=...&action=...` — Code.js 맨 앞에서만 호출
 * @param {Object} e
 * @param {string} callbackName
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function openSyncJsonpFromGet_(e, callbackName) {
  var action = '';
  try {
    action = openSyncGetActionFromRequest_(e) || '';
  } catch (err) {
    return openSyncTextOutputJsonp_(
      {
        ok: false,
        error: 'BAD_REQUEST',
        message: err && err.message != null ? String(err.message) : String(err)
      },
      callbackName
    );
  }
  if (action.length < 1) {
    return openSyncTextOutputJsonp_(
      { ok: false, error: 'BAD_REQUEST', message: 'action required' },
      callbackName
    );
  }
  try {
    return openSyncTextOutputJsonp_(openSyncRouteAction_(action, e), callbackName);
  } catch (x) {
    /** 예외가 그대로 나가면 200+HTML이 오고, JSONP <script>가 콜백을 못 부름 → 프론트 "초기화 실패"만 뜸 */
    return openSyncTextOutputJsonp_(
      {
        ok: false,
        error: { code: 'INTERNAL', message: x && x.message != null ? String(x.message) : String(x) }
      },
      callbackName
    );
  }
}

/**
 * @return {string[]}
 */
function openSyncAllowedActions_() {
  return [
    'ping',
    'syncOpenFull',
    'syncMasterNow',
    'productMappingState',
    'productMappingList',
    'initOperationsSheets',
    'operationsMappingUpsertMissing',
    'productMappingApply',
    'productMappingReset',
    'initAnalyticsSheets',
    'analyticsRebuild02',
    'analyticsTargetsGet',
    'analyticsTargetsApply',
    'analyticsTableExport',
    'analyticsResetAll',
    'analyticsMasterActualsGet',
    'analyticsFactRebuild',
    'analyticsFactRowsGet',
    'analyticsFactReport',
    'initStudentMgmtSheets',
    'studentMgmtRebuildFromMaster',
    'studentMgmtDateEditorList',
    'studentMgmtDateEditorSave',
    'studentMgmtDateEditorSaveBatch',
    'analyticsExportStagingPut',
    'analyticsTableExportFromStaging'
  ];
}

/**
 * @param {string} action
 * @param {Object|null|undefined} e
 * @return {Object}
 */
function openSyncRouteAction_(action, e) {
  e = e || { parameter: {} };
  if (action === 'ping') {
    return { ok: true, data: { name: 'openSync', version: 13, actions: openSyncAllowedActions_() } };
  }
  if (action === 'syncOpenFull') {
    try {
      var data0 = dbSyncOpenAll();
      data0.spreadsheetUrl = openSyncMasterSpreadsheetUrl_();
      return { ok: true, data: data0 };
    } catch (x) {
      return {
        ok: false,
        error: 'SYNC_FAILED',
        message: x && x.message != null ? String(x.message) : String(x)
      };
    }
  }
  if (action === 'syncMasterNow') {
    try {
      var dataM = dbSyncOpenAll();
      return {
        ok: true,
        data: {
          membersRows: dataM && dataM.members && dataM.members.rows != null ? dataM.members.rows : null,
          productsRows: dataM && dataM.products && dataM.products.rows != null ? dataM.products.rows : null,
          ordersRows: dataM && dataM.orders && dataM.orders.orderRows != null ? dataM.orders.orderRows : null,
          itemsRows: dataM && dataM.orders && dataM.orders.itemRows != null ? dataM.orders.itemRows : null
        }
      };
    } catch (xM) {
      return {
        ok: false,
        error: { code: 'SYNC_FAILED', message: xM && xM.message != null ? String(xM.message) : String(xM) }
      };
    }
  }
  if (action === 'productMappingState') {
    return dbProductMappingState_();
  }
  if (action === 'productMappingList') {
    return dbProductMappingList_();
  }
  if (action === 'initOperationsSheets') {
    var r0 = dbInitOperationsSheets_();
    if (r0 && r0.error) {
      return { ok: false, error: { code: r0.error.code, message: r0.error.message } };
    }
    return {
      ok: true,
      data: {
        operationsSpreadsheetId: r0.id,
        operationsSpreadsheetUrl: r0.url,
        alreadyConfigured: r0.already,
        productMappingHeadersApplied: r0.productMappingHeadersApplied,
        createdNew: r0.createdNew,
        seededRowCount: r0.seededRowCount != null ? r0.seededRowCount : 0
      }
    };
  }
  if (action === 'operationsMappingUpsertMissing') {
    return dbPmUpsertMissingProductsIntoMapping_();
  }
  if (action === 'productMappingApply') {
    var rows0 = openSyncExtractRowsForApply_(e);
    if (!rows0 || !rows0.length) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'payload 또는 rows 없음' } };
    }
    return dbProductMappingApply_(rows0);
  }
  if (action === 'productMappingReset') {
    return dbProductMappingResetFromMaster_();
  }
  if (action === 'initAnalyticsSheets') {
    var rAn = dbInitAnalyticsSheets_();
    if (rAn && rAn.error) {
      return { ok: false, error: { code: rAn.error.code, message: rAn.error.message } };
    }
    return {
      ok: true,
      data: {
        analyticsSpreadsheetId: rAn.id,
        analyticsSpreadsheetUrl: rAn.url,
        alreadyConfigured: rAn.already,
        createdNew: rAn.createdNew
      }
    };
  }
  if (action === 'analyticsRebuild02') {
    return dbAnalyticsRebuild02FromMaster_();
  }
  if (action === 'analyticsTargetsGet') {
    return dbAnalyticsTargetsRead_();
  }
  if (action === 'analyticsTargetsApply') {
    var tr = openSyncExtractTargetRowsForApply_(e);
    if (tr === null) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'payload 또는 rows 없음' } };
    }
    return dbAnalyticsTargetsApply_(tr);
  }
  if (action === 'analyticsTableExport') {
    var pEx = openSyncExtractPayloadJson_(e);
    if (!pEx) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'payload 없음' } };
    }
    return dbAnalyticsExportTableToSheet_(pEx);
  }
  if (action === 'analyticsExportStagingPut') {
    var pSt = e.parameter || {};
    /** GAS 웹앱 예약 쿼리 키 `sid` 사용 금지(405) — https://developers.google.com/apps-script/guides/web */
    var sid0 = pSt.exSid != null ? String(pSt.exSid).trim() : '';
    var seq0 = parseInt(String(pSt.seq != null ? pSt.seq : ''), 10);
    var tot0 = parseInt(String(pSt.total != null ? pSt.total : ''), 10);
    var bod0 = pSt.body != null ? String(pSt.body) : '';
    return dbAnalyticsExportStagingPut_(sid0, seq0, tot0, bod0);
  }
  if (action === 'analyticsTableExportFromStaging') {
    var pSc = e.parameter || {};
    var sid1 = pSc.exSid != null ? String(pSc.exSid).trim() : '';
    return dbAnalyticsExportStagingCommit_(sid1);
  }
  if (action === 'analyticsResetAll') {
    return dbAnalyticsResetAll_();
  }
  if (action === 'analyticsMasterActualsGet') {
    var pAc = e.parameter || {};
    var yAc = parseInt(String(pAc.year != null ? pAc.year : ''), 10);
    var mRawAc = pAc.month != null ? String(pAc.month).trim() : '';
    var mAc = mRawAc === '' ? NaN : parseInt(mRawAc, 10);
    var nowAc = new Date();
    if (!isFinite(yAc) || yAc < 2000 || yAc > 2100) {
      yAc = nowAc.getFullYear();
    }
    if (!isFinite(mAc) || mAc < 0 || mAc > 12) {
      mAc = nowAc.getMonth() + 1;
    }
    var scopeAc = pAc.scope != null ? String(pAc.scope).trim().toLowerCase() : '';
    return dbAnalyticsMasterActualsGet_(yAc, mAc, scopeAc);
  }
  if (action === 'analyticsFactRebuild') {
    var pFr = e.parameter || {};
    var yFr = parseInt(String(pFr.year != null ? pFr.year : ''), 10);
    var mFr = parseInt(String(pFr.month != null ? pFr.month : ''), 10);
    if (!isFinite(yFr) || yFr < 2000 || yFr > 2100) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'year(2000–2100)이 필요합니다.' } };
    }
    if (!isFinite(mFr) || mFr < 0 || mFr > 12) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'month(0–12) — 0이면 그 해 1~12월 전부' } };
    }
    return dbAnalyticsFactRebuildFromMaster_(yFr, mFr);
  }
  if (action === 'analyticsFactRowsGet') {
    var pRows = e.parameter || {};
    var yR = parseInt(String(pRows.year != null ? pRows.year : ''), 10);
    var mR = parseInt(String(pRows.month != null ? pRows.month : ''), 10);
    var nowR = new Date();
    if (!isFinite(yR) || yR < 2000 || yR > 2100) {
      yR = nowR.getFullYear();
    }
    if (!isFinite(mR) || mR < 0 || mR > 12) {
      mR = nowR.getMonth() + 1;
    }
    return dbAnalyticsFactRowsGet_(yR, mR);
  }
  if (action === 'analyticsFactReport') {
    var pRep = e.parameter || {};
    var yRp = parseInt(String(pRep.year != null ? pRep.year : ''), 10);
    var mRp = parseInt(String(pRep.month != null ? pRep.month : ''), 10);
    var nowP = new Date();
    if (!isFinite(yRp) || yRp < 2000 || yRp > 2100) {
      yRp = nowP.getFullYear();
    }
    /** 0 = 해당 연도 1~12월 일별(집계 02·dbAnalyticsFactReportComputed_와 동일) */
    if (!isFinite(mRp) || mRp < 0 || mRp > 12) {
      mRp = nowP.getMonth() + 1;
    }
    return { ok: true, data: dbAnalyticsFactReportComputed_(yRp, mRp) };
  }
  if (action === 'initStudentMgmtSheets') {
    var rStu = dbInitStudentMgmtSheets_();
    if (rStu && rStu.error) {
      return { ok: false, error: { code: rStu.error.code, message: rStu.error.message } };
    }
    return {
      ok: true,
      data: {
        studentSpreadsheetId: rStu.id,
        studentSpreadsheetUrl: rStu.url,
        alreadyConfigured: rStu.already,
        createdNew: rStu.createdNew
      }
    };
  }
  if (action === 'studentMgmtRebuildFromMaster') {
    return dbStudentMgmtRebuildFromMaster_();
  }
  if (action === 'studentMgmtDateEditorList') {
    return dbStudentMgmtDateEditorList_();
  }
  if (action === 'studentMgmtDateEditorSave') {
    var pStuSave = openSyncExtractPayloadJson_(e);
    if (!pStuSave) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'payload 없음' } };
    }
    return dbStudentMgmtDateEditorSave_(pStuSave);
  }
  if (action === 'studentMgmtDateEditorSaveBatch') {
    var pStuSaveB = openSyncExtractPayloadJson_(e);
    if (!pStuSaveB) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'payload 없음' } };
    }
    return dbStudentMgmtDateEditorSaveBatch_(pStuSaveB);
  }
  return { ok: false, error: 'UNKNOWN_ACTION', allowed: openSyncAllowedActions_() };
}

/**
 * @param {string} action
 * @return {Object}
 */
function openSyncExecuteAction_(action) {
  return openSyncRouteAction_(action, null);
}

/**
 * @param {Object} e
 * @return {any[]|null}
 */
function openSyncExtractRowsForApply_(e) {
  e = e || {};
  var p = e.parameter || {};
  var bodyText = p.payload != null ? String(p.payload) : '';
  if (!bodyText.length && e.postData && e.postData.contents) {
    var lo0 = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
    if (lo0.indexOf('application/x-www-form-urlencoded') >= 0 || lo0.indexOf('text/plain') >= 0 || !lo0.length) {
      var f0 = openSyncParseFormUrlEncoded_(String(e.postData.contents));
      if (f0 && f0.payload != null) {
        bodyText = String(f0.payload);
      }
    }
  }
  if (bodyText.length) {
    var j;
    try {
      j = JSON.parse(bodyText);
    } catch (e1) {
      try {
        j = JSON.parse(decodeURIComponent(bodyText));
      } catch (e2) {
        j = null;
      }
    }
    if (j && j.rows && j.rows.length) {
      return j.rows;
    }
  }
  if (e.postData && e.postData.contents) {
    var raw = String(e.postData.contents);
    var lo = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
    if (lo.indexOf('application/json') >= 0) {
      try {
        var jo = JSON.parse(raw);
        if (jo && jo.rows && jo.rows.length) {
          return jo.rows;
        }
      } catch (ej) {}
    }
  }
  return null;
}

/**
 * `analyticsTargetsApply` — `rows: []` 로 전체 비우기 허용
 * @param {Object} e
 * @return {any[]|null}
 */
function openSyncExtractTargetRowsForApply_(e) {
  e = e || {};
  var p = e.parameter || {};
  var bodyText = p.payload != null ? String(p.payload) : '';
  if (!bodyText.length && e.postData && e.postData.contents) {
    var lo0 = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
    if (lo0.indexOf('application/x-www-form-urlencoded') >= 0 || lo0.indexOf('text/plain') >= 0 || !lo0.length) {
      var f0 = openSyncParseFormUrlEncoded_(String(e.postData.contents));
      if (f0 && f0.payload != null) {
        bodyText = String(f0.payload);
      }
    }
  }
  if (bodyText.length) {
    var j;
    try {
      j = JSON.parse(bodyText);
    } catch (e1) {
      try {
        j = JSON.parse(decodeURIComponent(bodyText));
      } catch (e2) {
        j = null;
      }
    }
    if (j && Array.isArray(j.rows)) {
      return j.rows;
    }
  }
  if (e.postData && e.postData.contents) {
    var raw = String(e.postData.contents);
    var lo = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
    if (lo.indexOf('application/json') >= 0) {
      try {
        var jo = JSON.parse(raw);
        if (jo && Array.isArray(jo.rows)) {
          return jo.rows;
        }
      } catch (ej) {}
    }
  }
  return null;
}

/**
 * payload(JSON 문자열)를 객체로 읽는다.
 * @param {Object} e
 * @return {Object|null}
 */
function openSyncExtractPayloadJson_(e) {
  e = e || {};
  var p = e.parameter || {};
  var bodyText = p.payload != null ? String(p.payload) : '';
  if (!bodyText.length && e.postData && e.postData.contents) {
    var lo0 = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
    if (lo0.indexOf('application/x-www-form-urlencoded') >= 0 || lo0.indexOf('text/plain') >= 0 || !lo0.length) {
      var f0 = openSyncParseFormUrlEncoded_(String(e.postData.contents));
      if (f0 && f0.payload != null) {
        bodyText = String(f0.payload);
      }
    }
  }
  if (bodyText.length) {
    try {
      return JSON.parse(bodyText);
    } catch (e1) {
      try {
        return JSON.parse(decodeURIComponent(bodyText));
      } catch (e2) {
        return null;
      }
    }
  }
  if (e.postData && e.postData.contents) {
    var raw = String(e.postData.contents);
    var lo = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
    if (lo.indexOf('application/json') >= 0) {
      try {
        return JSON.parse(raw);
      } catch (ej) {}
    }
  }
  return null;
}

/**
 * @param {Object} e
 * @return {string}
 */
function openSyncGetActionFromRequest_(e) {
  e = e || {};
  var p = e.parameter || {};
  var action = p.action != null ? String(p.action).trim() : '';
  if (action.length) {
    return action;
  }
  var post = e.postData;
  if (!post || post.contents == null) {
    return '';
  }
  var ct = post.type != null ? String(post.type).toLowerCase() : '';
  var raw = String(post.contents);
  if (ct.length) {
    if (ct.indexOf('application/x-www-form-urlencoded') < 0 && ct.indexOf('text/plain') < 0) {
      return '';
    }
  }
  var q = openSyncParseFormUrlEncoded_(raw);
  return q.action != null ? String(q.action).trim() : '';
}

/**
 * @param {string} body
 * @return {Object}
 */
function openSyncParseFormUrlEncoded_(body) {
  var o = {};
  if (!body || !String(body).length) {
    return o;
  }
  var parts = String(body).split('&');
  var a;
  for (a = 0; a < parts.length; a++) {
    var part = parts[a];
    var i = part.indexOf('=');
    if (i < 0) {
      continue;
    }
    var k2 = decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '));
    var v2 = decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
    o[k2] = v2;
  }
  return o;
}

/**
 * @param {Object} e
 */
function doPost(e) {
  e = e || {};
  var jBody = null;
  try {
    if (e.postData && e.postData.contents) {
      var t = (e.postData.type != null ? String(e.postData.type) : '').toLowerCase();
      if (t.indexOf('application/json') >= 0) {
        jBody = JSON.parse(String(e.postData.contents));
      }
    }
  } catch (errJ) {
    jBody = null;
  }
  if (jBody && jBody.action === 'productMappingApply' && jBody.rows && jBody.rows.length) {
    return openSyncTextOutputJson_(dbProductMappingApply_(jBody.rows));
  }
  if (jBody && jBody.action === 'initOperationsSheets') {
    var rI = dbInitOperationsSheets_();
    if (rI && rI.error) {
      return openSyncTextOutputJson_({ ok: false, error: { code: rI.error.code, message: rI.error.message } });
    }
    return openSyncTextOutputJson_({
      ok: true,
      data: {
        operationsSpreadsheetId: rI.id,
        operationsSpreadsheetUrl: rI.url,
        alreadyConfigured: rI.already,
        productMappingHeadersApplied: rI.productMappingHeadersApplied,
        createdNew: rI.createdNew,
        seededRowCount: rI.seededRowCount != null ? rI.seededRowCount : 0
      }
    });
  }
  if (jBody && jBody.action === 'initAnalyticsSheets') {
    var rAn0 = dbInitAnalyticsSheets_();
    if (rAn0 && rAn0.error) {
      return openSyncTextOutputJson_({ ok: false, error: { code: rAn0.error.code, message: rAn0.error.message } });
    }
    return openSyncTextOutputJson_({
      ok: true,
      data: {
        analyticsSpreadsheetId: rAn0.id,
        analyticsSpreadsheetUrl: rAn0.url,
        alreadyConfigured: rAn0.already,
        createdNew: rAn0.createdNew
      }
    });
  }
  if (jBody && jBody.action === 'analyticsTargetsApply' && jBody.rows != null && Array.isArray(jBody.rows)) {
    return openSyncTextOutputJson_(dbAnalyticsTargetsApply_(jBody.rows));
  }
  if (jBody && jBody.action === 'analyticsTableExport') {
    return openSyncTextOutputJson_(dbAnalyticsExportTableToSheet_(jBody));
  }
  var action = '';
  try {
    if (jBody && jBody.action) {
      action = String(jBody.action);
    } else {
      action = openSyncGetActionFromRequest_(e) || '';
    }
  } catch (err) {
    return openSyncTextOutputJson_({
      ok: false,
      error: 'BAD_REQUEST',
      message: err && err.message != null ? String(err.message) : String(err)
    });
  }
  if (action === 'productMappingApply' && e.postData) {
    var rA = openSyncExtractRowsForApply_({ postData: e.postData, parameter: {} });
    if (rA && rA.length) {
      return openSyncTextOutputJson_(dbProductMappingApply_(rA));
    }
  }
  return openSyncTextOutputJson_(openSyncRouteAction_(action, e));
}

/**
 * @return {string}
 */
function openSyncMasterSpreadsheetUrl_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEETS_MASTER_ID');
  id = id != null ? String(id).trim() : '';
  if (!id.length) {
    return '';
  }
  return 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
}

/** OPTIONS — 일부 런타임에선 무시. 본문만. */
function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}
