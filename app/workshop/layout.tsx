import { redirect } from "next/navigation";

// 工作坊已結束：阻擋 /workshop/*（redirect 會導向首頁，無法同時顯示本 Layout 的 JSX）
export default function WorkshopLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect("/");
}
