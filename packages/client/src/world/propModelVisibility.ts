import type { Object3D } from "three";
import type { RoomLayoutZone } from "@gammyverse/shared";
import { PROP_MODEL_LOAD_BATCH_SIZE, PROP_RENDER_CULL_INTERVAL_MS, shouldLoadPropModel, shouldRenderDistanceCulledProp } from "./propDistanceCulling";
import type { RoadsideSceneryVisibility } from "./roadsideScenery";
import { isCoveredPosition, isInsideZone, type ZonePosition } from "./zoneVisibility";
export type DeferredPropModel = { propId: string; position: ZonePosition; started: boolean; start: () => void };
type PropVisibilityFocus = ZonePosition & { rotation?: number };
/** Camera forward uses the same (sin, cos) convention as player facing. */
export function propVisibilityFocus(position: ZonePosition, lookAt: ZonePosition): PropVisibilityFocus {
  return { x: lookAt.x, z: lookAt.z, rotation: Math.atan2(lookAt.x - position.x, lookAt.z - position.z) };
}
export class PropModelVisibility {
  private nextLoadAtMs = 0;
  private nextCullAtMs = 0;
  private coveredKey = "";
  update(now: number, editing: boolean, local: (ZonePosition & { rotation?: number }) | undefined, focus: PropVisibilityFocus,
    roadsideScenery: RoadsideSceneryVisibility, deferredPropModelLoads: readonly DeferredPropModel[], distanceCulledPropVisuals: readonly Object3D[],
    covered: readonly RoomLayoutZone[], offset: ZonePosition, editProps = false, zones: readonly RoomLayoutZone[] = [], currentPrivateZoneId: string | null = null): void {
    const focusInLayout = { x: focus.x - offset.x, z: focus.z - offset.z };
    // Props are authored in layout coordinates, while their Three.js objects
    // and the camera pose are offset into the centered map scene. Keep range
    // checks in layout space and anchor normal play to the character so zooming
    // the campus overview cannot pull distant props into render range.
    const distanceObserver = editing ? focusInLayout : local ?? focusInLayout;
    const privateRoom = editProps
      ? zones.find(zone => zone.kind === "private" && isInsideZone(focusInLayout, zone))
      : !editing && currentPrivateZoneId ? zones.find(zone => zone.id === currentPrivateZoneId && zone.kind === "private") : undefined;
    const key = JSON.stringify([covered.map(zone => zone.id), privateRoom?.id ?? null]);
    if (this.coveredKey !== key) { this.nextCullAtMs = 0; this.coveredKey = key; }
    const hiddenInLayout = (position: ZonePosition) => {
      if (privateRoom && !isInsideZone(position, privateRoom)) return true;
      return isCoveredPosition(position, covered);
    };
    const hiddenInWorld = (position: ZonePosition) => hiddenInLayout({ x: position.x - offset.x, z: position.z - offset.z });
    if (now >= this.nextCullAtMs) {
      const observer = editing ? { ...focusInLayout, rotation: focus.rotation } : local;
      roadsideScenery.update(observer, editing, prop => hiddenInLayout(prop));
    }
    if (now >= this.nextLoadAtMs) {
      this.nextLoadAtMs = now + PROP_RENDER_CULL_INTERVAL_MS;
      const remainingLoads = PROP_MODEL_LOAD_BATCH_SIZE;
      // Prioritise the closest props, so the area at the centre of the
      // screen fills first rather than following the saved props' order.
      const closest: Array<{ pending: typeof deferredPropModelLoads[number]; distanceSquared: number }> = [];
      for (const pending of deferredPropModelLoads) {
        const positionInLayout = { x: pending.position.x - offset.x, z: pending.position.z - offset.z };
        if (pending.started || hiddenInWorld(pending.position) || !(roadsideScenery.visibilityFor(pending.propId) ?? shouldLoadPropModel(positionInLayout, distanceObserver))) continue;
        const dx = positionInLayout.x - distanceObserver.x;
        const dz = positionInLayout.z - distanceObserver.z;
        const candidate = { pending, distanceSquared: dx * dx + dz * dz };
        const insertAt = closest.findIndex((entry) => candidate.distanceSquared < entry.distanceSquared);
        if (insertAt === -1) {
          if (closest.length < remainingLoads) closest.push(candidate);
        } else {
          closest.splice(insertAt, 0, candidate);
          if (closest.length > remainingLoads) closest.pop();
        }
      }
      for (const candidate of closest) candidate.pending.start();
    }
    if (now >= this.nextCullAtMs) {
      this.nextCullAtMs = now + PROP_RENDER_CULL_INTERVAL_MS;
      for (const visual of distanceCulledPropVisuals) {
        const positionInLayout = { x: visual.position.x - offset.x, z: visual.position.z - offset.z };
        visual.visible = !hiddenInWorld(visual.position) && (roadsideScenery.visibilityFor(visual.userData.officeMapPropId)
          ?? shouldRenderDistanceCulledProp(positionInLayout, distanceObserver, visual.visible));
      }
    }
  }
}
