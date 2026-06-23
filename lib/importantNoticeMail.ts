import type { AgendaMatch } from "@/lib/matchApplicationToAgenda";
import type { ReviewMeetingDate } from "@/lib/reviewMeetingAgenda";

export function formatAgendaTimeRangeForNotice(time: string): string {
  const normalized = String(time || "")
    .replace(/：/g, ":")
    .replace(/[~～]/g, "-")
    .replace(/\s+/g, "");
  const parts = normalized.split("-").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]} - ${parts[1]}`;
  }
  return String(time || "").trim();
}

export function importantNoticeReviewDateLabel(meetingDate: ReviewMeetingDate): string {
  if (meetingDate === "0701") return "7/1（三）";
  if (meetingDate === "0622") return "6/22（一）";
  return meetingDate;
}

export function buildImportantNoticeRemarksTemplate(agenda: AgendaMatch): string {
  const timeRange = formatAgendaTimeRangeForNotice(agenda.agendaCase.time);
  const dateLabel = importantNoticeReviewDateLabel(agenda.meetingDate);

  return `【簡報審查時間異動通知】

敬愛的計畫申請業者，您好：
感謝您參與「115年度基隆市政府地方產業創新研發推動計畫（地方型SBIR）」。
因部分業者未於 7/1 完成規定事項之繳交而取消資格，為求整體審查作業順暢，計畫辦公室已重新調整各組業者的簡報時段。您的簡報時間已有所異動，請務必依循下列最新時間出席。

再次提醒，您的最新簡報審查資訊如下：

🔸 審查日期： ${dateLabel}
🔸 審查時間： ${timeRange}
🔸 報到地點： 基隆市政府產業發展處 3樓會議室

⚠️ 注意事項：
※ 簡報當天請務必提早 30 分鐘至報到地點完成報到與準備，以免影響您的審查權益。

因時程調整造成您的不便，敬請見諒。如有任何疑問，歡迎隨時與計畫辦公室聯繫。預祝您簡報順利！`;
}

export function importantNoticeMailSubject(planTitle: string): string {
  const plan = planTitle.trim() || "未命名計畫";
  return `【基隆市 SBIR】計畫「${plan}」案件重要通知`;
}
