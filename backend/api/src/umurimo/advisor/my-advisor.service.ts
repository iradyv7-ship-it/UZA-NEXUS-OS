import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Actor } from '@uza/contracts';
import { UmurimoAccessService } from '../umurimo-authz.service';
import { WeekService } from '../week/week.service';
import { buildMyAdvisorBrief } from './my-advisor-brief';

const RESOURCE = 'week-advisor';

/** Same model and budget as the executive advisor — see planning/advisor/advisor.service.ts. */
const MODEL = 'claude-opus-5';
const MAX_TOKENS = 8_000;

export interface MyAdvisorTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface MyAdvisorAskInput {
  readonly question: string;
  readonly history?: readonly MyAdvisorTurn[];
}

/**
 * The employee-facing advisor — Claude, reading one person's own week.
 *
 * `AdvisorService` (planning/advisor) reads the whole register for the CEO/venture_manager.
 * This is the same idea turned inward: every internal role already holds `week:read` for
 * their own plan, blockers and scorecard (see `umurimo-access.ts`) — asking their own
 * advisor about that same data is not a new authority, so this gates on `week:read`, not a
 * new capability.
 *
 * Same three limits as the executive advisor, for the same reasons:
 *
 *  1. **Read-only.** It suggests; it does not edit an objective, clear a blocker, or file a
 *     report on anyone's behalf.
 *  2. **Grounded.** Built from `WeekService.myWeek()` and `.scorecard()` — the exact same
 *     data the person already sees on their own screen, nothing else.
 *  3. **Self-scoped, never comparative.** There is no cross-person data anywhere in the
 *     grounding brief, on purpose — `UmurimoModule`'s own charter is "reports upward on
 *     work, never on people," and a coach that could say "you're behind Aline" would
 *     violate that even though nobody asked it to.
 */
@Injectable()
export class MyAdvisorService {
  private readonly logger = new Logger(MyAdvisorService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly access: UmurimoAccessService,
    private readonly week: WeekService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  private system(): string {
    return [
      "You are the personal work advisor inside UZA Nexus, coaching one employee on their own week.",
      '',
      'You are given that person\'s own committed objectives, the problems they own, what they',
      'are still owed by others, requests aimed at them, and their scorecard — graded only',
      'against what THEY said they would do.',
      '',
      'How to answer:',
      '- Ground every claim in what is given. Never invent a target, a deadline, or a comparison',
      '  that is not in the brief.',
      '- You have no visibility into anyone else\'s week and must never imply a comparison to',
      '  another person, a team average, or a target you were not given.',
      '- Be direct, specific and short. Name the objective or blocker by its text or ref.',
      '- You cannot edit anything. If you think an objective should change, a blocker needs a',
      "  date, or a request needs answering, say so as something for THEM to do — never as done.",
      '- If the week looks fine, say so plainly. Manufacturing urgency where none exists is worse',
      '  than saying nothing.',
    ].join('\n');
  }

  private async grounding(actor: Actor): Promise<string> {
    const [mine, scorecard] = await Promise.all([
      this.week.myWeek(actor),
      this.week.scorecard(actor),
    ]);

    return buildMyAdvisorBrief({
      periodKey: mine.periodKey,
      objectives: mine.plan?.objectives ?? [],
      needsMyConfirmation: mine.needsMyConfirmation,
      reportFiled: mine.reportFiled,
      iOwe: mine.iOwe,
      waitingOnSomebody: mine.waitingOnSomebody,
      askedOfMe: mine.askedOfMe.map((c) => ({ ref: c.ref, body: c.body })),
      scorecard,
    });
  }

  async ask(actor: Actor, input: MyAdvisorAskInput): Promise<{ answer: string; groundedOn: string }> {
    await this.access.assertRole(actor, 'week:read', RESOURCE, 'ask');
    if (!input.question.trim()) throw new BadRequestException('ask something');
    if (!this.client) {
      throw new ServiceUnavailableException(
        'the advisor is not configured — set ANTHROPIC_API_KEY for the API process',
      );
    }

    const grounding = await this.grounding(actor);
    const history = (input.history ?? []).map((t) => ({ role: t.role, content: t.content }));

    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: this.system(),
      messages: [
        ...history,
        {
          role: 'user',
          content: `YOUR WEEK, AS OF NOW\n\n${grounding}\n\n---\n\n${input.question.trim()}`,
        },
      ],
    });

    let final: Anthropic.Message;
    try {
      final = await stream.finalMessage();
    } catch (err) {
      this.logger.error(`self-advisor call failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('the advisor could not be reached');
    }

    const answer = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    await this.access.allow(actor, RESOURCE, 'ask');
    return { answer, groundedOn: grounding };
  }

  /** The fixed question, for a "coach me" button that needs nothing typed. */
  async coachMe(actor: Actor): Promise<{ answer: string; groundedOn: string }> {
    return this.ask(actor, {
      question: [
        'Look at my week and tell me, in this order:',
        '1. Of what I committed to, what is genuinely at risk of not happening — and why,',
        '   specifically, based on what I have already logged.',
        '2. Which blocker I own is the one to clear first, and what the actual next step is.',
        '3. Anything I raised that is still nobody\'s — what should I do about it this week.',
        '4. Any request aimed at me I have not answered.',
        '5. One thing to focus on next, in one sentence.',
      ].join('\n'),
    });
  }
}
