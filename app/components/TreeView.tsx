// [Day 53 작업] 그리드 연동형 동적 트리 뷰 내비게이션(Tree View Navigation) 독립 컴포넌트
// 레거시 파워빌더의 절차적 TreeView 컨트롤 방식을 현대 웹 표준 React 선언형 아키텍처로 완벽히 전환합니다.

"use client";

import React, { useState } from "react";

/**
 * [레거시 파워빌더 vs 현대 React의 TreeView 아키텍처 구조적 대비 해설]
 *
 * 1. 레거시 파워빌더 (메모리 포인터 핸들 기반 절차식 트리 제어):
 *    - 파워빌더 환경에서는 윈도우 컨트롤 오브젝트인 `TreeView` 내에 노드를 삽입할 때 `tv_1.InsertItemFirst(0, l_tvi)` 또는
 *      `tv_1.InsertItemLast(h_parent, l_tvi)`와 같은 API 함수를 사용했습니다.
 *    - 이 과정에서 각 노드(Node [noʊd])는 운영체제(OS) 수준에서 할당하는 고유한 `Long` 타입 핸들(Handle) 값을 반환받으며,
 *      특정 노드를 탐색하거나 확장할 때에도 이 핸들 값을 인자로 건네 `tv_1.ExpandItem(h_node)` 또는 `tv_1.FindItem(NavigationType, h_start)`을 호출해야 했습니다.
 *    - 데이터와 UI 렌더링이 강하게 결합되어 있어, 데이터 구조가 변경되면 루프를 돌며 직접 Insert/Delete 메서드를 다량 실행해야 했으므로
 *      메모리 누수 위험이 높았고 UI 일관성 관리가 매우 까다로웠습니다.
 *
 * 2. 현대 웹 표준 React 아키텍처 (선언형 가상 DOM 데이터 바인딩 및 재귀적 렌더링):
 *    - 현대적인 React 기반 시스템에서는 화면에 노출되는 트리 구조를 메모리 포인터 핸들이 아닌 독립된 계층형 JSON 객체 배열(Graph/Tree Data)로 추상화합니다.
 *    - 개발자는 데이터의 삽입/수정 시 윈도우 API를 직접 제어하지 않으며, 오직 데이터 모델(State [steɪt]) 자체만 갱신(setState)합니다.
 *    - 트리 컴포넌트는 해당 데이터 구조를 따라 선언적으로 자신을 스스로 호출하는 재귀 호출(Recursive Call [rɪˈkɜːrsɪv kɔːl]) 렌더링을 진행하며,
 *      가상 DOM(Virtual DOM) 알고리즘이 변경된 차이점만을 분석해 브라우저에 효율적으로 실시간 반영합니다.
 *    - 각 노드의 열림/닫힘 토글(Toggle [ˈtɑːɡl]) 여부 역시 `expandedNodeIds`라는 `Set` 객체 상태를 통해 선언형 가시성(Visibility) 제어로 통합 관리됩니다.
 *
 * 표준 IPA 발음 기호 준수 가이드:
 *  - 트리 뷰 ➔ [ˈtriːvjuː]
 *  - 재귀 호출 ➔ [rɪˈkɜːrsɪv kɔːl]
 *  - 상태 ➔ [steɪt]
 *  - 노드 ➔ [noʊd]
 *  - 토글 ➔ [ˈtɑːɡl]
 */

// 트리 노드 데이터 구조 정의
export interface TreeNodeData {
  id: string;
  label: string;
  type: "folder" | "file";
  iconType?: string; // 노드 고유 시각화 구분용
  children?: TreeNodeData[];
}

// 모의 데이터 (Mock Data) - 대형 ERP의 다차원 메뉴 체계 및 조직도 모델링
const MOCK_TREE_DATA: TreeNodeData[] = [
  {
    id: "1",
    label: "ERP 시스템 설정",
    type: "folder",
    children: [
      {
        id: "1-1",
        label: "사용자 및 권한 그룹 관리",
        type: "folder",
        children: [
          { id: "1-1-1", label: "접근 권한 템플릿 설정.cfg", type: "file" },
          { id: "1-1-2", label: "계정 잠금 및 보안 정책.json", type: "file" },
        ],
      },
      { id: "1-2", label: "다차원 공통 코드 원장", type: "file" },
      { id: "1-3", label: "시스템 접속 감사 이력", type: "file" },
    ],
  },
  {
    id: "2",
    label: "재무 및 관리 회계 모듈",
    type: "folder",
    children: [
      {
        id: "2-1",
        label: "전표 및 일반 분개장",
        type: "folder",
        children: [
          { id: "2-1-1", label: "전표 자동 승인 규칙 정의.xml", type: "file" },
          { id: "2-1-2", label: "일일 자금 결산서 내역.xlsx", type: "file" },
        ],
      },
      { id: "2-2", label: "고정 자산 감가상각 대장", type: "file" },
      { id: "2-3", label: "연간 연결 재무제표 보고서", type: "file" },
    ],
  },
  {
    id: "3",
    label: "인사 및 급여 총무 시스템",
    type: "folder",
    children: [
      { id: "3-1", label: "부서별 정원 T/O 관리", type: "file" },
      { id: "3-2", label: "임직원 연말정산 시뮬레이터", type: "file" },
    ],
  },
];

export interface TreeViewProps {
  /** 외부 그리드 컴포넌트와의 데이터 연동을 위한 노드 선택 콜백 */
  onNodeSelect?: (node: TreeNodeData) => void;
}

export default function TreeView({ onNodeSelect }: TreeViewProps) {
  // 1. 상태(State [steɪt]) 정의
  // 열려있는 폴더형 노드들의 ID를 관리하는 Set 객체 상태
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    new Set(["1", "2"]) // 초기 상태로 상위 1, 2번 폴더를 열어둠
  );
  // 현재 마우스로 선택된 최하위 잎새 노드(Leaf Node [noʊd])의 정보 상태
  const [selectedNode, setSelectedNode] = useState<TreeNodeData | null>(null);

  // [Day 53 작업] expandedNodeIds 토글(Toggle [ˈtɑːɡl]) 이벤트 핸들러 블록
  // 파워빌더의 tv_1.ExpandItem() / tv_1.CollapseItem() 함수 기능을 대체하여 React State의 불변성을 유지하며 갱신합니다.
  const handleToggleFolder = (nodeId: string) => {
    setExpandedNodeIds((prevExpanded) => {
      const nextExpanded = new Set(prevExpanded);
      if (nextExpanded.has(nodeId)) {
        nextExpanded.delete(nodeId);
      } else {
        nextExpanded.add(nodeId);
      }
      return nextExpanded;
    });
  };

  // 잎새 노드 클릭 시 데이터 캡처 및 선택 처리 핸들러
  const handleSelectLeafNode = (node: TreeNodeData) => {
    setSelectedNode(node);
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  // 모든 폴더를 한 번에 열거나 닫는 유틸리티
  const handleExpandAll = (expand: boolean) => {
    if (expand) {
      const allFolderIds: string[] = [];
      const traverse = (nodes: TreeNodeData[]) => {
        nodes.forEach((n) => {
          if (n.type === "folder") {
            allFolderIds.push(n.id);
            if (n.children) traverse(n.children);
          }
        });
      };
      traverse(MOCK_TREE_DATA);
      setExpandedNodeIds(new Set(allFolderIds));
    } else {
      setExpandedNodeIds(new Set());
    }
  };

  // [Day 53 작업] 재귀 렌더링 서브 루프 컴포넌트 정의
  // 깊이(Depth) 제한 없이 계층 구조 데이터를 재귀 호출([rɪˈkɜːrsɪv kɔːl])하여 가상 DOM에 그립니다.
  const renderTreeNodes = (nodes: TreeNodeData[], depth: number = 0) => {
    return nodes.map((node) => {
      const isFolder = node.type === "folder";
      const isExpanded = expandedNodeIds.has(node.id);
      const isSelected = selectedNode?.id === node.id;

      return (
        <div key={node.id} className="select-none">
          {/* 노드 한 행을 나타내는 컴포넌트 */}
          <div
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            className={`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-all duration-150 ${
              isSelected
                ? "bg-indigo-950/60 border-l-2 border-cyan-400 text-cyan-300 shadow-[inset_0_0_8px_rgba(6,182,212,0.15)]"
                : "text-slate-300 hover:bg-slate-900/60 hover:text-slate-100"
            }`}
            onClick={() => {
              if (isFolder) {
                handleToggleFolder(node.id);
              } else {
                handleSelectLeafNode(node);
              }
            }}
          >
            {/* 1. 폴더 화살표 아이콘 (토글 스위치 역할) */}
            {isFolder ? (
              <span
                className={`transition-transform duration-200 ${
                  isExpanded ? "rotate-90 text-cyan-400" : "rotate-0 text-slate-500"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            ) : (
              <span className="w-3.5" /> // 잎새 노드 정렬용 공백
            )}

            {/* 2. 노드 타입별 맞춤형 네온 아이콘 (Folder/File) */}
            <span>
              {isFolder ? (
                isExpanded ? (
                  // 열린 폴더 아이콘 (다크 네온 퍼플 광선)
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#bd00ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_4px_rgba(189,0,255,0.7)]"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  // 닫힌 폴더 아이콘
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                )
              ) : (
                // 잎새 노드(파일) 아이콘 (다크 네온 사이안 광선)
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={isSelected ? "#00f0ff" : "#94a3b8"}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isSelected ? "drop-shadow-[0_0_4px_rgba(0,240,255,0.8)]" : ""}
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
            </span>

            {/* 3. 노드 라벨 텍스트 */}
            <span
              className={`text-xs font-medium tracking-wide ${
                isSelected
                  ? "text-cyan-300 font-bold drop-shadow-[0_0_6px_rgba(0,240,255,0.4)]"
                  : isFolder
                  ? "text-slate-200"
                  : "text-slate-400"
              }`}
            >
              {node.label}
            </span>
          </div>

          {/* 4. 자식 노드가 존재하고 폴더가 확장된 상태일 경우에만 재귀 호출([rɪˈkɜːrsɪv kɔːl]) 실행 */}
          {isFolder && isExpanded && node.children && (
            <div className="relative mt-0.5">
              {/* 계층구조 선 연결선 디자인 */}
              <div
                style={{ left: `${depth * 16 + 14}px` }}
                className="absolute top-0 bottom-1.5 w-[1px] bg-indigo-950/40 border-l border-dashed border-indigo-900/30"
              />
              {renderTreeNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="w-full max-w-md p-5 rounded-xl bg-slate-950 border border-slate-900 shadow-[0_4px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
      {/* 컴포넌트 헤더 */}
      <div className="flex items-center justify-between border-b border-indigo-950/40 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <h2 className="text-sm font-bold text-slate-100 tracking-wider">
            다차원 네비게이션 트리 (Tree [ˈtriːvjuː])
          </h2>
        </div>
        <div className="text-[10px] font-mono text-slate-500">
          <span>PB Web-Bridge Navigation v1.53</span>
        </div>
      </div>

      {/* 일괄 확장/축소 도구 모음 */}
      <div className="flex justify-between items-center gap-2 mb-3 bg-slate-900/30 p-2 rounded-lg border border-indigo-950/20">
        <span className="text-[10px] font-mono font-bold text-indigo-400">
          열린 폴더 개수: {expandedNodeIds.size}개
        </span>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleExpandAll(true)}
            className="text-[9px] font-bold px-2 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-900 hover:bg-indigo-900 hover:text-indigo-100 transition-all cursor-pointer"
          >
            전체 확장
          </button>
          <button
            onClick={() => handleExpandAll(false)}
            className="text-[9px] font-bold px-2 py-1 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-900 hover:bg-indigo-900 hover:text-indigo-100 transition-all cursor-pointer"
          >
            전체 축소
          </button>
        </div>
      </div>

      {/* 트리 노드 재귀 렌더링 컨테이너 */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-indigo-950">
        {renderTreeNodes(MOCK_TREE_DATA)}
      </div>

      {/* 상태 캡처 결과물 피드백 바인딩 영역 */}
      <div className="mt-4 pt-3 border-t border-indigo-950/20">
        <span className="text-[10.5px] font-bold text-slate-400 font-mono mb-1.5 block">
          실시간 런타임 이벤트 바인딩 캡처
        </span>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-indigo-950/40 min-h-[50px] flex items-center justify-center">
          {selectedNode ? (
            <div className="w-full text-center">
              <p className="text-xs text-slate-400 font-medium">
                현재 선택된 메뉴:{" "}
                <span className="text-cyan-300 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 drop-shadow-[0_0_5px_rgba(0,240,255,0.2)]">
                  {selectedNode.label}
                </span>
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                ID: {selectedNode.id} | Type: {selectedNode.type}
              </p>
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium italic animate-pulse">
              하단 파일(Leaf Node [noʊd])을 선택해 주세요.
            </span>
          )}
        </div>
      </div>

      {/* 레거시 개발자용 팁 */}
      <div className="mt-4 bg-slate-900/30 border border-indigo-950/20 rounded-md p-3 text-[10px] leading-relaxed text-slate-400 font-mono">
        <p className="text-purple-400 font-bold mb-1">💡 레거시 Pointer 탐색 vs 선언형 State 매칭</p>
        <p>
          파워빌더의 `FindItem()` 함수로 메모리 핸들 주소를 매번 조회하는 방식 대신, 컴포넌트 렌더링 루프 시
          `expandedNodeIds.has(node.id)` 여부로 자식 요소를 마운트/디스마운트하는 선언적 구조를 지닙니다.
        </p>
      </div>
    </div>
  );
}
