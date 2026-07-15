// [Day 51 작업] 다중 데이터 매핑용 듀얼 리스트박스(Dual Listbox) 현대화 컴포넌트
// 레거시 파워빌더의 ListBox 오브젝트를 현대 React 선언형 UI 아키텍처로 완벽히 전환하여 양방향 데이터 이동 및 검색 필터링을 고도화합니다.

"use client";

import React, { useState, useMemo } from "react";

/**
 * [레거시 파워빌더와 현대 React의 듀얼 리스트박스(Transfer List) 아키텍처 비교]
 *
 * 1. 레거시 파워빌더 (C/S 환경의 MultiSelect = True ListBox 제어):
 *    - 파워빌더에서는 화면에 2개의 ListBox 오브젝트(예: plb_unassigned, plb_assigned)를 배치한 후,
 *      사용자가 아이템을 복수 선택하면 루프를 돌며 `plb_unassigned.Selected(i)` 배열 속성이나
 *      `plb_unassigned.SelectedItem(i)` 함수를 전수조사하여 선택 여부를 판별했습니다.
 *    - 이후 선택된 아이템을 `plb_assigned.AddItem()`으로 대상 리스트박스에 추가하고,
 *      반대로 원본 리스트박스에서는 역순 루프를 돌며 `plb_unassigned.DeleteItem(i)`을 실행하는
 *      복잡한 물리적/절차적(Imperative) 버퍼 조작 스크립트를 작성해야 했습니다.
 *    - 이 방식은 UI 컨트롤에 데이터가 직접 바인딩되고 화면 상태가 난잡하게 흩어져, 유지보수가 매우 까다로웠습니다.
 *
 * 2. 현대 웹 표준 React 아키텍처 (선언형 양방향 데이터 바인딩 및 집합 연산):
 *    - React 환경에서는 상태(State)를 데이터의 단일 진실 공급원(Single Source of Truth)으로 유지합니다.
 *    - 데이터의 추가/삭제/전송 조작은 리스트 오브젝트를 직접 건드리지 않고,
 *      `unassigned`와 `assigned` 상태 배열의 불변성(Immutability) 갱신 파이프라인을 통과하며 수행됩니다.
 *    - 사용자가 선택한 아이템 ID 정보는 `Set` 구조의 상태(`selectedUnassigned`, `selectedAssigned`)로 안전하게 고속 추적되며,
 *      중앙 제어 버튼 클릭 시 집합 연산(Filter, Map, Spread Operator)을 적용하여 새로운 스냅샷 배열로 교체합니다.
 *    - UI 렌더링은 이 상태 스냅샷의 흐름에 맞춰 선언형(Declarative)으로 자동 갱신되며 가상 DOM을 통해 변경된 최소 영역만 신속히 다시 그립니다.
 *    - 발음 가이드 (표준 IPA 발음 기호 준수):
 *      * 리스트박스 ➔ [ˈlɪstbɑːks]
 *      * 전송 ➔ [trænsˈfɜːr]
 *      * 추가 ➔ [æd]
 *      * 제거 ➔ [rɪˈmuːv]
 *      * 선택 ➔ [sɪˈlekʃn]
 *      * 필터 ➔ [ˈfɪltər]
 */

export interface DualListboxItem {
  id: string;
  label: string;
  value: string;
  description?: string;
}

interface DualListboxProps {
  /** 미배정 목록 초기값 */
  initialUnassigned?: DualListboxItem[];
  /** 배정 목록 초기값 */
  initialAssigned?: DualListboxItem[];
  /** 데이터 변경 시 트리거되는 이벤트 콜백 */
  onChange?: (assigned: DualListboxItem[], unassigned: DualListboxItem[]) => void;
  /** 좌측 패널 타이틀 */
  titleLeft?: string;
  /** 우측 패널 타이틀 */
  titleRight?: string;
}

// 임시 테스트 데모용 기본 데이터셋
const DEFAULT_UNASSIGNED: DualListboxItem[] = [
  { id: "SYS_01", label: "시스템 설정 관리자", value: "SYS_ADMIN", description: "전체 시스템 통제 권한" },
  { id: "USR_02", label: "일반 사용자 관리", value: "USER_MGR", description: "사용자 계정 생성 및 암호 초기화" },
  { id: "ERP_03", label: "매출 마감 확정 권한", value: "ERP_SALES_CLOSE", description: "월별 실적 마감 및 락 걸기" },
  { id: "HR_04", label: "인사 평가 승인권", value: "HR_APPRAISAL_APP", description: "부서원 고과 최종 승인" },
  { id: "DEV_05", label: "소스 코드 배포 승인", value: "DEV_DEPLOY", description: "운영 서버 CD 파이프라인 트리거" },
  { id: "FIN_06", label: "법인카드 전표 처리", value: "FIN_CARD_EXP", description: "카드 결제 영수증 전표 상신" },
  { id: "LOG_07", label: "시스템 로그 감사 조회", value: "AUDIT_LOG_VIEW", description: "보안 감사 로그 이력 분석" },
];

const DEFAULT_ASSIGNED: DualListboxItem[] = [
  { id: "COMMON_01", label: "공통 코드 기본 조회", value: "COMMON_READ", description: "기본 공통 딕셔너리 테이블 읽기 권한" },
  { id: "REPT_02", label: "실적 보고서 출력", value: "REPORT_PRINT", description: "데이터윈도우 인쇄 및 PDF 추출" },
];

export default function DualListbox({
  initialUnassigned = DEFAULT_UNASSIGNED,
  initialAssigned = DEFAULT_ASSIGNED,
  onChange,
  titleLeft = "미배정 권한 목록 (Unassigned)",
  titleRight = "배정된 권한 목록 (Assigned)",
}: DualListboxProps) {
  // 1. 상태 정의 (데이터셋 및 로컬 다중 선택, 텍스트 필터 상태)
  const [unassigned, setUnassigned] = useState<DualListboxItem[]>(initialUnassigned);
  const [assigned, setAssigned] = useState<DualListboxItem[]>(initialAssigned);

  // 로컬 선택 상태 (아이템 ID를 보관하는 고속 Set 구조체)
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());

  // 패널 상단 실시간 Like 검색 필터 검색어 상태
  const [filterLeft, setFilterLeft] = useState<string>("");
  const [filterRight, setFilterRight] = useState<string>("");

  // 2. 실시간 로컬 텍스트 필터 적용 (useMemo 캐싱 최적화)
  // [Day 51 작업] 검색어 포함 여부를 Like 패턴 매칭으로 분석하는 실시간 필터링 계산 블록
  const filteredUnassigned = useMemo(() => {
    const keyword = filterLeft.trim().toLowerCase();
    if (!keyword) return unassigned;
    return unassigned.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword) ||
        item.value.toLowerCase().includes(keyword) ||
        (item.description && item.description.toLowerCase().includes(keyword))
    );
  }, [unassigned, filterLeft]);

  const filteredAssigned = useMemo(() => {
    const keyword = filterRight.trim().toLowerCase();
    if (!keyword) return assigned;
    return assigned.filter(
      (item) =>
        item.label.toLowerCase().includes(keyword) ||
        item.value.toLowerCase().includes(keyword) ||
        (item.description && item.description.toLowerCase().includes(keyword))
    );
  }, [assigned, filterRight]);

  // 3. 다중 선택(Multi-Selection) 이벤트 핸들러
  const handleToggleSelectLeft = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectRight = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 4. [Day 51 작업] 양방향 데이터 이동 핸들러 (불변성 스냅샷 갱신 파이프라인)
  // [➔ 추가] 버튼: 좌측 미배정 목록에서 선택된 아이템들을 우측 배정 목록으로 이동 [trænsˈfɜːr]
  const handleAddSelected = () => {
    if (selectedUnassigned.size === 0) return;

    // 선택된 아이템들을 필터링하여 찾아내기
    const itemsToAdd = unassigned.filter((item) => selectedUnassigned.has(item.id));
    const nextUnassigned = unassigned.filter((item) => !selectedUnassigned.has(item.id));
    const nextAssigned = [...assigned, ...itemsToAdd];

    setUnassigned(nextUnassigned);
    setAssigned(nextAssigned);
    setSelectedUnassigned(new Set()); // 전송 완료 후 선택 해제

    if (onChange) {
      onChange(nextAssigned, nextUnassigned);
    }
  };

  // [⬅ 제거] 버튼: 우측 배정 목록에서 선택된 아이템들을 좌측 미배정 목록으로 이동
  const handleRemoveSelected = () => {
    if (selectedAssigned.size === 0) return;

    const itemsToRemove = assigned.filter((item) => selectedAssigned.has(item.id));
    const nextAssigned = assigned.filter((item) => !selectedAssigned.has(item.id));
    const nextUnassigned = [...unassigned, ...itemsToRemove];

    setAssigned(nextAssigned);
    setUnassigned(nextUnassigned);
    setSelectedAssigned(new Set()); // 전송 완료 후 선택 해제

    if (onChange) {
      onChange(nextAssigned, nextUnassigned);
    }
  };

  // [▶▶ 전체 추가] 버튼: 현재 좌측 필터링(검색) 조건에 걸려있는 모든 아이템 일괄 우측 이동
  const handleAddAllFiltered = () => {
    if (filteredUnassigned.length === 0) return;

    const filteredIds = new Set(filteredUnassigned.map((item) => item.id));
    const nextUnassigned = unassigned.filter((item) => !filteredIds.has(item.id));
    const nextAssigned = [...assigned, ...filteredUnassigned];

    setUnassigned(nextUnassigned);
    setAssigned(nextAssigned);
    setSelectedUnassigned(new Set());

    if (onChange) {
      onChange(nextAssigned, nextUnassigned);
    }
  };

  // [◀◀ 전체 제거] 버튼: 현재 우측 필터링(검색) 조건에 걸려있는 모든 아이템 일괄 좌측 이동
  const handleRemoveAllFiltered = () => {
    if (filteredAssigned.length === 0) return;

    const filteredIds = new Set(filteredAssigned.map((item) => item.id));
    const nextAssigned = assigned.filter((item) => !filteredIds.has(item.id));
    const nextUnassigned = [...unassigned, ...filteredAssigned];

    setAssigned(nextAssigned);
    setUnassigned(nextUnassigned);
    setSelectedAssigned(new Set());

    if (onChange) {
      onChange(nextAssigned, nextUnassigned);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4 p-5 rounded-xl bg-slate-950 border border-slate-900 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {/* 컴포넌트 헤더 */}
      <div className="flex items-center justify-between border-b border-indigo-950/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
          <h2 className="text-sm font-bold text-slate-100 tracking-wider">
            권한 그룹 매핑 제어기 (Dual [ˈlɪstbɑːks] [trænsˈfɜːr])
          </h2>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          <span>PB Web-Bridge Modernization v1.51</span>
        </div>
      </div>

      {/* 듀얼 리스트박스 메인 레이아웃 (수평 대칭 구도) */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
        
        {/* ================= 좌측 패널: 미배정 목록 ================= */}
        <div className="flex flex-col h-[420px] rounded-lg bg-[#090e1c] border border-indigo-950/30 overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
          {/* 패널 타이틀 */}
          <div className="bg-slate-900/60 px-4 py-2.5 border-b border-indigo-950/40 flex justify-between items-center">
            <span className="text-[11px] font-bold text-cyan-400 tracking-wide uppercase">
              {titleLeft}
            </span>
            <span className="text-[9px] font-mono text-slate-400 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/10">
              {filteredUnassigned.length} / {unassigned.length}건
            </span>
          </div>

          {/* 검색 필터 */}
          <div className="p-2 border-b border-indigo-950/20 bg-slate-950/40">
            <div className="relative">
              <input
                type="text"
                placeholder="권한명, 코드값 등으로 검색 (Like)..."
                value={filterLeft}
                onChange={(e) => setFilterLeft(e.target.value)}
                className="w-full text-xs bg-slate-950/90 text-slate-300 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_8px_rgba(34,211,238,0.2)] transition-all placeholder:text-slate-600 font-mono"
              />
              {filterLeft && (
                <button
                  onClick={() => setFilterLeft("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 목록 바디 */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {filteredUnassigned.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                조회 대상 데이터가 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredUnassigned.map((item) => {
                  const isSelected = selectedUnassigned.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={(e) => handleToggleSelectLeft(item.id, e)}
                      className={`group/item flex items-start gap-2.5 p-2 rounded cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-cyan-500/10 border-cyan-500/30 shadow-[inset_0_0_8px_rgba(34,211,238,0.1)]"
                          : "bg-slate-900/20 border-transparent hover:bg-slate-900/60 hover:border-indigo-950/50"
                      }`}
                    >
                      {/* 커스텀 다중 선택 체크박스 */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // 부모 div 클릭 핸들러에서 상태 토글 처리
                        className="mt-0.5 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 cursor-pointer accent-cyan-500"
                      />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold font-mono transition-colors ${
                            isSelected ? "text-cyan-400" : "text-slate-300 group-hover/item:text-slate-200"
                          }`}>
                            {item.label}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1 rounded">
                            {item.value}
                          </span>
                        </div>
                        {item.description && (
                          <span className="text-[10px] text-slate-500 leading-normal line-clamp-1">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= 중앙 패널: 양방향 제어 버튼 패널 ================= */}
        <div className="flex md:flex-col gap-2 justify-center py-2 px-1">
          {/* [▶▶ 전체 추가] */}
          <button
            onClick={handleAddAllFiltered}
            disabled={filteredUnassigned.length === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-cyan-500/50 disabled:opacity-30 disabled:border-slate-800 disabled:text-slate-600 disabled:pointer-events-none rounded-md px-3 py-2.5 transition-all shadow-sm hover:shadow-[0_0_10px_rgba(34,211,238,0.15)] group active:scale-95"
            title="필터링된 모든 미배정 권한 전체 추가"
          >
            <span>전체 추가</span>
            <span className="font-mono tracking-tighter text-cyan-400 group-hover:translate-x-0.5 transition-transform">▶▶</span>
          </button>

          {/* [➔ 추가] */}
          <button
            onClick={handleAddSelected}
            disabled={selectedUnassigned.size === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-[11px] font-bold text-slate-200 hover:text-white bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600 hover:border-indigo-400 disabled:opacity-30 disabled:bg-slate-900/40 disabled:border-slate-800 disabled:text-slate-600 disabled:pointer-events-none rounded-md px-4 py-2.5 transition-all shadow-[0_0_8px_rgba(99,102,241,0.1)] hover:shadow-[0_0_12px_rgba(99,102,241,0.4)] group active:scale-95"
            title="선택된 권한 배정 목록으로 추가 [æd]"
          >
            <span>추가</span>
            <span className="font-mono text-indigo-400 group-hover:text-white group-hover:translate-x-0.5 transition-all">➔</span>
          </button>

          {/* [⬅ 제거] */}
          <button
            onClick={handleRemoveSelected}
            disabled={selectedAssigned.size === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-[11px] font-bold text-slate-200 hover:text-white bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600 hover:border-purple-400 disabled:opacity-30 disabled:bg-slate-900/40 disabled:border-slate-800 disabled:text-slate-600 disabled:pointer-events-none rounded-md px-4 py-2.5 transition-all shadow-[0_0_8px_rgba(168,85,247,0.1)] hover:shadow-[0_0_12px_rgba(168,85,247,0.4)] group active:scale-95"
            title="선택된 권한 배정 목록에서 제거"
          >
            <span className="font-mono text-purple-400 group-hover:text-white group-hover:-translate-x-0.5 transition-all">⬅</span>
            <span>제거</span>
          </button>

          {/* [◀◀ 전체 제거] */}
          <button
            onClick={handleRemoveAllFiltered}
            disabled={filteredAssigned.length === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-purple-500/50 disabled:opacity-30 disabled:border-slate-800 disabled:text-slate-600 disabled:pointer-events-none rounded-md px-3 py-2.5 transition-all shadow-sm hover:shadow-[0_0_10px_rgba(168,85,247,0.15)] group active:scale-95"
            title="필터링된 배정 권한 전체 회복"
          >
            <span className="font-mono tracking-tighter text-purple-400 group-hover:-translate-x-0.5 transition-transform">◀◀</span>
            <span>전체 제거</span>
          </button>
        </div>

        {/* ================= 우측 패널: 배정 목록 ================= */}
        <div className="flex flex-col h-[420px] rounded-lg bg-[#090e1c] border border-indigo-950/30 overflow-hidden focus-within:ring-1 focus-within:ring-purple-500/50 transition-all">
          {/* 패널 타이틀 */}
          <div className="bg-slate-900/60 px-4 py-2.5 border-b border-indigo-950/40 flex justify-between items-center">
            <span className="text-[11px] font-bold text-purple-400 tracking-wide uppercase">
              {titleRight}
            </span>
            <span className="text-[9px] font-mono text-slate-400 bg-purple-950/30 px-1.5 py-0.5 rounded border border-purple-500/10">
              {filteredAssigned.length} / {assigned.length}건
            </span>
          </div>

          {/* 검색 필터 */}
          <div className="p-2 border-b border-indigo-950/20 bg-slate-950/40">
            <div className="relative">
              <input
                type="text"
                placeholder="권한명, 코드값 등으로 검색 (Like)..."
                value={filterRight}
                onChange={(e) => setFilterRight(e.target.value)}
                className="w-full text-xs bg-slate-950/90 text-slate-300 border border-slate-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-purple-500/50 focus:shadow-[0_0_8px_rgba(168,85,247,0.2)] transition-all placeholder:text-slate-600 font-mono"
              />
              {filterRight && (
                <button
                  onClick={() => setFilterRight("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 목록 바디 */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {filteredAssigned.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                배정된 데이터 항목이 존재하지 않습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredAssigned.map((item) => {
                  const isSelected = selectedAssigned.has(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={(e) => handleToggleSelectRight(item.id, e)}
                      className={`group/item flex items-start gap-2.5 p-2 rounded cursor-pointer transition-all border ${
                        isSelected
                          ? "bg-purple-500/10 border-purple-500/30 shadow-[inset_0_0_8px_rgba(168,85,247,0.1)]"
                          : "bg-slate-900/20 border-transparent hover:bg-slate-900/60 hover:border-indigo-950/50"
                      }`}
                    >
                      {/* 커스텀 다중 선택 체크박스 */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // 부모 div 클릭 핸들러에서 상태 토글 처리
                        className="mt-0.5 rounded border-slate-800 bg-slate-950 text-purple-500 focus:ring-0 focus:ring-offset-0 focus:outline-none w-3.5 h-3.5 cursor-pointer accent-purple-500"
                      />
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold font-mono transition-colors ${
                            isSelected ? "text-purple-400" : "text-slate-300 group-hover/item:text-slate-200"
                          }`}>
                            {item.label}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1 rounded">
                            {item.value}
                          </span>
                        </div>
                        {item.description && (
                          <span className="text-[10px] text-slate-500 leading-normal line-clamp-1">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 하단 도움말 안내 영역 */}
      <div className="bg-slate-900/30 border border-indigo-950/20 rounded-md p-3 text-[10.5px] leading-relaxed text-slate-400 font-mono">
        <p className="text-indigo-400 font-bold mb-1">💡 복수 선택 및 제어 팁</p>
        <p>각 리스트박스([ˈlɪstbɑːks]) 내 항목들을 자유롭게 복수 선택([ˈmʌlti sɪˈlekʃn])하여, 중앙 전송([trænsˈfɜːr]) 제어 패널을 통해 원하는 방향으로 신속하게 매핑을 진행할 수 있습니다. 상단 실시간 검색 필터([ˈfɪltər])를 병행하면 대량의 ERP 권한 매핑도 안정적으로 소화할 수 있습니다.</p>
      </div>
    </div>
  );
}
