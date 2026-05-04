import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.SMOKE_PDF_URL || "http://localhost:3000";
const outDir = path.join(process.cwd(), "tmp-pdf-smoke");
fs.mkdirSync(outDir, { recursive: true });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function postPdf(name, body) {
  const res = await fetch(`${baseUrl}/api/pdf`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const ab = await res.arrayBuffer();
  if (!res.ok) {
    const t = new TextDecoder().decode(ab.slice(0, 400));
    throw new Error(`${name}: HTTP ${res.status} ${t}`);
  }
  const file = path.join(outDir, `${name}.pdf`);
  fs.writeFileSync(file, Buffer.from(ab));
  return { file, bytes: ab.byteLength };
}

const months = Object.fromEntries(
  ["115/07", "115/08", "115/09", "115/10"].map((m) => [m, { progress: true, checkpoint: false }])
);

const scheduleBody = {
  filename: "smoke-schedule.pdf",
  formData: {
    projectCategory: "技術",
    projectName: "PDF煙測-進度表合計",
    companyName: "測試公司",
    leaderName: "王小明",
    submitYear: "115",
    submitMonth: "5",
    projectStartDate: "2026-01-01",
    projectEndDate: "2026-12-31",
    projectMonths: "12",
    scheduleCheckpoints: {
      rows: [
        { id: "A", item: "分項A", weight: "55", manMonths: "10", months: { ...months } },
        { id: "A1", item: "工作A1", weight: "5", manMonths: "50", months: { ...months } },
        { id: "B", item: "分項B", weight: "45", manMonths: "8", months: { ...months } },
      ],
      kpis: [],
      notes: {},
    },
    planContent: {
      formData: {
        architectureTreeJson: JSON.stringify({
          name: "根",
          unit: "本公司",
          weight: "100",
          children: [
            { name: "子項一", unit: "研發", weight: "60", children: [] },
            { name: "子項二", unit: "測試", weight: "40", children: [] },
          ],
        }),
        implementation: "",
        stepsMethod: "",
        techTransferAnalysis: "",
      },
      images: {},
    },
    humanBudget: {
      piProfile: { name: "主持人", achievements: "VeryLongTokenWithoutSpaces_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890_REPEAT" },
      piEducation: [{ school: "台大", time: "110/09", degree: "碩士", dept: "電機" }],
      piExperience: [{ org: "某公司", time: "111/01-112/12", dept: "RD", title: "工程師" }],
      piProjects: [
        {
          org: "國立臺灣大學/財團法人台北市科技基金會",
          time: "113/06",
          name: "某計畫名稱很長用來測試換行與表格高度是否足夠顯示完整內容",
          task: "負責系統開發與測試驗證工作項目說明文字",
        },
      ],
      team: [
        {
          no: "1",
          name: "成員甲",
          title: "工程師",
          education: "清大資工碩士",
          experience: "新創公司一年",
          achievements: "mAP50-95=0.8 以及 ESP32 AES-CBC加密 測試中英混排ABCDEF12345",
          years: "2",
          tasks: "A1",
          months: "3",
        },
      ],
    },
  },
};

const deepTree = {
  name: "總計畫根節點名稱稍長用於測試樹狀圖縮放",
  unit: "測試公司",
  weight: "100",
  children: [
    {
      name: "分項A-水域偵測",
      unit: "A組",
      weight: "55",
      children: [
        { name: "A-1-資料集", unit: "甲", weight: "10", children: [] },
        { name: "A-2-模型", unit: "乙", weight: "20", children: [] },
        { name: "A-3-硬體", unit: "丙", weight: "15", children: [] },
        { name: "A-4-整合", unit: "丁", weight: "10", children: [] },
      ],
    },
    {
      name: "分項B-驗證",
      unit: "B組",
      weight: "45",
      children: [
        { name: "B-1-測試", unit: "戊", weight: "25", children: [] },
        { name: "B-2-上線", unit: "己", weight: "20", children: [] },
      ],
    },
  ],
};

const treeBody = {
  filename: "smoke-tree.pdf",
  formData: {
    projectCategory: "技術",
    projectName: "PDF煙測-深樹",
    companyName: "測試公司",
    leaderName: "王小明",
    submitYear: "115",
    submitMonth: "5",
    planContent: {
      formData: {
        architectureTreeJson: JSON.stringify(deepTree),
        implementation: "",
        stepsMethod: "",
        techTransferAnalysis: "",
      },
      images: {},
    },
    scheduleCheckpoints: { rows: [], kpis: [], notes: {} },
  },
};

const cases = [
  ["schedule-human-tree", scheduleBody],
  ["tree-only", treeBody],
];

console.log("PDF smoke →", baseUrl);
for (let i = 0; i < cases.length; i++) {
  const [name, body] = cases[i];
  if (i > 0) await delay(8000);
  try {
    const r = await postPdf(name, body);
    console.log("OK", name, r.bytes, "bytes", r.file);
  } catch (e) {
    if (String(e).includes("429")) {
      console.warn("429, waiting 70s …");
      await delay(70000);
      const r = await postPdf(name, body);
      console.log("OK", name, r.bytes, "bytes", r.file);
    } else {
      throw e;
    }
  }
}
console.log("All smoke PDFs written to", outDir);
