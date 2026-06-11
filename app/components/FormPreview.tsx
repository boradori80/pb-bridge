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
