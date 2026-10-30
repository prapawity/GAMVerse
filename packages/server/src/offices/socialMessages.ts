import {
  isValidReaction,
  isValidHandRaise,
  type PlayerState,
} from "@gammyverse/shared";
import type { SpotlightRequest } from "@gammyverse/shared";
import { OfficeChat, type ChatPerson } from "./chat.js";
import { persistChatMessage } from "./chatRepository.js";
import { getOfficeRole } from "./repository.js";
import { Spotlight } from "./spotlight.js";
import { ReactionGate } from "./reactions.js";
import { revokeSpotlightParticipant } from "../media/service.js";
import { logServerError } from "../infra/logger.js";
const CHAT_SEND_FAILED_LABEL = "Chat could not be sent.";
const SPOTLIGHT_COMMAND_FAILED_LABEL = "Spotlight command failed.";
import { HAND_RAISE_MAX_DURATION_MS } from "./handRaiseLifetime.js";
export { HAND_RAISE_MAX_DURATION_MS };
const handRaiseTimers = new WeakMap<SocialRoom, Map<string, ReturnType<typeof setTimeout>>>();

type Client = {
  sessionId: string;
  send: (event: string, payload: unknown) => void;
};
type SocialRoom = {
  state: {
    spotlightUsernames: Map<string, boolean>;
    spotlightEpoch: string;
  };
  onMessage: (
    event: string,
    handler: (client: Client, payload: unknown) => void,
  ) => void;
  broadcast: (event: string, payload: unknown) => void;
};
type SpotlightRequestSnapshot = { incoming: SpotlightRequest[]; outgoing: SpotlightRequest[] };
type SocialState = {
  username: (id: string) => string | undefined;
  player: (id: string) => PlayerState | undefined;
  people: () => ChatPerson[];
  client: (id: string) => Client | undefined;
};
type OfficeSocial = {
  states: Map<SocialRoom, SocialState>;
  spotlight: Spotlight;
  chat: OfficeChat;
  reactions: ReactionGate;
};
const offices = new Map<string, OfficeSocial>();
function sendSpotlightState(
  room: SocialRoom,
  snapshot: {
    usernames: string[];
    epoch: string;
  },
) {
  room.state.spotlightUsernames.clear();
  for (const username of snapshot.usernames)
    room.state.spotlightUsernames.set(username, true);
  room.state.spotlightEpoch = snapshot.epoch;
  room.broadcast("spotlight-state", snapshot);
}
function sendSpotlightRequests(states: ReadonlyMap<SocialRoom, SocialState>, username: string, snapshot: SpotlightRequestSnapshot) {
  for (const state of states.values())
    for (const person of state.people())
      if (person.username === username) state.client(person.sessionId)?.send("spotlight-requests", snapshot);
}
function officeSocial(officeId: string) {
  const existing = offices.get(officeId);
  if (existing) return existing;
  const states = new Map<SocialRoom, SocialState>();
  const spotlight = new Spotlight(officeId, {
    role: (username) => getOfficeRole(username, officeId),
    revoke: revokeSpotlightParticipant,
    changed: (snapshot) => {
      for (const room of states.keys()) sendSpotlightState(room, snapshot);
    },
    requestsChanged: (username, snapshot) => sendSpotlightRequests(states, username, snapshot),
  });
  const chat = new OfficeChat(officeId, {
    role: (username) => getOfficeRole(username, officeId),
    persist: persistChatMessage,
    people: () => [...states.values()].flatMap((state) => state.people()),
    deliver: (id, message) => {
      for (const state of states.values())
        state.client(id)?.send("chat-message", message);
    },
  });
  const social = { states, spotlight, chat, reactions: new ReactionGate() };
  offices.set(officeId, social);
  return social;
}
function registerChat(room: SocialRoom, state: SocialState, chat: OfficeChat) {
  room.onMessage("chat", (client, payload) => {
    const username = state.username(client.sessionId);
    if (username)
      void chat
        .send(client.sessionId, username, payload)
        .catch(() =>
          client.send("chat-error", { error: CHAT_SEND_FAILED_LABEL }),
        );
  });
}
function registerReactions(
  room: SocialRoom,
  state: SocialState,
  social: OfficeSocial,
) {
  room.onMessage("reaction", (client, payload) => {
    if (
      !state.player(client.sessionId) ||
      !isValidReaction(payload) ||
      !social.reactions.accept(client.sessionId)
    )
      return;
    for (const target of social.states.keys())
      target.broadcast("reaction", {
        sessionId: client.sessionId,
        emoji: payload.emoji,
      });
  });
}
/**
 * Without this handler Colyseus treats "hand-raise" as an unregistered message and drops the sender
 * (production) or errors them (dev mode), which disconnected anyone who pressed the button.
 */
function registerHandRaise(room: SocialRoom, state: SocialState) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  handRaiseTimers.set(room, timers);
  room.onMessage("hand-raise", (client, payload) => {
    const player = state.player(client.sessionId);
    if (!player || !isValidHandRaise(payload)) return;
    const existing = timers.get(client.sessionId);
    if (payload.raised) {
      // A repeated raise cannot extend the one-minute maximum.
      if (player.handRaised && existing) return;
      if (existing) clearTimeout(existing);
      player.handRaised = true;
      const timer = setTimeout(() => {
        timers.delete(client.sessionId);
        const current = state.player(client.sessionId);
        if (current) current.handRaised = false;
      }, HAND_RAISE_MAX_DURATION_MS);
      timer.unref?.();
      timers.set(client.sessionId, timer);
      return;
    }
    if (existing) clearTimeout(existing);
    timers.delete(client.sessionId);
    player.handRaised = false;
  });
}
export function registerSocialMessages(
  room: SocialRoom,
  officeId: string,
  state: SocialState,
) {
  const social = officeSocial(officeId);
  social.states.set(room, state);
  sendSpotlightState(room, social.spotlight.snapshot());
  for (const person of state.people())
    if (person.username) state.client(person.sessionId)?.send("spotlight-requests", social.spotlight.requestSnapshot(person.username));
  registerChat(room, state, social.chat);
  registerReactions(room, state, social);
  registerHandRaise(room, state);
  room.onMessage("spotlight", (client, payload) => {
    const username = state.username(client.sessionId);
    if (username)
      void social.spotlight.command(username, payload).catch(() =>
        client.send("spotlight-error", {
          error: SPOTLIGHT_COMMAND_FAILED_LABEL,
        }),
      );
  });
  room.onMessage("spotlight-sync", (client) => {
    const username = state.username(client.sessionId);
    if (username) client.send("spotlight-requests", social.spotlight.requestSnapshot(username));
  });
  return social.spotlight;
}
export function unregisterSocialMessages(room: SocialRoom, officeId: string, rotateOnFinalDispose = true) {
  const social = offices.get(officeId);
  if (!social) return;
  social.states.delete(room);
  for (const timer of handRaiseTimers.get(room)?.values() ?? []) clearTimeout(timer);
  handRaiseTimers.delete(room);
  if (social.states.size > 0) return;
  offices.delete(officeId);
  if (!rotateOnFinalDispose) return;
  void social.spotlight
    .close()
    .catch((error) =>
      logServerError("realtime", "spotlight.close.failed", error, { officeId }),
    );
}

export function socialPeople(
  players: Iterable<[string, PlayerState]>,
  zones: Map<string, { id: string }>,
  groups: Map<string, string>,
  admittedZoneSessions?: ReadonlySet<string>,
) {
  const people: ChatPerson[] = [];
  for (const [sessionId, player] of players) {
    if (player.presence !== "online") continue;
    const zone = zones.get(sessionId);
    const group = groups.get(sessionId);
    let channel = ["solo", sessionId];
    if (zone && (!admittedZoneSessions || admittedZoneSessions.has(sessionId))) channel = ["zone", zone.id];
    else if(zone) channel = ["solo",sessionId];
    else if (group) channel = ["proximity", group];
    people.push({
      sessionId,
      username: player.username,
      channel: JSON.stringify(channel),
    });
  }
  return people;
}
