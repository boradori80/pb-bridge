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
                          onChange={(e) => {
                            if (isCellReadOnly) return;
                            setGridData((prev) => {
                              const next = [...prev];
                              if (next[rIdx]) next[rIdx][col.name] = e.target.value;
                              return next;
                            });
                          }}
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
                          onChange={(e) => {
                            if (isCellReadOnly) return;
                            const val = formatNumberWithCommas(e.target.value);
                            setGridData((prev) => {
                              const next = [...prev];
                              if (next[rIdx]) next[rIdx][col.name] = val;
                              return next;
                            });
                          }}
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
                        onChange={(e) => {
                          if (isCellReadOnly) return;
                          setGridData((prev) => {
                            const next = [...prev];
                            if (next[rIdx]) next[rIdx][col.name] = e.target.value;
                            return next;
                          });
                        }}
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
