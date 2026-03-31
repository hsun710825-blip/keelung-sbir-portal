import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: "基隆市地方型 SBIR 計畫申請系統隱私權政策。",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 md:p-10 shadow-sm">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-wide mb-8">基隆市地方型 SBIR 計畫申請系統 - 隱私權政策</h1>

        <div className="space-y-6 leading-relaxed text-[15px]">
          <p>
            歡迎您使用「115年度基隆市地方型產業創新研發推動計畫 (地方型 SBIR)
            申請系統」（以下簡稱本系統）。為了讓您能夠安心使用本系統的各項服務與資訊，特此向您說明本系統的隱私權保護政策，以保障您的權益，請您詳閱下列內容：
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-2">一、隱私權保護政策的適用範圍</h2>
            <p>
              隱私權保護政策內容，包括本系統如何處理在您使用網站服務時收集到的個人識別資料。隱私權保護政策不適用於本系統以外的相關連結網站，也不適用於非本系統所委託或參與管理的人員。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">二、個人資料的蒐集、處理及利用方式</h2>
            <p className="mb-3">
              當您造訪本系統或使用本系統所提供之功能服務時，我們將視該服務功能性質，請您提供必要的個人資料（包含但不限於透過 Google
              帳號登入所取得之電子郵件、姓名），並在該特定目的範圍內處理及利用您的個人資料。
            </p>
            <p className="mb-3">
              針對計畫申請，系統將收集您所填寫的企業資訊、聯絡人資料及計畫書內容。這些資料僅供基隆市政府及本計畫執行團隊進行資格審查、評審作業、聯繫及相關行政處理使用。
            </p>
            <p>
              除非取得您的同意或其他法令之特別規定，本系統絕不會將您的個人資料揭露予第三人或使用於蒐集目的以外之其他用途。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">三、資料之保護</h2>
            <p>
              本系統主機均設有防火牆、防毒系統等相關的各項資訊安全設備及必要的安全防護措施，加以保護網站及您的個人資料。僅由經過授權的人員才能接觸您的個人及計畫資料，相關處理人員皆簽有保密合約，如有違反保密義務者，將受相關法律處分。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">四、與第三人共用個人資料之政策</h2>
            <p>
              本系統絕不會提供、交換、出租或出售任何您的個人資料給其他個人、團體、私人企業或公務機關，但有法律依據或合約義務者，不在此限。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">五、隱私權保護政策之修正</h2>
            <p>本系統隱私權保護政策將因應需求隨時進行修正，修正後的條款將刊登於網站上。</p>
          </section>
        </div>
      </div>
    </main>
  );
}
