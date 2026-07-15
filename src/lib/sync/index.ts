export {
  CANONICAL_APP_ORIGIN,
  getSpaceRelayBaseUrl,
  isSpaceRelayConfigured,
  SPACE_RELAY_UI_ENABLED,
} from "./config";
export { defaultSpaceSync, normalizeSpaceSync } from "./defaults";
export { getDeviceId, getDeviceSecret } from "./deviceIdentity";
export {
  assertNoPrivateNotes,
  buildSharedSnapshot,
  type SharedSpaceSnapshot,
} from "./sharedSnapshot";
export {
  createRoom,
  joinRoom,
  pullRoom,
  pushRoom,
  deleteRoom,
  SpaceRelayNotConfiguredError,
  type CreateRoomResult,
  type JoinRoomResult,
  type PullResult,
} from "./client";
