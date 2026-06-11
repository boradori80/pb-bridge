// [Day 21 작업] 파워빌더 소스 파일 에디터 및 업로드 기능 전담 컴포넌트
"use client";

import React, { useRef } from "react";

interface SourceEditorProps {
  activeFileName: string;
  activeFileSize: string;
  activeFileContent: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function SourceEditor({
  activeFileName,
  activeFileSize,
  activeFileContent,
  onFileChange,
}: SourceEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="lg:col-span-5 flex flex-col bg-slate-950/80 border border-slate-900 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-4 border-b border-slate-900 bg-slate-900/30 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">📄 소스 코드 에디터</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition-all"
        >
          업로드
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          className="hidden"
          accept=".srd,.srw,.sru,.srp"
        />
      </div>
      <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-900 text-xs font-mono text-slate-400 flex justify-between">
        <span>{activeFileName}</span>
        <span>{activeFileSize}</span>
      </div>
      <pre className="p-4 font-mono text-xs text-indigo-300 bg-[#05080f]/90 overflow-x-auto max-h-[400px] whitespace-pre">
        {activeFileContent}
      </pre>
    </section>
  );
}
