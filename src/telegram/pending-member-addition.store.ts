import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateFamilyMemberInput } from '../families/application/family-members.service';

const DRAFT_TTL_MS = 5 * 60 * 1000;

export interface PendingMemberAddition {
  readonly id: string;
  readonly chatId: number;
  readonly requestedByUserId: number;
  readonly input: CreateFamilyMemberInput;
  readonly expiresAt: Date;
}

@Injectable()
export class PendingMemberAdditionStore {
  private readonly drafts = new Map<string, PendingMemberAddition>();

  create(
    draft: Omit<PendingMemberAddition, 'id' | 'expiresAt'>,
  ): PendingMemberAddition {
    this.removeExpired();

    const pendingDraft: PendingMemberAddition = {
      ...draft,
      id: randomUUID(),
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    };
    this.drafts.set(pendingDraft.id, pendingDraft);

    return pendingDraft;
  }

  consume(id: string): PendingMemberAddition | null {
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

  get(id: string): PendingMemberAddition | null {
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
