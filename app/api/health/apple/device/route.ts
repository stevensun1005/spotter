import { appleDeviceOwner } from "@/features/heart/apple/server";
import { api, json } from "@/server/http";

// This identity is derived from the paired device token, never from a browser-supplied owner.
export const GET = api((request) => json({ owner: appleDeviceOwner(request) }));
