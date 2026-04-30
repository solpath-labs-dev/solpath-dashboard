# 수강생 관리 DB — 스키마 확정 문서

> 원천 시트 컬럼 스펠링은 `gas/DB/dbSchema.js` (`DB_ORDER_ITEMS_HEADERS`, `DB_MEMBERS_HEADERS`, `DB_PRODUCT_MAPPING_HEADERS`)와 동일하게 둔다.  
> **구현·시트 생성·Script Property** 는 Step 2 이후.

---

## 1. 파일·위치

| 항목 | 확정 |
|------|------|
| 스프레드시트 **표시 이름** | `솔루션편입_수강생_마스터` |
| 다른 DB와의 관계 | **독립 파일** (원천 DB·집계 DB와 분리) |
| 드라이브 위치 | **다른 DB 파일들과 동일 폴더** |

접속용 스프레드시트 ID는 `Script Property`로 둔다 (키 이름은 Step 2에서 코드와 함께 정함).

---

## 2. 시트 탭명

| 역할 | 탭명 |
|------|------|
| 회원 1행 마스터 | `student_member_master` |
| 주문 라인 이벤트 | `student_member_order_events` |

---

## 3. 목적·데이터 원칙

- **수강생(아래 포함 카테고리 구매 회원) 중심** — 임웹 **회원 전체**가 아님.
- **아임웹에서 동기화된 원천 시트**(`members`, `orders`, `order_items` 등)는 **읽기 전용·수정 금지**.
- **`솔루션편입_수강생_마스터`** 는 자체 적재 DB이며, **`product_start_date` / `product_end_date`** 는 **프론트에서 수정 가능** (운영 편집).
- **재등록 / 등록예정 / 연락필요** 등은 **시트 컬럼에 넣지 않고**, 조회·리포트 단계에서 **계산**한다.
- **월별 수강·환불** 판단은 **매출 건수(집계)와 동일 기준** — “해당 월에 실제로 잡히는 상품·환불” 논리에 맞춘다 (구현은 집계 로직과 정렬).

---

## 4. 포함 카테고리 (적재 대상)

`product_mapping.internal_category` 가 아래 **어느 하나라도** 해당하는 주문 라인·회원만 수강생 DB로 가져온다.

| 값 | 비고 |
|----|------|
| `solpass` | |
| `challenge` | |
| `solutine` | |
| `jasoseo` | 자소서 — 날짜 규칙은 §6 참고 |

**`textbook`(교재)** 는 수강생 DB **적재 대상에서 제외** (라인·회원 모두 이 카테고리만으로는 넣지 않음).

---

## 5. 라인·회원 제외 규칙

아래에 해당하면 **이벤트에 넣지 않으며**, 해당 회원이 다른 유효 라인이 없으면 **마스터에서도 제외**된다.

| 조건 | 설명 |
|------|------|
| `internal_category === unmapped` | 매핑 없음 |
| `product_mapping.lifecycle === test` | 시험용 상품 매핑 |
| 구매자 그룹 | `members.group_titles` 파싱 결과에 **정확히 `관리자`** 인 그룹이 있거나, 그룹명 문자열에 **`테스트`** 가 포함 |
| 구매자 표시 이름 | `orders.orderer_name` 이 **정확히** `솔루션편입` 과 일치 (trim/대소문자 변환 없이 집계와 동일한 strict 비교) |

**매출 건수 집계에 있는 `orderer_call` 특정 번호 제외 규칙은 수강생 DB에는 적용하지 않는다.**

제외 판정은 집계의 `dbAnOrderLineSkipForAnalytics_` 및 주문자 이름 처리와 **같은 데이터 소스·같은 이름/그룹 규칙**을 쓰되, **전화번호 분기만 빼면** 된다 (구현 시 공통 헬퍼화 권장).

---

## 6. `product_start_date` / `product_end_date`

두 컬럼은 **모든 이벤트 행에 존재**한다. 카테고리에 따라 **값 채움 규칙만 다르다** (자소서는 종료일 칸을 비움).

**시간대**: **Asia/Seoul** 고정.

### 6.1 `solpass` / `challenge` / `solutine`

| 컬럼 | 기본 채움 |
|------|-----------|
| `product_start_date` | `orders.order_time` 으로 **구매일(서울 날짜)** 을 정한 뒤, 그 **다음 날 00:00:00** (서울). 하루를 24시간 단위로 쓰는 전제. |
| `product_end_date` | `product_start_date` **날짜**를 1일째로 포함한 N일권의 **마지막 날** 23:59:59 (아래 N). |

**이용 기간 N일 (시작일 포함 — 초기값, 코드 `dbStuEndDateFromStartYmd_`)**

종료 **날짜** = 시작 **날짜**에 달력으로 **(N − 1)** 일을 더한 날.  
예: 시작 3/27·28일권 → 마지막 날 4/23.

| `internal_category` | N (일) |
|---------------------|--------|
| `solpass` | 28 |
| `challenge` | 14 |
| `solutine` | 26 (시작일 포함; 월~금 20영업일·4주차 금요일 종료와 맞추려 캘린더 26일로 통일) |

### 6.2 `jasoseo`

| 컬럼 | 기본 채움 |
|------|-----------|
| `product_start_date` | **`order_time` 과 동일 시각** (주문 즉시 첨삭 시작, 마감은 학교별로 상이) |
| `product_end_date` | **비움** (열은 유지, 셀 빈 값) |

### 6.3 운영 편집

- `product_start_date`, `product_end_date` 는 **프론트에서 수정 가능**.
- **재동기화 시 사용자 수정을 덮어쓸지·병합할지** 는 Step 3 구현에서 정함 (본 문서는 스키마만).

### 6.4 환불 시각

- **환불(클레임) 시각**은 원천과 같이 **`claim_event_time`** 컬럼을 사용한다.

---

## 7. `student_member_master` — 컬럼

원천 `members` 에서만 가져오며, **교재-only·기타 파생 플래그 열은 두지 않는다.**

| # | 컬럼명 | 설명 |
|---|--------|------|
| 1 | `member_code` | PK |
| 2 | `uid` | |
| 3 | `name` | |
| 4 | `callnum` | |
| 5 | `last_login_time` | |
| 6 | `group_titles` | JSON 문자열, 원천과 동일 의미 |

**넣지 않음**: `member_grade`, `join_time`, `sms_agree`, `email_agree` 및 그 외 주소·추천 등.

| # | 컬럼명 | 설명 |
|---|--------|------|
| 7 | `fetched_at` | 행 반영 시각 (ISO) |
| 8 | `source_sync_id` | 마지막 반영 동기화 ID |

**1행 헤더 순서 (확정)**

`member_code`, `uid`, `name`, `callnum`, `last_login_time`, `group_titles`, `fetched_at`, `source_sync_id`

---

## 8. `student_member_order_events` — 컬럼

### 8.1 원천 `order_items` 에서 **제외**하는 열

- `order_section_item_no`
- `line_price`, `line_price_sale`, `line_point`, `line_coupon`, `line_period_discount`

### 8.2 원천에서 **유지**하는 열 (순서는 구현 시 헤더 상수로 고정)

`order_item_code`, `order_no`, `order_status`, `section_status`, `claim_status`, `claim_type`, `claim_event_time`, `prod_no`, `prod_name`, `options_raw`, `options_count`, `row_json`, `updated_at`, `fetched_at`, `source_sync_id`

### 8.3 조인·운영 열 (시트에 저장)

| 컬럼명 | 출처 |
|--------|------|
| `member_code` | `orders.orderer_member_code` |
| `order_time` | `orders.order_time` |
| `internal_category` | `product_mapping.internal_category` |
| `lifecycle` | `product_mapping.lifecycle` |
| `product_start_date` | §6 규칙 + 프론트 수정 |
| `product_end_date` | §6 규칙 + 프론트 수정 |

### 8.4 권장 1행 헤더 순서 (확정안)

식별·조인·기간·상태·상품·메타 순.

`order_item_code`, `order_no`, `member_code`, `order_time`, `internal_category`, `lifecycle`, `product_start_date`, `product_end_date`, `order_status`, `section_status`, `claim_status`, `claim_type`, `claim_event_time`, `prod_no`, `prod_name`, `options_raw`, `options_count`, `row_json`, `updated_at`, `fetched_at`, `source_sync_id`

- `updated_at`: 프론트의 “수강 시작일, 종료일 설정”에서 시작/종료를 저장한 시각(ISO). 날짜 미수정 행은 빈 값일 수 있다.

### 8.5 키

- **이벤트 식별**: `order_item_code`
- **보조 묶음**: `order_no`

---

## 9. 프론트·리포트 (스키마 밖)

- 일일 인원·재등록률 등 **표/카드 UI** 는 별도 설계; 필요한 상태는 **계산 결과**로만 쓴다.
- “챌린지 → 솔패스는 신규” 등 비즈니스 규칙도 **스키마 컬럼이 아니라 계산 단계**에서 적용한다.

---

## 10. 변경 이력 (요약)

| 시점 | 내용 |
|------|------|
| 확정 | 파일명 `솔루션편입_수강생_마스터`, 탭 `student_member_*`, 교재 제외, 자소서 포함, textbook-only 추적 제거 |
| 확정 | 이벤트에 `internal_category`, `lifecycle`, `member_code`, `order_time`, `product_start_date`, `product_end_date` |
| 확정 | 구매자 제외: 관리자·테스트 그룹·주문자명 솔루션편입 (전화번호 제외 규칙 없음) |
