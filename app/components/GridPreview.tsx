// [Day 21 작업] 데이터윈도우 웹 변환 그리드 프리뷰 컴포넌트
// [Day 32 작업] 상단 Retrieval Argument 조회 바 및 동적 데이터 바인딩 고도화
// [Day 34 작업] 그리드 런타임 결과 내 실시간 와일드카드 필터링(Filter) 고도화 구현
"use client";

import React from "react";
import { ParsedPB, ColumnInfo } from "../types";
import { isNumericColumn, formatNumberWithCommas, evaluateDWExpression } from "../utils/expression";

interface GridPreviewProps {
  parsedData: ParsedPB;
  gridData: Array<{ [key: string]: string }>;
  setGridData: React.Dispatch<React.SetStateAction<Array<{ [key: string]: string }>>>;
  argValues: { [key: string]: string };
  // [Day 27 작업] 행 선택 상태 정의 구역
  selectedRowIndex: number;
  onSelectRow: (rIdx: number) => void;
}

const ALIGN_MAP: { [key: string]: string } = {
  "0": "text-left",
  "1": "text-right",
  "2": "text-center",
};

const getAlignClass = (alignCode: string | undefined): string => {
  if (!alignCode) return "text-left";
  return ALIGN_MAP[alignCode.replace(/[^0-9]/g, "")] || "text-left";
};

// [Day 32 작업] 레거시 DB 조회를 시뮬레이션하기 위한 10개 행 규모의 가상 직원/실적 마스터 데이터셋
const MOCK_MASTER_DATA = [
  { id: "1001", region: "개발팀", rep: "김개발", sales: "150000", status: "Closed", name: "김개발", emp_id: "1001", dept: "개발팀" },
  { id: "1002", region: "영업팀", rep: "이영업", sales: "250000", status: "Open", name: "이영업", emp_id: "1002", dept: "영업팀" },
  { id: "1003", region: "인사팀", rep: "박인사", sales: "80000", status: "Closed", name: "박인사", emp_id: "1003", dept: "인사팀" },
  { id: "1004", region: "개발팀", rep: "최기술", sales: "120000", status: "Open", name: "최기술", emp_id: "1004", dept: "개발팀" },
  { id: "1005", region: "영업팀", rep: "정실적", sales: "300000", status: "Closed", name: "정실적", emp_id: "1005", dept: "영업팀" },
  { id: "1006", region: "인사팀", rep: "조인사", sales: "90000", status: "Open", name: "조인사", emp_id: "1006", dept: "인사팀" },
  { id: "1007", region: "개발팀", rep: "한코딩", sales: "180000", status: "Closed", name: "한코딩", emp_id: "1007", dept: "개발팀" },
  { id: "1008", region: "영업팀", rep: "강판매", sales: "220000", status: "Open", name: "강판매", emp_id: "1008", dept: "영업팀" },
  { id: "1009", region: "인사팀", rep: "황관리", sales: "95000", status: "Closed", name: "황관리", emp_id: "1009", dept: "인사팀" },
  { id: "1010", region: "개발팀", rep: "백엔드", sales: "160000", status: "Open", name: "백엔드", emp_id: "1010", dept: "개발팀" }
];

export default function GridPreview({
  parsedData,
  gridData,
  setGridData,
  argValues,
  selectedRowIndex,
  onSelectRow,
}: GridPreviewProps) {
  // [Day 32 작업] 동적 조회(Retrieve) 및 필터링 관련 React 로컬 상태 관리
  const [selectedDept, setSelectedDept] = React.useState<string>("전체");
  const [searchKeyword, setSearchKeyword] = React.useState<string>("김개발"); // 사용성 향상을 위한 초기 기본값 지정
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  // [Day 34 작업] 결과 내 실시간 와일드카드 필터링 키워드 로컬 상태 선언
  const [filterKeyword, setFilterKeyword] = React.useState<string>("");

  // [Day 33 작업] 정렬 상태 관리를 위한 React 로컬 상태 추가
  // key: 정렬 대상 컬럼명, direction: 정렬 방향 (asc: 오름차순, desc: 내림차순, none: 정렬 안 함)
  const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: "asc" | "desc" | "none" }>({
    key: "",
    direction: "none",
  });

  // [Day 24 작업] 초기 gridData 백업 및 비교를 위한 레퍼런스
  const snapshotRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const initialGridDataRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const prevParsedDataRef = React.useRef<any>(null);

  // [Day 29 작업] 추출된 JSON 마스터 패킷 저장용 상태
  const [dumpOutput, setDumpOutput] = React.useState<string | null>(null);
  // [Day 30 작업] 클립보드 복사 완료 상태 관리용 토스트 플래그
  const [copied, setCopied] = React.useState<boolean>(false);

  // [Day 35 작업] 실시간 유효성 검증(Validation) 및 레거시 ItemChanged / dw_1.Find() 대치 로직
  /*
   * 파워빌더 레거시 메커니즘 vs 현대 리액트 선언형 아키텍처 비교 설명 (교육용 주석)
   * 
   * 1. 파워빌더 (레거시 C/S 환경):
   *    - 파워빌더에서는 사용자가 셀(Column) 값을 수정하고 포커스를 잃을 때 `ItemChanged` 이벤트가 동기적으로 발생합니다.
   *    - 이 이벤트 내에서 입력된 신규 값(data)의 유효성을 검증하며, 유효하지 않은 경우 Action Code를 반환하여 포커스 아웃을 막거나 입력을 거부합니다.
   *    - 최종적으로 모든 수정이 끝난 후 `dw_1.AcceptText()`를 호출하여 화면의 버퍼 값을 데이터윈도우의 Primary Buffer로 강제 승인합니다.
   *    - 특정 조건의 잘못된 로우를 찾아내기 위해서는 `dw_1.Find("IsNull(emp_name) or emp_name = ''", 1, dw_1.RowCount())`와 같이
   *      C++ 내장 탐색 엔진을 명시적 루프로 호출하여 에러 행의 포인터를 역추적해 이동해야 했습니다.
   * 
   * 2. 현대 React 아키텍처 (선언형/실시간 환경):
   *    - React 환경에서는 사용자의 키 입력이 일어날 때마다 `onChange` 핸들러가 트리거되어 단일 상태 원천(Single Source of Truth)인 `gridData`를 즉시 업데이트합니다.
   *    - 별도의 `AcceptText()` 호출 없이도 데이터의 변경은 즉시 선언형 데이터 흐름에 반영됩니다.
   *    - 본 컴포넌트에서는 `gridData` 상태가 변경될 때마다 `useEffect` 훅을 통해 전체 행을 스캔하는 `validateGridData` 함수를 자동으로 트리거합니다.
   *    - JavaScript의 고차 함수(`reduce`, `forEach`)를 활용한 선언형 배열 탐색 알고리즘을 활용하여, 특정 컬럼(사원명, 부서명, 사번 등)의
   *      필수값 누락 여부 및 형식 오류(예: 실적 필드의 숫자 형식 위반)를 O(N) 복잡도로 초고속 전수 스캔합니다.
   *    - 감지된 검증 에러는 `validationErrors` 상태로 기록되며, 이 상태와 렌더링 파이프라인이 즉각 연동되어 해당 행의 배경색(다크 레드/주황 네온)을 변경하고,
   *      하단 터미널 로그창에 빨간색 에러 텍스트(`[VALIDATION ERROR]`)를 실시간으로 스트리밍 출력하게 됩니다.
   */
  const [validationErrors, setValidationErrors] = React.useState<{ [rowIndex: number]: string }>({});

  const validateGridData = React.useCallback((data: Array<{ [key: string]: string }>) => {
    const errors: { [rowIndex: number]: string } = {};
    
    data.forEach((row, idx) => {
      // 1. 필수값 누락 검증 (사원명: rep/name, 부서명: dept/region, 사번: emp_id/id)
      const empName = row.rep ?? row.name ?? "";
      const deptName = row.dept ?? row.region ?? "";
      const empId = row.emp_id ?? row.id ?? "";

      if (!empId.trim()) {
        errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 필수 항목인 '사번'이 누락되었습니다.`;
        return;
      }
      if (!empName.trim()) {
        errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 필수 항목인 '사원명'이 누락되었습니다.`;
        return;
      }
      if (!deptName.trim()) {
        errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 필수 항목인 '부서명'이 누락되었습니다.`;
        return;
      }

      // 2. 형식 검증 (실적/sales가 비어있지 않은 경우 숫자 형식인지 체크)
      const salesVal = row.sales ?? "";
      if (salesVal.trim()) {
        const cleanSales = salesVal.replace(/,/g, "");
        if (isNaN(Number(cleanSales))) {
          errors[idx] = `[VALIDATION ERROR] ${idx + 1}번째 행의 실적(Sales) 필드가 올바른 숫자 형식이 아닙니다.`;
          return;
        }
      }
    });

    setValidationErrors(errors);
  }, []);

  // gridData의 변경을 실시간으로 감시하여 유효성 검증 수행
  React.useEffect(() => {
    validateGridData(gridData);
  }, [gridData, validateGridData]);

  // 실시간 에러 발생 시 하단 터미널에 에러 문구를 실시간 스트리밍 출력
  React.useEffect(() => {
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      const errorMsg = errorKeys
        .map((k) => validationErrors[Number(k)])
        .join("\n");
      setDumpOutput(errorMsg);
    } else {
      // 에러가 없고 기존 dumpOutput이 에러 메시지 형식을 띠고 있다면(즉, "[VALIDATION ERROR]"를 포함하고 있다면) 지워주거나 초기화
      setDumpOutput((prev) => {
        if (prev && prev.includes("[VALIDATION ERROR]")) {
          return null;
        }
        return prev;
      });
    }
  }, [validationErrors]);

  // [Day 32 작업] 파싱된 컬럼 정보 규격에 맞게 동적 데이터 행을 조립하는 헬퍼 함수
  const generateRowData = (mockItem: typeof MOCK_MASTER_DATA[0], columns: ColumnInfo[]) => {
    const row: { [key: string]: string } = {};
    columns.forEach((col) => {
      const colName = col.name;
      const lowerName = colName.toLowerCase();
      
      if (mockItem[colName as keyof typeof mockItem] !== undefined) {
        row[colName] = mockItem[colName as keyof typeof mockItem];
      } else if (lowerName.includes("id")) {
        row[colName] = mockItem.id;
      } else if (lowerName.includes("region") || lowerName.includes("dept") || lowerName.includes("department")) {
        row[colName] = mockItem.region;
      } else if (lowerName.includes("rep") || lowerName.includes("name") || lowerName.includes("emp")) {
        row[colName] = mockItem.rep;
      } else if (lowerName.includes("sales") || lowerName.includes("salary") || lowerName.includes("amt") || lowerName.includes("amount")) {
        row[colName] = mockItem.sales;
      } else if (lowerName.includes("status")) {
        row[colName] = mockItem.status;
      } else {
        const numTypes = ["number", "decimal", "numeric", "double", "real", "float", "integer", "int", "long", "ulong"];
        const colType = (col.type || "").toLowerCase();
        const isNum = numTypes.some((t) => colType.includes(t));
        row[colName] = isNum ? "0" : `${colName} Val`;
      }
    });
    return row;
  };

  // [Day 34 작업] dw_1.SetFilter() 및 dw_1.Filter() 대치용 React 파생 상태(Derived State) 필터링 핸들러
  /*
   * 파워빌더 dw_1.SetFilter() / Filter() 와 현대 React 파생 상태(Derived State) 기반 필터링 비교 (교육용 설명)
   * 
   * 1. 파워빌더(레거시 C/S)의 필터링 메커니즘:
   *    파워빌더에서는 `dw_1.SetFilter("emp_name like '%홍%'")`와 같이 조건식 문자열을 설정한 후,
   *    `dw_1.Filter()`를 호출하면 C++ 데이터윈도우 엔진이 프라이머리 버퍼(Primary Buffer)에 적재된 로우 중에서
   *    조건식을 불충족하는 로우들을 필터 버퍼(Filter Buffer)로 직접 강제 격리시킵니다.
   *    화면에는 프라이머리 버퍼에 잔류한 가시 행들만 리렌더링되며, 이후 정렬이나 갱신 시 버퍼 간의 로우 포인터가 직접 교환됩니다.
   *    이 방식은 원본 상태(메모리 데이터)를 물리적으로 나누고 상태를 분할 관리하므로 복원(Undo)이나 다차원 연동이 비직관적이었습니다.
   * 
   * 2. 현대 React 아키텍처의 파생 상태(Derived State) 및 선언형(Declarative) 필터링:
   *    React 환경에서는 단일 진실 공급원(Single Source of Truth) 원칙 하에, 원본 데이터 상태인 `gridData`를 절대로 훼손하지 않습니다.
   *    사용자가 필터 인풋을 입력할 때마다 `filterKeyword` 로컬 상태(State)만 변경해 주고,
   *    화면을 렌더링하기 직전에 원본 `gridData`를 스캔하여 조건에 맞는 행만 가공해서 생성하는 '파생 상태(Derived State)' 구조로 평가합니다.
   *    - `useMemo` 훅을 활용하여 `gridData`나 `filterKeyword`가 변하지 않았다면 이전 가공 데이터를 재사용(Memoization)해 렌더링 부하를 최소화합니다.
   *    - 데이터의 원본이 훼손되지 않으므로, 필터를 끄거나 키워드를 지우면 별도의 쿼리나 백업 복구 없이도 즉시 원본 전체 화면으로 복원됩니다.
   * 
   * 3. 인덱스 매핑의 해결:
   *    파워빌더 버퍼 필터링 시에는 `GetRow()`나 `rIdx` 등이 화면 가시 기준 인덱스로 고정되지만, 
   *    리액트에서는 `{ row, index }` 구조로 원본 `gridData` 내에서의 절대 인덱스(`index`)를 항상 내장하여 전달함으로써,
   *    필터링 작동 중에 데이터를 수정하고, 개별 복구(Undo)를 가동하고, 변경 카운팅을 유지하는 동작들이 인덱스 꼬임 현상 없이 100% 무결하게 작동합니다.
   */
  const filteredRows = React.useMemo(() => {
    const lowerKeyword = filterKeyword.toLowerCase().trim();
    return gridData.map((row, index) => ({ row, index })).filter(({ row }) => {
      if (!lowerKeyword) return true;
      return (parsedData.columns || []).some((col) => {
        const val = row[col.name] ?? "";
        return val.toLowerCase().includes(lowerKeyword);
      });
    });
  }, [gridData, filterKeyword, parsedData.columns]);

  // // [Day 32 작업] dw_1.Retrieve(as_dept) 대응 조회 이벤트 핸들러
  const handleRetrieve = () => {
    setIsLoading(true);
    
    setTimeout(() => {
      const filteredMock = MOCK_MASTER_DATA.filter((item) => {
        const matchDept = selectedDept === "전체" || item.region === selectedDept;
        const matchKeyword = !searchKeyword.trim() || 
          item.rep.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
          item.id.toLowerCase().includes(searchKeyword.toLowerCase().trim());
        return matchDept && matchKeyword;
      });

      // [Day 33 작업] 새로운 데이터를 조회할 때 각 행에 __originalIndex 고유 키를 순차 부여
      const updatedRows = filteredMock.map((mockItem, idx) => {
        const row = generateRowData(mockItem, parsedData.columns || []);
        row.__originalIndex = String(idx);
        return row;
      });
      
      // 조회 결과 반환 시 정렬 상태도 초기 상태('none')로 리셋하여 정렬 정합성 보장
      setSortConfig({ key: "", direction: "none" });
      // 필터 키워드 또한 조회 시 함께 리셋하여 데이터가 가려지지 않도록 보장
      setFilterKeyword("");

      setGridData(updatedRows);
      setIsLoading(false);
      onSelectRow(0); // 첫 번째 행 자동 선택

      // 조회 완료된 데이터셋 상태를 기준으로 변동 감지 버퍼 기준점 재초기화
      snapshotRef.current = JSON.parse(JSON.stringify(updatedRows));
      initialGridDataRef.current = JSON.parse(JSON.stringify(updatedRows));
    }, 300);
  };

  // [Day 30 작업] 클립보드 복사 함수 및 파일 다운로드 가동 스크립트 블록
  const handleCopyToClipboard = async () => {
    if (!dumpOutput) return;
    try {
      await navigator.clipboard.writeText(dumpOutput);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error("클립보드 복사 실패:", err);
    }
  };

  const handleDownloadJSON = () => {
    if (!dumpOutput) return;
    try {
      const blob = new Blob([dumpOutput], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pb_bridge_data_dump.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("JSON 다운로드 실패:", err);
    }
  };

  // [Day 33 작업] dw_1.SetSort() 및 dw_1.Sort() 대치용 동적 정렬 이벤트 핸들러 및 처리기
  const handleSort = (colName: string) => {
    // 1. 순환 정렬 방향 설정: none -> asc -> desc -> none
    let nextDirection: "asc" | "desc" | "none" = "asc";
    if (sortConfig.key === colName) {
      if (sortConfig.direction === "asc") nextDirection = "desc";
      else if (sortConfig.direction === "desc") nextDirection = "none";
      else nextDirection = "asc";
    }

    setSortConfig({ key: colName, direction: nextDirection });

    // 2. 정렬 비교 함수(Comparator) 정의
    const compareFn = (a: { [key: string]: string }, b: { [key: string]: string }) => {
      // 정렬이 해제된 경우 원래 순서(__originalIndex) 기준으로 복구
      if (nextDirection === "none") {
        const idxA = parseInt(a.__originalIndex || "0", 10);
        const idxB = parseInt(b.__originalIndex || "0", 10);
        return idxA - idxB;
      }

      const valA = a[colName] ?? "";
      const valB = b[colName] ?? "";

      // 숫자형 컬럼인지 판별하여 값 기반 정렬 수행
      const isNum = isNumericColumn(parsedData.columns?.find((c) => c.name === colName)?.type || "");
      if (isNum) {
        const numA = parseFloat(valA.replace(/,/g, "")) || 0;
        const numB = parseFloat(valB.replace(/,/g, "")) || 0;
        return nextDirection === "asc" ? numA - numB : numB - numA;
      }

      // 문자열 컬럼의 경우 한국어 가나다 및 대소문자 구분 로캘(Locale) 정렬 대응
      return nextDirection === "asc"
        ? valA.localeCompare(valB, "ko", { numeric: true })
        : valB.localeCompare(valA, "ko", { numeric: true });
    };

    // 3. 삼중 버퍼 동시 정렬을 수행하여 인덱스 참조 정합성 보장
    const sortedGridData = [...gridData].sort(compareFn);
    const sortedInitial = [...initialGridDataRef.current].sort(compareFn);
    const sortedSnapshot = [...snapshotRef.current].sort(compareFn);

    setGridData(sortedGridData);
    initialGridDataRef.current = sortedInitial;
    snapshotRef.current = sortedSnapshot;

    // 첫 행 자동 선택으로 부드러운 전환 효과 제공
    onSelectRow(0);
  };

  // [Day 33 작업] 부모 컴포넌트로부터 유입되는 최초 gridData에 순서 복원용 고유 인덱스(__originalIndex) 주입
  React.useEffect(() => {
    if (gridData.length > 0 && !gridData[0].hasOwnProperty("__originalIndex")) {
      setGridData((prev) =>
        prev.map((row, idx) => (row.__originalIndex ? row : { ...row, __originalIndex: String(idx) }))
      );
    }
  }, [gridData, setGridData]);

  React.useEffect(() => {
    // __originalIndex가 정상 주입된 상태에서만 snapshot 및 initial 상태 백업을 수행합니다.
    if (gridData.length > 0 && gridData.every((row) => row.hasOwnProperty("__originalIndex"))) {
      if (snapshotRef.current.length === 0) {
        snapshotRef.current = JSON.parse(JSON.stringify(gridData));
      }
      if (
        prevParsedDataRef.current !== parsedData ||
        initialGridDataRef.current.length !== gridData.length ||
        initialGridDataRef.current.length === 0
      ) {
        initialGridDataRef.current = JSON.parse(JSON.stringify(gridData));
        prevParsedDataRef.current = parsedData;
      }
    }
  }, [gridData, parsedData]);

  // [Day 25 작업] 전체 초기화(Reset) 핸들러
  const handleResetAll = () => {
    if (snapshotRef.current.length > 0) {
      const resetSnapshot = JSON.parse(JSON.stringify(snapshotRef.current));
      setGridData(resetSnapshot);
      setFilterKeyword(""); // 리셋 시 필터 또한 리셋
      // 비교용 reference 데이터 또한 초기 원본 상태로 동기화하여 변경 감지 카운터를 리셋합니다.
      initialGridDataRef.current = JSON.parse(JSON.stringify(snapshotRef.current));
    }
  };

  // [Day 25 작업] 개별 행 원복(Undo) 핸들러
  const handleUndoRow = (rIdx: number) => {
    const originalRow = snapshotRef.current[rIdx];
    if (!originalRow) return;
    setGridData((prev) => {
      const next = [...prev];
      next[rIdx] = JSON.parse(JSON.stringify(originalRow));
      return next;
    });
    // 비교용 reference의 해당 행 데이터 또한 원본 상태로 복구해 줍니다.
    if (initialGridDataRef.current[rIdx]) {
      initialGridDataRef.current[rIdx] = JSON.parse(JSON.stringify(originalRow));
    }
  };

  // [Day 29 작업] 데이터 추출 핸들러 및 파워빌더 dw_1.Update() 메커니즘 연동
  const handleSaveAndExtract = () => {
    // [Day 35 작업] 저장 및 추출 시점에 최종적으로 에러 상태를 점검하여 추출을 제한합니다.
    const errorKeys = Object.keys(validationErrors);
    if (errorKeys.length > 0) {
      const errorMsg = errorKeys
        .map((k) => validationErrors[Number(k)])
        .join("\n");
      setDumpOutput(errorMsg);
      return;
    }

    const modifiedRows = gridData
      .map((row, rIdx) => {
        const originalRow = initialGridDataRef.current[rIdx];
        if (!originalRow) return null;
        
        const isModified = (parsedData.columns || []).some((col) => {
          const currentVal = row[col.name] ?? "";
          const originalVal = originalRow[col.name] ?? "";
          return currentVal !== originalVal;
        });

        if (isModified) {
          // [Day 33 작업] 임시 정렬 관리 속성인 __originalIndex를 JSON 덤프 데이터에서 제외
          const { __originalIndex, ...cleanRow } = row;
          return {
            row_no: rIdx + 1,
            data: cleanRow,
          };
        }
        return null;
      })
      .filter((item): item is { row_no: number; data: { [key: string]: string } } => item !== null);

    if (modifiedRows.length === 0) {
      setDumpOutput(
        JSON.stringify(
          {
            message: "변경사항이 존재하지 않습니다.",
            status: "NO_CHANGES",
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } else {
      setDumpOutput(JSON.stringify(modifiedRows, null, 2));
    }
  };

  // [Day 24 작업] 단 하나의 컬럼이라도 값의 변동이 생겼는지 감지하는 판별 로직 (isRowModified)
  const isRowModified = (currentRow: { [key: string]: string }, rIdx: number): boolean => {
    const originalRow = initialGridDataRef.current[rIdx];
    if (!originalRow) return false;

    return (parsedData.columns || []).some((col) => {
      const currentVal = currentRow[col.name] ?? "";
      const originalVal = originalRow[col.name] ?? "";
      return currentVal !== originalVal;
    });
  };

  // [Day 24 작업] 실시간 변경된 행의 총 개수 계산
  const modifiedRowsCount = gridData.reduce((count, row, rIdx) => {
    return count + (isRowModified(row, rIdx) ? 1 : 0);
  }, 0);

  return (
    <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4">
      {/* 타이틀 구역 및 수정 카운터 뱃지 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-white">
            💻 웹 변환 화면 프리뷰 (Grid Preview)
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
              modifiedRowsCount > 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)] animate-pulse"
                : "bg-slate-900/60 text-slate-500 border-slate-800"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${modifiedRowsCount > 0 ? "bg-emerald-400" : "bg-slate-600"}`}></span>
            수정 중인 행: {modifiedRowsCount}건
          </span>
          {/* 전체 수정 데이터 일괄 초기화 버튼 */}
          <button
            onClick={handleResetAll}
            disabled={modifiedRowsCount === 0}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
              modifiedRowsCount > 0
                ? "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                : "bg-slate-950 border-slate-900 text-slate-700 cursor-not-allowed"
            }`}
            title="모든 변경 사항을 최초 데모 데이터 상태로 초기화합니다."
          >
            전체 초기화 ↺
          </button>
          {/* 저장 및 데이터 추출 버튼 */}
          <button
            onClick={handleSaveAndExtract}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border border-emerald-500/30 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 transition-all cursor-pointer"
            title="변경된 데이터셋을 JSON 패킷으로 추출합니다."
          >
            저장 및 데이터 추출 💾
          </button>
        </div>
      </div>

      {/* [Day 32 작업] 파워빌더 Retrieval Argument 아규먼트 입력을 상징하는 다크 네온 스타일 조회 조건 바 */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0d1527]/90 border border-indigo-950/60 rounded-xl shadow-lg relative overflow-hidden">
        {/* 네온 백그라운드 빛 효과 */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center gap-4 flex-wrap z-10">
          {/* 부서선택 드롭다운 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">as_dept</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
            >
              <option value="전체">전체 부서</option>
              <option value="개발팀">개발팀 (R&D)</option>
              <option value="영업팀">영업팀 (Sales)</option>
              <option value="인사팀">인사팀 (HR)</option>
            </select>
          </div>

          {/* 검색어 입력창 */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">as_keyword</span>
            <input
              type="text"
              placeholder="사원명 또는 사번 입력..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRetrieve();
                }
              }}
              className="bg-slate-950 border border-slate-800 hover:border-indigo-500/50 focus:border-indigo-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-48 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>
        </div>

        {/* 다크 네온 스타일 조회 버튼 */}
        <button
          onClick={handleRetrieve}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4.5 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right hover:scale-[1.02] text-xs text-white font-extrabold rounded shadow-[0_0_12px_rgba(99,102,241,0.35)] hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] border border-indigo-500/20 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <span>조회</span>
          <span>🔍</span>
        </button>
      </div>

      {/* [Day 34 작업] 결과 내 필터링 인풋 입력 UI 컴포넌트 추가 (다크 네온 디자인) */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#0a0f1d]/90 border border-cyan-950/60 rounded-xl shadow-lg relative overflow-hidden">
        {/* 네온 백그라운드 빛 효과 */}
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-2 z-10">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">dw_1.Filter()</span>
          <span className="text-xs text-slate-300 font-bold">결과 내 실시간 필터링 🔍</span>
        </div>
        <div className="relative flex items-center z-10 w-full sm:w-72">
          <input
            type="text"
            placeholder="필터 키워드 입력 (전체 컬럼 검색)..."
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            className="bg-slate-950 border border-slate-800 hover:border-cyan-500/50 focus:border-cyan-500 text-xs text-slate-300 placeholder-slate-600 rounded px-3 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all pl-8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]"
          />
          <span className="absolute left-2.5 text-xs text-cyan-500 pointer-events-none">🔍</span>
          {filterKeyword && (
            <button
              onClick={() => setFilterKeyword("")}
              className="absolute right-2 text-xs text-slate-500 hover:text-slate-300 focus:outline-none cursor-pointer"
              title="필터 키워드 초기화"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 고속 입력용 가변 뷰포트 및 스크롤 최적화 구역 */}
      <div className="relative overflow-x-auto overflow-y-auto border border-slate-900 rounded-xl min-h-[260px] max-h-[400px] scrollbar-thin">
        {/* [Day 32 작업] 데이터 조회 중 로딩 레이어 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-30 transition-all">
            {/* 회전하는 다크 네온 링 */}
            <div className="w-9 h-9 rounded-full border-[3px] border-indigo-500/10 border-t-indigo-500 animate-spin shadow-[0_0_15px_rgba(99,102,241,0.4)]"></div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-bold text-indigo-400 tracking-wide animate-pulse">데이터 조회 중...</span>
              <span className="text-[9px] font-mono text-slate-500">Retrieving...</span>
            </div>
          </div>
        )}

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-900 z-10">
            <tr
              style={{
                height: parsedData?.bands?.header
                  ? `${parsedData.bands.header / 2}px`
                  : "44px",
              }}
            >
              <th className="p-3 text-center w-12 bg-slate-900">No.</th>
              {(parsedData.columns || []).map((c, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(c.name)}
                  className={`p-3 font-mono text-slate-300 bg-slate-900 cursor-pointer select-none hover:bg-slate-800 hover:text-white transition-all border-r border-slate-900/40 relative group ${getAlignClass(
                    c.alignment
                  )}`}
                  title="클릭하여 순환 정렬 (기본값 ➔ 오름차순 ➔ 내림차순)"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{c.label || c.name}</span>
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded transition-all duration-300 ${
                        sortConfig.key === c.name && sortConfig.direction !== "none"
                          ? sortConfig.direction === "asc"
                            ? "text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                            : "text-purple-400 bg-purple-950/40 border border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                          : "text-slate-600 border border-transparent group-hover:text-slate-400"
                      }`}
                    >
                      {sortConfig.key === c.name
                        ? sortConfig.direction === "asc"
                          ? "▲"
                          : sortConfig.direction === "desc"
                          ? "▼"
                          : "-"
                        : "-"}
                    </span>
                  </div>
                </th>
              ))}
              {(parsedData.computedFields || []).map((comp, i) => (
                <th key={i} className="p-3 text-amber-400 bg-indigo-950/20">
                  🧮 {comp.label || comp.name}
                </th>
              ))}
              {/* 제어 열 헤더 추가 */}
              <th className="p-3 text-center w-20 text-slate-400 font-bold border-l border-slate-900/40 bg-slate-900">
                제어
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {/* [Day 34 작업] 실시간 필터링 결과 및 원본 부재 시의 조건부 렌더링 대응 */}
            {gridData.length === 0 ? (
              <tr>
                <td colSpan={(parsedData.columns?.length || 0) + (parsedData.computedFields?.length || 0) + 2} className="p-8 text-center text-slate-500 italic">
                  조회 결과 데이터가 존재하지 않습니다. 상단 조건바에서 조회해 주십시오.
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={(parsedData.columns?.length || 0) + (parsedData.computedFields?.length || 0) + 2} className="p-8 text-center text-cyan-400 bg-slate-950/80 border border-cyan-900/30 font-medium italic">
                  🔍 필터링 조건에 부합하는 데이터가 존재하지 않습니다. (검색어: &quot;{filterKeyword}&quot;)
                </td>
              </tr>
            ) : (
              filteredRows.map(({ row, index: rIdx }, fIdx) => {
                const hasError = validationErrors.hasOwnProperty(rIdx);
                const isModified = isRowModified(row, rIdx);
                const isSelected = selectedRowIndex === rIdx;
                
                let rowBgClass = "";
                if (hasError) {
                  rowBgClass = "bg-red-950/25 hover:bg-red-950/35 border-y border-red-500/30 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.15)]";
                } else if (isSelected) {
                  rowBgClass = "bg-indigo-600/10 border-y border-indigo-500/30 font-bold";
                } else if (isModified) {
                  rowBgClass = "bg-emerald-950/10 hover:bg-emerald-950/20";
                } else {
                  rowBgClass = "hover:bg-slate-800/40";
                }

                return (
                  <tr
                    key={rIdx}
                    style={{
                      height: parsedData?.bands?.detail
                        ? `${parsedData.bands.detail / 2}px`
                        : "40px",
                    }}
                    onClick={() => onSelectRow(rIdx)}
                    className={`transition-all font-mono cursor-pointer ${rowBgClass}`}
                  >
                    <td className={`p-3 text-center transition-all ${
                      hasError
                        ? "border-l-4 border-l-red-500 bg-red-950/30 text-red-400 font-bold"
                        : isModified 
                        ? "border-l-4 border-l-emerald-500 bg-emerald-950/20 text-emerald-400 font-bold" 
                        : "text-slate-600"
                    }`}>
                      {fIdx + 1}
                    </td>
                    {(parsedData.columns || []).map((col, cIdx) => {
                      let isCellReadOnly = col.tabsequence === "0" || col.protect === "1";
                      
                      if (col.protect && col.protect.toLowerCase().includes("if")) {
                        const evaluated = evaluateDWExpression(
                          col.protect,
                          { ...row, ...argValues },
                          parsedData.columns
                        );
                        const isProtected = evaluated === 1 || evaluated === "1" || String(evaluated).toLowerCase() === "true";
                        isCellReadOnly = col.tabsequence === "0" || isProtected;
                      }

                      const cellAlignClass = getAlignClass(col.alignment);
                      const colType = (col.type || "").toLowerCase();

                      const renderGridCellInput = () => {
                        const baseClass =
                          "w-full bg-transparent px-2 py-1 text-xs border-0 focus:outline-none rounded transition-all";
                        const stateClass = isCellReadOnly
                          ? "bg-slate-950/60 text-slate-500 cursor-not-allowed italic"
                          : "text-white focus:ring-1 focus:ring-indigo-500";
                        const tabIndexValue = isCellReadOnly ? -1 : 0;

                        const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
                          if (isCellReadOnly) return;
                          e.currentTarget.select();
                        };

                        // [Day 34 작업] 필터링 조건에서도 정합성을 잃지 않는 4방향 키보드 이동 및 엔터 핸들러
                        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                          const columnsCount = parsedData.columns ? parsedData.columns.length : 0;
                          const currentFilteredIdx = filteredRows.findIndex(item => item.index === rIdx);

                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            if (currentFilteredIdx === -1) return;
                            let nextFilteredIdx = currentFilteredIdx + 1;
                            while (nextFilteredIdx < filteredRows.length) {
                              const nextRow = filteredRows[nextFilteredIdx].index;
                              const target = document.querySelector(
                                `input[data-row="${nextRow}"][data-col="${col.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                onSelectRow(nextRow);
                                break;
                              }
                              nextFilteredIdx++;
                            }
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            if (currentFilteredIdx === -1) return;
                            let prevFilteredIdx = currentFilteredIdx - 1;
                            while (prevFilteredIdx >= 0) {
                              const prevRow = filteredRows[prevFilteredIdx].index;
                              const target = document.querySelector(
                                `input[data-row="${prevRow}"][data-col="${col.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                onSelectRow(prevRow);
                                break;
                              }
                              prevFilteredIdx--;
                            }
                          } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            let nextColIdx = cIdx + 1;
                            while (nextColIdx < columnsCount) {
                              const nextCol = parsedData.columns[nextColIdx];
                              const target = document.querySelector(
                                `input[data-row="${rIdx}"][data-col="${nextCol.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                break;
                              }
                              nextColIdx++;
                            }
                          } else if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            let prevColIdx = cIdx - 1;
                            while (prevColIdx >= 0) {
                              const prevCol = parsedData.columns[prevColIdx];
                              const target = document.querySelector(
                                `input[data-row="${rIdx}"][data-col="${prevCol.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                break;
                              }
                              prevColIdx--;
                            }
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            if (currentFilteredIdx === -1) return;
                            let targetFound = false;

                            let nextFilteredIdx = currentFilteredIdx + 1;
                            while (nextFilteredIdx < filteredRows.length) {
                              const nextRow = filteredRows[nextFilteredIdx].index;
                              const target = document.querySelector(
                                `input[data-row="${nextRow}"][data-col="${col.name}"]`
                              ) as HTMLInputElement | null;
                              if (target && !target.readOnly && target.tabIndex !== -1) {
                                target.focus();
                                onSelectRow(nextRow);
                                targetFound = true;
                                break;
                              }
                              nextFilteredIdx++;
                            }

                            if (!targetFound) {
                              let startFilteredIdx = currentFilteredIdx;
                              let startCol = cIdx + 1;
                              for (let f = startFilteredIdx; f < filteredRows.length; f++) {
                                const targetRow = filteredRows[f].index;
                                const startC = (f === startFilteredIdx) ? startCol : 0;
                                for (let c = startC; c < columnsCount; c++) {
                                  const targetCol = parsedData.columns[c];
                                  const target = document.querySelector(
                                    `input[data-row="${targetRow}"][data-col="${targetCol.name}"]`
                                  ) as HTMLInputElement | null;
                                  if (target && !target.readOnly && target.tabIndex !== -1) {
                                    target.focus();
                                    onSelectRow(targetRow);
                                    targetFound = true;
                                    break;
                                  }
                                }
                                if (targetFound) break;
                              }
                            }
                          }
                        };

                        if (
                          colType.includes("date") ||
                          colType.includes("time") ||
                          colType.includes("timestamp")
                        ) {
                          return (
                            <input
                              type="date"
                              value={row[col.name] ?? ""}
                              readOnly={isCellReadOnly}
                              tabIndex={tabIndexValue}
                              data-row={rIdx}
                              data-col={col.name}
                              onChange={(e) => {
                                if (isCellReadOnly) return;
                                setGridData((prev) => {
                                  const next = [...prev];
                                  if (next[rIdx]) next[rIdx][col.name] = e.target.value;
                                  return next;
                                });
                              }}
                              onClick={(e) => {
                                if (!isCellReadOnly) {
                                  try {
                                    e.currentTarget.showPicker();
                                  } catch (err) {}
                                }
                              }}
                              onFocus={(e) => {
                                handleFocus(e);
                                if (!isCellReadOnly) {
                                  try {
                                    e.currentTarget.showPicker();
                                  } catch (err) {}
                                }
                              }}
                              onKeyDown={handleKeyDown}
                              className={`${baseClass} ${cellAlignClass} ${stateClass}`}
                            />
                          );
                        }

                        if (isNumericColumn(col.type)) {
                          return (
                            <input
                              type="text"
                              value={formatNumberWithCommas(row[col.name] ?? "")}
                              readOnly={isCellReadOnly}
                              tabIndex={tabIndexValue}
                              data-row={rIdx}
                              data-col={col.name}
                              onChange={(e) => {
                                if (isCellReadOnly) return;
                                const val = formatNumberWithCommas(e.target.value);
                                setGridData((prev) => {
                                  const next = [...prev];
                                  if (next[rIdx]) next[rIdx][col.name] = val;
                                  return next;
                                });
                              }}
                              onFocus={handleFocus}
                              onKeyDown={handleKeyDown}
                              className={`${baseClass} text-right ${stateClass}`}
                            />
                          );
                        }

                        return (
                          <input
                            type="text"
                            value={row[col.name] ?? ""}
                            readOnly={isCellReadOnly}
                            tabIndex={tabIndexValue}
                            data-row={rIdx}
                            data-col={col.name}
                            onChange={(e) => {
                              if (isCellReadOnly) return;
                              setGridData((prev) => {
                                const next = [...prev];
                                  if (next[rIdx]) next[rIdx][col.name] = e.target.value;
                                return next;
                              });
                            }}
                            onFocus={handleFocus}
                            onKeyDown={handleKeyDown}
                            className={`${baseClass} ${cellAlignClass} ${stateClass}`}
                          />
                        );
                      };

                      return (
                        <td key={cIdx} className="p-1 border-r border-slate-900/40">
                          {renderGridCellInput()}
                        </td>
                      );
                    })}
                    {(parsedData.computedFields || []).map((comp, cpIdx) => {
                      const mergedColumns = [
                        ...parsedData.columns,
                        ...(parsedData.arguments || []).map((arg) => ({
                          name: arg.name,
                          type: arg.type,
                          dbname: arg.name,
                        })),
                      ];
                      const res = evaluateDWExpression(
                        comp.expression,
                        { ...row, ...argValues },
                        mergedColumns
                      );
                      return (
                        <td
                          key={cpIdx}
                          className={`p-3 text-amber-400 font-bold bg-indigo-950/10 ${getAlignClass(
                            comp.alignment
                          )}`}
                          title={comp.expression}
                        >
                          {typeof res === "number" ? res.toLocaleString() : res}
                        </td>
                      );
                    })}
                    {/* 행 단위 개별 Undo 버튼 분기 구역 */}
                    <td className="p-1 border-l border-slate-900/40 text-center w-20">
                      {isModified && (
                        <button
                          onClick={() => handleUndoRow(rIdx)}
                          className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold transition-all opacity-70 animate-pulse cursor-pointer"
                          title="이 행의 수정을 취소하고 원래 상태로 되돌립니다."
                        >
                          원복
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* TRANSACTION DATA DUMP 로그 터미널 레이어 */}
      {dumpOutput && (
        <div className={`mt-4 bg-black border rounded-xl p-4 font-mono text-xs flex flex-col gap-2 relative shadow-2xl transition-all ${
          dumpOutput.includes("[VALIDATION ERROR]")
            ? "border-red-900/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
            : "border-emerald-900/50 text-emerald-400"
        }`}>
          {/* 복사 완료 알림 레이아웃 */}
          {copied && (
            <div className="absolute top-12 right-4 bg-emerald-950 text-emerald-300 border border-emerald-400/50 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-bounce z-10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>복사 완료! 📋</span>
            </div>
          )}
          <div className={`flex items-center justify-between border-b pb-2 ${
            dumpOutput.includes("[VALIDATION ERROR]") ? "border-red-900/30" : "border-emerald-900/30"
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                dumpOutput.includes("[VALIDATION ERROR]") ? "bg-red-500" : "bg-emerald-500"
              }`}></span>
              <span className={`font-bold ${
                dumpOutput.includes("[VALIDATION ERROR]") ? "text-red-300" : "text-emerald-300"
              }`}>
                {dumpOutput.includes("[VALIDATION ERROR]")
                  ? "[VALIDATION ERROR LOG] - 실시간 데이터 유효성 검증 오류"
                  : "[TRANSACTION DATA DUMP] - dw_1.Update() Buffer JSON Output"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!dumpOutput.includes("[VALIDATION ERROR]") && (
                <>
                  <button
                    onClick={handleCopyToClipboard}
                    className="text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/50 px-2.5 py-1 rounded border border-emerald-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 hover:shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                    title="추출된 JSON 문자열을 클립보드에 원클릭 복사합니다."
                  >
                    클립보드 복사 📋
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/50 px-2.5 py-1 rounded border border-cyan-500/30 text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 hover:shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                    title="추출된 JSON 파일을 로컬 디스크로 즉시 다운로드합니다."
                  >
                    JSON 다운로드 💾
                  </button>
                </>
              )}
              <button
                onClick={() => setDumpOutput(null)}
                className={`px-2.5 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                  dumpOutput.includes("[VALIDATION ERROR]")
                    ? "text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-900/50 border-red-500/20"
                    : "text-emerald-500 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/20"
                }`}
              >
                닫기 ✕
              </button>
            </div>
          </div>
          <pre className="overflow-auto max-h-48 scrollbar-thin whitespace-pre-wrap select-all">
            {dumpOutput}
          </pre>
        </div>
      )}
    </section>
  );
}
