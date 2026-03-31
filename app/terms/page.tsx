import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "服務條款",
  description: "基隆市地方型 SBIR 計畫申請系統服務條款。",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 md:p-10 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-wide mb-8">基隆市地方型 SBIR 計畫申請系統 - 服務條款</h1>

        <div className="space-y-6 leading-relaxed text-[15px]">
          <p>
            歡迎使用「115年度基隆市地方型產業創新研發推動計畫 (地方型 SBIR)
            申請系統」（以下簡稱本系統）。當您登入並使用本系統時，即表示您已閱讀、瞭解並同意接受本服務條款之所有內容。
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-2">一、帳號與安全性</h2>
            <p className="mb-3">本系統採用第三方（如 Google）帳號登入機制。您有責任維持該帳號及密碼的機密安全。</p>
            <p>若您發現帳號遭到盜用或有其他任何安全問題發生時，請立即通知本計畫專案辦公室。</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">二、使用者義務與承諾</h2>
            <p className="mb-3">
              您承諾絕不為任何非法目的或以任何非法方式使用本系統，並承諾遵守中華民國相關法規及一切使用網際網路之國際慣例。
            </p>
            <p>
              您保證於本系統填寫及上傳之所有企業資料、計畫書、營業執照等文件，均為真實、正確且最新之資料。若有虛偽不實，除取消申請資格外，您需自負相關法律責任。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">三、智慧財產權的保護</h2>
            <p className="mb-3">您上傳至本系統之計畫書及相關文件，其智慧財產權仍歸屬於您或您的企業所有。</p>
            <p>
              為辦理審查作業之需，您同意基隆市政府及計畫執行團隊（包含評審委員）得於審查目的範圍內，重製、閱覽或下載您所提交之資料。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">四、系統中斷或故障</h2>
            <p>
              本系統有時可能會出現中斷或故障等現象，或許將造成您使用上的不便、資料喪失、錯誤等情形。建議您於填寫重要資料（如計畫書內容）時，應自行於本地端存檔備份。本系統對於您因使用（或無法使用）本系統而造成的損害，不負任何賠償責任。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">五、條款之修改</h2>
            <p>
              本系統保留隨時修改本服務條款之權利，修改後的條款將公佈於本網站上，不另行個別通知。您於任何修改或變更後繼續使用本服務，視為您已閱讀、瞭解並同意接受該等修改或變更。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
