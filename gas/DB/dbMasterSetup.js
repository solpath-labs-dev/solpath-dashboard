/**
 * 원천 DB 스프레드시트 생성·탭·헤더 1행.
 * **새 파일**은 `SpreadsheetApp.create`가 아니라 **Drive v3 Files.create** + `parents` (옮기기 없음).
 * 저장 위치: (1) **이 Apps Script가 Drive에 있는 상위 폴더** (2) 없을 때 Property / 코드 ID / `00_admin/10_IMWEB_DASHBOARD` 경로
 * → 그 **베이스** 안에 **`DB`라는 하위 폴더**를 `get` 또는 `create` 하고, 스프레드시트는 그 `DB` **안**에 둔다. (`dbSchema.js` `DB_SUBFOLDER_NAME`)
 * Script Properties: `SHEETS_MASTER_ID` — 있으면 그 ID로 연다. Drive에서 지워져 열기 실패 시 `dbOpenMaster_`가 키를 지우고 **이 함수와 같은 방식**으로 원천 DB를 다시 만든다. **수동**으로 바꾸려면 키 삭제 후 이 함수만 실행.
 * 위치: `SHEETS_MASTER_ID`가 옛 루트에 있어도, 매번 **스크립트 베이스/DB** 아래로 맞추기 위해 이동을 시도한다.
 */
function dbSetupMasterDatabase() {
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty(DB_PROP_SHEETS_MASTER_ID);
  var ss;
  var createdNew = false;
  if (id != null && String(id).trim().length) {
    Logger.log(
      'dbSetupMasterDatabase: Property ' +
        DB_PROP_SHEETS_MASTER_ID +
        ' 있음(기존 시트) — 새로 만들지 않고 이 ID로 연다. 완전히 새 DB를 만들려면 이 키를 스크립트 Property에서 지운 뒤 다시 실행.'
    );
    try {
      ss = SpreadsheetApp.openById(String(id).trim());
    } catch (e) {
      Logger.log('dbSetupMasterDatabase: openById 실패 → 신규 생성. ' + (e && e.message != null ? e.message : String(e)));
      ss = dbCreateNewMasterSpreadsheet_();
      p.setProperty(DB_PROP_SHEETS_MASTER_ID, ss.getId());
      createdNew = true;
    }
  } else {
    Logger.log('dbSetupMasterDatabase: ' + DB_PROP_SHEETS_MASTER_ID + ' 없음 — 새 마스터 시트 생성');
    ss = dbCreateNewMasterSpreadsheet_();
    p.setProperty(DB_PROP_SHEETS_MASTER_ID, ss.getId());
    createdNew = true;
  }

  // 기존 ID로 연 경우에도 루트에 남아 있을 수 있으므로, 항상 베이스/DB 기준으로 맞춤(no-op 가능)
  dbEnsureMasterSpreadsheetInDbSubfolder_(ss.getId());

  dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_MEMBERS, DB_MEMBERS_HEADERS);
  dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_ORDERS, DB_ORDERS_HEADERS);
  dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_ORDER_ITEMS, DB_ORDER_ITEMS_HEADERS);
  dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_PRODUCTS, DB_PRODUCTS_HEADERS);
  dbGetOrCreateSheetWithHeaders_(ss, DB_SHEET_SYNC_LOG, DB_SYNC_LOG_HEADERS);
  if (createdNew) {
    dbDeleteOrphanDefaultSheetIfAny_(ss);
  }

  var url = ss.getUrl();
  var sid = ss.getId();
  var loc = dbDescribeMasterFileLocation_(sid);
  Logger.log('dbSetupMasterDatabase OK id=' + sid + ' url=' + url + ' (createdNew=' + createdNew + ' = 이번에 새로 만든 파일이면 true, false면 Property에 있던 기존 ID만 연 것)');
  Logger.log('dbSetupMasterDatabase Drive 위치: ' + loc.drivePath);
  if (loc.parentFolderUrl) {
    Logger.log('dbSetupMasterDatabase (이 파일이 들어 있는 폴더 열기): ' + loc.parentFolderUrl);
  }
  return {
    id: sid,
    url: url,
    drivePath: loc.drivePath,
    parentFolderUrl: loc.parentFolderUrl,
    createdNew: createdNew
  };
}

/**
 * 스프레드시트 파일의 Drive 상 위치(이름 경로) + 직상위 폴더 URL(탐색용)
 * @param {string} fileId
 * @returns {{ drivePath: string, parentFolderUrl: string }}
 */
function dbDescribeMasterFileLocation_(fileId) {
  var empty = { drivePath: '', parentFolderUrl: '' };
  try {
    var file = DriveApp.getFileById(String(fileId).trim());
    var segments = [file.getName()];
    var pit0 = file.getParents();
    var folder = pit0.hasNext() ? pit0.next() : null;
    var parentFolderUrl = folder ? 'https://drive.google.com/drive/folders/' + folder.getId() : '';
    var depth = 0;
    while (folder && depth < 50) {
      depth++;
      segments.unshift(folder.getName());
      var pit = folder.getParents();
      folder = pit.hasNext() ? pit.next() : null;
    }
    return { drivePath: segments.join(' > '), parentFolderUrl: parentFolderUrl };
  } catch (e) {
    return {
      drivePath: '(경로 조회 실패: ' + (e && e.message != null ? e.message : String(e)) + ')',
      parentFolderUrl: ''
    };
  }
}

/**
 * **부모 폴더 ID가 있으면** Drive API로 그 `parents`에 직접 스프레드시트 생성.
 * `SpreadsheetApp.create`만 쓰면 **항상 내 드라이브 루트**에 생기므로, REST 실패·폴백이면 `DB` 폴더로 **addToFolder + removeFromFolder**로 옮긴다.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function dbCreateNewMasterSpreadsheet_() {
  var title = '솔루션편입_원천DB_아임웹';
  var baseFolderId = dbResolveMasterParentFolderId_();
  var subId = '';
  if (baseFolderId) {
    subId = dbGetOrCreateDbSubfolder_(baseFolderId) || '';
    if (subId) {
      Logger.log('dbCreateNewMasterSpreadsheet_: baseFolder=' + baseFolderId + ' sub(DB)=' + subId);
      try {
        var file = dbDriveCreateSpreadsheetInFolder_(title, subId);
        if (file && file.id) {
          var opened = dbOpenNewSpreadsheetByIdWithRetry_(file.id);
          if (opened) {
            return opened;
          }
        }
        if (file && file.id) {
          try {
            DriveApp.getFileById(String(file.id).trim()).setTrashed(true);
            Logger.log('dbCreateNewMasterSpreadsheet_: REST로만 생긴 파일 open 실패 — 중복 막기 위해 휴지통(같은 이름으로 루트에서 다시 만듦)');
          } catch (tr) {
            Logger.log('dbCreateNewMasterSpreadsheet_: REST 유령 휴지통 실패(무시) ' + (tr && tr.message != null ? tr.message : String(tr)));
          }
        } else {
          Logger.log('dbCreateNewMasterSpreadsheet_: Drive Files.create id 없음 — 아래서 SpreadsheetApp.create 시도');
        }
      } catch (e) {
        Logger.log('dbCreateNewMasterSpreadsheet_: ' + (e && e.message != null ? e.message : String(e)));
      }
    } else {
      Logger.log('dbCreateNewMasterSpreadsheet_: DB 하위 폴더 실패(접근·권한 확인)');
    }
    Logger.log('dbCreateNewMasterSpreadsheet_: REST+open 정상 실패 — SpreadsheetApp.create(한 번만) 후 DB로 이동');
  } else {
    Logger.log('dbCreateNewMasterSpreadsheet_: 베이스 폴더 ID 없음 — 루트에만 생성(스크립트 부모·SHEETS_MASTER_PARENT_FOLDER_ID·' + (DB_DEFAULT_MASTER_FOLDER_PATH || []) + ' 경로 점검)');
  }
  var ss;
  try {
    ss = SpreadsheetApp.create(title);
  } catch (ce) {
    Logger.log('dbCreateNewMasterSpreadsheet_: SpreadsheetApp.create 실패 — ' + (ce && ce.message != null ? ce.message : String(ce)));
    throw ce;
  }
  if (subId) {
    dbMoveMasterSpreadsheetUnderDbFolderIfNeeded_(ss.getId(), subId);
  }
  return ss;
}

/**
 * `SpreadsheetApp.create`로 만든 파일을 `.../DB` 안으로만 두기(루트에 남지 않게).
 * (Drive `File`에는 addToFolder/removeFromFolder가 없고, **Folder#addFile / removeFile** 또는 **File#moveTo** 사용)
 * @param {string} fileId
 * @param {string} dbSubfolderId
 */
function dbMoveMasterSpreadsheetUnderDbFolderIfNeeded_(fileId, dbSubfolderId) {
  var fid = String(fileId).trim();
  var dest = String(dbSubfolderId).trim();
  if (!fid || !dest) {
    return;
  }
  try {
    var f = DriveApp.getFileById(fid);
    var target = DriveApp.getFolderById(dest);
    var it = f.getParents();
    var parentList = [];
    var inDest = false;
    var hasNonDest = false;
    while (it.hasNext()) {
      var p = it.next();
      parentList.push(p);
      if (p.getId() === dest) {
        inDest = true;
      } else {
        hasNonDest = true;
      }
    }
    if (inDest && !hasNonDest) {
      return;
    }
    if (typeof f.moveTo === 'function') {
      f.moveTo(target);
      Logger.log('dbMoveMasterSpreadsheetUnderDbFolderIfNeeded_: moveTo 완료 → ' + dest);
      return;
    }
    target.addFile(f);
    var j;
    for (j = 0; j < parentList.length; j++) {
      if (parentList[j].getId() !== dest) {
        parentList[j].removeFile(f);
      }
    }
    Logger.log('dbMoveMasterSpreadsheetUnderDbFolderIfNeeded_: addFile+removeFile 완료 → ' + dest);
  } catch (e) {
    Logger.log('dbMoveMasterSpreadsheetUnderDbFolderIfNeeded_: ' + (e && e.message != null ? e.message : String(e)));
  }
}

/**
 * `SHEETS_MASTER_ID`로 예전에 루트에 만든 파일을 열었을 때도, 여기서 **DB 하위**로 끌어올림(이미 DB면 no-op).
 */
function dbEnsureMasterSpreadsheetInDbSubfolder_(spreadsheetFileId) {
  var base = dbResolveMasterParentFolderId_();
  if (!base) {
    Logger.log('dbEnsureMasterSpreadsheetInDbSubfolder_: 베이스 폴더 ID 없음 — 이동 스킵 (스크립트 부모·' + DB_PROP_SHEETS_MASTER_PARENT_FOLDER_ID + '·경로)');
    return;
  }
  var subId = dbGetOrCreateDbSubfolder_(base) || '';
  if (!subId) {
    Logger.log('dbEnsureMasterSpreadsheetInDbSubfolder_: DB 폴더 실패 — 이동 스킵');
    return;
  }
  Logger.log('dbEnsureMasterSpreadsheetInDbSubfolder_: base=' + base + ' sub(DB)=' + subId);
  dbMoveMasterSpreadsheetUnderDbFolderIfNeeded_(String(spreadsheetFileId).trim(), subId);
}

/**
 * Drive REST 직후 가끔 `openById`만 지연/실패하고 URL로는 열리는 경우가 있어 **openByUrl** 도 시도.
 * @param {string} fileId
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet|null}
 */
function dbOpenNewSpreadsheetByIdWithRetry_(fileId) {
  var id = String(fileId).trim();
  if (!id.length) {
    return null;
  }
  var byUrl = 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
  var n;
  for (n = 0; n < 6; n++) {
    if (n > 0) {
      Utilities.sleep(400);
    }
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      Logger.log('dbOpenNewSpreadsheetByIdWithRetry_ openById n=' + (n + 1) + ' ' + (e && e.message != null ? e.message : String(e)));
    }
    try {
      return SpreadsheetApp.openByUrl(byUrl);
    } catch (e2) {
      Logger.log('dbOpenNewSpreadsheetByIdWithRetry_ openByUrl n=' + (n + 1) + ' ' + (e2 && e2.message != null ? e2.message : String(e2)));
    }
  }
  return null;
}

/**
 * Drive v3: https://developers.google.com/drive/api/v3/reference/files/create
 * @returns {{ id: string }|null}
 */
function dbDriveCreateSpreadsheetInFolder_(title, parentFolderId) {
  try {
    var url = 'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true';
    var body = {
      name: String(title),
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [String(parentFolderId).trim()]
    };
    var r = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
    var code = r.getResponseCode();
    var text = r.getContentText() || '';
    // v3 는 성공 시 200 또는 201(등) — 200만 보면 201이 실패로 떨어져 생성이 통째로 스킵됨
    if (code < 200 || code >= 300) {
      Logger.log('dbDriveCreateSpreadsheetInFolder_ http=' + code + ' ' + text.slice(0, 400));
      return null;
    }
    var j = JSON.parse(text);
    if (!j || !j.id) {
      return null;
    }
    try {
      var check = DriveApp.getFileById(String(j.id).trim());
      Logger.log('dbDriveCreateSpreadsheetInFolder_: id=' + j.id + ' mime=' + check.getMimeType() + ' name=' + check.getName());
    } catch (ch) {
      Logger.log('dbDriveCreateSpreadsheetInFolder_: id 있음, DriveApp 확인만 실패 ' + (ch && ch.message != null ? ch.message : String(ch)));
    }
    return { id: j.id };
  } catch (e) {
    Logger.log('dbDriveCreateSpreadsheetInFolder_: ' + (e && e.message != null ? e.message : String(e)));
    return null;
  }
}

/**
 * **베이스** = Apps Script가 들어 있는 Drive 폴더를 최우선, 그다음 Property·코드 ID·`DB_DEFAULT_MASTER_FOLDER_PATH`
 * (베이스 아래 `DB` 하위는 `dbGetOrCreateDbSubfolder_`에서 처리)
 */
function dbResolveMasterParentFolderId_() {
  var fromClasp = dbGetParentFolderIdOfClaspScript_();
  if (fromClasp) {
    return fromClasp;
  }
  var p = PropertiesService.getScriptProperties();
  var raw = p.getProperty(DB_PROP_SHEETS_MASTER_PARENT_FOLDER_ID);
  var fromProp = raw != null && String(raw).trim() ? String(raw).trim() : '';
  var fromCode =
    typeof DB_DEFAULT_SHEETS_MASTER_PARENT_FOLDER_ID === 'string' && DB_DEFAULT_SHEETS_MASTER_PARENT_FOLDER_ID.trim() !== ''
      ? DB_DEFAULT_SHEETS_MASTER_PARENT_FOLDER_ID.trim()
      : '';
  var fromPath = '';
  if (typeof DB_DEFAULT_MASTER_FOLDER_PATH !== 'undefined' && DB_DEFAULT_MASTER_FOLDER_PATH && DB_DEFAULT_MASTER_FOLDER_PATH.length) {
    fromPath = dbGetFolderIdByPathFromMyDriveRoot_(DB_DEFAULT_MASTER_FOLDER_PATH);
  }
  return fromProp || fromCode || fromPath || '';
}

/**
 * `baseParentId` **바로 아래**에 `DB` 이름의 폴더가 있으면 그 ID, 없으면 `createFolder`.
 * @param {string} baseParentId
 * @returns {string}
 */
function dbGetOrCreateDbSubfolder_(baseParentId) {
  var name = typeof DB_SUBFOLDER_NAME === 'string' && DB_SUBFOLDER_NAME.trim() ? DB_SUBFOLDER_NAME.trim() : 'DB';
  try {
    var parent = DriveApp.getFolderById(String(baseParentId).trim());
    var it = parent.getFoldersByName(name);
    if (it.hasNext()) {
      return it.next().getId();
    }
    return parent.createFolder(name).getId();
  } catch (e) {
    Logger.log('dbGetOrCreateDbSubfolder_: ' + (e && e.message != null ? e.message : String(e)));
    return '';
  }
}

/** Drive가 만든 기본 "시트1" / Sheet1 이 남아 있고 다른 탭이 있으면 제거 */
function dbDeleteOrphanDefaultSheetIfAny_(ss) {
  if (ss.getSheets().length < 2) {
    return;
  }
  var a = ['Sheet1', '시트1', 'シート1'];
  var i;
  for (i = 0; i < a.length; i++) {
    var sh = ss.getSheetByName(a[i]);
    if (sh) {
      try {
        ss.deleteSheet(sh);
        Logger.log('dbDeleteOrphanDefaultSheetIfAny_: removed ' + a[i]);
      } catch (e) {}
      return;
    }
  }
}

/**
 * `My Drive` 루트에서 `segments[0]`, `segments[1]`, … 이름의 하위 폴더를 순서대로 찾은 뒤 **그 폴더 ID**
 * @param {string[]} segments
 * @returns {string}
 */
function dbGetFolderIdByPathFromMyDriveRoot_(segments) {
  if (!segments || !segments.length) {
    return '';
  }
  try {
    var current = DriveApp.getRootFolder();
    var i;
    for (i = 0; i < segments.length; i++) {
      var name = String(segments[i]);
      var it = current.getFoldersByName(name);
      if (!it.hasNext()) {
        Logger.log('dbGetFolderIdByPathFromMyDriveRoot_: 폴더 없음 (단계 ' + (i + 1) + '): ' + name);
        return '';
      }
      current = it.next();
    }
    return current.getId();
  } catch (e) {
    Logger.log('dbGetFolderIdByPathFromMyDriveRoot_: ' + (e && e.message != null ? e.message : String(e)));
    return '';
  }
}

/**
 * 이 Apps Script 프로젝트(Drive상 파일)의 **첫 부모** = 스크립트가 들어 있는 그 폴더 ID (베이스 1순위)
 * @returns {string} 폴더 ID 또는 실패 시 ''
 */
function dbGetParentFolderIdOfClaspScript_() {
  try {
    var sid = ScriptApp.getScriptId();
    if (!sid || !String(sid).trim().length) {
      return '';
    }
    var scriptFile = DriveApp.getFileById(String(sid).trim());
    var it = scriptFile.getParents();
    if (!it.hasNext()) {
      return '';
    }
    return it.next().getId();
  } catch (e) {
    Logger.log('dbGetParentFolderIdOfClaspScript_: ' + (e && e.message != null ? e.message : String(e)));
    return '';
  }
}
