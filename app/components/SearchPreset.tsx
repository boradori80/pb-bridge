// [Day 56 작업] 사용자 정의 검색 조건 프리셋(Search Query Preset) 저장/복원 및 localStorage 직렬화 관리 컴포넌트
// 초보자를 위한 설명: 파워빌더 레거시 환경의 ProfileString / RegistrySet 함수를 현대 웹 React와 localStorage API로 전환한 독립 컴포넌트입니다.

"use client";

import React, { useState, useEffect, useRef } from "react";

/**
 * =========================================================================
 * [Day 56 작업] 파워빌더 레거시 개인화 저장 vs 현대 웹 localStorage React 상태 동기화 구조적 비교 해설
 * =========================================================================
 *
 * 1. 레거시 파워빌더 환경 (SetProfileString / RegistrySet 동기식 파일 IO):
 *    - 파워빌더 레거시 ERP 앱에서는 사용자의 검색 조건(부서명, 조회 상태, 실적 금액 범위 등)을 저장하기 위해
 *      `SetProfileString("pb.ini", "SearchPreset", "Dept", ls_dept)` 함수를 써서 로컬 INI 파일에 쓰거나,
 *      `RegistrySet("HKEY_CURRENT_USER\Software\ERP\Presets", "Dept", RegString!, ls_dept)` 함수로 윈도우 레지스트리에 기재했습니다.
 *    - 이 방식은 클라이언트 OS OS 파일 시스템 스풀러에 직접 디스크 I/O를 일으키며 동기식(Synchronous)으로 동작했습니다.
 *    - 또한 읽어올 때는 `ProfileString("pb.ini", "SearchPreset", "Dept", "전체")`와 같이 단일 문자열 값 단위로 개별 호출해야 했으며,
 *      멀티 디바이스 환경이나 웹 브라우저 샌드박스 환경에서는 디스크 직접 접근 권한 제한으로 동작이 불가능했습니다.
 *
 * 2. 현대 웹 표준 React 아키텍처 (localStorage JSON 직렬화 & 불변 단방향 상태 동기화):
 *    - 현대 웹 ERP에서는 디스크 파일 direct 접근 대신 브라우저 보안 샌드박스가 제공하는 Web Storage API인 `localStorage`를 활용합니다.
 *    - 복잡한 다차원 검색 파라미터 객체(Dept, Status, SalesAmount, Keyword 등) 전체를 `JSON.stringify()`를 통해 단 하나의
 *      텍스트 스냅샷으로 원자적(Atomic) 직렬화하여 `'erp_search_presets'` 키에 저장합니다.
 *    - 저장된 프리셋을 불러올 때는 `JSON.parse()`로 역직렬화한 후, React의 단방향 데이터 흐름(Unidirectional Data Flow) 원칙에 따라
 *      상위 컨테이너로 `onRestorePreset(preset.query)` 콜백(Callback) 이벤트를 전출합니다.
 *    - 이를 통해 메인 데이터윈도우 그리드, 조회 조건 입력 필드, 검색 바 상태가 한꺼번에 불변성 스냅샷으로 동기화되어 즉시 복원됩니다.
 *
 * 표준 IPA 발음 기호 준수 가이드:
 *  - Preset ➔ [ˈpriːset]
 *  - Storage ➔ [ˈstɔːrɪdʒ]
 *  - Serialization ➔ [ˌsɪriəlaɪˈzeɪʃn]
 *  - Callback ➔ [ˈkɔːlbæk]
 *  - Snapshot ➔ [ˈsnæpʃɑːt]
 *  - Popover ➔ [ˈpɑːp.oʊvər]
 *  - LocalStorage ➔ [ˈloʊkl ˈstɔːrɪdʒ]
 * =========================================================================
 */

// 저장할 프리셋 객체의 데이터 구조 정의
export interface SearchQueryPreset {
  id: string;          // 프리셋 고유 타임스탬프 ID (예: preset-1721700000000)
  name: string;        // 프리셋 사용자 지정 별칭 (예: "영업팀 Open건 실적5만↑")
  createdAt: string;   // 생성 일시 (예: "2026-07-23 14:30")
  query: {             // 복원될 폼 파라미터 객체
    as_dept?: string;
    as_status?: string;
    an_sales?: string;
    keyword?: string;
    [key: string]: any;
  };
}

export interface SearchPresetProps {
  /** 현재 화면의 검색 파라미터 객체 스냅샷 */
  currentQuery: {
    as_dept?: string;
    as_status?: string;
    an_sales?: string;
    keyword?: string;
    [key: string]: any;
  };
  /** 사용자가 프리셋 선택 시 메인 그리드/조회바를 한 번에 복원할 상위 콜백 */
  onRestorePreset: (presetQuery: { [key: string]: any }) => void;
  /** 추가 컨테이너 스타일 클래스 */
  className?: string;
}

// localStorage 저장소 키 상수
const STORAGE_KEY = "erp_search_presets";

// 로컬스토리지 부재 시 부드럽게 대체할 초기 기본 예시 프리셋 데이터
const INITIAL_DEMO_PRESETS: SearchQueryPreset[] = [
  {
    id: "preset-demo-1",
    name: "영업팀 실적 5만 이상 (Closed)",
    createdAt: "2026-07-23 10:00",
    query: {
      as_dept: "영업팀",
      as_status: "Closed",
      an_sales: "50000",
    },
  },
  {
    id: "preset-demo-2",
    name: "개발팀 전체 조회 (Open)",
    createdAt: "2026-07-23 11:15",
    query: {
      as_dept: "개발팀",
      as_status: "Open",
      an_sales: "0",
    },
  },
];

export default function SearchPreset({
  currentQuery,
  onRestorePreset,
  className = "",
}: SearchPresetProps) {
  // 1. 저장된 프리셋 목록 상태
  const [presets, setPresets] = useState<SearchQueryPreset[]>([]);
  
  // 2. 미니 팝오버(Popover) 열림/닫힘 상태
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  // 3. 드롭다운 열림/닫힘 상태
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // 4. 별칭 등록 팝오버 입력 필드 상태
  const [presetNameInput, setPresetNameInput] = useState<string>("");

  // 5. 선택된 프리셋 식별 ID
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // 팝오버 및 드롭다운 외부 클릭 감지용 Ref
  const containerRef = useRef<HTMLDivElement>(null);

  // =========================================================================
  // [Day 56 작업] localStorage 데이터 로딩 및 예외 방어(Guard) 핸들러
  // =========================================================================
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
          // JSON 역직렬화 시 예외 방어 처리
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPresets(parsed);
          } else {
            // 로컬스토리지에 배열이 비어있으면 초기 기본 예시로 대체
            setPresets(INITIAL_DEMO_PRESETS);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_PRESETS));
          }
        } else {
          // 최초 데이터가 없을 경우 기본 데모 데이터 등록
          setPresets(INITIAL_DEMO_PRESETS);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_PRESETS));
        }
      }
    } catch (error) {
      // 로컬 스토리지 데이터 손상 또는 JSON 파싱 오류 시 부드럽게 기본 예시로 대체
      console.warn("[Day 56 SearchPreset] localStorage read error, falling back to initial defaults:", error);
      setPresets(INITIAL_DEMO_PRESETS);
    }
  }, []);

  // 외부 클릭 시 팝오버 및 드롭다운 닫기 핸들러
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // =========================================================================
  // [Day 56 작업] localStorage 신규 프리셋 저장 핸들러
  // =========================================================================
  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetNameInput.trim()) return;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newPreset: SearchQueryPreset = {
      id: `preset-${Date.now()}`,
      name: presetNameInput.trim(),
      createdAt: formattedDate,
      query: { ...currentQuery },
    };

    const updated = [newPreset, ...presets];
    setPresets(updated);
    setSelectedPresetId(newPreset.id);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("[Day 56 SearchPreset] localStorage write error:", err);
    }

    setPresetNameInput("");
    setIsPopoverOpen(false);
  };

  // =========================================================================
  // [Day 56 작업] 프리셋 선택 및 상위 onRestorePreset 복원 콜백 트리거
  // =========================================================================
  const handleSelectPreset = (preset: SearchQueryPreset) => {
    setSelectedPresetId(preset.id);
    setIsDropdownOpen(false);
    
    // 상위 메인 그리드 및 조회조건 바 복원 파이프라인 트리거
    if (onRestorePreset && preset.query) {
      onRestorePreset(preset.query);
    }
  };

  // =========================================================================
  // [Day 56 작업] 프리셋 삭제 및 localStorage 즉시 반영 핸들러
  // =========================================================================
  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 드롭다운 선택 이벤트 전파 방지

    const updated = presets.filter((p) => p.id !== id);
    setPresets(updated);

    if (selectedPresetId === id) {
      setSelectedPresetId("");
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("[Day 56 SearchPreset] localStorage delete error:", err);
    }
  };

  // 현재 선택된 프리셋 객체
  const activePreset = presets.find((p) => p.id === selectedPresetId);

  return (
    <div ref={containerRef} className={`relative flex items-center gap-2 font-mono text-xs ${className}`}>
      
      {/* 1. 프리셋 저장 버튼 [💾 현재 조건 저장] */}
      <button
        type="button"
        onClick={() => {
          setIsPopoverOpen(!isPopoverOpen);
          setIsDropdownOpen(false);
        }}
        className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-bold transition-all duration-200 shadow-[0_0_12px_rgba(0,240,255,0.15)] flex items-center gap-1.5 cursor-pointer shrink-0"
        title="현재 입력된 검색 파라미터를 브라우저 Web Storage(localStorage)에 스냅샷으로 저장합니다"
      >
        <span className="text-cyan-400">💾</span>
        <span>조건 저장</span>
      </button>

      {/* 2. 저장된 쿼리 목록 드롭다운 토글 버튼 */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsDropdownOpen(!isDropdownOpen);
            setIsPopoverOpen(false);
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 transition-all flex items-center justify-between gap-2.5 min-w-[210px] cursor-pointer shadow-inner"
        >
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0"></span>
            <span className="truncate text-slate-300 font-medium">
              {activePreset ? activePreset.name : "저장된 검색 조건 불러오기..."}
            </span>
          </div>
          <span className="text-slate-500 text-[10px]">▼</span>
        </button>

        {/* ================= 드롭다운 메뉴 (Custom Dropdown Menu) ================= */}
        {isDropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-80 rounded-xl bg-[#0b1021]/95 backdrop-blur-xl border border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-fade-in">
            {/* 드롭다운 헤더 */}
            <div className="px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                <span>📋</span> 저장된 쿼리 프리셋 목록 ({presets.length}건)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">localStorage</span>
            </div>

            {/* 프리셋 목록 영역 */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/50 scrollbar-thin scrollbar-thumb-slate-800">
              {presets.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-[11px]">
                  저장된 검색 조건이 없습니다.
                </div>
              ) : (
                presets.map((preset) => {
                  const isSelected = preset.id === selectedPresetId;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`group flex items-center justify-between px-3.5 py-2.5 text-xs transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-indigo-950/70 text-cyan-300 font-bold border-l-2 border-cyan-400"
                          : "hover:bg-slate-900/90 text-slate-300 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden pr-2">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{preset.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                          <span>부서: {preset.query.as_dept || "전체"}</span>
                          <span>상태: {preset.query.as_status || "전체"}</span>
                          {preset.query.an_sales && <span>실적: {preset.query.an_sales}만</span>}
                        </div>
                      </div>

                      {/* 조건 2: 각 프리셋 항목 옆 [✕] 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={(e) => handleDeletePreset(preset.id, e)}
                        title="프리셋 삭제"
                        className="p-1 rounded hover:bg-rose-950/80 hover:text-rose-400 text-slate-500 transition-colors shrink-0 cursor-pointer"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= 3. 별칭 등록 다크 네온 미니 팝오버 (Popover Layout) ================= */}
      {isPopoverOpen && (
        <div className="absolute left-0 top-full mt-2 w-84 p-4 rounded-2xl bg-[#0b1021]/95 backdrop-blur-2xl border border-cyan-500/40 shadow-[0_10px_35px_rgba(0,240,255,0.2)] z-50 animate-fade-in">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
              <span>💾</span> 검색 조건 프리셋 별칭 등록
            </h4>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="text-slate-500 hover:text-slate-300 text-xs font-bold"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSavePreset} className="space-y-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                프리셋 별칭 (Name):
              </label>
              <input
                type="text"
                autoFocus
                placeholder="예: 영업팀 Closed 실적 5만이상"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-400 focus:outline-none text-slate-100 text-xs font-mono placeholder:text-slate-600 transition-all"
              />
            </div>

            {/* 현재 저장될 쿼리 객체 스냅샷 미리보기 */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-900 text-[10px] space-y-1">
              <span className="text-purple-400 font-bold block">
                🔍 스냅샷 저장 파라미터 미리보기:
              </span>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400">
                <div>부서(as_dept): <span className="text-cyan-300">{currentQuery.as_dept || "전체"}</span></div>
                <div>상태(as_status): <span className="text-cyan-300">{currentQuery.as_status || "전체"}</span></div>
                <div>실적(an_sales): <span className="text-cyan-300">{currentQuery.an_sales || "0"}</span></div>
                {currentQuery.keyword && (
                  <div>검색어: <span className="text-cyan-300">{currentQuery.keyword}</span></div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsPopoverOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-medium border border-slate-800 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!presetNameInput.trim()}
                className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-colors shadow-[0_0_10px_rgba(0,240,255,0.4)]"
              >
                저장하기
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
