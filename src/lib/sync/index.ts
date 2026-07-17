export {
  CANONICAL_APP_ORIGIN,
  getSpaceRelayBaseUrl,
  isSpaceRelayConfigured,
  SPACE_RELAY_UI_ENABLED,
} from "./config";
export {
  defaultSpaceSync,
  normalizeSpaceSync,
  canConnectSpaceToRelay,
  isSpaceGuest,
} from "./defaults";
export { getDeviceId, getDeviceSecret } from "./deviceIdentity";
export {
  assertNoPrivateNotes,
  buildSharedSnapshot,
  type SharedSpaceSnapshot,
} from "./sharedSnapshot";
export {
  createRoom,
  joinRoom,
  previewRoom,
  pullRoom,
  pushRoom,
  deleteRoom,
  rotateJoinCode,
  registerSpaceRoom,
  normalizeShortCode,
  SpaceRelayNotConfiguredError,
  type CreateRoomResult,
  type JoinRoomResult,
  type PreviewRoomResult,
  type PullResult,
} from "./client";
