// [Day 15 작업] 파워빌더 분석기 및 수식 계산기 공통 타입 선언
// 초보자를 위한 설명: 파워빌더(.srd, .srw 등) 파일 구조 분석과 화면 렌더링에 사용되는 공통 타입(인터페이스) 정의 파일입니다.

/**
 * 계산식 필드(Computed Field) 정보를 정의하는 인터페이스
 */
export interface ComputedFieldInfo {
  name: string;        // 계산식 필드의 고유 이름
  expression: string;  // 계산식 수식 (예: sales * 1.1)
  alignment: string;   // 정렬 방식 ("0": 좌측, "1": 우측, "2": 중앙)
  band: string;        // 표시될 영역 (detail, summary 등)
  label: string;       // 화면에 표시될 한글 라벨 또는 이름
}

/**
 * SQL Retrieve 쿼리에 사용되는 조회 인자(Argument) 정보를 정의하는 인터페이스
 */
export interface ArgumentInfo {
  name: string;        // 인자 변수명 (예: as_status)
  type: string;        // 인자 데이터 타입 (예: string, number)
}

/**
 * 데이터윈도우 테이블의 컬럼 정보를 정의하는 인터페이스
 */
export interface ColumnInfo {
  name: string;        // 컬럼의 고유 이름
  type: string;        // 데이터 타입 (char, number 등)
  dbname: string;      // 실제 데이터베이스 컬럼명 (예: employee.id)
  label?: string;      // 컬럼에 매핑된 한글 헤더 텍스트
  alignment?: string;  // 정렬 코드 ("0": 좌측, "1": 우측, "2": 중앙)
  [key: string]: string | undefined; // 추가적인 속성 확장을 위한 인덱스 시그니처
}

/**
 * 파워빌더 소스 파일 분석 결과 전체를 담는 메인 인터페이스
 */
export interface ParsedPB {
  release: string;     // 파워빌더 버전 (예: 10.5, 12.5)
  fileType: string;    // 파일 형식 설명 (예: DataWindow (.srd))
  datawindowProps: { [key: string]: string }; // 데이터윈도우 공통 속성 key-value 맵
  columns: ColumnInfo[];                      // 파싱된 테이블 컬럼 목록
  computedFields: ComputedFieldInfo[];        // 파싱된 연산 필드 목록
  retrieveQuery: string;                      // 파싱된 SQL 조회 쿼리 원문
  bands: { [key: string]: number };          // 밴드(header, detail 등)별 높이 정보
  controls: Array<{ name: string; type: string }>; // 윈도우/사용자 객체 내 컨트롤 목록
  arguments: ArgumentInfo[];                  // 조회 인자 목록
  parseError?: string; // 구조 분석 중 발생한 예외 메시지 (Day 14 구현)
  sqlError?: string;   // SQL 분석 중 발생한 예외 메시지 (Day 14 구현)
}
