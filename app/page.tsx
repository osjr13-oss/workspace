import { redirect } from "next/navigation";
import { Landing } from "@/components/landing";
import { getOptionalUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { user } = await getOptionalUser();
  if (user) redirect("/chats");
  return <Landing />;
}
