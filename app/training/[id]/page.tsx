import { redirect } from "next/navigation";
import { AuthScreen } from "@/features/auth/auth-screen";
import { Dashboard } from "@/features/dashboard/dashboard";
import { currentAccount } from "@/features/auth/server";
import { workoutAt } from "@/features/training/route";
import { asDate } from "@/shared/dates";

export const dynamic = "force-dynamic";

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const workout = workoutAt("/training/" + (await params).id);
  if (!workout) redirect("/");
  const viewer = await currentAccount();
  if (!viewer) return <AuthScreen />;
  return <Dashboard viewer={viewer} initialDate={asDate(Date.now(), "UTC")} initialWorkoutId={workout} />;
}
