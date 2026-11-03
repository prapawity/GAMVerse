import type { SpatialConversationMember } from "./spatialConversations.js";

function sameScalars(a: object, b: object, excludedKey?: string): boolean {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left).filter(key => key !== excludedKey);
  const rightKeys = Object.keys(right).filter(key => key !== excludedKey);
  return leftKeys.length === rightKeys.length && leftKeys.every(key =>
    Object.hasOwn(right, key) && left[key] === right[key]);
}

/** Copies projection inputs so later in-place mutations cannot hide an invalidation.
 * Positions are deliberately absent: authoritative membership is reconciled by
 * the room before these conversation-only fields are supplied.
 */
export class SpatialConversationInputs {
  private previous: SpatialConversationMember[] | null = null;

  unchanged(members: readonly SpatialConversationMember[]): boolean {
    return this.previous !== null && this.previous.length === members.length && members.every((member, index) => {
      const previous = this.previous![index]!;
      return sameScalars(previous, member, "mediaTarget") &&
        (previous.mediaTarget && member.mediaTarget
          ? sameScalars(previous.mediaTarget, member.mediaTarget)
          : previous.mediaTarget === member.mediaTarget);
    });
  }

  remember(members: readonly SpatialConversationMember[]): void {
    this.previous = members.map(member => member.mediaTarget
      ? { ...member, mediaTarget: { ...member.mediaTarget } }
      : { ...member });
  }
}
