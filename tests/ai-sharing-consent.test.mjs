import assert from "node:assert/strict";
import { test } from "node:test";
import { allowAnthropicSharing, allowsAnthropicSharing } from "../features/ai-coach/sharing-consent-store.ts";

test("Anthropic sharing is off until granted per account, device and consent version", () => {
  const values = new Map([["spotter:anthropic-sharing:v0:owner", "allowed"]]);
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(allowsAnthropicSharing(storage, "owner"), false);
  allowAnthropicSharing(storage, "owner");
  assert.equal(allowsAnthropicSharing(storage, "owner"), true);
  assert.equal(allowsAnthropicSharing(storage, "other-account"), false);
  assert.equal(allowsAnthropicSharing({ getItem: () => null }, "owner"), false);
  allowAnthropicSharing(storage, "");
  assert.equal(values.has("spotter:anthropic-sharing:v1:"), false);
});
