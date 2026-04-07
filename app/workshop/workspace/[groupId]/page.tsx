"use client";

import "reactflow/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "dagre";
import { toPng } from "html-to-image";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type NodeProps,
  type Edge,
  type Node,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
} from "reactflow";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { workshopDb } from "@/lib/firebaseWorkshop";
import {
  WORKSHOP_GROUP_MAP,
  normalizeWorkshopGroupId,
  type WorkshopGroupId,
} from "@/app/workshop/_lib/workshopGroups";

type IdeaDoc = {
  id: string;
  type: "sticky" | "draw";
  companyName: string;
  studentName: string;
  ideaText: string;
  color?: string | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  pathData?: string | null;
  strokeWidth?: number | null;
  strokeColor?: string | null;
  strokeStyle?: "solid" | "dashed" | "dotted";
  opacity?: number | null;
  createdAtMs: number;
};

type EdgeThickness = "thin" | "medium" | "thick";
type EdgeDash = "solid" | "dashed" | "dotted";
type LayoutKind = "TB" | "LR" | "RL" | "BT" | "RADIAL";
type DrawMode = "none" | "pen" | "highlighter";

type BudgetRow = {
  id: string;
  category: string;
  subsidy: number;
  matching: number;
};

const NODE_W = 260;
const NODE_H = 140;
const STICKY_COLORS_10 = [
  "#fee2e2",
  "#ffedd5",
  "#fef3c7",
  "#ecfccb",
  "#dcfce7",
  "#ccfbf1",
  "#dbeafe",
  "#e0e7ff",
  "#ede9fe",
  "#fce7f3",
];
const TOOL_COLORS_16 = [
  "#fecaca",
  "#fed7aa",
  "#fde68a",
  "#bef264",
  "#bbf7d0",
  "#99f6e4",
  "#bae6fd",
  "#bfdbfe",
  "#c7d2fe",
  "#ddd6fe",
  "#fbcfe8",
  "#fda4af",
  "#fdba74",
  "#86efac",
  "#67e8f9",
  "#a5b4fc",
];
const HIGHLIGHT_COLORS = ["#fde047", "#86efac", "#67e8f9", "#f9a8d4"];
const ACCOUNTING_OPTIONS = [
  "人事費-研發人員",
  "人事費-國際研發人員",
  "人事費-顧問",
  "消耗性器材及原材料費",
  "研發設備使用費",
  "研發設備維護費",
  "技術引進及委託研究費-技術或智慧財產權購買費",
  "技術引進及委託研究費-委託研究費",
  "技術引進及委託研究費-委託勞務費",
  "技術引進及委託研究費-委託設計費",
];

function getStrokeWidth(v: EdgeThickness): number {
  if (v === "thick") return 3;
  if (v === "medium") return 2;
  return 1;
}

function getDashArray(v: EdgeDash): string | undefined {
  if (v === "dashed") return "6 4";
  if (v === "dotted") return "2 6";
  return undefined;
}

function buildStickyNode(docRow: IdeaDoc, idx: number, selectedId: string | null): Node {
  return {
    id: docRow.id,
    type: "sticky",
    position: {
      x: typeof docRow.x === "number" ? docRow.x : 120 + (idx % 4) * 280,
      y: typeof docRow.y === "number" ? docRow.y : 120 + Math.floor(idx / 4) * 180,
    },
    data: {
      companyName: docRow.companyName,
      studentName: docRow.studentName,
      ideaText: docRow.ideaText,
      color: docRow.color || STICKY_COLORS_10[idx % STICKY_COLORS_10.length],
      showTools: selectedId === docRow.id,
    },
    style: { width: NODE_W, border: "1px solid #fcd34d", borderRadius: 12 },
  };
}

function buildDrawNode(docRow: IdeaDoc, idx: number): Node {
  const width = typeof docRow.width === "number" ? docRow.width : 220;
  const height = typeof docRow.height === "number" ? docRow.height : 140;
  return {
    id: docRow.id,
    type: "draw",
    position: {
      x: typeof docRow.x === "number" ? docRow.x : 180 + idx * 20,
      y: typeof docRow.y === "number" ? docRow.y : 220 + idx * 20,
    },
    data: {
      pathData: docRow.pathData || "",
      strokeColor: docRow.strokeColor || "#0f172a",
      strokeWidth: docRow.strokeWidth || 3,
      strokeStyle: docRow.strokeStyle || "solid",
      opacity: typeof docRow.opacity === "number" ? docRow.opacity : 1,
    },
    draggable: true,
    style: {
      width,
      height,
      border: "none",
      background: "transparent",
    },
  };
}

function buildDefaultEdges(nodes: Node[]): Edge[] {
  if (nodes.length <= 1) return [];
  return nodes.slice(1).map((n, i) => ({
    id: `e-${nodes[0].id}-${n.id}-${i}`,
    source: nodes[0].id,
    target: n.id,
    animated: false,
    type: "smoothstep",
  }));
}

function autoLayoutDagre(nodes: Node[], rankdir: "TB" | "LR" | "RL" | "BT"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir, nodesep: 30, ranksep: 70, marginx: 24, marginy: 24 });

  nodes.forEach((node) => g.setNode(node.id, { width: NODE_W, height: NODE_H }));
  const edges = buildDefaultEdges(nodes);
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));

  dagre.layout(g);

  return nodes.map((node) => {
    const p = g.node(node.id);
    return {
      ...node,
      position: {
        x: p.x - NODE_W / 2,
        y: p.y - NODE_H / 2,
      },
    };
  });
}

function autoLayoutRadial(nodes: Node[]): Node[] {
  if (nodes.length <= 1) return nodes;
  const [root, ...rest] = nodes;
  const cx = 420;
  const cy = 320;
  const radius = Math.max(220, Math.min(520, rest.length * 42));
  const angleStep = (Math.PI * 2) / rest.length;
  return [
    { ...root, position: { x: cx - NODE_W / 2, y: cy - NODE_H / 2 } },
    ...rest.map((n, i) => ({
      ...n,
      position: {
        x: cx + Math.cos(i * angleStep) * radius - NODE_W / 2,
        y: cy + Math.sin(i * angleStep) * radius - NODE_H / 2,
      },
    })),
  ];
}

function StickyNodeRenderer({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow();
  const companyName = String(data.companyName || "");
  const studentName = String(data.studentName || "");
  const ideaText = String(data.ideaText || "");
  const color = String(data.color || "#fef3c7");
  const showTools = Boolean(data.showTools);

  async function updateColor(next: string) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, color: next } } : n)));
    await updateDoc(doc(workshopDb, "workshop_ideas", id), {
      color: next,
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }

  async function removeSelf() {
    await deleteDoc(doc(workshopDb, "workshop_ideas", id)).catch(() => undefined);
  }

  return (
    <div className="relative rounded-lg border border-amber-300 p-3 shadow-sm" style={{ backgroundColor: color }}>
      {showTools ? (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white/90 p-1">
          {STICKY_COLORS_10.map((c) => (
            <button
              key={`${id}-${c}`}
              type="button"
              title="節點顏色"
              onClick={() => void updateColor(c)}
              className="h-4 w-4 rounded-full border border-slate-300"
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            title="刪除節點"
            onClick={() => void removeSelf()}
            className="ml-1 rounded border border-red-300 bg-red-50 px-1.5 text-[10px] text-red-700"
          >
            🗑️
          </button>
        </div>
      ) : null}
      <p className="text-xs font-semibold text-amber-900">
        {companyName} · {studentName}
      </p>
      <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-slate-800">{ideaText}</p>
    </div>
  );
}

function DrawNodeRenderer({ data }: NodeProps) {
  const width = 240;
  const height = 160;
  const dashArray = getDashArray((data.strokeStyle as EdgeDash) || "solid");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={String(data.pathData || "")}
        fill="none"
        stroke={String(data.strokeColor || "#0f172a")}
        strokeWidth={Number(data.strokeWidth || 3)}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={Number(data.opacity || 1)}
      />
    </svg>
  );
}

function WorkspacePageInner() {
  const params = useParams<{ groupId: string }>();
  const groupId = normalizeWorkshopGroupId(params?.groupId);
  const group = groupId ? WORKSHOP_GROUP_MAP[groupId] : null;
  const rf = useReactFlow();

  const [planTitle, setPlanTitle] = useState("未命名計畫");
  const [boardStatus, setBoardStatus] = useState<"草案中" | "定稿">("草案中");
  const [ideas, setIdeas] = useState<IdeaDoc[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutMode, setLayoutMode] = useState<LayoutKind>("TB");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [edgeThickness, setEdgeThickness] = useState<EdgeThickness>("medium");
  const [edgeDash, setEdgeDash] = useState<EdgeDash>("solid");
  const [edgeArrow, setEdgeArrow] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [noteColor, setNoteColor] = useState(TOOL_COLORS_16[0]);
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [drawColor, setDrawColor] = useState("#0f172a");
  const [drawSize, setDrawSize] = useState(4);
  const [drawStyle, setDrawStyle] = useState<EdgeDash>("solid");
  const [drawingPath, setDrawingPath] = useState("");
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([
    { id: crypto.randomUUID(), category: ACCOUNTING_OPTIONS[0], subsidy: 0, matching: 0 },
  ]);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [savingMsg, setSavingMsg] = useState("");
  const captureRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(
    () => ({
      sticky: StickyNodeRenderer,
      draw: DrawNodeRenderer,
    }),
    [],
  );

  useEffect(() => {
    if (!groupId) return;
    const qIdeas = query(collection(workshopDb, "workshop_ideas"), where("groupId", "==", groupId));
    const un = onSnapshot(qIdeas, (snap) => {
      const rows = snap.docs
        .map((d) => {
          const x = d.data() as DocumentData;
          const ts = x.createdAt?.toMillis?.();
          return {
            id: d.id,
            type: x.type === "draw" ? "draw" : "sticky",
            companyName: String(x.companyName || ""),
            studentName: String(x.studentName || ""),
            ideaText: String(x.ideaText || ""),
            color: typeof x.color === "string" ? x.color : null,
            x: typeof x.x === "number" ? x.x : null,
            y: typeof x.y === "number" ? x.y : null,
            width: typeof x.width === "number" ? x.width : null,
            height: typeof x.height === "number" ? x.height : null,
            pathData: typeof x.pathData === "string" ? x.pathData : null,
            strokeWidth: typeof x.strokeWidth === "number" ? x.strokeWidth : null,
            strokeColor: typeof x.strokeColor === "string" ? x.strokeColor : null,
            strokeStyle:
              x.strokeStyle === "dashed" || x.strokeStyle === "dotted" || x.strokeStyle === "solid"
                ? x.strokeStyle
                : "solid",
            opacity: typeof x.opacity === "number" ? x.opacity : null,
            createdAtMs: typeof ts === "number" ? ts : 0,
          } satisfies IdeaDoc;
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id));
      setIdeas(rows);
      const nextNodes = rows.map((r, idx) =>
        r.type === "draw" ? buildDrawNode(r, idx) : buildStickyNode(r, idx, selectedNodeId),
      );
      setNodes(nextNodes);
      setEdges((prev) => (prev.length > 0 ? prev : buildDefaultEdges(nextNodes)));
    });
    return () => un();
  }, [groupId, selectedNodeId]);

  useEffect(() => {
    if (!groupId) return;
    const boardRef = doc(workshopDb, "workshop_boards", groupId);
    const un = onSnapshot(boardRef, (snap) => {
      if (!snap.exists()) return;
      const x = snap.data() as Record<string, unknown>;
      if (typeof x.planTitle === "string" && x.planTitle.trim()) setPlanTitle(x.planTitle);
      if (x.status === "草案中" || x.status === "定稿") setBoardStatus(x.status);
      if (Array.isArray(x.budgetRows)) {
        const rows = (x.budgetRows as unknown[])
          .map((r) => {
            const row = r as Record<string, unknown>;
            return {
              id: String(row.id || crypto.randomUUID()),
              category: String(row.category || ACCOUNTING_OPTIONS[0]),
              subsidy: Number(row.subsidy || 0),
              matching: Number(row.matching || 0),
            } satisfies BudgetRow;
          })
          .filter((r) => Number.isFinite(r.subsidy) && Number.isFinite(r.matching));
        if (rows.length > 0) setBudgetRows(rows);
      }
    });
    return () => un();
  }, [groupId]);

  const memberList = useMemo(() => {
    const m = new Map<string, string>();
    ideas.forEach((row) => {
      if (row.type !== "sticky") return;
      const key = `${row.companyName}|${row.studentName}`.trim();
      if (!key || m.has(key)) return;
      m.set(key, `${row.companyName}／${row.studentName}`);
    });
    return [...m.values()];
  }, [ideas]);

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    const selectedChange = changes.find((c) => c.type === "select");
    if (selectedChange && "selected" in selectedChange) {
      setSelectedNodeId(selectedChange.selected ? selectedChange.id : null);
    }
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);
  const onConnect = useCallback((conn: Connection) => {
    const style = {
      strokeWidth: getStrokeWidth(edgeThickness),
      strokeDasharray: getDashArray(edgeDash),
    };
    setEdges((es) =>
      addEdge(
        {
          ...conn,
          animated: false,
          type: "smoothstep",
          style,
          markerEnd: edgeArrow ? { type: MarkerType.ArrowClosed } : undefined,
        },
        es,
      ),
    );
  }, [edgeArrow, edgeDash, edgeThickness]);

  const onNodeDragStop = useCallback(async (_: unknown, node: Node) => {
    try {
      await updateDoc(doc(workshopDb, "workshop_ideas", node.id), {
        x: node.position.x,
        y: node.position.y,
        updatedAt: serverTimestamp(),
      });
    } catch {
      // drag sync fail should not block UI
    }
  }, []);

  async function handleAutoLayout() {
    const stickyNodes = nodes.filter((n) => n.type !== "draw");
    const drawNodes = nodes.filter((n) => n.type === "draw");
    const laidSticky =
      layoutMode === "RADIAL"
        ? autoLayoutRadial(stickyNodes)
        : autoLayoutDagre(stickyNodes, layoutMode as "TB" | "LR" | "RL" | "BT");
    const laid = [...laidSticky, ...drawNodes];
    setNodes(laid);
    setEdges(buildDefaultEdges(laidSticky));
    await Promise.all(
      laidSticky.map((n) =>
        updateDoc(doc(workshopDb, "workshop_ideas", n.id), {
          x: n.position.x,
          y: n.position.y,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined),
      ),
    );
  }

  async function handleSaveBoard() {
    if (!groupId || !group) return;
    await setDoc(
      doc(workshopDb, "workshop_boards", groupId),
      {
        groupId,
        teacherName: group.teacher,
        planTitle: planTitle.trim() || "未命名計畫",
        status: boardStatus,
        memberCount: memberList.length,
        budgetRows,
        budgetSummary: {
          totalSubsidy: budgetRows.reduce((sum, r) => sum + (Number(r.subsidy) || 0), 0),
          totalMatching: budgetRows.reduce((sum, r) => sum + (Number(r.matching) || 0), 0),
          total: budgetRows.reduce((sum, r) => sum + (Number(r.subsidy) || 0) + (Number(r.matching) || 0), 0),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setSavingMsg("已儲存至平台");
    setTimeout(() => setSavingMsg(""), 1800);
  }

  async function handleDownloadPng() {
    if (!captureRef.current) return;
    const dataUrl = await toPng(captureRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f8fafc",
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${groupId || "group"}-${planTitle || "plan"}.png`;
    a.click();
  }

  async function handleAddStickyNote() {
    if (!groupId || !group) return;
    const text = noteText.trim();
    if (!text) return;
    const center = flowRef.current?.getViewport?.() ? rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 260, y: 260 };
    await addDoc(collection(workshopDb, "workshop_ideas"), {
      groupId,
      teacherName: group.teacher,
      companyName: "便利貼",
      studentName: "操作員",
      ideaText: text,
      color: noteColor,
      type: "sticky",
      x: center.x,
      y: center.y,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNoteText("");
  }

  async function handleDeleteSelected() {
    const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
    if (selectedIds.length === 0) return;
    await Promise.all(selectedIds.map((id) => deleteDoc(doc(workshopDb, "workshop_ideas", id)).catch(() => undefined)));
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        void handleDeleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function toRelativePath(points: { x: number; y: number }[], left: number, top: number): string {
    if (points.length === 0) return "";
    const p0 = points[0];
    const cmds = [`M ${p0.x - left} ${p0.y - top}`];
    for (let i = 1; i < points.length; i += 1) cmds.push(`L ${points[i].x - left} ${points[i].y - top}`);
    return cmds.join(" ");
  }

  async function saveDrawPath(path: string, bounds: { minX: number; minY: number; maxX: number; maxY: number }) {
    if (!groupId || !group || !path) return;
    await addDoc(collection(workshopDb, "workshop_ideas"), {
      groupId,
      teacherName: group.teacher,
      companyName: "畫筆軌跡",
      studentName: "操作員",
      ideaText: drawMode === "highlighter" ? "螢光筆" : "畫筆",
      type: "draw",
      x: bounds.minX,
      y: bounds.minY,
      width: Math.max(30, bounds.maxX - bounds.minX + 16),
      height: Math.max(30, bounds.maxY - bounds.minY + 16),
      pathData: path,
      strokeColor: drawColor,
      strokeWidth: drawMode === "highlighter" ? Math.max(drawSize, 10) : drawSize,
      strokeStyle: drawStyle,
      opacity: drawMode === "highlighter" ? 0.35 : 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function handleBudgetSave() {
    if (!groupId || !group) return;
    setBudgetSaving(true);
    await setDoc(
      doc(workshopDb, "workshop_boards", groupId),
      {
        groupId,
        teacherName: group.teacher,
        planTitle: planTitle.trim() || "未命名計畫",
        status: boardStatus,
        budgetRows,
        budgetSummary: {
          totalSubsidy: budgetRows.reduce((sum, r) => sum + (Number(r.subsidy) || 0), 0),
          totalMatching: budgetRows.reduce((sum, r) => sum + (Number(r.matching) || 0), 0),
          total: budgetRows.reduce((sum, r) => sum + (Number(r.subsidy) || 0) + (Number(r.matching) || 0), 0),
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setBudgetSaving(false);
    setSavingMsg("已儲存預算");
    setTimeout(() => setSavingMsg(""), 1800);
  }

  if (!groupId || !group) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-8 text-slate-700">
        無效組別，請使用 `/workshop/workspace/A|B|C`
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-slate-100">
      <div ref={captureRef} className="flex h-full flex-col">
        <header className="border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900">115年基隆市地方型SBIR撰寫工作坊</h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {group.label} · {group.teacher}
            </span>
            {savingMsg ? <span className="text-xs text-emerald-700">{savingMsg}</span> : null}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <label className="text-sm text-slate-700">
              該組計畫名稱
              <input
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="text-sm text-slate-700">
              組員名單（自動抓取）
              <div className="mt-1 max-h-20 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                {memberList.length > 0 ? memberList.join("、") : "尚無成員資料"}
              </div>
            </div>
          </div>
        </header>

        <section className="relative flex-1">
          {drawMode !== "none" ? (
            <DrawOverlay
              reactFlow={rf}
              mode={drawMode}
              color={drawColor}
              widthPx={drawMode === "highlighter" ? Math.max(drawSize, 10) : drawSize}
              dash={drawStyle}
              onFinish={(path, bounds) => void saveDrawPath(path, bounds)}
              onPreviewPath={setDrawingPath}
              onStart={setDrawingStart}
            />
          ) : null}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            onInit={(ins) => {
              flowRef.current = ins;
            }}
            fitView
          >
            <Background gap={20} />
            <MiniMap />
            <Controls />
            <Panel position="top-right">
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <label className="text-xs text-slate-600">
                  心智圖結構選擇
                  <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as LayoutKind)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="TB">樹狀圖（上到下）</option>
                    <option value="LR">組織圖（左到右）</option>
                    <option value="RL">樹狀圖（右到左）</option>
                    <option value="BT">樹狀圖（下到上）</option>
                    <option value="RADIAL">環狀／放射狀圖（Radial）</option>
                  </select>
                </label>
                <button onClick={handleAutoLayout} className="rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white">
                  套用排列
                </button>
                <label className="text-xs text-slate-600">
                  連線粗細
                  <select
                    value={edgeThickness}
                    onChange={(e) => setEdgeThickness(e.target.value as EdgeThickness)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="thick">粗</option>
                    <option value="medium">中</option>
                    <option value="thin">細</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  連線樣式
                  <select
                    value={edgeDash}
                    onChange={(e) => setEdgeDash(e.target.value as EdgeDash)}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="solid">實線</option>
                    <option value="dashed">虛線</option>
                    <option value="dotted">點狀線</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={edgeArrow} onChange={(e) => setEdgeArrow(e.target.checked)} />
                  箭頭（開啟/關閉）
                </label>
                <label className="text-xs text-slate-600">
                  版面狀態
                  <select
                    value={boardStatus}
                    onChange={(e) => setBoardStatus(e.target.value as "草案中" | "定稿")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option>草案中</option>
                    <option>定稿</option>
                  </select>
                </label>
                <button onClick={handleSaveBoard} className="rounded-md bg-blue-600 px-2 py-1.5 text-xs text-white">
                  儲存至平台
                </button>
                <button
                  onClick={handleDownloadPng}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                >
                  下載圖檔
                </button>
              </div>
            </Panel>
            <Panel position="bottom-right">
              <div className="w-72 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-700">手動工具箱</p>
                <textarea
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="新增便利貼內容"
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
                <div className="flex flex-wrap gap-1">
                  {TOOL_COLORS_16.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNoteColor(c)}
                      className={`h-4 w-4 rounded-full border ${noteColor === c ? "border-slate-900" : "border-slate-300"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button onClick={() => void handleAddStickyNote()} className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white">
                  新增便利貼
                </button>
                <div className="border-t border-slate-200 pt-2">
                  <p className="text-xs text-slate-600">畫筆／螢光筆</p>
                  <div className="mt-1 flex gap-1">
                    <button
                      onClick={() => setDrawMode((m) => (m === "pen" ? "none" : "pen"))}
                      className={`rounded-md px-2 py-1 text-xs ${drawMode === "pen" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      畫筆模式
                    </button>
                    <button
                      onClick={() => setDrawMode((m) => (m === "highlighter" ? "none" : "highlighter"))}
                      className={`rounded-md px-2 py-1 text-xs ${drawMode === "highlighter" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      螢光筆模式
                    </button>
                  </div>
                  {drawMode !== "none" ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1">
                        {(drawMode === "highlighter" ? HIGHLIGHT_COLORS : TOOL_COLORS_16).map((c) => (
                          <button
                            key={`draw-${c}`}
                            onClick={() => setDrawColor(c)}
                            className="h-4 w-4 rounded-full border border-slate-300"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={1}
                          max={16}
                          value={drawSize}
                          onChange={(e) => setDrawSize(Number(e.target.value))}
                        />
                        <select
                          value={drawStyle}
                          onChange={(e) => setDrawStyle(e.target.value as EdgeDash)}
                          className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                        >
                          <option value="solid">實線</option>
                          <option value="dashed">虛線</option>
                          <option value="dotted">點狀線</option>
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Panel>
          </ReactFlow>
          {drawingPath && drawingStart ? (
            <svg className="pointer-events-none absolute inset-0 z-20">
              <path
                d={drawingPath}
                fill="none"
                stroke={drawColor}
                strokeWidth={drawMode === "highlighter" ? Math.max(drawSize, 10) : drawSize}
                strokeDasharray={getDashArray(drawStyle)}
                opacity={drawMode === "highlighter" ? 0.35 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
          <div className="absolute left-3 top-3 z-30 w-96 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <button
              onClick={() => setBudgetOpen((v) => !v)}
              className="w-full rounded-md bg-slate-100 px-2 py-1 text-left text-sm font-medium text-slate-700"
            >
              {budgetOpen ? "▼" : "▶"} 預算試算區塊
            </button>
            {budgetOpen ? (
              <div className="mt-2 space-y-2">
                {budgetRows.map((row) => {
                  const subtotal = (Number(row.subsidy) || 0) + (Number(row.matching) || 0);
                  return (
                    <div key={row.id} className="grid grid-cols-[1fr_80px_80px_80px_26px] gap-1 text-xs">
                      <select
                        value={row.category}
                        onChange={(e) =>
                          setBudgetRows((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)),
                          )
                        }
                        className="rounded border border-slate-200 px-1 py-1"
                      >
                        {ACCOUNTING_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={row.subsidy}
                        onChange={(e) =>
                          setBudgetRows((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, subsidy: Number(e.target.value || 0) } : r)),
                          )
                        }
                        className="rounded border border-slate-200 px-1 py-1"
                      />
                      <input
                        type="number"
                        value={row.matching}
                        onChange={(e) =>
                          setBudgetRows((rows) =>
                            rows.map((r) => (r.id === row.id ? { ...r, matching: Number(e.target.value || 0) } : r)),
                          )
                        }
                        className="rounded border border-slate-200 px-1 py-1"
                      />
                      <input readOnly value={subtotal} className="rounded border border-slate-200 bg-slate-50 px-1 py-1" />
                      <button
                        onClick={() => setBudgetRows((rows) => rows.filter((r) => r.id !== row.id))}
                        className="rounded bg-red-50 text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setBudgetRows((rows) => [
                        ...rows,
                        { id: crypto.randomUUID(), category: ACCOUNTING_OPTIONS[0], subsidy: 0, matching: 0 },
                      ])
                    }
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    + 新增列
                  </button>
                  <button
                    onClick={() => void handleBudgetSave()}
                    disabled={budgetSaving}
                    className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    {budgetSaving ? "儲存中..." : "儲存預算"}
                  </button>
                </div>
                <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <div>總補助款：{budgetRows.reduce((s, r) => s + (Number(r.subsidy) || 0), 0)}</div>
                  <div>總配合款：{budgetRows.reduce((s, r) => s + (Number(r.matching) || 0), 0)}</div>
                  <div className="font-semibold">
                    計畫總經費：
                    {budgetRows.reduce((s, r) => s + (Number(r.subsidy) || 0) + (Number(r.matching) || 0), 0)}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function DrawOverlay({
  reactFlow,
  mode,
  color,
  widthPx,
  dash,
  onFinish,
  onPreviewPath,
  onStart,
}: {
  reactFlow: ReactFlowInstance;
  mode: DrawMode;
  color: string;
  widthPx: number;
  dash: EdgeDash;
  onFinish: (path: string, bounds: { minX: number; minY: number; maxX: number; maxY: number }) => void;
  onPreviewPath: (path: string) => void;
  onStart: (p: { x: number; y: number } | null) => void;
}) {
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const drawingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    drawingRef.current = true;
    const p = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    pointsRef.current = [p];
    onStart(p);
    onPreviewPath(`M ${e.clientX} ${e.clientY}`);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingRef.current) return;
    const p = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    pointsRef.current.push(p);
    const cmds = [`M ${pointsRef.current[0].x} ${pointsRef.current[0].y}`];
    for (let i = 1; i < pointsRef.current.length; i += 1) cmds.push(`L ${pointsRef.current[i].x} ${pointsRef.current[i].y}`);
    onPreviewPath(cmds.join(" "));
  };

  const handlePointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = pointsRef.current;
    if (pts.length < 2) {
      onPreviewPath("");
      onStart(null);
      return;
    }
    const minX = Math.min(...pts.map((p) => p.x)) - 8;
    const minY = Math.min(...pts.map((p) => p.y)) - 8;
    const maxX = Math.max(...pts.map((p) => p.x)) + 8;
    const maxY = Math.max(...pts.map((p) => p.y)) + 8;
    const relPath = pts
      .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x - minX} ${p.y - minY}`)
      .join(" ");
    onFinish(relPath, { minX, minY, maxX, maxY });
    onPreviewPath("");
    onStart(null);
    pointsRef.current = [];
  };

  if (mode === "none") return null;

  return (
    <div
      className="absolute inset-0 z-10 cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        pointerEvents: "auto",
        mixBlendMode: mode === "highlighter" ? "multiply" : "normal",
        opacity: mode === "highlighter" ? 0.85 : 1,
        border: "0",
      }}
      data-color={color}
      data-width={widthPx}
      data-dash={dash}
    />
  );
}

export default function WorkshopWorkspacePage() {
  return (
    <ReactFlowProvider>
      <WorkspacePageInner />
    </ReactFlowProvider>
  );
}
