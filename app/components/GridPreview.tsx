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
}: GridPreviewProps) {
  return (
    <section className="bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl p-5 flex flex-col gap-4">
      <h3 className="text-sm font-bold text-white">
        💻 웹 변환 화면 프리뷰 (Grid Preview)
      </h3>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {gridData.map((row, rIdx) => (
              <tr
                key={rIdx}
                style={{
                  height: parsedData?.bands?.detail
                    ? `${parsedData.bands.detail / 2}px`
                    : "40px",
                }}
                className="hover:bg-slate-800 transition-all font-mono"
              >
                <td className="p-3 text-center text-slate-600">{rIdx + 1}</td>
                {(parsedData.columns || []).map((col, cIdx) => {
                  const isCellReadOnly =
                    col.tabsequence === "0" || col.protect === "1";
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
                    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        const nextInput = document.querySelector(
                          `input[data-row="${rIdx + 1}"][data-col="${col.name}"]`
                        ) as HTMLInputElement | null;
                        if (nextInput) nextInput.focus();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        const prevInput = document.querySelector(
                          `input[data-row="${rIdx - 1}"][data-col="${col.name}"]`
                        ) as HTMLInputElement | null;
                        if (prevInput) prevInput.focus();
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
