// [Day 21 작업] 파워빌더 파싱 통계 보고서 및 조회 인자(Retrieval Arguments) 바인딩 컴포넌트
"use client";

import React from "react";
import { ParsedPB } from "../types";

interface ParsingSummaryProps {
  activeFileType: string;
  parsedData: ParsedPB;
  columnSearch: string;
  onColumnSearchChange: (value: string) => void;
  argValues: { [key: string]: string };
  onArgChange: (argName: string, value: string) => void;
}

export default function ParsingSummary({
  activeFileType,
  parsedData,
  columnSearch,
  onColumnSearchChange,
  argValues,
  onArgChange,
}: ParsingSummaryProps) {
  const filteredColumns = (parsedData.columns || []).filter((col) =>
    col.name.toLowerCase().includes(columnSearch.toLowerCase())
  );

  return (
    <div className="lg:col-span-7 flex flex-col gap-6">
      {/* 파싱 정보 요약 보고서 */}
      <section className="flex flex-col bg-slate-900/40 border border-slate-900 rounded-2xl p-5 gap-4">
        <h3 className="text-sm font-bold text-white">🔍 파싱 정보 요약 보고서</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 block uppercase">타입</span>
            <span className="text-xs font-bold text-emerald-400 font-mono mt-1 block">
              {activeFileType}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 block uppercase">PB Release</span>
            <span className="text-xs font-bold text-yellow-400 font-mono mt-1 block">
              {parsedData.release ? `v${parsedData.release}` : "미감지"}
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 block uppercase font-mono">Columns</span>
            <span className="text-xs font-bold text-indigo-400 font-mono mt-1 block">
              {parsedData.columns?.length || 0} EA
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-500 block uppercase font-mono">Computed</span>
            <span className="text-xs font-bold text-amber-400 font-mono mt-1 block">
              {parsedData.computedFields?.length || 0} EA
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              분석된 컬럼 명세서
            </span>
            <input
              type="text"
              placeholder="컬럼 필터링..."
              value={columnSearch}
              onChange={(e) => onColumnSearchChange(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-850 rounded text-xs text-white"
            />
          </div>
          <div className="max-h-40 overflow-y-auto border border-slate-950 rounded-xl bg-slate-950/40 text-xs font-mono scrollbar-thin">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 font-bold">
                <tr>
                  <th className="p-2 pl-4">No.</th>
                  <th className="p-2">컬럼명</th>
                  <th className="p-2">타입</th>
                  <th className="p-2">정렬</th>
                </tr>
              </thead>
              <tbody>
                {filteredColumns.map((c, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-900/60 hover:bg-slate-800/40 text-slate-300"
                  >
                    <td className="p-2 pl-4 text-slate-500">{i + 1}</td>
                    <td className="p-2 font-bold text-indigo-300">{c.name}</td>
                    <td className="p-2 text-slate-400">{c.type}</td>
                    <td className="p-2 text-slate-400">
                      {c.alignment === "1"
                        ? "우측"
                        : c.alignment === "2"
                        ? "중앙"
                        : "좌측"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Retrieval Arguments 실시간 바인딩 입력란 */}
      <section className="flex flex-col bg-slate-900/40 border border-slate-900 rounded-2xl p-5 gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🔑 Retrieval Arguments 실시간 바인딩 입력란</span>
          </h3>
          <span className="px-2 py-0.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded">
            실시간 SQL & 연산 필드 바인딩 중
          </span>
        </div>

        {parsedData.arguments && parsedData.arguments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {parsedData.arguments.map((arg, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-1.5 bg-slate-950/40 p-3 rounded-xl border border-slate-900/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 font-mono flex items-center gap-1">
                    <span className="text-indigo-500 text-[10px]">:</span>
                    {arg.name}
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {arg.type}
                  </span>
                </div>
                <input
                  type="text"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-mono text-white placeholder-slate-600 transition-all shadow-inner"
                  placeholder={`${
                    arg.type.toLowerCase() === "number"
                      ? "예: 50000 (숫자)"
                      : "예: Closed (문자열)"
                  }`}
                  value={argValues[arg.name] || ""}
                  onChange={(e) => onArgChange(arg.name, e.target.value)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs italic bg-slate-950/20 rounded-xl border border-dashed border-slate-900">
            탐지된 조회용 인자(Retrieval Arguments)가 존재하지 않습니다.
          </div>
        )}
      </section>
    </div>
  );
}
