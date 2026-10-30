import assert from "node:assert/strict";
import test from "node:test";
import { ACCOUNT_DRAWER_KEEP_OPEN_SELECTOR, isWorkspacePanelOutsideClick } from "./workspacePanelOutsideClick";

const target = (insideKeepOpenSurface: boolean) => ({ closest: () => (insideKeepOpenSurface ? {} : null) }) as unknown as EventTarget;

test("a click outside the panel, rail and overlays dismisses the panel", () => {
  assert.equal(isWorkspacePanelOutsideClick(target(false)), true);
});

test("clicks inside the panel, rail or an overlay keep it open", () => {
  assert.equal(isWorkspacePanelOutsideClick(target(true)), false);
});

test("a non-element target keeps it open", () => {
  assert.equal(isWorkspacePanelOutsideClick(null), false);
  assert.equal(isWorkspacePanelOutsideClick({} as EventTarget), false);
});

test("the account drawer uses its own keep-open surfaces", () => {
  const seen: string[] = [];
  const probe = { closest: (selector: string) => { seen.push(selector); return null; } } as unknown as EventTarget;
  assert.equal(isWorkspacePanelOutsideClick(probe, ACCOUNT_DRAWER_KEEP_OPEN_SELECTOR), true);
  assert.match(seen[0]!, /#character-drawer/);
  assert.match(seen[0]!, /\.office-account-button/);
});
