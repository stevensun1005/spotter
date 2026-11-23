import Dashboard from "./dashboard";
import { getChatGPTUser } from "./chatgpt-auth";
import { asDate } from "./workout";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const identity = user && { id: user.userId, name: user.fullName || user.email.split("@")[0] };
  return <Dashboard viewer={identity} initialDate={asDate()} />;
}
