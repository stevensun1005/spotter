import Dashboard from "./dashboard";
import { getChatGPTUser } from "./chatgpt-auth";
import { asDate } from "./workout";
import { workoutId } from "@/features/heart/server";
import { whoopStatuses, type WhoopStatus } from "@/features/heart/whoop";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ heart?: string; whoop?: string }> }) {
  const user = await getChatGPTUser();
  const identity = user && { id: user.userId, name: user.fullName || user.email.split("@")[0] };
  const { heart, whoop } = await searchParams;
  const result = whoopStatuses.find((value): value is WhoopStatus => value === whoop);
  const heartReturn = identity && heart && workoutId.safeParse(heart).success && result ? { id: heart, result } : undefined;
  return <Dashboard viewer={identity} initialDate={asDate()} heartReturn={heartReturn} />;
}
