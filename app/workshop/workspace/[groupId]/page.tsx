"use client";

import "reactflow/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dagre from "dagre";
import { toPng } from "html-to-image";
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "reactflow";
import { useParams } from "next/navigation";
import {
  collection,
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
import {
  WORKSHOP_GROUP_MAP,
  normalizeWorkshopGroupId,
  type WorkshopGroupId,
} from "@/app/workshop/_lib/workshopGroups";

type IdeaDoc = {
  id: string;
  companyName: string;
  studentName: string;
  ideaText: string;
  x?: number | null;
  y?: number | null;
  createdAtMs: number;
};

const NODE_W = 260;
const NODE_H = 140;

function buildNode(docRow: IdeaDoc, idx: number): Node {
  return {
    id: docRow.id,
    position: {
      x: typeof docRow.x === "number" ? docRow.x : 120 + (idx % 4) * 280,
      y: typeof docRow.y === "number" ? docRow.y : 120 + Math.floor(idx / 4) * 180,
    },
    data: {
      label: (
        <div className="rounded-lg bg-amber-50 p-3 shadow-sm">
          <p className="text-xs font-semibold text-amber-800">
            {docRow.companyName} · {docRow.studentName}
          </p>
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-slate-800">{docRow.ideaText}</p>
        </div>
      ),
    },
    style: { width: NODE_W, border: "1px solid #fcd34d", borderRadius: 12, background: "#fff" },
  };
}

function buildDefaultEdges(nodes: Node[]): Edge[] {
  if (nodes.length <= 1) return [];
  return nodes.slice(1).map((n, i) => ({
    id: `e-${nodes[0].id}-${n.id}-${i}`,
    source: nodes[0].id,
    target: n.id,
    animated: false,
  }));
}

function autoLayout(nodes: Node[], rankdir: "TB" | "LR"): Node[] {
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

function WorkspacePageInner() {
  const params = useParams<{ groupId: string }>();
  const groupId = normalizeWorkshopGroupId(params?.groupId);
  const group = groupId ? WORKSHOP_GROUP_MAP[groupId] : null;

  const [planTitle, setPlanTitle] = useState("未命名計畫");
  const [boardStatus, setBoardStatus] = useState<"草案中" | "定稿">("草案中");
  const [ideas, setIdeas] = useState<IdeaDoc[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutMode, setLayoutMode] = useState<"TB" | "LR">("TB");
  const [savingMsg, setSavingMsg] = useState("");
  const captureRef = useRef<HTMLDivElement>(null);

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
            companyName: String(x.companyName || ""),
            studentName: String(x.studentName || ""),
            ideaText: String(x.ideaText || ""),
            x: typeof x.x === "number" ? x.x : null,
            y: typeof x.y === "number" ? x.y : null,
            createdAtMs: typeof ts === "number" ? ts : 0,
          } satisfies IdeaDoc;
        })
        .sort((a, b) => a.createdAtMs - b.createdAtMs || a.id.localeCompare(b.id));
      setIdeas(rows);
      const nextNodes = rows.map((r, idx) => buildNode(r, idx));
      setNodes(nextNodes);
      setEdges((prev) => (prev.length > 0 ? prev : buildDefaultEdges(nextNodes)));
    });
    return () => un();
  }, [groupId]);

  const memberList = useMemo(() => {
    const m = new Map<string, string>();
    ideas.forEach((row) => {
      const key = `${row.companyName}|${row.studentName}`.trim();
      if (!key || m.has(key)) return;
      m.set(key, `${row.companyName}／${row.studentName}`);
    });
    return [...m.values()];
  }, [ideas]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes, ns));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
  }, []);
  const onConnect = useCallback((conn: Connection) => {
    setEdges((es) => addEdge({ ...conn, animated: false }, es));
  }, []);

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
    const laid = autoLayout(nodes, layoutMode);
    setNodes(laid);
    setEdges(buildDefaultEdges(laid));
    await Promise.all(
      laid.map((n) =>
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
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            fitView
          >
            <Background gap={20} />
            <MiniMap />
            <Controls />
            <Panel position="top-right">
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <label className="text-xs text-slate-600">
                  圖表自動排列
                  <select
                    value={layoutMode}
                    onChange={(e) => setLayoutMode(e.target.value as "TB" | "LR")}
                    className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="TB">樹狀圖（上到下）</option>
                    <option value="LR">組織圖（左到右）</option>
                  </select>
                </label>
                <button onClick={handleAutoLayout} className="rounded-md bg-slate-900 px-2 py-1.5 text-xs text-white">
                  套用排列
                </button>
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
          </ReactFlow>
        </section>
      </div>
    </main>
  );
}

export default function WorkshopWorkspacePage() {
  return (
    <ReactFlowProvider>
      <WorkspacePageInner />
    </ReactFlowProvider>
  );
}
