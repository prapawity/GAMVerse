import assert from "node:assert/strict";
import test from "node:test";
import { CHARACTER_MODEL_MAX_BYTES, CHARACTER_MODEL_SIZE_ERROR } from "@gammyverse/shared";
import { validateGlb } from "./characterModels.js";

test("GLB validation accepts a 15 MiB model and rejects one byte over the limit", () => {
  const json = JSON.stringify({ asset: { version: "2.0" }, nodes: [{}], meshes: [{}] });
  const jsonBytes = Math.ceil(Buffer.byteLength(json) / 4) * 4;
  const glb = Buffer.alloc(15 * 1024 * 1024);
  glb.write("glTF", 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonBytes, 12);
  glb.write("JSON", 16);
  glb.write(json.padEnd(jsonBytes), 20);
  const binHeader = 20 + jsonBytes;
  glb.writeUInt32LE(glb.length - binHeader - 8, binHeader);
  glb.writeUInt32LE(0x004e4942, binHeader + 4);

  assert.equal(CHARACTER_MODEL_MAX_BYTES, glb.length);
  assert.equal(validateGlb(glb), null);
  assert.equal(validateGlb(Buffer.concat([glb, Buffer.alloc(1)])), CHARACTER_MODEL_SIZE_ERROR);
});

test("required Meshopt GLBs can use a URI-less fallback but must decode from the embedded binary", () => {
  const meshopt = "EXT_meshopt_compression";
  const json = {
    asset: { version: "2.0" },
    nodes: [{}],
    meshes: [{}],
    extensionsRequired: [meshopt],
    buffers: [{ byteLength: 4 }, { byteLength: 12 }],
    bufferViews: [{
      buffer: 1, byteLength: 12,
      extensions: { [meshopt]: { buffer: 0, byteLength: 4, byteStride: 4, count: 3, mode: "TRIANGLES" } },
    }],
  };
  const makeGlb = (metadata: object) => {
    const raw = JSON.stringify(metadata);
    const jsonLength = Math.ceil(raw.length / 4) * 4;
    const glb = Buffer.alloc(20 + jsonLength + 8 + 4);
    glb.write("glTF");
    glb.writeUInt32LE(2, 4);
    glb.writeUInt32LE(glb.length, 8);
    glb.writeUInt32LE(jsonLength, 12);
    glb.write("JSON", 16);
    glb.write(raw.padEnd(jsonLength), 20);
    glb.writeUInt32LE(4, 20 + jsonLength);
    glb.writeUInt32LE(0x004e4942, 24 + jsonLength);
    return glb;
  };
  assert.equal(validateGlb(makeGlb(json)), null);
  assert.match(validateGlb(makeGlb({ ...json, extensionsRequired: [] })) ?? "", /embedded/);
  assert.match(validateGlb(makeGlb({
    ...json, buffers: [json.buffers[0], { ...json.buffers[1], uri: "fallback.bin" }],
  })) ?? "", /embedded/);
  json.bufferViews[0].extensions[meshopt].buffer = 1;
  assert.match(validateGlb(makeGlb(json)) ?? "", /embedded/);
});
