import AdminPageClient from "@/components/admin/AdminPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPage() {
  return <AdminPageClient />;
}
