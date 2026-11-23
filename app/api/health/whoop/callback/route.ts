import { getChatGPTUser } from "@/app/chatgpt-auth";
import { requireHeartWorkout, saveHeart, workoutId } from "@/features/heart/server";
import { readWhoopWorkout, whoopCallbackFlow, whoopEnabled, type WhoopStatus } from "@/features/heart/whoop";
import { publicOrigin } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const target = new URL("/", publicOrigin(request));
  const redirect = () => new Response(null, {
    status: 303,
    headers: { Location: target.href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  const account = await getChatGPTUser();
  if (!account || !whoopEnabled()) return redirect();
  const flow = await whoopCallbackFlow(request, account.userId);
  if (!flow || !workoutId.safeParse(flow.workout).success) return redirect();

  let status: WhoopStatus = "cancelled";
  if (flow.code) {
    try {
      const window = await requireHeartWorkout(account.userId, flow.workout);
      const heart = await readWhoopWorkout(request, flow.code, window);
      if (heart) await saveHeart(account.userId, flow.workout, heart);
      status = heart ? "synced" : "empty";
    } catch {
      status = "error";
    }
  }
  target.searchParams.set("heart", flow.workout);
  target.searchParams.set("whoop", status);
  return redirect();
}
