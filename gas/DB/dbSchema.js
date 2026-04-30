/**
 * 원천 DB (Google Sheets) — 스키마·Property 키.
 * Open API 응답(camelCase) → 아래 **헤더(snake_case) 열**로 매핑. ([BACKEND_API.md](../../docs/BACKEND_API.md) 주문 절)
 *
 * 원천 시트는 GAS만 쓰기·사람 읽기 전용(락은 시트 UI에서 별도 설정).
 *
 * --- 스프레드시트 **파일 ID** (고유값) ---
 * 소스 코드에 스프레드시트 id 문자열을 **박아 넣지 않는다**. (`.clasp.json`의 `scriptId`는 **이 GAS 프로젝트** id이지 시트 id가 아님.)
 * 시트를 만들 때 나온 id만 `PropertiesService.setProperty('SHEETS_MASTER_ID'|…, ss.getId())` 등으로 **그때마다** 넣는다.
 * “고정값” 문제는 **레포**가 아니라, GAS 편집기 **프로젝트 설정 → 스크립트 속성**에 **옛 id가 남아 있는 것** — UI에서 파일을 지워도 속성은 자동으로 안 지워진다.
 */
var DB_PROP_SHEETS_MASTER_ID = 'SHEETS_MASTER_ID';
/** (선택) 마스터 스프레드시트를 **처음 만들 때** 둘 Google Drive 폴더 ID. */
var DB_PROP_SHEETS_MASTER_PARENT_FOLDER_ID = 'SHEETS_MASTER_PARENT_FOLDER_ID';

/**
 * (선택) **레포에 박는** 팀용 폴더 ID. 비어 있으면 `dbGetParentFolderIdOfClaspScript_()` = **clasp로 연동된 이 GAS
 * 프로젝트 파일이 Drive에 있는 그 폴더**를 씀(ScriptApp.getScriptId + Drive). Properties가 최우선.
 * @type {string}
 */
var DB_DEFAULT_SHEETS_MASTER_PARENT_FOLDER_ID = '';

/**
 * `My Drive`에서 루트 → … 순으로 내려갈 **폴더 이름** (캡처: `00_admin` / `10_IMWEB_DASHBOARD`).
 * 새 마스터 DB 스프레드시트는 **여기(마지막 폴더)**에 두도록 이동. 이름 바꾸면 여기도 같이 맞출 것.
 * @type {string[]}
 */
var DB_DEFAULT_MASTER_FOLDER_PATH = ['00_admin', '10_IMWEB_DASHBOARD'];

/** `dbSetupMasterDatabase` — 스크립트가 있는 Drive 폴더 **아래** 이 이름의 하위 폴더를 만들고(없으면 사용), 시트는 그 안에 둔다. */
var DB_SUBFOLDER_NAME = 'DB';

var DB_PROP_UNIT_CODE = 'IMWEB_UNIT_CODE';

var DB_SHEET_MEMBERS = 'members';
var DB_SHEET_ORDERS = 'orders';
var DB_SHEET_ORDER_ITEMS = 'order_items';
var DB_SHEET_PRODUCTS = 'products';
var DB_SHEET_SYNC_LOG = 'sync_log';

/**
 * 층 1(운영/파생) — 상품·내부 분류 매핑. 원천 `products`와 **별도 시트(또는 별도 스프레드시트)**. (레포 `docs/SCHEMA_PRODUCT_MAPPING.md` 참고)
 * Script Property: `SHEETS_OPERATIONS_ID` — 없으면 개발/초기에는 원천 마스터와 **같은 파일**에 탭만 두는 방식으로도 동작시킬 수 있음(구현에서 결정).
 */
var DB_PROP_SHEETS_OPERATIONS_ID = 'SHEETS_OPERATIONS_ID';
var DB_SHEET_PRODUCT_MAPPING = 'product_mapping';

/**
 * @type {string[]}
 * - internal_category: `unmapped` | `solpass` | `solutine` | `challenge` | `textbook` | `jasoseo` (영문 키 고정)
 * - lifecycle: `active` | `archived` | `test` | `legacy` ((구)상품)
 */
/** `sales_end`: yyyy-MM-dd, archived·legacy에서만 필수(맨 끝 열 — 기존 7열 시트와 행 정렬 유지) */
var DB_PRODUCT_MAPPING_HEADERS = [
  'prod_no',
  'product_name',
  'internal_category',
  'lifecycle',
  'created_at',
  'updated_at',
  'notes',
  'sales_end'
];

/**
 * 층 2(집계·리포트) — 대시보드(임베드) **전용** 파일. Script Property: `SHEETS_ANALYTICS_ID` (docs/ANALYTICS_DASHBOARD_NEXT.md)
 */
var DB_PROP_SHEETS_ANALYTICS_ID = 'SHEETS_ANALYTICS_ID';

/**
 * 수강생 관리 전용 스프레드시트. Script Property: `SHEETS_STUDENT_ID`
 * (문서: `docs/SCHEMA_STUDENT_MANAGEMENT.md`)
 */
var DB_PROP_SHEETS_STUDENT_ID = 'SHEETS_STUDENT_ID';
var DB_STUDENT_SPREADSHEET_TITLE = '솔루션편입_수강생_마스터';
var DB_SHEET_STUDENT_MEMBER_MASTER = 'student_member_master';
var DB_SHEET_STUDENT_ORDER_EVENTS = 'student_member_order_events';

/** @type {string[]} */
var DB_STUDENT_MEMBER_HEADERS = [
  'member_code',
  'uid',
  'name',
  'callnum',
  'last_login_time',
  'group_titles',
  'fetched_at',
  'source_sync_id'
];

/** @type {string[]} — 원천 order_items 에서 가격·order_section_item_no 제외 + 조인·기간 열 */
var DB_STUDENT_ORDER_EVENT_HEADERS = [
  'order_item_code',
  'order_no',
  'member_code',
  'order_time',
  'internal_category',
  'lifecycle',
  'product_start_date',
  'product_end_date',
  'order_status',
  'section_status',
  'claim_status',
  'claim_type',
  'claim_event_time',
  'prod_no',
  'prod_name',
  'options_raw',
  'options_count',
  'row_json',
  'updated_at',
  'fetched_at',
  'source_sync_id'
];

/** 연·월 목표 — `goal_target` = `entire` | `solpass` | `challenge` | `solutine` (빈칸 금지) */
var DB_SHEET_ANALYTICS_GOALS = '01_연월_목표';
/** 마스터 `order_items` 1:1 + 실결제·스냅샷(종료일은 운영 product_mapping.sales_end) */
var DB_SHEET_ANALYTICS_ORDER_LINES = '02_주문라인_실적';

/** @type {string[]} */
var DB_ANALYTICS_GOALS_HEADERS = ['year', 'month', 'goal_target', 'sales_target', 'people_target'];

/**
 * @type {string[]}
 * line_net_amount = order_items line_price - line_price_sale - line_point.
 * `02_주문라인_실적`에는 ISO 원본(`order_time`, `claim_event_time`)만 저장하고, 서울 날짜(`yyyy-MM-dd`) 변환은 집계 계산 시점에만 수행.
 * claim_event_time = 취소 접수 ISO — 원천 `order_items.claim_event_time` (= API `cancelInfo.cancelRequestTime`). 일별 fact·카드에서 **환불액·환불 건수는 이 시각의 서울 일자**에만 반영.
 */
var DB_ANALYTICS_ORDER_LINE_HEADERS = [
  'order_section_item_no',
  'order_item_code',
  'order_no',
  'order_time',
  'prod_no',
  'prod_name',
  'line_net_amount',
  'section_status',
  'internal_category',
  'lifecycle',
  'add_time',
  'claim_event_time'
];

/* --- 이전 집계 탭(이름·데이터 이행용) --- */
var DB_SHEET_ANALYTICS_KPI_LEGACY = 'kpi_매출건수_목표';
var DB_SHEET_ANALYTICS_KPI_OLD = '01_일월간_매출_인원_목표';
var DB_SHEET_ANALYTICS_FACT_LEGACY = 'fact_매출건수_일별';

/**
 * 리포트 `dbAnalyticsFactRowsGet_` 메모리 결과 형식 (롱) — 02_주문라인_실적에서 집계해 채움
 * @type {string[]}
 */
var DB_ANALYTICS_FACT_HEADERS = [
  'date_ymd',
  'metric',
  'internal_category',
  'prod_no',
  'value',
  'batch_id',
  'updated_at'
];

/** 끝 2열: docs/SPEC.md §5.1.1 공통 */
var DB_META_SUFFIX = ['fetched_at', 'source_sync_id'];

/** @type {string[]} */
var DB_MEMBERS_HEADERS = [
  'member_code',
  'uid',
  'name',
  'callnum',
  'gender',
  'birth',
  'addr',
  'sms_agree',
  'email_agree',
  'join_time',
  'recommend_code',
  'recommend_target_code',
  'last_login_time',
  'member_grade',
  'group_json',
  /** `GET /member-info/groups`의 `title` — `group`의 `siteGroupCode`와 매칭한 문자열 배열 JSON */
  'group_titles'
].concat(DB_META_SUFFIX);

/** @type {string[]} */
var DB_ORDERS_HEADERS = [
  'order_no',
  'order_time',
  'orderer_member_code',
  'orderer_name',
  'orderer_call',
  'order_status',
  'order_type',
  'currency',
  'total_price',
  'total_discount_price',
  'total_point',
  'line_coupon_sum',
  'payment_amount'
].concat(DB_META_SUFFIX);

/** @type {string[]} */
var DB_ORDER_ITEMS_HEADERS = [
  'order_section_item_no',
  'order_item_code',
  'order_no',
  'order_status',
  'section_status',
  'claim_status',
  'claim_type',
  'claim_event_time',
  'prod_no',
  'prod_name',
  'line_price',
  'line_price_sale',
  'line_point',
  'line_coupon',
  'line_period_discount',
  'options_raw',
  'options_count',
  'row_json'
].concat(DB_META_SUFFIX);

/** @type {string[]} — §3.3.4 + 메타 */
var DB_PRODUCTS_HEADERS = [
  'prod_no',
  'prod_status',
  'categories',
  'name',
  'prod_type_data',
  'price',
  'price_org',
  'is_exist_options',
  'is_mix',
  'add_time',
  'edit_time'
].concat(DB_META_SUFFIX);

/** @type {string[]} */
var DB_SYNC_LOG_HEADERS = [
  'sync_id',
  'started_at',
  'ended_at',
  'entity',
  'status',
  'rows_written',
  'message'
];
