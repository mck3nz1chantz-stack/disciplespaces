/**
 * Shared-layer snapshot for Space room create / join / sync.
 * Explicit allow-list — private notes must never appear here.
 */

import type {
  Member,
  PrayerBoardEntry,
  Session,
  Space,
  SpaceKind,
  SpaceTemplateId,
} from "../../types";

export interface SharedSpaceSnapshot {
  v: 1;
  kind: "ds-shared-snapshot";
  spaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  members: Member[];
  preferredBibleVersion: "KJV";
  spaceTemplate?: SpaceTemplateId;
  spaceKind?: SpaceKind;
  defaultSessionTemplateId?: string;
  inviteCode?: string;
  sessions: Session[];
  prayerBoard: PrayerBoardEntry[];
  exportedAt: string;
}

/** Build a shared snapshot from local data. Never includes private notes. */
export function buildSharedSnapshot(
  space: Space,
  sessions: Session[],
  prayerBoard: PrayerBoardEntry[],
): SharedSpaceSnapshot {
  return {
    v: 1,
    kind: "ds-shared-snapshot",
    spaceId: space.id,
    name: space.name,
    description: space.description,
    createdAt: space.createdAt,
    members: space.members.map((m) => ({
      id: m.id,
      name: m.name,
      joinedAt: m.joinedAt,
    })),
    preferredBibleVersion: "KJV",
    spaceTemplate: space.spaceTemplate,
    spaceKind: space.spaceKind,
    defaultSessionTemplateId: space.defaultSessionTemplateId,
    inviteCode: space.inviteCode,
    sessions: sessions
      .filter((s) => s.spaceId === space.id)
      .map((s) => ({
        id: s.id,
        spaceId: s.spaceId,
        date: s.date,
        templateId: s.templateId,
        attendees: s.attendees ?? [],
        passagesStudied: s.passagesStudied ?? [],
        responses: s.responses,
        notes: s.notes,
        sharedNotes: s.sharedNotes,
        keyTakeaways: s.keyTakeaways,
        actionItems: s.actionItems,
      })),
    prayerBoard: prayerBoard
      .filter((e) => e.spaceId === space.id)
      .map((e) => ({
        id: e.id,
        spaceId: e.spaceId,
        sessionId: e.sessionId,
        scope: e.scope,
        kind: e.kind,
        authorMemberId: e.authorMemberId,
        authorName: e.authorName,
        subject: e.subject,
        content: e.content,
        status: e.status,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    exportedAt: new Date().toISOString(),
  };
}

/** Reject payloads that accidentally include private note keys. */
export function assertNoPrivateNotes(payload: unknown): void {
  const json = JSON.stringify(payload);
  if (
    /"privateNotes?"\s*:/i.test(json) ||
    /"kind"\s*:\s*"private/i.test(json)
  ) {
    throw new Error(
      "Refusing to sync: private note data must never leave this device.",
    );
  }
}
