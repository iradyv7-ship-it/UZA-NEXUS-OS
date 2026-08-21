import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanningAccessService } from '../planning-authz.service';
import { ReviewService } from '../review/review.service';

const RESOURCE = 'advisor';

/** Opus 5. Adaptive thinking; `budget_tokens` is rejected on this model. */
const MODEL = 'claude-opus-5';
const MAX_TOKENS = 16_000;

export interface AdvisorTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface AskInput {
  readonly question: string;
  /** Prior turns, oldest first. The caller owns the thread; this service stays stateless. */
  readonly history?: readonly AdvisorTurn[];
}

/**
 * The advisor — Claude, reading the register.
 *
 * It exists to make the Monday review a conversation rather than a report. Every call is
 * grounded in the SAME text the review produces (`ReviewService.brief`), so the advisor
 * cannot describe a state of the business that the register does not contain.
 *
 * Three deliberate limits:
 *
 *  1. **Read-only.** The advisor never writes to the register. It can propose an
 *     initiative, a next action, or a decision; a human creates it. An advisor that can
 *     silently edit the register destroys the one property that makes the register
 *     useful — that everything in it was put there on purpose.
 *  2. **Grounded.** The register brief is passed as context on every turn. The system
 *     prompt requires it to say when the register does not contain the answer instead of
 *     filling the gap.
 *  3. **Executive-gated.** `advisor` is a ceo/venture_manager capability. The brief
 *     contains every venture's state at once, which is exactly the cross-venture view
 *     the object-scope rules withhold from everyone else.
 */
@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
    private readonly review: ReviewService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    // Absent key is not a boot failure — the rest of Planning must run without it.
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  private system(): string {
    return [
      'You are the operating advisor inside UZA Nexus, the system that runs UZA Solutions Ltd (Rwanda).',
      'You are talking to the founder and CEO, Yves Iradukunda Nsengiyumva, or to a venture manager.',
      '',
      'UZA Solutions runs several ventures at once: UZA Bulk (sourcing and import), UZA Mobility',
      '(vehicle supply, the Tunga Taxi driver-financing programme with LOLC Unguka, EV charging,',
      'the garage), UZA Empower (training and impact), UZA Cloud (software), and UZA Nexus itself.',
      '',
      'You are given the current register below: what is running, what is held, what filed a',
      'check-in, what stayed silent, and what decisions are waiting on the CEO.',
      '',
      'How to answer:',
      '- Ground every claim in the register. If the register does not say, say that it does not say,',
      '  and name what would have to be recorded for the question to be answerable.',
      '- Be direct and plain. No preamble, no restating the question, no consultant register.',
      '- Lead with the answer. Then the reasoning, briefly.',
      '- Attention is finite. If you are asked what to do next, be willing to say what to stop.',
      '- Reference initiatives by their ref (INIT-YYYY-NNNN) and decisions by theirs (DEC-YYYY-NNNN).',
      '- You cannot change the register. When you propose a new initiative, a next action, or a',
      '  decision, state it as a proposal for the CEO to enter, not as something done.',
      '- Silence in the register is a finding, not a gap to smooth over. A running initiative with',
      '  no check-in means either it is not running or it has no real owner. Say so.',
    ].join('\n');
  }

  /** The grounding block: the week's review plus the full register, one line per initiative. */
  private async context(actor: Actor): Promise<string> {
    const brief = await this.review.brief(actor);
    const initiatives = await this.prisma.initiative.findMany({
      where: { status: 'active' },
      orderBy: [{ ventureCode: 'asc' }, { attention: 'asc' }],
    });
    const lines = initiatives.map((i) => {
      const bits = [
        `[${i.ref}] ${i.name}`,
        `venture=${i.ventureCode ?? '-'}`,
        `attention=${i.attention}`,
        `owner=${i.ownerId}`,
      ];
      if (i.nextAction) bits.push(`next="${i.nextAction}"`);
      if (i.reviewAt) bits.push(`review=${i.reviewAt.toISOString().slice(0, 10)}`);
      if (i.targetDate) bits.push(`target=${i.targetDate.toISOString().slice(0, 10)}`);
      if (i.artifactUrl) bits.push(`doc=${i.artifactUrl}`);
      return `- ${bits.join(' | ')}`;
    });
    return `${brief}\n\nFULL REGISTER (${initiatives.length} active)\n${lines.join('\n')}`;
  }

  async ask(actor: Actor, input: AskInput): Promise<{ answer: string; groundedOn: string }> {
    await this.access.assertRole(actor, 'advisor', RESOURCE, 'ask');
    if (!input.question.trim()) throw new BadRequestException('ask something');
    if (!this.client) {
      throw new ServiceUnavailableException(
        'the advisor is not configured — set ANTHROPIC_API_KEY for the API process',
      );
    }

    const grounding = await this.context(actor);
    const history = (input.history ?? []).map((t) => ({ role: t.role, content: t.content }));

    // Streaming rather than a single create() call: these answers run long, and a
    // non-streamed request at this max_tokens is the classic way to hit a request timeout.
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: this.system(),
      messages: [
        ...history,
        {
          role: 'user',
          content: `THE REGISTER, AS OF NOW\n\n${grounding}\n\n---\n\n${input.question.trim()}`,
        },
      ],
    });

    let final: Anthropic.Message;
    try {
      final = await stream.finalMessage();
    } catch (err) {
      this.logger.error(`advisor call failed: ${(err as Error).message}`);
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

  /**
   * The standing Monday question, asked for you. Same path as `ask`, fixed prompt — so the
   * founder can open one endpoint and get the week read back to him without typing anything.
   */
  async weeklyRead(actor: Actor): Promise<{ answer: string; groundedOn: string }> {
    return this.ask(actor, {
      question: [
        'Read this week for me. In this order:',
        '1. What actually moved, and what is the register claiming moved that the check-ins do not support?',
        '2. What is silent, and what does the silence mean for each one specifically?',
        '3. Which held initiatives are past their review date — start, re-date, or park each?',
        '4. The decisions waiting on me: which is the most expensive to keep waiting, and why?',
        '5. One thing to stop this week.',
      ].join('\n'),
    });
  }
}
