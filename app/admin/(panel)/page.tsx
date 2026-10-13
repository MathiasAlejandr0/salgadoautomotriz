import { Suspense } from "react";
import AdminGate from "@/components/admin/AdminGate";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminGate />
    </Suspense>
  );
}