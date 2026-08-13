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
    marginLeft: 0,
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
    alignSelf: "stretch",
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
    flexBasis: "33.333%",
    maxWidth: "33.333%",
    borderRight: "1 solid #000",
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "space-between",
  },
  quantCellLast: {
    flexBasis: "33.333%",
    maxWidth: "33.333%",
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
    marginLeft: 0,
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
    marginLeft: 0,
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

export type TreeLayoutSpec = {
  nameFont: number;
  metaFont: number;
  cardW: number;
  marginV: number;
  branchColW: number;
  connectorW: number;
  connectorH: number;
  cardPad: number;
};

const DEFAULT_TREE_LAYOUT: TreeLayoutSpec = {
  nameFont: 18,
  metaFont: 13,
  cardW: 220,
  marginV: 14,
  branchColW: 28,
  connectorW: 24,
  connectorH: 2.4,
  cardPad: 12,
};

/** CJK／全形字寬接近 em；略放大避免低估行數造成裁切或文字溢出方塊 */
const CJK_CHAR_WIDTH_FACTOR = 1.05;
const LINE_HEIGHT_FACTOR = 1.3;

function countWrappedLines(text: string, fontSize: number, maxWidth: number, minChars = 4) {
  const len = Array.from(String(text || "")).length;
  if (len <= 0) return 1;
  const charsPerLine = Math.max(minChars, Math.floor(maxWidth / (fontSize * CJK_CHAR_WIDTH_FACTOR)));
  return Math.max(1, Math.ceil(len / charsPerLine));
}

const TreeBranch = ({
  node,
  layout,
  isRoot = true,
  isFirst = false,
  isLast = false,
}: {
  node: PdfTreeNodeData | null | undefined;
  layout: TreeLayoutSpec;
  isRoot?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) => {
  if (!node) return null;
  const hasChildren = node.children && node.children.length > 0;
  const labelName = String(node.name || "").trim() || "未命名項目";
  const labelWeight = String(node.weight ?? "").trim() || "0";
  const labelUnit = String(node.unit || "").trim();
  const bw = layout.branchColW;
  const ch = layout.connectorH;
  const innerW = Math.max(40, layout.cardW - layout.cardPad * 2);
  const minCardH = estimateTreeCardHeight(node, layout);

  return (
    <View style={{ flexDirection: "row", alignItems: "stretch" }}>
      {!isRoot && (
        <View style={{ width: bw, flexDirection: "column" }}>
          <View style={{ flex: 1, borderLeftWidth: isFirst ? 0 : ch, borderColor: "#222" }} />
          <View style={{ width: bw, height: ch, backgroundColor: "#222" }} />
          <View style={{ flex: 1, borderLeftWidth: isLast ? 0 : ch, borderColor: "#222" }} />
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: layout.cardW,
            minHeight: minCardH,
            marginVertical: layout.marginV,
            padding: layout.cardPad,
            borderWidth: 2,
            borderColor: "#444",
            borderRadius: 6,
            backgroundColor: "#fff",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              width: innerW,
              fontSize: layout.nameFont,
              fontWeight: "bold",
              marginBottom: 4,
              lineHeight: LINE_HEIGHT_FACTOR,
            }}
          >
            {wrapCJK(labelName)}
          </Text>
          {labelUnit ? (
            <Text style={{ width: innerW, fontSize: layout.metaFont, color: "#444", lineHeight: LINE_HEIGHT_FACTOR }}>
              {wrapCJK(`單位: ${labelUnit}`)}
            </Text>
          ) : null}
          <Text style={{ width: innerW, fontSize: layout.metaFont, color: "#444", lineHeight: LINE_HEIGHT_FACTOR }}>
            {wrapCJK(`權重: ${labelWeight}%`)}
          </Text>
        </View>

        {hasChildren && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: layout.connectorW, height: ch, backgroundColor: "#222" }} />
            <View style={{ flexDirection: "column" }}>
              {node.children!.map((child, index) => (
                <TreeBranch
                  key={`${index}-${child.name}-${child.weight}`}
                  layout={layout}
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

function estimateTreeCardHeight(node: PdfTreeNodeData | null | undefined, layout: TreeLayoutSpec) {
  const labelName = String(node?.name || "").trim() || "未命名項目";
  const labelUnit = String(node?.unit || "").trim();
  const labelWeight = String(node?.weight ?? "").trim() || "0";
  const innerW = Math.max(40, layout.cardW - layout.cardPad * 2);
  const nameLines = countWrappedLines(labelName, layout.nameFont, innerW, 4);
  const unitLines = labelUnit ? countWrappedLines(`單位: ${labelUnit}`, layout.metaFont, innerW, 6) : 0;
  const weightLines = countWrappedLines(`權重: ${labelWeight}%`, layout.metaFont, innerW, 6);
  const gapAfterName = 4;
  return (
    layout.cardPad * 2 +
    gapAfterName +
    nameLines * (layout.nameFont * LINE_HEIGHT_FACTOR) +
    unitLines * (layout.metaFont * LINE_HEIGHT_FACTOR) +
    weightLines * (layout.metaFont * LINE_HEIGHT_FACTOR) +
    10
  );
}

function measureTree(node: PdfTreeNodeData | null | undefined, layout: TreeLayoutSpec): { width: number; height: number } {
  if (!node) return { width: 360, height: 220 };
  const children = Array.isArray(node.children) ? node.children : [];
  const cardWidth = layout.cardW;
  const cardHeight = estimateTreeCardHeight(node, layout);
  const spine = layout.branchColW + layout.connectorW;
  if (!children.length) {
    return { width: cardWidth, height: cardHeight + layout.marginV * 2 };
  }
  const childMeasures = children.map((c) => measureTree(c, layout));
  const childrenHeight = childMeasures.reduce((s, m) => s + m.height, 0);
  const childrenMaxWidth = childMeasures.reduce((m, c) => Math.max(m, c.width), 0);
  return {
    width: cardWidth + spine + childrenMaxWidth,
    height: Math.max(cardHeight + layout.marginV * 2, childrenHeight),
  };
}

function TreePage({
  treeData,
  layout,
  pageWidth,
  pageHeight,
}: {
  treeData: PdfTreeNodeData;
  layout: TreeLayoutSpec;
  pageWidth: number;
  pageHeight: number;
}) {
  return (
    <Page size={[pageWidth, pageHeight]} orientation="landscape" style={{ fontFamily: "NotoSansTC", paddingHorizontal: 0, paddingVertical: 0 }} wrap={false}>
      <View style={{ padding: 36, flexDirection: "column", width: "100%" }}>
        <TreeBranch layout={layout} node={treeData} isRoot={true} />
      </View>
    </Page>
  );
}

/** 單頁優先縮排與字級（下限 9pt），頁面與 crop 採寬鬆邊界，避免節點／文字被裁切。 */
export async function renderTreeBranchPageBuffer(treeData: PdfTreeNodeData) {
  ensureFontRegistered();
  const pagePadding = 36;
  const layoutBudgetH = 560;

  let layout: TreeLayoutSpec = { ...DEFAULT_TREE_LAYOUT };
  let measured = measureTree(treeData, layout);
  let guard = 0;
  // 優先縮小字級與間距，盡量保留卡片寬度讓長中文可換行落在框內
  while (measured.height > layoutBudgetH && layout.nameFont > 9 && guard < 100) {
    layout = {
      ...layout,
      nameFont: Math.max(9, Math.round((layout.nameFont - 0.5) * 10) / 10),
      metaFont: Math.max(9, Math.round((layout.metaFont - 0.4) * 10) / 10),
      cardW: Math.max(170, layout.cardW - 2),
      marginV: Math.max(6, layout.marginV - 0.5),
      branchColW: Math.max(20, layout.branchColW - 0.4),
      connectorW: Math.max(16, layout.connectorW - 0.4),
      cardPad: Math.max(8, layout.cardPad - 0.3),
    };
    measured = measureTree(treeData, layout);
    guard += 1;
  }

  // 寬鬆 slack：量測偏低估時仍留足空間，避免嵌入 crop 裁到節點／文字溢出感
  const slack = 1.35;
  const contentW = Math.ceil(measured.width * slack + 32);
  const contentH = Math.ceil(measured.height * slack + 32);
  const pageWidth = Math.max(720, contentW + pagePadding * 2);
  const pageHeight = Math.max(400, contentH + pagePadding * 2);
  const doc = (
    <Document>
      <TreePage treeData={treeData} layout={layout} pageWidth={pageWidth} pageHeight={pageHeight} />
    </Document>
  );
  // crop 對齊內容區（已含 slack），左右上下再外擴，避免緊貼裁切；不改用整頁以免小樹被空白過度縮小
  const cropPad = 20;
  return {
    buffer: await renderToBuffer(doc),
    cropBox: {
      left: Math.max(0, pagePadding - cropPad),
      right: Math.min(pageWidth, pagePadding + contentW + cropPad),
      top: Math.min(pageHeight, pageHeight - pagePadding + cropPad),
      bottom: Math.max(0, pageHeight - pagePadding - contentH - cropPad),
    },
  };
}

