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
  return openSyncTextOutputJsonp_(openSyncRouteAction_(action, e), callbackName);
}

/**
 * @return {string[]}
 */
function openSyncAllowedActions_() {
  return [
    'ping',
    'syncOpenFull',
    'productMappingState',
    'productMappingList',
    'initOperationsSheets',
    'productMappingApply'
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
    return { ok: true, data: { name: 'openSync', version: 4, actions: openSyncAllowedActions_() } };
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
  if (action === 'productMappingApply') {
    var rows0 = openSyncExtractRowsForApply_(e);
    if (!rows0 || !rows0.length) {
      return { ok: false, error: { code: 'BAD_REQUEST', message: 'payload 또는 rows 없음' } };
    }
    return dbProductMappingApply_(rows0);
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
