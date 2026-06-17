// [Day 21 작업] 데이터윈도우 웹 등록 폼 프리뷰 컴포넌트
"use client";

import React from "react";
import { ParsedPB, ColumnInfo } from "../types";
import { isNumericColumn, formatNumberWithCommas } from "../utils/expression";

interface FormPreviewProps {
  parsedData: ParsedPB;
  formData: { [key: string]: string };
  onFormInputChange: (colName: string, value: string) => void;
}

// [Day 27 작업] 폼 프리뷰 Props 동기화 구역
// 
// 파워빌더 데이터윈도우의 RowFocusChanged / GetRow() 버퍼와 React 상태 관리 융합에 대한 설명:
// 1. 파워빌더(레거시) 방식:
//    전통적인 클라이언트/서버(C/S) 파워빌더 개발에서는 그리드(dw_1)에서 행이 바뀔 때 'RowFocusChanged' 이벤트가 자동으로 발생합니다.
//    개발자는 'dw_1.GetRow()'나 'dw_1.GetItemString(row, col)' 함수를 이용해 포커스된 행의 버퍼 데이터를 수동으로 조회한 뒤,
//    별도로 존재하는 프리뷰 폼이나 상세 디테일 윈도우의 컨트롤에 SetText()나 SetItem() 등으로 수동 동기화(Sync)해 주는 절차가 필요했습니다.
//    또한 상세 폼에서 변경이 일어나면 이를 다시 그리드 버퍼에 동기화해 주는 로직을 개발자가 매번 수작업으로 바인딩해야만 했습니다.
// 
// 2. 현대 웹 표준 React 방식:
//    React는 상태가 단방향으로 흐르며 상태 변화가 렌더링으로 이어지는 선언적 UI 구조를 따릅니다.
//    부모 컴포넌트(page.tsx)에서 'selectedRowIndex' 상태를 관리하고, 'gridData[selectedRowIndex]'의 데이터 스냅샷을 
//    'formData' Props로 하위 컴포넌트인 FormPreview에 전달(단방향 흐름)함으로써, 사용자가 그리드 행을 클릭하는 순간
//    이 정보가 폭포수처럼 하단 폼으로 흘러들어가 실시간으로 반영됩니다.
//    반대로 상세 폼 내의 인풋에서 변경(onChange)이 일어나면, 부모로부터 전달받은 역방향 콜백 함수 'onFormInputChange'를 통해
//    부모가 소유한 'gridData' 배열 버퍼의 해당 인덱스 레코드를 정밀 갱신(양방향 바인딩 시뮬레이션)합니다.
//    이로써 데이터의 단일 진실 공급원(Single Source of Truth)을 유지하면서도 파워빌더의 양방향 연동 사양을 아름답고 단순하게 완비할 수 있습니다.
export default function FormPreview({
  parsedData,
  formData,
  onFormInputChange,
}: FormPreviewProps) {
  // [Day 18 작업] 파워빌더의 tabsequence 및 protect 속성을 분석하여 웹 표준 접근성 속성으로 동적 매핑하는 함수
  const renderDynamicInputField = (column: ColumnInfo) => {
    const colName = column.name;
    const type = (column.type || "").toLowerCase();
    const value = formData[colName] || "";

    const isReadOnly = column.tabsequence === "0" || column.protect === "1";
    const currentTabIndex = isReadOnly
      ? -1
      : parseInt(column.tabsequence || "0", 10);

    const baseInputClass = `w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
      isReadOnly ? "opacity-60 cursor-not-allowed select-none bg-slate-950" : ""
    }`;

    if (
      type.includes("date") ||
      type.includes("time") ||
      type.includes("timestamp")
    ) {
      return (
        <input
          type="date"
          className={baseInputClass}
          value={value}
          onChange={(e) =>
            !isReadOnly && onFormInputChange(colName, e.target.value)
          }
          onClick={(e) => {
            if (!isReadOnly) {
              try {
                e.currentTarget.showPicker();
              } catch (err) {
                // 구형 브라우저 지원 방어
              }
            }
          }}
          onFocus={(e) => {
            if (!isReadOnly) {
              try {
                e.currentTarget.showPicker();
              } catch (err) {
                // 구형 브라우저 지원 방어
              }
            }
          }}
          readOnly={isReadOnly}
          tabIndex={currentTabIndex}
        />
      );
    }
    if (isNumericColumn(type)) {
      return (
        <input
          type="text"
          className={baseInputClass}
          placeholder={isReadOnly ? "보호된 필드" : "숫자 입력"}
          value={formatNumberWithCommas(value)}
          onChange={(e) =>
            !isReadOnly &&
            onFormInputChange(colName, formatNumberWithCommas(e.target.value))
          }
          readOnly={isReadOnly}
          tabIndex={currentTabIndex}
        />
      );
    }
    return (
      <input
        type="text"
        className={baseInputClass}
        placeholder={isReadOnly ? "보호된 필드" : "텍스트 입력"}
        value={value}
        onChange={(e) =>
          !isReadOnly && onFormInputChange(colName, e.target.value)
        }
        readOnly={isReadOnly}
        tabIndex={currentTabIndex}
      />
    );
  };

  return (
    <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden p-5 flex flex-col gap-4">
      <h3 className="text-sm font-bold text-white">
        📋 웹 등록 폼 화면 프리뷰 (Form Preview)
      </h3>
      {parsedData.columns && parsedData.columns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 p-5 border border-slate-900 rounded-xl max-w-4xl mx-auto w-full">
          {parsedData.columns.map((col, idx) => (
            // 📌 [Day 20 최적화] 개별 바구니 엘리먼트에 고유 식별 명찰(key={idx})을 명시하여 React 렌더링 경고를 소멸시킵니다.
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-900/40"
            >
              <label className="sm:w-1/3 text-xs font-bold text-slate-300">
                {col.label || col.name}
              </label>
              <div className="sm:w-2/3">{renderDynamicInputField(col)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-slate-500 text-xs italic">
          프리뷰를 표시할 수 있는 유효한 데이터윈도우 사양이 존재하지 않습니다.
        </div>
      )}
    </section>
  );
}
