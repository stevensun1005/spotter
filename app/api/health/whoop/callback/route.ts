import { currentAccount } from "@/features/auth/server";
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
  const account = await currentAccount();
  if (!account || !whoopEnabled()) return redirect();
  const flow = await whoopCallbackFlow(request, account.id);
  if (!flow || !workoutId.safeParse(flow.workout).success) return redirect();

  let status: WhoopStatus = "cancelled";
  if (flow.code) {
    try {
      const window = requireHeartWorkout(account.id, flow.workout);
      const heart = await readWhoopWorkout(request, flow.code, window);
      if (heart) saveHeart(account.id, flow.workout, heart);
      status = heart ? "synced" : "empty";
    } catch {
      status = "error";
    }
  }
  target.searchParams.set("heart", flow.workout);
  target.searchParams.set("whoop", status);
  return redirect();
}
