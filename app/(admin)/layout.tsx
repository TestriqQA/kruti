import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import { getImagePromptsRevealUntil } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const revealUntil = await getImagePromptsRevealUntil();
  const imagePromptsRevealUntil =
    revealUntil && revealUntil.getTime() > Date.now() ? revealUntil.toISOString() : null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <AdminSidebar user={session.user} imagePromptsRevealUntil={imagePromptsRevealUntil} />
      <main className="flex-1 overflow-y-auto scroll-gutter-stable">
        <div className="max-w-7xl mx-auto w-full p-6">{children}</div>
      </main>
    </div>
  );
}
