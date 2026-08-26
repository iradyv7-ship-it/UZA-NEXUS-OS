import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { UmurimoAccessService } from '../umurimo-authz.service';
import { isCommentSubject, mayModerate, type CommentSubject } from '../umurimo-access';
import { commentRef, extractMentions } from '../umurimo-ids';
import { nextSequence, refPrefix } from '../../planning/planning-ids';

const RESOURCE = 'comment';
const MAX_BODY = 4000;

export interface PostComment {
  subjectType: string;
  subjectRef: string;
  body: string;
  /** `request` means the team owes an answer; it stays open until resolved. */
  kind?: 'comment' | 'request';
  /** Reply into an existing thread. */
  parentRef?: string;
}

/**
 * Comments — why a record is the way it is, attached to the record.
 *
 * This is NOT a chat service and the distinction is enforced by design rather than by policy:
 * every comment must name a subject from a fixed allowlist, so there is nowhere to put a
 * message that is not about a specific piece of work. The test, applied consistently: if the
 * message would be meaningless without knowing which record it concerns, it belongs here; if
 * it makes sense on its own, it belongs in WhatsApp.
 *
 * Two rules that matter more than they look:
 *
 *  - **A comment is never a side channel.** A person who cannot read the subject must not be
 *    able to read its comments, and mentioning them does not change that. Mentions notify;
 *    they never grant.
 *  - **Nobody rewrites anybody's words.** An author may edit their own comment (and the edit
 *    is stamped). Removing or altering someone else's requires `comment:moderate`, which only
 *    the executive holds.
 */
@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: UmurimoAccessService,
  ) {}

  /** Post a comment or an explicit request for comment against a record. */
  async post(actor: Actor, input: PostComment) {
    await this.access.assertRole(actor, 'comment:write', RESOURCE, 'create', input.subjectRef);

    const subjectType = this.assertSubject(input.subjectType);
    const body = this.assertBody(input.body);

    // A reply must live on the same subject as its parent. Without this check a thread can be
    // walked from a record the actor may read onto one they may not.
    if (input.parentRef) {
      const parent = await this.prisma.comment.findUnique({
        where: { ref: input.parentRef },
        select: { subjectType: true, subjectRef: true },
      });
      if (!parent) throw new NotFoundException(`comment ${input.parentRef} not found`);
      if (parent.subjectType !== subjectType || parent.subjectRef !== input.subjectRef) {
        throw new BadRequestException(
          'a reply must sit on the same subject as the comment it answers',
        );
      }
    }

    const seq = await nextSequence(this.prisma.comment, refPrefix('CMT'));
    const created = await this.prisma.comment.create({
      data: {
        ref: commentRef(seq),
        subjectType,
        subjectRef: input.subjectRef,
        parentRef: input.parentRef ?? null,
        authorId: actor.userId,
        body,
        kind: input.kind ?? 'comment',
        mentions: extractMentions(body),
      },
    });

    await this.access.allow(actor, RESOURCE, 'create', created.ref);
    return created;
  }

  /**
   * The whole thread on one record, oldest first, replies nested under their parent.
   *
   * Returned flat-with-children rather than as a tree of unknown depth: threads on a work item
   * are two levels in practice, and a recursive shape invites an interface that hides the
   * third level rather than one that refuses to create it.
   */
  async thread(actor: Actor, subjectType: string, subjectRef: string) {
    await this.access.assertRole(actor, 'comment:read', RESOURCE, 'read', subjectRef);
    const type = this.assertSubject(subjectType);

    const rows = await this.prisma.comment.findMany({
      where: { subjectType: type, subjectRef },
      orderBy: { createdAt: 'asc' },
    });

    await this.access.allow(actor, RESOURCE, 'read', subjectRef);

    const roots = rows.filter((r) => !r.parentRef);
    return roots.map((root) => ({
      ...root,
      replies: rows.filter((r) => r.parentRef === root.ref),
    }));
  }

  /**
   * Close an open request-for-comment.
   *
   * The author may close their own; the executive may close any. A person who asked a question
   * and got an answer elsewhere should be able to say so without needing a manager, and a
   * request that nobody can close becomes permanent noise in the digest.
   */
  async resolve(actor: Actor, ref: string, note?: string) {
    await this.access.assertRole(actor, 'comment:resolve', RESOURCE, 'resolve', ref);

    const comment = await this.prisma.comment.findUnique({ where: { ref } });
    if (!comment) throw new NotFoundException(`comment ${ref} not found`);
    if (comment.kind !== 'request') {
      throw new BadRequestException(`comment ${ref} is not a request — only a request can be resolved`);
    }
    if (comment.resolvedAt) return comment; // idempotent; re-resolving is not an error

    const isAuthor = comment.authorId === actor.userId;
    if (!isAuthor && !mayModerate(actor.role)) {
      return this.access.denyScope(actor, RESOURCE, 'resolve', ref);
    }

    const updated = await this.prisma.comment.update({
      where: { ref },
      data: { resolvedAt: new Date(), resolvedBy: actor.userId, resolvedNote: note ?? null },
    });
    await this.access.allow(actor, RESOURCE, 'resolve', ref);
    return updated;
  }

  /** Edit your own comment. The edit is stamped; the original is not preserved by design. */
  async edit(actor: Actor, ref: string, body: string) {
    await this.access.assertRole(actor, 'comment:write', RESOURCE, 'update', ref);

    const comment = await this.prisma.comment.findUnique({ where: { ref } });
    if (!comment) throw new NotFoundException(`comment ${ref} not found`);
    if (comment.authorId !== actor.userId && !mayModerate(actor.role)) {
      return this.access.denyScope(actor, RESOURCE, 'update', ref);
    }

    const clean = this.assertBody(body);
    const updated = await this.prisma.comment.update({
      where: { ref },
      data: { body: clean, mentions: extractMentions(clean), editedAt: new Date() },
    });
    await this.access.allow(actor, RESOURCE, 'update', ref);
    return updated;
  }

  /** Every open request for comment, newest first. Feeds the weekly digest. */
  async openRequests(actor: Actor, mentioningMe = false) {
    await this.access.assertRole(actor, 'comment:read', RESOURCE, 'list');
    const rows = await this.prisma.comment.findMany({
      where: {
        kind: 'request',
        resolvedAt: null,
        ...(mentioningMe ? { mentions: { has: actor.userId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    await this.access.allow(actor, RESOURCE, 'list');
    return rows;
  }

  private assertSubject(value: string): CommentSubject {
    if (!isCommentSubject(value)) {
      throw new BadRequestException(
        `unknown comment subject "${value}" — add it to COMMENT_SUBJECTS deliberately`,
      );
    }
    return value;
  }

  private assertBody(body: string): string {
    const clean = body.trim();
    if (!clean) throw new BadRequestException('a comment cannot be empty');
    if (clean.length > MAX_BODY) {
      throw new BadRequestException(`a comment cannot exceed ${MAX_BODY} characters`);
    }
    return clean;
  }
}
