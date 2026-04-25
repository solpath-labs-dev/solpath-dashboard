/**
 * 대시보드(프론트) — Open API **전체** 시트 스냅샷. Web App `POST` + CORS.
 * 구현: `dbSyncOpenAll()` = members → products(1p) → orders
 *
 * Script Property `SOLPATH_DASHBOARD_TOKEN` (비어 있으면 401) — `fetch` `token` 필드와 동일.
 * 본문: `application/x-www-form-urlencoded` (프리플라이트·CORS 단순화) — `action`, `token`
 */

var PROP_DASHBOARD_SYNC_TOKEN = 'SOLPATH_DASHBOARD_TOKEN';

/**
 * CORS(브라우저 `fetch` from jsDelivr / 아임웹).
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

function openSyncGetTokenFromRequest_(e) {
  e = e || {};
  var p = e.parameter || {};
  var action = p.action != null ? String(p.action).trim() : '';
  var token = p.token != null ? String(p.token).trim() : '';
  if (action.length || token.length) {
    return { action: action, token: token };
  }
  var post = e.postData;
  if (!post || post.contents == null) {
    return { action: '', token: '' };
  }
  var ct = post.type != null ? String(post.type) : '';
  if (ct.length && ct.indexOf('application/x-www-form-urlencoded') < 0) {
    return { action: '', token: '' };
  }
  var q = openSyncParseFormUrlEncoded_(String(post.contents));
  return {
    action: q.action != null ? String(q.action).trim() : '',
    token: q.token != null ? String(q.token).trim() : ''
  };
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
 * @param {string} token
 * @return {boolean}
 */
function openSyncValidateToken_(token) {
  if (!token || !String(token).length) {
    return false;
  }
  var s = PropertiesService.getScriptProperties().getProperty(PROP_DASHBOARD_SYNC_TOKEN);
  s = s != null ? String(s).trim() : '';
  if (!s.length) {
    return false;
  }
  return token === s;
}

/**
 * @param {Object} e
 */
function doPost(e) {
  var h = openSyncCorsHeaders_();
  var action = '';
  var token = '';
  try {
    var parsed = openSyncGetTokenFromRequest_(e);
    action = parsed.action;
    token = parsed.token;
  } catch (err) {
    return openSyncJsonResponse_(
      { ok: false, error: 'BAD_REQUEST', message: err && err.message != null ? String(err.message) : String(err) },
      h
    );
  }
  if (!openSyncValidateToken_(token)) {
    return openSyncJsonResponse_({ ok: false, error: 'UNAUTHORIZED' }, h);
  }
  if (action === 'ping') {
    return openSyncJsonResponse_({ ok: true, data: { name: 'openSync', version: 1, actions: ['ping', 'syncOpenFull'] } }, h);
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
 * Script Property `SHEETS_MASTER_ID` — 원천 DB 스프레드시트 편집 URL(프론트 확인 버튼).
 * @return {string} 없으면 빈 문자열
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
 * CORS preflight(환경·배포에 따라 호출). 본 응답 body 없이 헤더만.
 */
function doOptions() {
  return openSyncTextResponse_('', openSyncCorsHeaders_());
}
