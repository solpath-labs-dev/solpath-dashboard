/**
 * 대시보드 — Open API 전체 시트 스냅샷. Web App POST + CORS.
 * dbSyncOpenAll() = members → products(1p) → orders
 *
 * 본문: application/x-www-form-urlencoded — `action` 만 (ping | syncOpenFull)
 */

/**
 * CORS(브라우저 fetch).
 * @return {Object<string,string>}
 */
function openSyncCorsHeaders_() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Max-Age': '3600'
  };
}

function openSyncJsonResponse_(obj, httpHeaders) {
  var t = ContentService.createTextOutput(JSON.stringify(obj));
  t.setMimeType(ContentService.MimeType.JSON);
  openSyncApplyHeaders_(t, httpHeaders);
  return t;
}

function openSyncTextResponse_(text, httpHeaders) {
  var t = ContentService.createTextOutput(text != null ? String(text) : '');
  t.setMimeType(ContentService.MimeType.TEXT);
  openSyncApplyHeaders_(t, httpHeaders);
  return t;
}

/**
 * @param {GoogleAppsScript.Content.TextOutput} out
 * @param {Object<string,string>|undefined} httpHeaders
 */
function openSyncApplyHeaders_(out, httpHeaders) {
  if (!out || !httpHeaders) {
    return;
  }
  var k;
  for (k in httpHeaders) {
    if (Object.prototype.hasOwnProperty.call(httpHeaders, k)) {
      out.setHeader(k, httpHeaders[k]);
    }
  }
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
  var ct = post.type != null ? String(post.type) : '';
  if (ct.length && ct.indexOf('application/x-www-form-urlencoded') < 0) {
    return '';
  }
  var q = openSyncParseFormUrlEncoded_(String(post.contents));
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
  var h = openSyncCorsHeaders_();
  var action = '';
  try {
    action = openSyncGetActionFromRequest_(e);
  } catch (err) {
    return openSyncJsonResponse_(
      { ok: false, error: 'BAD_REQUEST', message: err && err.message != null ? String(err.message) : String(err) },
      h
    );
  }
  if (action === 'ping') {
    return openSyncJsonResponse_({ ok: true, data: { name: 'openSync', version: 2, actions: ['ping', 'syncOpenFull'] } }, h);
  }
  if (action === 'syncOpenFull') {
    try {
      var data = dbSyncOpenAll();
      data.spreadsheetUrl = openSyncMasterSpreadsheetUrl_();
      return openSyncJsonResponse_({ ok: true, data: data }, h);
    } catch (x) {
      return openSyncJsonResponse_(
        {
          ok: false,
          error: 'SYNC_FAILED',
          message: x && x.message != null ? String(x.message) : String(x)
        },
        h
      );
    }
  }
  return openSyncJsonResponse_(
    {
      ok: false,
      error: 'UNKNOWN_ACTION',
      allowed: ['ping', 'syncOpenFull']
    },
    h
  );
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

/**
 * CORS preflight
 */
function doOptions() {
  return openSyncTextResponse_('', openSyncCorsHeaders_());
}
