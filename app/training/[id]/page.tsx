import { redirect } from "next/navigation";
import Dashboard from "@/app/dashboard";
import { workoutAt } from "@/features/training/route";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { asDate } from "@/app/workout";

export const dynamic = "force-dynamic";

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = workoutAt("/training/" + (await params).id);
  if (!id) redirect("/");
  const user = await getChatGPTUser();
  const identity = user && { id: user.userId, name: user.fullName || user.email.split("@")[0] };
  return <Dashboard viewer={identity} initialDate={asDate()} initialWorkoutId={id} />;
}
