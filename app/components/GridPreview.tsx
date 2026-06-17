// [Day 21 작업] 데이터윈도우 웹 변환 그리드 프리뷰 컴포넌트
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
  // 파워빌더의 GetRow() 버퍼 포인터와 유사하게, 현재 뷰어에서 선택된 행을 관리하기 위해 Props를 통해 상위 상태 및 변경 제어 함수를 주입받습니다.
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

export default function GridPreview({
  parsedData,
  gridData,
  setGridData,
  argValues,
  selectedRowIndex,
  onSelectRow,
}: GridPreviewProps) {
  // [Day 24 작업] 초기 gridData 백업 및 비교를 위한 레퍼런스
  // [설명] 파워빌더의 dw_1.GetItemStatus() 메커니즘을 현대적 웹 React 상태 비교로 구현한 판별식
  // 파워빌더(PowerBuilder) 환경에서는 dw_1.GetItemStatus(row, column, Primary!) API를 호출하여
  // 특정 행이나 셀의 데이터 상태가 DataModified!, NewModified!, NotModified! 인지 판별하고,
  // 최종적으로 Update() 함수 호출 시 DB 트랜잭션 무결성을 제어했습니다.
  // 현대 웹 프런트엔드 React 환경에서는 별도의 상태 관리 객체(State)나 ref를 활용해 
  // 최초로 로드된 원본 데이터(Initial Data)의 스냅샷을 보관하고, 
  // 사용자가 입력한 현재 상태(gridData)와 행 단위로 실시간 비교(State Comparison)하여 변경 여부를 감지합니다.
  // 이를 통해 복잡한 API 호출 없이 리액티브한 화면 렌더링과 조건부 스타일링을 동시 실현하여 
  // 사용자에게 실시간으로 어떤 데이터가 변경되었는지 직관적인 피드백을 제공합니다.
  // [Day 25 작업] 최초 컴포넌트 마운트 시점의 3개 행 데모 데이터 스냅샷 백업용 Ref
  const snapshotRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const initialGridDataRef = React.useRef<Array<{ [key: string]: string }>>([]);
  const prevParsedDataRef = React.useRef<any>(null);

  /*
   * [Day 25 작업] 파워빌더와 현대 웹 상태 관리 비교 (교육용 주석)
   *
   * 1. 파워빌더 데이터윈도우의 롤백 및 초기화 메커니즘:
   *    과거 클라이언트/서버(C/S) 아키텍처에서 파워빌더의 DataWindow는 데이터베이스에서 조회한 
   *    최초의 데이터 상태를 내부 버퍼(Primary Buffer, Filter Buffer, Delete Buffer)에 보관하며 관리했습니다.
   *    사용자가 데이터를 수정하면 각 행의 상태 값(ItemStatus)이 DataModified!나 NewModified! 등으로 변하고,
   *    개발자는 dw_1.Retrieve()로 재조회하여 전체 데이터를 초기화하거나, dw_1.DiscardInitialRows() 또는
   *    트랜잭션 롤백(ROLLBACK) 처리를 통해 변경 중이던 임시 데이터를 버리고 안전하게 원본 상태로 돌려놓았습니다.
   *
   * 2. 현대 웹 프런트엔드의 불변성 상태 관리(Immutable State Mutation) 및 스냅샷 복원:
   *    React와 같은 현대 웹 프런트엔드 프레임워크에서는 직접 버퍼를 조작하지 않고, 
   *    데이터를 불변(Immutable) 상태로 관리합니다. 데이터 변경 시 기존 객체를 직접 수정하지 않고 
   *    완전히 새로운 객체 스냅샷을 생성하여 교체하는 방식을 사용합니다.
   *    본 컴포넌트에서는 최초 렌더링 시점의 원본 데이터를 `snapshotRef`라는 복제 레퍼런스에 안전하게 저장(Snapshot Capture)해 둡니다.
   *    - 전체 초기화(Reset) 시: 이 최초 스냅샷 데이터를 딥 카피(Deep Copy)하여 `setGridData` 상태로 통째로 교체합니다.
   *    - 개별 행 원복(Undo) 시: 변경된 특정 행(Index)의 데이터만 최초 스냅샷 버퍼에서 꺼내어 불변성을 지키며 
   *      해당 행만 새로운 객체로 대체하여 상태를 업데이트합니다.
   *    
   * 이러한 현대적인 스냅샷 복원 기술은 파워빌더의 메모리 내 버퍼 데이터 롤백 처리와 구조적, 개념적으로 완전히 동일한 철학을 따릅니다.
   */
  React.useEffect(() => {
    // 컴포넌트가 처음 로드될 때 gridData의 최초 상태를 딥 카피하여 저장합니다.
    if (snapshotRef.current.length === 0 && gridData.length > 0) {
      snapshotRef.current = JSON.parse(JSON.stringify(gridData));
    }
  }, [gridData]);

  React.useEffect(() => {
    // parsedData가 변경되었거나, 상위에서 gridData의 로드/리셋으로 길이가 달라진 경우 초기 캡처를 수행합니다.
    if (
      prevParsedDataRef.current !== parsedData ||
      initialGridDataRef.current.length !== gridData.length ||
      initialGridDataRef.current.length === 0
    ) {
      initialGridDataRef.current = JSON.parse(JSON.stringify(gridData));
      prevParsedDataRef.current = parsedData;
    }
  }, [parsedData, gridData]);

  // [Day 25 작업] 전체 초기화(Reset) 핸들러
  const handleResetAll = () => {
    if (snapshotRef.current.length > 0) {
      const resetSnapshot = JSON.parse(JSON.stringify(snapshotRef.current));
      setGridData(resetSnapshot);
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
      {/* [Day 24 작업] 타이틀 구역 및 수정 카운터 뱃지 */}
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
          {/* // [Day 25 작업] 전체 수정 데이터 일괄 초기화 버튼 */}
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
        </div>
      </div>
      <div className="overflow-x-auto border border-slate-900 rounded-xl max-h-48 scrollbar-thin">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0 border-b border-slate-900">
            <tr
              style={{
                height: parsedData?.bands?.header
                  ? `${parsedData.bands.header / 2}px`
                  : "44px",
              }}
            >
              <th className="p-3 text-center w-12">No.</th>
              {(parsedData.columns || []).map((c, i) => (
                <th
                  key={i}
                  className={`p-3 font-mono text-slate-300 ${getAlignClass(
                    c.alignment
                  )}`}
                >
                  {c.label || c.name}
                </th>
              ))}
              {(parsedData.computedFields || []).map((comp, i) => (
                <th key={i} className="p-3 text-amber-400 bg-indigo-950/20">
                  🧮 {comp.label || comp.name}
                </th>
              ))}
              {/* // [Day 25 작업] 제어 열 헤더 추가 */}
              <th className="p-3 text-center w-20 text-slate-400 font-bold border-l border-slate-900/40">
                제어
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {gridData.map((row, rIdx) => {
              // [Day 24 작업] 행의 수정 여부를 실시간으로 감지하여 스타일을 분기합니다.
              const isModified = isRowModified(row, rIdx);

              // [Day 27 작업] 행 선택 상태 및 조건부 스타일링 바인딩 구역
              // 현재 선택된 행(selectedRowIndex === rIdx)일 경우, 시각적인 구분을 위해 영롱한 인디고 다크 배경색(bg-indigo-600/10 border-y border-indigo-500/30)을 입힙니다.
              // 만약 선택되지 않았고 수정된 상태라면 기존의 에메랄드 배경을, 수정되지 않은 기본 상태라면 슬레이트 호버 배경을 보여줍니다.
              const isSelected = selectedRowIndex === rIdx;
              const rowBgClass = isSelected
                ? "bg-indigo-600/10 border-y border-indigo-500/30 font-bold"
                : isModified
                ? "bg-emerald-950/10 hover:bg-emerald-950/20"
                : "hover:bg-slate-800/40";

              return (
                <tr
                  key={rIdx}
                  style={{
                    height: parsedData?.bands?.detail
                      ? `${parsedData.bands.detail / 2}px`
                      : "40px",
                  }}
                  // [Day 27 작업] <tr> 클릭 이벤트 바인딩 구역
                  // 사용자가 특정 행을 클릭하면 상위 page.tsx의 selectedRowIndex 상태가 변경되며, 이에 연동되어 FormPreview에 실시간으로 데이터가 연동됩니다.
                  // 이는 파워빌더 데이터윈도우의 RowFocusChanged 이벤트가 트리거되면서 GetRow() 함수를 통해 포커스된 버퍼 레코드를 참조하는 작동 방식을 리액트식 선언형 상태와 단방향 바인딩으로 조화롭게 재구현한 형태입니다.
                  onClick={() => onSelectRow(rIdx)}
                  className={`transition-all font-mono cursor-pointer ${rowBgClass}`}
                >
                  {/* [Day 24 작업] 수정된 행일 경우 No. 셀에 에메랄드 테두리 및 텍스트 하이라이트 동적 부여 */}
                  <td className={`p-3 text-center transition-all ${
                    isModified 
                      ? "border-l-4 border-l-emerald-500 bg-emerald-950/20 text-emerald-400 font-bold" 
                      : "text-slate-600"
                  }`}>
                    {rIdx + 1}
                  </td>
                  {(parsedData.columns || []).map((col, cIdx) => {
                    // [Day 26 작업] Protect 속성 내 If 조건부 표현식 실시간 셀 잠금 연동
                    // 
                    // 파워빌더와 현대 웹 React의 런타임 수식 평가 메커니즘 비교 (교육용 설명):
                    // 1. 파워빌더 데이터윈도우(DataWindow)의 런타임 Row 단위 평가:
                    //    과거 4GL 개발 환경인 파워빌더에서는 Protect 속성에 `protect="if(status = 'closed', 1, 0)"` 과 같은
                    //    동적 표현식(Expression)을 정의할 수 있습니다. 런타임 엔진(DataWindow Engine)은 화면을 그리거나
                    //    특정 행의 상태가 변경될 때마다 각 셀 단위로 이 표현식을 재평가(Re-evaluation)하여 
                    //    해당 셀의 편집 권한(Protect)을 즉시 잠그거나 푸는 고도의 화면 제어를 내부적으로 수행했습니다.
                    // 
                    // 2. 현대 웹 표준 React의 동적 조건부 렌더링(Dynamic Conditional Rendering):
                    //    React는 '상태(State)가 변경되면 컴포넌트가 자동으로 다시 그려진다(Re-rendering)'는 선언적 패러다임을 따릅니다.
                    //    따라서, 사용자가 데이터를 수정하여 행(`row`)의 값이 변할 때마다 컴포넌트 내부에서 `evaluateDWExpression`
                    //    함수를 통해 `col.protect` 수식을 실시간으로 다시 평가(Evaluation)합니다.
                    //    이를 통해 반환값에 따라 `isCellReadOnly` 상태를 결정하고, React의 가상 DOM은 이를 인지하여 
                    //    브라우저 표준인 `readOnly={true}`, `tabIndex={-1}` 및 비활성화 스타일 클래스(`bg-slate-950/60 text-slate-500`)를 즉시 반영(Dynamic Class Binding)합니다.
                    //    이로써 레거시 데이터윈도우의 Row 단위 실시간 셀 보호 로직을 현대적이고 선언적인 웹 렌더링 방식으로 완벽히 일치시킬 수 있습니다.
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

                      // [Day 22 작업] 셀 인풋 포커스 진입 시 텍스트 자동 전체 선택 (Auto Select)
                      // [설명] 파워빌더(PowerBuilder)의 데이터윈도우(DataWindow)는 과거 클라이언트/서버(C/S) 환경에서 
                      // 사용자가 그리드 셀에 포커스를 이동했을 때 기존 입력값을 자동으로 전체 선택(Auto Select/Block)하여 
                      // 바로 새로운 값을 덮어쓸 수 있도록 고속 입력 편의성을 제공했습니다.
                      // 현대 웹 표준 브라우저에서는 포커스 이벤트(onFocus) 발생 시 `select()` 메서드를 실행하여 
                      // 동일한 고속 입력 생산성을 재현합니다. 이를 통해 마우스 클릭이나 Tab 키로 진입하더라도 
                      // 사용자가 기존 값을 백스페이스로 지울 필요 없이 즉시 수정할 수 있습니다.
                      const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
                        if (isCellReadOnly) return;
                        e.currentTarget.select();
                      };

                      // [Day 22 작업] 키보드 상하 방향키 행 이동 제어 (ArrowUp, ArrowDown)
                      // [설명] 파워빌더 데이터윈도우 그리드는 엑셀처럼 위/아래 방향키를 눌러 여러 행의 동일한 컬럼 셀을 
                      // 자유롭게 이동하며 데이터를 입력(Row Navigation)할 수 있는 특징을 가지고 있습니다.
                      // 브라우저는 기본적으로 input 태그 내부에서 좌우 이동만 지원하므로, React 환경에서 
                      // 각 input 요소에 행(`data-row`)과 컬럼(`data-col`) 속성을 커스텀 마크업으로 주입합니다.
                      // 사용자가 ArrowUp/ArrowDown 키를 누르면, `document.querySelector`를 사용하여 
                      // 인접한 행(rIdx - 1 또는 rIdx + 1)의 동일한 컬럼 명을 가진 input 요소를 동적으로 탐색하고,
                      // 해당 DOM 요소에 `.focus()` API를 호출함으로써 C/S 환경의 심리스한 키보드 입력 생산성을 완벽히 복원합니다.
                      // [Day 23 작업] 좌우 방향키 및 엔터 키 네비게이션 제어 기능
                      // [설명] 파워빌더(PowerBuilder)의 데이터윈도우(DataWindow)는 과거 클라이언트/서버(C/S) 환경에서
                      // 고도의 데이터 입력을 연속적이고 신속하게 처리하기 위해 행 기반 연속 입력(Row-by-Row Entry) 환경을 제공했습니다.
                      // 사용자가 키보드 방향키(상하좌우)나 엔터(Enter) 키만으로 마우스 없이 테이블 전체를 빠른 속도로 종횡무진 탐색하며
                      // 편집할 수 있는 이 강력한 UI 사용성은 오늘날의 현대적인 웹 환경에서도 매우 중요합니다.
                      // 
                      // 웹 브라우저의 기본 인풋 요소는 단일 텍스트 입력 내에서 커서 좌우 이동만 지원하므로,
                      // React 컴포넌트 내부에서 키보드 이벤트를 가로채고 DOM 구조(`data-row` 및 `data-col`)를 정밀하게 탐색하는 메커니즘을 결합했습니다.
                      // 특히, 데이터윈도우의 'tabsequence = 0' 또는 'protect = 1' 사양에 해당하는 수정 불가능(readOnly) 셀이 있는 경우
                      // 이를 자동으로 인식하고 건너뜀으로써, 실무 사용자의 연속 입력 흐름이 단절되지 않고 
                      // 오직 입력 가능한 셀로만 포커스가 부드럽게 흐르도록 설계했습니다.
                      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                        const columnsCount = parsedData.columns ? parsedData.columns.length : 0;
                        const rowsCount = gridData.length;

                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          let nextRow = rIdx + 1;
                          while (nextRow < rowsCount) {
                            const target = document.querySelector(
                              `input[data-row="${nextRow}"][data-col="${col.name}"]`
                            ) as HTMLInputElement | null;
                            if (target && !target.readOnly && target.tabIndex !== -1) {
                              target.focus();
                              break;
                            }
                            nextRow++;
                          }
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          let prevRow = rIdx - 1;
                          while (prevRow >= 0) {
                            const target = document.querySelector(
                              `input[data-row="${prevRow}"][data-col="${col.name}"]`
                            ) as HTMLInputElement | null;
                            if (target && !target.readOnly && target.tabIndex !== -1) {
                              target.focus();
                              break;
                            }
                            prevRow--;
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
                          let targetFound = false;

                          // 1단계: 아래 행들 중에서 동일 컬럼(col.name)의 입력 가능한 셀 탐색
                          let nextRow = rIdx + 1;
                          while (nextRow < rowsCount) {
                            const target = document.querySelector(
                              `input[data-row="${nextRow}"][data-col="${col.name}"]`
                            ) as HTMLInputElement | null;
                            if (target && !target.readOnly && target.tabIndex !== -1) {
                              target.focus();
                              targetFound = true;
                              break;
                            }
                            nextRow++;
                          }

                          // 2단계: 아래 행에 동일 컬럼의 입력 가능 셀이 없다면, 현재 위치 이후(다음 열들 및 다음 행들) 순차 탐색
                          if (!targetFound) {
                            let startRow = rIdx;
                            let startCol = cIdx + 1;
                            for (let r = startRow; r < rowsCount; r++) {
                              const startC = (r === startRow) ? startCol : 0;
                              for (let c = startC; c < columnsCount; c++) {
                                const targetCol = parsedData.columns[c];
                                const target = document.querySelector(
                                  `input[data-row="${r}"][data-col="${targetCol.name}"]`
                                ) as HTMLInputElement | null;
                                if (target && !target.readOnly && target.tabIndex !== -1) {
                                  target.focus();
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
                                } catch (err) {
                                  // 예외 방어
                                }
                              }
                            }}
                            onFocus={(e) => {
                              handleFocus(e);
                              if (!isCellReadOnly) {
                                try {
                                  e.currentTarget.showPicker();
                                } catch (err) {
                                  // 예외 방어
                                }
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
                  {/* // [Day 25 작업] 행 단위 개별 Undo 버튼 분기 구역 */}
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
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
