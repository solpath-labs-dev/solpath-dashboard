/**
 * 대시보드 — Open API 전체 시트 스냅샷. Web App
 * dbSyncOpenAll() = members → products(1p) → orders
 *
 * POST: 본문 `text/plain` 또는 `application/x-www-form-urlencoded` — `action=ping|syncOpenFull`
 * GET+JSONP(브라우저): `?format=jsonp&callback=NAME&action=...` — TextOutput엔 CORS(setHeader) API가 **없어**
 *   fetch는 크로스 오리진 읽기에 CORS가 필요 → JSONP는 `<script src>`로 우회(임웹/솔패스)
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
  var t = safe + '(' + JSON.stringify(obj) + ');';
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.JAVASCRIPT);
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
  return openSyncTextOutputJsonp_(openSyncExecuteAction_(action), callbackName);
}

/**
 * @param {string} action
 * @return {Object}
 */
function openSyncExecuteAction_(action) {
  if (action === 'ping') {
    return {
      ok: true,
      data: { name: 'openSync', version: 3, actions: ['ping', 'syncOpenFull'] }
    };
  }
  if (action === 'syncOpenFull') {
    try {
      var data = dbSyncOpenAll();
      data.spreadsheetUrl = openSyncMasterSpreadsheetUrl_();
      return { ok: true, data: data };
    } catch (x) {
      return {
        ok: false,
        error: 'SYNC_FAILED',
        message: x && x.message != null ? String(x.message) : String(x)
      };
    }
  }
  return { ok: false, error: 'UNKNOWN_ACTION', allowed: ['ping', 'syncOpenFull'] };
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
  var action = '';
  try {
    action = openSyncGetActionFromRequest_(e) || '';
  } catch (err) {
    return openSyncTextOutputJson_({
      ok: false,
      error: 'BAD_REQUEST',
      message: err && err.message != null ? String(err.message) : String(err)
    });
  }
  return openSyncTextOutputJson_(openSyncExecuteAction_(action));
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
