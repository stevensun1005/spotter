import assert from "node:assert/strict";
import { test } from "node:test";
import { isSpotterApp, oauthNotice, oauthNoticeText, supportsNativeOAuth } from "../features/auth/oauth-ui.ts";

test("federated login distinguishes browser, older app, and supported native app", () => {
  const web = "Mozilla/5.0 AppleWebKit/605.1.15";
  assert.equal(isSpotterApp(web), false);
  assert.equal(isSpotterApp(web + " Spotter/1.0"), true);
  assert.equal(supportsNativeOAuth(web + " Spotter/1.0"), false);
  assert.equal(supportsNativeOAuth(web + " Spotter/1.0 SpotterOAuth/1"), true);
  assert.equal(supportsNativeOAuth(web + " SpotterOAuth/10"), false);
});

test("callback query parameters can select only a fixed login message", () => {
  assert.equal(oauthNotice("linked"), "linked");
  assert.match(oauthNoticeText("use-access-code"), /原登录方式或访问码/);
  for (const value of ["<script>", "constructor", "signed-in", ["linked"], null]) {
    assert.equal(oauthNotice(value), undefined);
  }
});
