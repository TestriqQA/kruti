import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/components/LandingPage";
import HomeJsonLd from "@/components/HomeJsonLd";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");
  return (
    <>
      {/* D-05: server-rendered, so the structured data is in view-source. */}
      <HomeJsonLd />
      <LandingPage />
    </>
  );
}
