// [Day 21 작업] SQL 에디터 및 실시간 바인딩 하이라이터, 시뮬레이터 컴포넌트
"use client";

import React from "react";
import { ParsedPB, ArgumentInfo } from "../types";

interface SqlEditorProps {
  parsedData: ParsedPB;
  argValues: { [key: string]: string };
  isSqlFormatted: boolean;
  onSqlFormatChange: (formatted: boolean) => void;
  sqlExecuteLog: string | null;
  isExecutingSql: boolean;
  onExecuteSql: () => void;
}

export default function SqlEditor({
  parsedData,
  argValues,
  isSqlFormatted,
  onSqlFormatChange,
  sqlExecuteLog,
  isExecutingSql,
  onExecuteSql,
}: SqlEditorProps) {
  const formatSQL = (sql: string): string => {
    if (!sql) return "";
    const cleaned = sql.replace(/\s+/g, " ").trim();
    const formatted = cleaned.replace(
      /\b(SELECT|FROM|WHERE|AND|OR)\b/gi,
      "\n$1\n    "
    );
    return formatted
      .split("\n")
      .map((line) =>
        line.trim()
          ? ["SELECT", "FROM", "WHERE", "AND", "OR"].some((kw) =>
              new RegExp(`^${kw}$`, "i").test(line.trim())
            )
            ? line.trim().toUpperCase()
            : "    " + line.trim()
          : ""
      )
      .filter(Boolean)
      .join("\n");
  };

  const highlightSQL = (
    sql: string,
    args: { [key: string]: string },
    argDefs: ArgumentInfo[]
  ): string => {
    if (!sql) return "";
    let escaped = sql
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    argDefs.forEach((arg) => {
      const val = args[arg.name] !== undefined ? args[arg.name] : "";
      const isString =
        arg.type.toLowerCase() === "string" ||
        arg.type.toLowerCase() === "char";

      let displayVal = "";
      let isPlaceholder = false;
      if (val === "") {
        displayVal = `:${arg.name}`;
        isPlaceholder = true;
      } else {
        displayVal = isString ? `'${val}'` : val;
      }

      const escapedVal = displayVal
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const spanClass = isPlaceholder
        ? "text-amber-500/70 italic underline decoration-dotted"
        : "text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shadow-sm transition-all";

      escaped = escaped.replace(
        new RegExp(`:${arg.name}\\b`, "g"),
        `<span class="${spanClass}">${escapedVal}</span>`
      );
    });

    const keywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "AND",
      "OR",
      "INSERT",
      "UPDATE",
      "DELETE",
      "JOIN",
    ];
    keywords.forEach((keyword) => {
      escaped = escaped.replace(
        new RegExp(`\\b${keyword}\\b`, "gi"),
        `<span class="text-blue-400 font-bold">${keyword.toUpperCase()}</span>`
      );
    });

    return escaped;
  };

  return (
    <section className="bg-black border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      <div className="bg-zinc-950 px-4 py-2 border-b border-zinc-900 flex items-center justify-between">
        <span className="text-xs font-bold text-amber-500">
          SQL Editor (SCOTT@xe)
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSqlFormatChange(true)}
            className={`px-2 py-1 rounded text-xs font-semibold ${
              isSqlFormatted
                ? "bg-indigo-600 text-white"
                : "bg-zinc-900 text-zinc-400"
            }`}
          >
            정렬
          </button>
          <button
            onClick={() => onSqlFormatChange(false)}
            className={`px-2 py-1 rounded text-xs font-semibold ${
              !isSqlFormatted
                ? "bg-indigo-600 text-white"
                : "bg-zinc-900 text-zinc-400"
            }`}
          >
            원문
          </button>
          <button
            onClick={onExecuteSql}
            disabled={isExecutingSql}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded disabled:opacity-50"
          >
            {isExecutingSql ? "Running..." : "Run"}
          </button>
        </div>
      </div>
      <div className="flex bg-black min-h-[120px] font-mono text-xs p-4 overflow-x-auto">
        {parsedData.sqlError ? (
          <span className="text-rose-500 italic">
            -- ⚠️ Retrieve 구문이 심각하게 파손되어 SQL을 분리하지 못했습니다.
            상단 에러 상세 로그를 확인하세요.
          </span>
        ) : parsedData.retrieveQuery ? (
          <pre className="text-emerald-400 whitespace-pre-wrap leading-relaxed">
            <code
              dangerouslySetInnerHTML={{
                __html: highlightSQL(
                  isSqlFormatted
                    ? formatSQL(parsedData.retrieveQuery)
                    : parsedData.retrieveQuery,
                  argValues,
                  parsedData.arguments || []
                ),
              }}
            />
          </pre>
        ) : (
          <span className="text-zinc-600 italic">
            -- 파싱된 조회용 SQL 구문이 없습니다.
          </span>
        )}
      </div>
      {sqlExecuteLog && (
        <div className="bg-zinc-950 border-t border-zinc-900 p-3 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap">
          {sqlExecuteLog}
        </div>
      )}
    </section>
  );
}
