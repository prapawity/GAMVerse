import assert from "node:assert/strict";
import test from "node:test";
import { AnimationMixer, BoxGeometry, Group, Mesh, SphereGeometry } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { prepareStaticAvatarRig } from "./staticAvatarRig";

for (const count of [2, 4]) {
  test(`auto-rig generates a working gait for a ${count}-legged avatar clone`, () => {
    const model = new Group();
    const body = new Mesh(new BoxGeometry(0.65, 0.45, count === 4 ? 1.35 : 0.35));
    body.position.y = 0.8;
    model.add(body);
    for (const z of count === 4 ? [-0.52, 0.52] : [0]) {
      for (const x of [-0.24, 0.24]) {
        const foot = new Mesh(new SphereGeometry(0.12, 12, 10));
        foot.position.set(x, 0.18, z);
        foot.scale.y = 1.5;
        model.add(foot);
      }
    }
    const rig = prepareStaticAvatarRig(model);
    assert.ok(rig);
    assert.deepEqual(rig.animations.map(clip => clip.name), ["Idle", "Walk"]);
    const instance = clone(rig.scene);
    assert.equal(instance.getObjectsByProperty("isBone", true).length, count + 1);
    const leg = instance.getObjectByName("AutoRigLeg0")!;
    const rest = leg.position.y;
    const mixer = new AnimationMixer(instance);
    mixer.clipAction(rig.animations[1]).play();
    mixer.setTime(0.225);
    assert.ok(leg.position.y > rest);
    assert.equal(model.getObjectsByProperty("isBone", true).length, 0);
  });
}

test("a static box stays unchanged when no feet are detected", () => {
  const model = new Group();
  model.add(new Mesh(new BoxGeometry()));
  assert.equal(prepareStaticAvatarRig(model), null);
});
