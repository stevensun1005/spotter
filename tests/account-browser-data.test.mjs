import assert from "node:assert/strict";
import { test } from "node:test";
import { clearDeletedAccountBrowserData } from "../features/auth/account-browser-data.ts";
import { accountDeletedPath } from "../features/auth/paths.ts";

function browserStorage(keys) {
  const items = new Set(keys);
  return {
    keys: () => [...items],
    get length() { return items.size; },
    key: (index) => [...items][index] ?? null,
    removeItem: (key) => items.delete(key),
  };
}

test("deletion clears the target account's data and preserves other accounts and browser preferences", () => {
  const owner = "account@example.com";
  const otherOwner = "account@example.com-other";
  const localKeys = [
    "spotter-drafts:", "spotter:nutrition-cache:", "spotter:workout-reminder:",
    "spotter:workout-reminder-delivered:", "spotter:anthropic-sharing:v1:",
  ];
  const keepLocal = ["spotter:display", "spotter-drafts:demo", ...localKeys.map((key) => key + otherOwner),
    `spotter-checkin:${encodeURIComponent(otherOwner)}:1`];
  const keepSession = [`spotter-workout-clocks:${otherOwner}:clock:1`];
  const localStorage = browserStorage([...keepLocal, ...localKeys.map((key) => key + owner),
    `spotter-checkin:${encodeURIComponent(owner)}:1`, `spotter-checkin:${encodeURIComponent(owner)}:2`]);
  const sessionStorage = browserStorage([...keepSession, `spotter-workout-clocks:${owner}:clock:1`, `spotter-workout-clocks:${owner}:clock:2`]);

  clearDeletedAccountBrowserData(owner, { localStorage, sessionStorage });

  assert.deepEqual(localStorage.keys(), keepLocal);
  assert.deepEqual(sessionStorage.keys(), keepSession);
});

test("deletion tolerates blocked browser storage and still clears the available clock data", () => {
  const sessionStorage = browserStorage(["spotter-workout-clocks:account:clock:1"]);
  clearDeletedAccountBrowserData("account", {
    get localStorage() { throw new DOMException("Blocked", "SecurityError"); },
    sessionStorage,
  });
  assert.deepEqual(sessionStorage.keys(), []);
});

test("deletion redirects to sign-in and carries only a fixed confirmation status", () => {
  assert.equal(accountDeletedPath(false), "/sign-in?return_to=%2F&account_deleted=done");
  assert.equal(accountDeletedPath(true), "/sign-in?return_to=%2F&account_deleted=apple");
});
