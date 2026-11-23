import { AuthScreen } from "@/features/auth/auth-screen";
import { Dashboard } from "@/features/dashboard/dashboard";
import { currentAccount } from "@/features/auth/server";
import { asDate } from "@/shared/dates";
import { workoutId } from "@/features/heart/server";
import { whoopStatuses, type WhoopStatus } from "@/features/heart/whoop";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: {
  searchParams: Promise<{ heart?: string | string[]; whoop?: string | string[] }>;
}) {
  const viewer = await currentAccount();
  if (!viewer) return <AuthScreen />;
  const params = await searchParams;
  const id = workoutId.safeParse(params.heart);
  const result = whoopStatuses.find((value: WhoopStatus) => value === params.whoop);
  return <Dashboard viewer={viewer} initialDate={asDate(Date.now(), "UTC")}
    heartReturn={id.success && result ? { id: id.data, result } : undefined} />;
}
