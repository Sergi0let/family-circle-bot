import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConnectGoogleCalendarInput } from '../calendar/application/calendar-connections.service';

const DRAFT_TTL_MS = 5 * 60 * 1000;

export interface PendingCalendarConnection {
  readonly id: string;
  readonly chatId: number;
  readonly requestedByUserId: number;
  readonly input: ConnectGoogleCalendarInput;
  readonly expiresAt: Date;
}

@Injectable()
export class PendingCalendarConnectionStore {
  private readonly drafts = new Map<string, PendingCalendarConnection>();

  create(
    draft: Omit<PendingCalendarConnection, 'id' | 'expiresAt'>,
  ): PendingCalendarConnection {
    this.removeExpired();

    const pendingDraft: PendingCalendarConnection = {
      ...draft,
      id: randomUUID(),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    };
    this.drafts.set(pendingDraft.id, pendingDraft);

    return pendingDraft;
  }

  consume(id: string): PendingCalendarConnection | null {
    const draft = this.get(id);

    if (draft === null) {
      return null;
    }

    this.drafts.delete(id);
    return draft;
  }

  discard(id: string): void {
    this.drafts.delete(id);
  }

  get(id: string): PendingCalendarConnection | null {
    const draft = this.drafts.get(id);

    if (draft === undefined || draft.expiresAt.getTime() <= Date.now()) {
      this.drafts.delete(id);
      return null;
    }

    return draft;
  }

  private removeExpired(): void {
    for (const [id, draft] of this.drafts.entries()) {
      if (draft.expiresAt.getTime() <= Date.now()) {
        this.drafts.delete(id);
      }
    }
  }
}
