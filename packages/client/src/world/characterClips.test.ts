import assert from "node:assert/strict";
import test from "node:test";
import { pickCharacterClips, shouldUseProceduralRig } from "./characterClips";

const clips = (...names: string[]) => names.map(name => ({ name }));

test("Kenney clip names still resolve exactly", () => {
  const picked = pickCharacterClips(clips("idle", "walk", "run", "sit", "dance"));
  assert.deepEqual([picked.idle?.name, picked.walk?.name, picked.run?.name, picked.sit?.name, picked.dance?.name], ["idle", "walk", "run", "sit", "dance"]);
});

test("exported names with prefixes and extra words are recognised", () => {
  const picked = pickCharacterClips(clips("Armature|Standing Idle", "mixamo.com|Walking", "Armature|Fast_Run", "Sitting Idle", "Hip Hop Dancing"));
  assert.equal(picked.walk?.name, "mixamo.com|Walking");
  assert.equal(picked.run?.name, "Armature|Fast_Run");
  assert.equal(picked.idle?.name, "Armature|Standing Idle");
  assert.equal(picked.dance?.name, "Hip Hop Dancing");
});

test("a walk clip is never reused as the run clip", () => {
  const picked = pickCharacterClips(clips("Walk", "Jog"));
  assert.equal(picked.walk?.name, "Walk");
  assert.equal(picked.run?.name, "Jog");
  assert.equal(pickCharacterClips(clips("Walking")).run, undefined);
});

test("unrelated or opaque clip names match nothing", () => {
  const picked = pickCharacterClips(clips("mixamo.com", "Take 001", "Situp", "Runway pose"));
  assert.equal(picked.idle, undefined);
  assert.equal(picked.walk, undefined);
  assert.equal(picked.sit, undefined);
});

test("an uploaded model with no walk clip is driven by the procedural rig, one with a walk clip is not", () => {
  const customId = "custom-11111111-1111-4111-8111-111111111111";
  assert.equal(shouldUseProceduralRig(customId, pickCharacterClips(clips("mixamo.com"))), true);
  assert.equal(shouldUseProceduralRig(customId, pickCharacterClips([])), true);
  assert.equal(shouldUseProceduralRig(customId, pickCharacterClips(clips("Idle"))), true, "idle alone leaves the legs still while moving");
  assert.equal(shouldUseProceduralRig(customId, pickCharacterClips(clips("Idle", "Walk"))), false);
  assert.equal(shouldUseProceduralRig("character-pm-jimmy", pickCharacterClips(clips("Idle", "Walk"))), true);
  assert.equal(shouldUseProceduralRig("character-kenney-a", pickCharacterClips([])), false);
});

test("the procedural rig finds bones whatever their letter case", async () => {
  const THREE = await import("three");
  const { createProceduralHumanoidRig } = await import("./proceduralHumanoidMotion");
  const root = new THREE.Group();
  for (const name of ["Armature_UpperArm.L", "Armature_UpperArm.R"]) { const bone = new THREE.Bone(); bone.name = name; root.add(bone); }
  assert.ok(createProceduralHumanoidRig(root), "Blender-style upper arm bones are found");
  assert.equal(createProceduralHumanoidRig(new THREE.Group()), null);
});
