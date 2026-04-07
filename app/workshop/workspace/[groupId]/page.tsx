"use client";

import "reactflow/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "dagre";
import { toPng } from "html-to-image";
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { workshopDb } from "@/lib/firebaseWorkshop";
import { WORKSHOP_GROUP_MAP, normalizeWorkshopGroupId } from "@/app/workshop/_lib/workshopGroups";

type LayoutKind = "TB" | "LR" | "RL" | "BT" | "RADIAL";
type EdgeThickness = "thick" | "medium" | "thin";
type EdgeDash = "solid" | "dashed" | "dotted";
type DrawMode = "none" | "pen" | "highlighter" | "eraser";

type BudgetRow = {
  id: string;
  category: string;
  subsidy: number;
  matching: number;
};

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
  strokeStyle?: EdgeDash;
  opacity?: number | null;
  createdAtMs: number;
};

type UndoItem =
  | { kind: "add"; id: string }
  | {
      kind: "delete";
      payload: Omit<IdeaDoc, "id" | "createdAtMs">;
      id: string;
    };

const NODE_W = 260;
const NODE_H = 150;
const COLORS_10 = ["#fee2e2", "#ffedd5", "#fef3c7", "#ecfccb", "#dcfce7", "#ccfbf1", "#dbeafe", "#e0e7ff", "#ede9fe", "#fce7f3"];
const COLORS_16 = [
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

function strokeWidthOf(v: EdgeThickness): number {
  if (v === "thick") return 3;
  if (v === "medium") return 2;
  return 1;
}
function dashOf(v: EdgeDash): string | undefined {
  if (v === "dashed") return "8 5";
  if (v === "dotted") return "2 7";
  return undefined;
}

function StickyNode({ id, data }: NodeProps) {
  const { setNodes } = useReactFlow();
  const color = String(data.color || "#fef3c7");
  const showTools = Boolean(data.showTools);

  async function setColor(next: string) {
    setNodes((nodes) => nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, color: next } } : n)));
    await updateDoc(doc(workshopDb, "workshop_ideas", id), { color: next, updatedAt: serverTimestamp() }).catch(
      () => undefined,
    );
  }
  async function removeNode() {
    await deleteDoc(doc(workshopDb, "workshop_ideas", id)).catch(() => undefined);
  }

  const handleClass = "h-3 w-3 rounded-full border border-white bg-blue-500";
  return (
    <div className="relative rounded-xl border border-amber-300 p-3 shadow-sm" style={{ backgroundColor: color }}>
      <Handle type="target" position={Position.Top} className={handleClass} />
      <Handle type="source" position={Position.Top} className={handleClass} />
      <Handle type="target" position={Position.Right} className={handleClass} />
      <Handle type="source" position={Position.Right} className={handleClass} />
      <Handle type="target" position={Position.Bottom} className={handleClass} />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
      <Handle type="target" position={Position.Left} className={handleClass} />
      <Handle type="source" position={Position.Left} className={handleClass} />

      {showTools ? (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-white/90 p-1">
          {COLORS_10.map((c) => (
            <button
              key={`${id}-${c}`}
              type="button"
              onClick={() => void setColor(c)}
              className="h-4 w-4 rounded-full border border-slate-300"
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            onClick={() => void removeNode()}
            className="ml-1 rounded border border-red-300 bg-red-50 px-1.5 text-[10px] text-red-700"
          >
            🗑️
          </button>
        </div>
      ) : null}
      <p className="text-xs font-semibold text-amber-900">
        {String(data.companyName || "")} · {String(data.studentName || "")}
      </p>
      <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-slate-800">{String(data.ideaText || "")}</p>
    </div>
  );
}

function DrawNode({ data }: NodeProps) {
  return (
    <svg width={240} height={170} className="overflow-visible">
      <path
        d={String(data.pathData || "")}
        fill="none"
        stroke={String(data.strokeColor || "#0f172a")}
        strokeWidth={Number(data.strokeWidth || 3)}
        strokeDasharray={dashOf((data.strokeStyle as EdgeDash) || "solid")}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={Number(data.opacity || 1)}
      />
      <Handle type="target" position={Position.Top} className="h-3 w-3 rounded-full border border-white bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="h-3 w-3 rounded-full border border-white bg-blue-500" />
    </svg>
  );
}

function toNode(row: IdeaDoc, idx: number, selectedId: string | null): Node {
  if (row.type === "draw") {
    return {
      id: row.id,
      type: "draw",
      position: { x: row.x ?? 180 + idx * 20, y: row.y ?? 180 + idx * 20 },
      data: {
        pathData: row.pathData || "",
        strokeColor: row.strokeColor || "#0f172a",
        strokeWidth: row.strokeWidth || 3,
        strokeStyle: row.strokeStyle || "solid",
        opacity: row.opacity ?? 1,
      },
      style: { width: row.width || 240, height: row.height || 170, border: "none", background: "transparent" },
    };
  }
  return {
    id: row.id,
    type: "sticky",
    position: { x: row.x ?? 120 + (idx % 4) * 280, y: row.y ?? 120 + Math.floor(idx / 4) * 190 },
    data: {
      companyName: row.companyName,
      studentName: row.studentName,
      ideaText: row.ideaText,
      color: row.color || COLORS_10[idx % COLORS_10.length],
      showTools: selectedId === row.id,
    },
    style: { width: NODE_W, borderRadius: 12 },
  };
}

function autoLayout(nodes: Node[], kind: LayoutKind): Node[] {
  if (kind === "RADIAL") {
    if (nodes.length <= 1) return nodes;
    const [root, ...rest] = nodes;
    const cx = 520;
    const cy = 360;
    const radius = Math.max(220, 48 * rest.length);
    const step = (Math.PI * 2) / rest.length;
    return [
      { ...root, position: { x: cx - NODE_W / 2, y: cy - NODE_H / 2 } },
      ...rest.map((n, i) => ({
        ...n,
        position: { x: cx + Math.cos(i * step) * radius - NODE_W / 2, y: cy + Math.sin(i * step) * radius - NODE_H / 2 },
      })),
    ];
  }
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: kind, nodesep: 40, ranksep: 80 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  nodes.slice(1).forEach((n) => g.setEdge(nodes[0].id, n.id));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

function WorkspaceInner() {
  const params = useParams<{ groupId: string }>();
  const groupId = normalizeWorkshopGroupId(params?.groupId);
  const group = groupId ? WORKSHOP_GROUP_MAP[groupId] : null;
  const rf = useReactFlow();

  const [planTitle, setPlanTitle] = useState("未命名計畫");
  const [boardStatus, setBoardStatus] = useState<"草案中" | "定稿">("草案中");
  const [ideas, setIdeas] = useState<IdeaDoc[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layoutKind, setLayoutKind] = useState<LayoutKind>("TB");
  const [edgeThickness, setEdgeThickness] = useState<EdgeThickness>("medium");
  const [edgeDash, setEdgeDash] = useState<EdgeDash>("solid");
  const [edgeArrow, setEdgeArrow] = useState(true);
  const [toolText, setToolText] = useState("");
  const [toolColor, setToolColor] = useState(COLORS_16[0]);
  const [mode, setMode] = useState<DrawMode>("none");
  const [drawColor, setDrawColor] = useState("#0f172a");
  const [drawSize, setDrawSize] = useState(4);
  const [drawDash, setDrawDash] = useState<EdgeDash>("solid");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([{ id: crypto.randomUUID(), category: ACCOUNTING_OPTIONS[0], subsidy: 0, matching: 0 }]);
  const [savingMsg, setSavingMsg] = useState("");
  const [undoStack, setUndoStack] = useState<UndoItem[]>([]);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const ideasMapRef = useRef<Map<string, IdeaDoc>>(new Map());
  const captureRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => ({ sticky: StickyNode, draw: DrawNode }), []);

  useEffect(() => {
    const down = () => setIsMouseDown(true);
    const up = () => setIsMouseDown(false);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  useEffect(() => {
    if (!groupId) return;
    const un = onSnapshot(query(collection(workshopDb, "workshop_ideas"), where("groupId", "==", groupId)), (snap) => {
      const rows = snap.docs
        .map((d) => {
          const x = d.data() as DocumentData;
          const createdAtMs = x.createdAt?.toMillis?.() ?? 0;
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
            strokeStyle: x.strokeStyle === "dashed" || x.strokeStyle === "dotted" ? x.strokeStyle : "solid",
            opacity: typeof x.opacity === "number" ? x.opacity : null,
            createdAtMs,
          } as IdeaDoc;
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id));
      ideasMapRef.current = new Map(rows.map((r) => [r.id, r]));
      setIdeas(rows);
      setNodes(rows.map((r, i) => toNode(r, i, selectedNodeId)));
    });
    return () => un();
  }, [groupId, selectedNodeId]);

  useEffect(() => {
    if (!groupId) return;
    const un = onSnapshot(doc(workshopDb, "workshop_boards", groupId), (snap) => {
      if (!snap.exists()) return;
      const x = snap.data() as Record<string, unknown>;
      if (typeof x.planTitle === "string") setPlanTitle(x.planTitle || "未命名計畫");
      if (x.status === "草案中" || x.status === "定稿") setBoardStatus(x.status);
      if (Array.isArray(x.budgetRows)) {
        const rows = (x.budgetRows as unknown[]).map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id: String(row.id || crypto.randomUUID()),
            category: String(row.category || ACCOUNTING_OPTIONS[0]),
            subsidy: Number(row.subsidy || 0),
            matching: Number(row.matching || 0),
          } satisfies BudgetRow;
        });
        if (rows.length > 0) setBudgetRows(rows);
      }
    });
    return () => un();
  }, [groupId]);

  const memberList = useMemo(() => {
    const m = new Map<string, string>();
    ideas.forEach((i) => {
      if (i.type !== "sticky") return;
      const k = `${i.companyName}|${i.studentName}`;
      if (!m.has(k)) m.set(k, `${i.companyName}／${i.studentName}`);
    });
    return [...m.values()];
  }, [ideas]);

  const totals = useMemo(() => {
    const subsidy = budgetRows.reduce((s, r) => s + (Number(r.subsidy) || 0), 0);
    const matching = budgetRows.reduce((s, r) => s + (Number(r.matching) || 0), 0);
    return { subsidy, matching, total: subsidy + matching };
  }, [budgetRows]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
    const c = changes.find((x) => x.type === "select");
    if (c && "selected" in c) setSelectedNodeId(c.selected ? c.id : null);
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);
  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((es) =>
        addEdge(
          {
            ...conn,
            type: "smoothstep",
            style: { strokeWidth: strokeWidthOf(edgeThickness), strokeDasharray: dashOf(edgeDash) },
            markerEnd: edgeArrow ? { type: MarkerType.ArrowClosed } : undefined,
          },
          es,
        ),
      );
    },
    [edgeArrow, edgeDash, edgeThickness],
  );

  const pushUndo = useCallback((item: UndoItem) => {
    setUndoStack((prev) => [item, ...prev].slice(0, 5));
  }, []);

  const deleteById = useCallback(
    async (id: string) => {
      const snapshot = ideasMapRef.current.get(id);
      if (snapshot) {
        const { createdAtMs, ...payload } = snapshot;
        pushUndo({ kind: "delete", id, payload });
      }
      await deleteDoc(doc(workshopDb, "workshop_ideas", id)).catch(() => undefined);
    },
    [pushUndo],
  );

  const deleteSelected = useCallback(async () => {
    const ids = nodes.filter((n) => n.selected).map((n) => n.id);
    await Promise.all(ids.map((id) => deleteById(id)));
  }, [deleteById, nodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "")) {
        e.preventDefault();
        void deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected]);

  const onNodeDragStop = useCallback(async (_: unknown, node: Node) => {
    await updateDoc(doc(workshopDb, "workshop_ideas", node.id), {
      x: node.position.x,
      y: node.position.y,
      updatedAt: serverTimestamp(),
    }).catch(() => undefined);
  }, []);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (mode === "eraser") {
        void deleteById(node.id);
      }
    },
    [deleteById, mode],
  );
  const onNodeMouseEnter = useCallback(
    (_: unknown, node: Node) => {
      if (mode === "eraser" && isMouseDown) void deleteById(node.id);
    },
    [deleteById, isMouseDown, mode],
  );

  async function handleAutoLayout() {
    const sticky = nodes.filter((n) => n.type !== "draw");
    const drawings = nodes.filter((n) => n.type === "draw");
    const laid = autoLayout(sticky, layoutKind);
    setNodes([...laid, ...drawings]);
    await Promise.all(
      laid.map((n) =>
        updateDoc(doc(workshopDb, "workshop_ideas", n.id), { x: n.position.x, y: n.position.y, updatedAt: serverTimestamp() }).catch(
          () => undefined,
        ),
      ),
    );
  }

  async function saveBoard() {
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
        budgetSummary: { totalSubsidy: totals.subsidy, totalMatching: totals.matching, total: totals.total },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setSavingMsg("已儲存至平台");
    setTimeout(() => setSavingMsg(""), 1600);
  }

  async function saveBudget() {
    await saveBoard();
    setSavingMsg("已儲存預算");
    setTimeout(() => setSavingMsg(""), 1600);
  }

  async function addStickyByTool() {
    if (!groupId || !group || !toolText.trim()) return;
    const p = rf.screenToFlowPosition({ x: window.innerWidth * 0.5, y: window.innerHeight * 0.52 });
    const ref = await addDoc(collection(workshopDb, "workshop_ideas"), {
      groupId,
      teacherName: group.teacher,
      type: "sticky",
      companyName: "便利貼",
      studentName: "操作員",
      ideaText: toolText.trim(),
      color: toolColor,
      x: p.x,
      y: p.y,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    pushUndo({ kind: "add", id: ref.id });
    setToolText("");
  }

  async function handleUndo() {
    const item = undoStack[0];
    if (!item || !groupId || !group) return;
    setUndoStack((prev) => prev.slice(1));
    if (item.kind === "add") {
      await deleteDoc(doc(workshopDb, "workshop_ideas", item.id)).catch(() => undefined);
      return;
    }
    const payload = item.payload;
    await setDoc(
      doc(workshopDb, "workshop_ideas", item.id),
      {
        ...payload,
        groupId,
        teacherName: group.teacher,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    ).catch(() => undefined);
  }

  async function exportPng() {
    if (!captureRef.current) return;
    const img = await toPng(captureRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#f8fafc" });
    const a = document.createElement("a");
    a.href = img;
    a.download = `${groupId || "group"}-${planTitle || "plan"}.png`;
    a.click();
  }

  if (!groupId || !group) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 text-slate-700">無效組別</main>;
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
              <input value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
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
          <DrawOverlay
            enabled={mode === "pen" || mode === "highlighter"}
            reactFlow={rf}
            color={drawColor}
            width={mode === "highlighter" ? Math.max(drawSize, 10) : drawSize}
            dash={drawDash}
            opacity={mode === "highlighter" ? 0.35 : 1}
            onStrokeComplete={async (payload) => {
              if (!groupId || !group) return;
              const ref = await addDoc(collection(workshopDb, "workshop_ideas"), {
                groupId,
                teacherName: group.teacher,
                type: "draw",
                companyName: "畫筆軌跡",
                studentName: "操作員",
                ideaText: mode === "highlighter" ? "螢光筆" : "畫筆",
                ...payload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              pushUndo({ kind: "add", id: ref.id });
            }}
          />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onInit={(inst) => {
              flowRef.current = inst;
            }}
            fitView
            connectionMode={ConnectionMode.Loose}
            panOnDrag={mode === "none" || mode === "eraser"}
            zoomOnScroll={mode === "none" || mode === "eraser"}
            zoomOnPinch={mode === "none" || mode === "eraser"}
            zoomOnDoubleClick={mode === "none" || mode === "eraser"}
            selectionOnDrag={mode === "none" || mode === "eraser"}
          >
            <Background gap={20} />
            <MiniMap />
            <Controls />

            <Panel position="top-right">
              <div className="flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <label className="text-xs text-slate-600">
                  心智圖結構選擇
                  <select value={layoutKind} onChange={(e) => setLayoutKind(e.target.value as LayoutKind)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs">
                    <option value="TB">樹狀圖（上到下）</option>
                    <option value="LR">樹狀圖（左到右）</option>
                    <option value="RL">樹狀圖（右到左）</option>
                    <option value="BT">樹狀圖（下到上）</option>
                    <option value="RADIAL">放射狀圖</option>
                  </select>
                </label>
                <button onClick={() => void handleAutoLayout()} className="rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white">
                  套用排列
                </button>
                <label className="text-xs text-slate-600">
                  連線粗細
                  <select value={edgeThickness} onChange={(e) => setEdgeThickness(e.target.value as EdgeThickness)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs">
                    <option value="thick">粗</option>
                    <option value="medium">中</option>
                    <option value="thin">細</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  連線樣式
                  <select value={edgeDash} onChange={(e) => setEdgeDash(e.target.value as EdgeDash)} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs">
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
                  <select value={boardStatus} onChange={(e) => setBoardStatus(e.target.value as "草案中" | "定稿")} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs">
                    <option>草案中</option>
                    <option>定稿</option>
                  </select>
                </label>
                <button onClick={() => void saveBoard()} className="rounded-md bg-blue-600 px-2 py-1.5 text-xs text-white">
                  儲存至平台
                </button>
                <button onClick={() => void exportPng()} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
                  下載圖檔
                </button>
              </div>
            </Panel>

            <Panel position="bottom-right">
              <div className="w-72 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-700">手動工具箱</p>
                <textarea rows={2} value={toolText} onChange={(e) => setToolText(e.target.value)} placeholder="新增便利貼內容" className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs" />
                <div className="flex flex-wrap gap-1">
                  {COLORS_16.map((c) => (
                    <button key={c} type="button" onClick={() => setToolColor(c)} className={`h-4 w-4 rounded-full border ${toolColor === c ? "border-slate-900" : "border-slate-300"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={() => void addStickyByTool()} className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white">
                  新增便利貼
                </button>
                <div className="border-t border-slate-200 pt-2">
                  <p className="text-xs text-slate-600">畫布模式</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(["none", "pen", "highlighter", "eraser"] as DrawMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`rounded-md px-2 py-1 text-xs ${mode === m ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                      >
                        {m === "none" ? "一般" : m === "pen" ? "畫筆" : m === "highlighter" ? "螢光筆" : "橡皮擦"}
                      </button>
                    ))}
                    <button onClick={() => void handleUndo()} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700">
                      Undo
                    </button>
                  </div>
                  {(mode === "pen" || mode === "highlighter") ? (
                    <div className="mt-2 space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {(mode === "highlighter" ? HIGHLIGHT_COLORS : COLORS_16).map((c) => (
                          <button key={`draw-${c}`} onClick={() => setDrawColor(c)} className="h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="range" min={1} max={16} value={drawSize} onChange={(e) => setDrawSize(Number(e.target.value))} />
                        <select value={drawDash} onChange={(e) => setDrawDash(e.target.value as EdgeDash)} className="rounded border border-slate-200 px-1 py-0.5 text-xs">
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

          <div className="absolute left-3 top-3 z-30 overflow-auto rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <button onClick={() => setBudgetOpen((v) => !v)} className="w-full rounded-md bg-slate-100 px-2 py-1 text-left text-sm font-medium text-slate-700">
              {budgetOpen ? "▼" : "▶"} 預算試算區塊
            </button>
            {budgetOpen ? (
              <div className="mt-2 min-w-[800px] rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_40px] gap-2 border-b border-slate-200 pb-2 text-xs font-semibold text-slate-700">
                  <div>會計科目</div>
                  <div>補助款</div>
                  <div>配合款</div>
                  <div>小計</div>
                  <div />
                </div>
                <div className="mt-2 space-y-2">
                  {budgetRows.map((row) => {
                    const subtotal = (Number(row.subsidy) || 0) + (Number(row.matching) || 0);
                    return (
                      <div key={row.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_40px] gap-2 text-xs">
                        <select value={row.category} onChange={(e) => setBudgetRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, category: e.target.value } : r)))} className="rounded border border-slate-200 px-2 py-1">
                          {ACCOUNTING_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <input type="number" value={row.subsidy} onChange={(e) => setBudgetRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, subsidy: Number(e.target.value || 0) } : r)))} className="rounded border border-slate-200 px-2 py-1" />
                        <input type="number" value={row.matching} onChange={(e) => setBudgetRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, matching: Number(e.target.value || 0) } : r)))} className="rounded border border-slate-200 px-2 py-1" />
                        <input readOnly value={subtotal} className="rounded border border-slate-200 bg-slate-50 px-2 py-1" />
                        <button onClick={() => setBudgetRows((rows) => rows.filter((r) => r.id !== row.id))} className="rounded border border-red-200 bg-red-50 text-red-700">
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setBudgetRows((rows) => [...rows, { id: crypto.randomUUID(), category: ACCOUNTING_OPTIONS[0], subsidy: 0, matching: 0 }])} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
                    + 新增列
                  </button>
                  <button onClick={() => void saveBudget()} className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white">
                    儲存預算
                  </button>
                </div>
                <div className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                  <div>總補助款：{totals.subsidy}</div>
                  <div>總配合款：{totals.matching}</div>
                  <div className="font-semibold">計畫總經費（總計）：{totals.total}</div>
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
  enabled,
  reactFlow,
  color,
  width,
  dash,
  opacity,
  onStrokeComplete,
}: {
  enabled: boolean;
  reactFlow: ReactFlowInstance;
  color: string;
  width: number;
  dash: EdgeDash;
  opacity: number;
  onStrokeComplete: (payload: {
    x: number;
    y: number;
    width: number;
    height: number;
    pathData: string;
    strokeColor: string;
    strokeWidth: number;
    strokeStyle: EdgeDash;
    opacity: number;
  }) => void;
}) {
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const drawingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);

  const schedulePaint = () => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pts = pointsRef.current;
      if (pts.length < 2 || !pathRef.current) return;
      const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
      pathRef.current.setAttribute("d", d);
    });
  };

  const pointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    drawingRef.current = true;
    const p = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    pointsRef.current = [p];
    if (pathRef.current) pathRef.current.setAttribute("d", "");
  };
  const pointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || !drawingRef.current) return;
    pointsRef.current.push(reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    schedulePaint();
  };
  const pointerUp = () => {
    if (!enabled || !drawingRef.current) return;
    drawingRef.current = false;
    const pts = pointsRef.current;
    pointsRef.current = [];
    if (pts.length < 2) {
      if (pathRef.current) pathRef.current.setAttribute("d", "");
      return;
    }
    const minX = Math.min(...pts.map((p) => p.x)) - 8;
    const minY = Math.min(...pts.map((p) => p.y)) - 8;
    const maxX = Math.max(...pts.map((p) => p.x)) + 8;
    const maxY = Math.max(...pts.map((p) => p.y)) + 8;
    const rel = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x - minX} ${p.y - minY}`).join(" ");
    onStrokeComplete({
      x: minX,
      y: minY,
      width: Math.max(30, maxX - minX),
      height: Math.max(30, maxY - minY),
      pathData: rel,
      strokeColor: color,
      strokeWidth: width,
      strokeStyle: dash,
      opacity,
    });
    if (pathRef.current) pathRef.current.setAttribute("d", "");
  };

  if (!enabled) return null;
  return (
    <div className="absolute inset-0 z-20 cursor-crosshair" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={pointerUp}>
      <svg className="pointer-events-none absolute inset-0">
        <path ref={pathRef} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dashOf(dash)} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
      </svg>
    </div>
  );
}

export default function WorkshopWorkspacePage() {
  return (
    <ReactFlowProvider>
      <WorkspaceInner />
    </ReactFlowProvider>
  );
}
