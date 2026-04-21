import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

export type PdfSummaryPageData = {
  companyName: string;
  /** 顯示用（建議民國年月日） */
  foundingDate: string;
  leaderName: string;
  mainBusinessItems: string;
  /** 例：（民國114年12月31日結案前可產出之效益） */
  quantBenefitDeadlineLine?: string;
  summary: string;
  innovationFocus: string;
  executionAdvantage: string;
  qualitativeBenefits: string;
  benefitValue: string;
  benefitNewProduct: string;
  benefitDerivedProduct: string;
  benefitAdditionalRnD: string;
  benefitInvestment: string;
  benefitCostReduction: string;
  benefitEmployment: string;
  benefitNewCompany: string;
  benefitInventionPatent: string;
  benefitUtilityPatent: string;
};

let fontRegistered = false;
const wrapCJK = (text: string) => text.split("").join("\u200B");

function ensureFontRegistered() {
  if (fontRegistered) return;
  const regularPath = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Regular.ttf");
  const boldPath = path.join(process.cwd(), "assets", "fonts", "NotoSansTC-Bold.otf");
  Font.register({
    family: "NotoSansTC",
    fonts: [
      { src: regularPath, fontWeight: "normal" },
      { src: boldPath, fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => Array.from(word));
  fontRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansTC",
    fontSize: 14,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    lineHeight: 1.15,
  },
  topSmallTitle: {
    textAlign: "center",
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
  },
  outer: {
    border: "1 solid #000",
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 4,
    minHeight: 760,
  },
  outerMain: {
    flex: 1,
    justifyContent: "space-between",
  },
  companySectionTitle: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  companyRow: {
    flexDirection: "row",
    marginBottom: 1,
    alignItems: "flex-start",
  },
  companyLabel: {
    width: 138,
  },
  companyValue: {
    flex: 1,
  },
  sectionBlock: {
    marginTop: 3,
  },
  secTitle: {
    fontWeight: "bold",
    marginBottom: 1,
  },
  subTitle: {
    marginTop: 1,
    marginLeft: 10,
    fontWeight: "bold",
    marginBottom: 2,
  },
  content: {
    marginLeft: 24,
    marginTop: 1,
  },
  quantWrap: {
    marginTop: 2,
    marginLeft: 10,
    width: "100%",
    flexShrink: 0,
  },
  quantSubTitle: {
    fontWeight: "bold",
    marginBottom: 2,
  },
  quantTable: {
    border: "1 solid #000",
    width: "100%",
  },
  quantRow: {
    flexDirection: "row",
    borderBottom: "1 solid #000",
    minHeight: 32,
  },
  quantRowLast: {
    flexDirection: "row",
    minHeight: 32,
  },
  quantCell: {
    flex: 1,
    borderRight: "1 solid #000",
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "space-between",
  },
  quantCellLast: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "space-between",
  },
  quantLabel: {
    fontSize: 12,
  },
  quantValue: {
    textAlign: "right",
    fontSize: 12,
    fontWeight: "bold",
  },
  noteWrap: {
    width: "100%",
    marginTop: 12,
    paddingBottom: 8,
    marginBottom: 8,
    marginLeft: 10,
    paddingRight: 10,
    flexDirection: "row",
  },
  noteMark: {
    fontSize: 10,
    marginRight: 2,
  },
  noteText: {
    fontSize: 10,
    flex: 1,
    lineHeight: 1.3,
    flexWrap: "wrap",
  },
  footerHelp: {
    marginTop: 12,
    width: "100%",
    fontSize: 10,
    lineHeight: 1.25,
    flexWrap: "wrap" as const,
  },
  quantDeadline: {
    marginLeft: 10,
    fontSize: 10,
    marginBottom: 2,
    lineHeight: 1.2,
    flexWrap: "wrap" as const,
  },
});

function n(v: string) {
  const s = String(v || "").trim();
  return s || "0";
}

function SummaryPage({ data }: { data: PdfSummaryPageData }) {
  const execChars = Array.from(String(data.executionAdvantage || "")).length;
  const execFontSize = execChars > 520 ? 10 : execChars > 420 ? 11 : 12;
  const quantRows = [
    [
      { label: "1. 增加產值（千元）", value: data.benefitValue },
      { label: "2. 產出新產品或服務共（項）", value: data.benefitNewProduct },
      { label: "3. 衍生商品或服務數共（項）", value: data.benefitDerivedProduct },
    ],
    [
      { label: "4. 額外投入研發費用（千元）", value: data.benefitAdditionalRnD },
      { label: "5. 促成投資額（千元）", value: data.benefitInvestment },
      { label: "6. 降低成本（千元）", value: data.benefitCostReduction },
    ],
    [
      { label: "7. 增加就業人數（人）", value: data.benefitEmployment },
      { label: "8. 成立新公司（家）", value: data.benefitNewCompany },
      { label: "9. 發明專利共（件）", value: data.benefitInventionPatent },
    ],
    [
      { label: "10. 新型/新式樣專利共（件）", value: data.benefitUtilityPatent },
      { label: "", value: "" },
      { label: "", value: "" },
    ],
  ];

  return (
    <Page size="A4" style={styles.page} wrap={false}>
      <Text style={styles.topSmallTitle}>115年度基隆市政府地方產業創新研發推動計畫（地方型 SBIR）</Text>
      <Text style={styles.title}>計畫書摘要表</Text>
      <View style={styles.outer}>
        <View style={styles.outerMain}>
          <View>
            <Text style={styles.companySectionTitle}>一、公司簡介</Text>
            <View style={styles.companyRow}>
              <Text style={styles.companyLabel}>（一）公司名稱：</Text>
              <Text style={styles.companyValue}>{data.companyName}</Text>
            </View>
            <View style={styles.companyRow}>
              <Text style={styles.companyLabel}>（二）設立日期：</Text>
              <Text style={styles.companyValue}>{data.foundingDate}</Text>
            </View>
            <View style={styles.companyRow}>
              <Text style={styles.companyLabel}>（三）負責人：</Text>
              <Text style={styles.companyValue}>{data.leaderName}</Text>
            </View>
            <View style={styles.companyRow}>
              <Text style={styles.companyLabel}>（四）主要營業項目：</Text>
              <Text style={styles.companyValue}>{data.mainBusinessItems}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.secTitle}>二、計畫摘要（此摘要內容屬可公開部份）</Text>
              <Text style={styles.subTitle}>（一）計畫內容摘要（110字以內）</Text>
              <Text style={styles.content}>{data.summary}</Text>
              <Text style={styles.subTitle}>（二）計畫創新重點（110字以內）</Text>
              <Text style={styles.content}>{data.innovationFocus}</Text>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.secTitle}>三、執行優勢（請說明公司執行本計畫優勢為何？）</Text>
              <Text style={{ ...styles.content, fontSize: execFontSize, lineHeight: 1.2 }}>{data.executionAdvantage}</Text>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.secTitle}>四、預期效益（結案三年內產出）</Text>
            <View style={styles.quantWrap}>
              <Text style={styles.quantSubTitle}>（一）量化效益</Text>
              {data.quantBenefitDeadlineLine ? (
                <Text style={styles.quantDeadline}>
                  {wrapCJK(data.quantBenefitDeadlineLine)}
                </Text>
              ) : null}
              <View style={styles.quantTable}>
                {quantRows.map((row, idx) => (
                  <View key={idx} style={idx === quantRows.length - 1 ? styles.quantRowLast : styles.quantRow}>
                    {row.map((cell, ci) => (
                      <View key={`${idx}-${ci}`} style={ci === row.length - 1 ? styles.quantCellLast : styles.quantCell}>
                        <Text style={styles.quantLabel}>{cell.label}</Text>
                        <Text style={styles.quantValue}>{cell.label ? n(cell.value) : ""}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.noteWrap}>
                <Text style={styles.noteMark}>※</Text>
                <Text style={styles.noteText}>
                  {wrapCJK(
                    "增加產值(因本計畫產生之營業額)、額外投入研發費用(不含政府補助款與自籌款)、促成投資額(自行增資或吸引外在投資)、增加就業人數(需加保勞保，若其為計畫編列之待聘人員需聘用超過3個月)"
                  )}
                </Text>
              </View>
              <Text style={styles.subTitle}>
                {wrapCJK("（二）非量化效益（請以敘述性方式說明，例如對公司的影響等）")}
              </Text>
              <Text style={styles.content}>{data.qualitativeBenefits}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={{ width: "100%", marginTop: 8, flexDirection: "row", flexWrap: "wrap" }}>
        <Text style={styles.footerHelp}>
          {wrapCJK(
            "填表說明：\n1. 本摘要得於政府相關網站上公開發佈。\n2. 請重點條列說明，並以1頁為原則。\n3. 本摘要所有格式不得刪減、調整。\n4. 量化效益應客觀評估，並作為本計畫驗收成果之參考，若無請填「0」。"
          )}
        </Text>
      </View>
    </Page>
  );
}

export async function renderSummaryPageBuffer(data: PdfSummaryPageData) {
  ensureFontRegistered();
  const doc = (
    <Document>
      <SummaryPage data={data} />
    </Document>
  );
  return await renderToBuffer(doc);
}

export type PdfTreeNodeData = {
  name: string;
  unit: string;
  weight: string;
  children?: PdfTreeNodeData[];
};

const TreeBranch = ({
  node,
  isRoot = true,
  isFirst = false,
  isLast = false,
}: {
  node: PdfTreeNodeData | null | undefined;
  isRoot?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  if (!node) return null;
  const hasChildren = node.children && node.children.length > 0;
  const labelName = String(node.name || "").trim() || "未命名項目";
  const labelWeight = node.weight || 0;
  const labelUnit = String(node.unit || "").trim();

  return (
    <View style={{ flexDirection: "row", alignItems: "stretch" }}>
      {!isRoot && (
        <View style={{ width: 30, flexDirection: "column" }}>
          <View style={{ flex: 1, borderLeftWidth: isFirst ? 0 : 2.6, borderColor: "#222" }} />
          <View style={{ width: 30, height: 2.6, backgroundColor: "#222" }} />
          <View style={{ flex: 1, borderLeftWidth: isLast ? 0 : 2.6, borderColor: "#222" }} />
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 240,
            marginVertical: 20,
            padding: 18,
            borderWidth: 2,
            borderColor: "#444",
            borderRadius: 6,
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 8, lineHeight: 1.2 }}>{wrapCJK(labelName)}</Text>
          <Text style={{ fontSize: 18, color: "#444", lineHeight: 1.2 }}>
            {wrapCJK(`${labelUnit ? `單位: ${labelUnit}\n` : ""}權重: ${labelWeight}%`)}
          </Text>
        </View>

        {hasChildren && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 26, height: 2.6, backgroundColor: "#222" }} />
            <View style={{ flexDirection: "column" }}>
              {node.children!.map((child, index) => (
                <TreeBranch
                  key={`${index}-${child.name}-${child.weight}`}
                  node={child}
                  isRoot={false}
                  isFirst={index === 0}
                  isLast={index === node.children!.length - 1}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

function countTreeDepth(node: PdfTreeNodeData | null | undefined): number {
  if (!node) return 1;
  const kids = Array.isArray(node.children) ? node.children : [];
  if (!kids.length) return 1;
  return 1 + Math.max(...kids.map((k) => countTreeDepth(k)));
}

function countTreeLeaves(node: PdfTreeNodeData | null | undefined): number {
  if (!node) return 1;
  const kids = Array.isArray(node.children) ? node.children : [];
  if (!kids.length) return 1;
  return kids.reduce((acc, k) => acc + countTreeLeaves(k), 0);
}

function TreePage({ treeData, pageWidth, pageHeight }: { treeData: PdfTreeNodeData; pageWidth: number; pageHeight: number }) {
  return (
    <Page size={[pageWidth, pageHeight]} orientation="landscape" style={{ fontFamily: "NotoSansTC", paddingHorizontal: 0, paddingVertical: 0 }}>
      <View style={{ padding: 4, flexDirection: "column", width: "100%" }}>
        <TreeBranch node={treeData} isRoot={true} />
      </View>
    </Page>
  );
}

export async function renderTreeBranchPageBuffer(treeData: PdfTreeNodeData) {
  ensureFontRegistered();
  const scale = 1;
  const depth = Math.max(2, countTreeDepth(treeData));
  const leaves = Math.max(3, countTreeLeaves(treeData));
  // Keep page tightly around actual tree content so PDF embedding can fill width without shrinking the tree body.
  const pageWidth = Math.max(1100, Math.min(3600, (360 + depth * 280) * scale));
  const pageHeight = Math.max(720, Math.min(4800, (260 + leaves * 120) * scale));
  const doc = (
    <Document>
      <TreePage treeData={treeData} pageWidth={pageWidth} pageHeight={pageHeight} />
    </Document>
  );
  return await renderToBuffer(doc);
}

