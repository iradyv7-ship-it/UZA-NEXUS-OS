import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Actor } from '@uza/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningAccessService } from '../planning/planning-authz.service';
import { redact } from './intake-lanes';

const RESOURCE = 'signalTriage';
const MODEL = 'claude-opus-5';

/**
 * Deliberately no extended thinking. Triage is a filing decision against a list that fits
 * on one screen; adaptive thinking would add latency and cost to a task that does not
 * reward it, and the forced tool call is what keeps the output shaped.
 */
const TOOL: Anthropic.Tool = {
  name: 'file_signal',
  description: 'Record where this signal belongs and how confident you are.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          'One paragraph, at most three sentences, saying what this is and why it matters. Written for the CEO to scan, not to admire.',
      },
      initiativeRef: {
        type: 'string',
        description:
          'The INIT-YYYY-NNNN this belongs to, or the empty string if none of them fit. Do not force a fit.',
      },
      proposedAction: {
        type: 'string',
        description:
          'What a person should do with this: a next action to set, a decision to raise, a new initiative to open, or nothing.',
      },
      confidence: {
        type: 'number',
        description:
          'Between 0 and 1. Below 0.5 means you are guessing, and saying so is more useful than guessing well.',
      },
      noise: {
        type: 'boolean',
        description:
          'True if this carries no decision, no commitment and no new fact — chatter, acknowledgements, output.',
      },
    },
    required: ['summary', 'proposedAction', 'confidence', 'noise'],
  },
};

/**
 * Triage — the advisor reading the intake queue.
 *
 * One model call per signal, never a batch. Batching would be cheaper, but two signals
 * from different walls in one call is one context holding both, which is precisely the
 * adjacency the compartmentalisation rules exist to prevent. Paying for separate calls is
 * the cost of that guarantee and it is a small one.
 *
 * Everything sent to the model is redacted first. Not because the model is the risk, but
 * because whatever comes back is written to `summary`, and `summary` is a shared field.
 *
 * Triage writes only to the Signal row. It cannot create an initiative, set a next action,
 * or raise a decision — it proposes, in text, and a person acts.
 */
@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);
  private readonly client: Anthropic | null;

  /** A cap per run so a large backlog drains predictably instead of in one huge bill. */
  private static readonly MAX_PER_RUN = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: PlanningAccessService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async run(actor?: Actor): Promise<{ triaged: number; noise: number; skipped: number }> {
    if (actor) await this.access.assertRole(actor, 'intake:write', RESOURCE, 'run');
    if (!this.client) throw new ServiceUnavailableException('triage needs ANTHROPIC_API_KEY');

    const pending = await this.prisma.signal.findMany({
      where: { status: 'new' },
      orderBy: { occurredAt: 'asc' },
      take: TriageService.MAX_PER_RUN,
    });
    if (!pending.length) return { triaged: 0, noise: 0, skipped: 0 };

    const initiatives = await this.prisma.initiative.findMany({
      where: { status: 'active' },
      select: { ref: true, name: true, ventureCode: true, attention: true, nextAction: true },
      orderBy: { ref: 'asc' },
    });
    const register = initiatives
      .map(
        (i) =>
          `[${i.ref}] ${i.name} — ${i.ventureCode ?? 'unassigned'}, ${i.attention}${i.nextAction ? `, next: ${i.nextAction}` : ''}`,
      )
      .join('\n');
    const knownRefs = new Set(initiatives.map((i) => i.ref));

    let triaged = 0;
    let noise = 0;
    let skipped = 0;

    for (const signal of pending) {
      try {
        const result = await this.ask(register, signal.title, signal.body);
        if (!result) {
          skipped += 1;
          continue;
        }
        // The model may name an initiative that does not exist. Drop it rather than
        // storing a dangling ref — a proposal pointing at nothing is worse than none.
        const ref =
          result.initiativeRef && knownRefs.has(result.initiativeRef) ? result.initiativeRef : null;

        await this.prisma.signal.update({
          where: { ref: signal.ref },
          data: {
            status: result.noise ? 'dismissed' : 'triaged',
            dismissedReason: result.noise ? 'triage: no decision, commitment or new fact' : null,
            summary: redact(result.summary),
            proposedInitiativeRef: ref,
            proposedAction: result.noise ? null : redact(result.proposedAction),
            proposedConfidence: result.confidence,
            ...(result.noise ? { resolvedAt: new Date() } : {}),
          },
        });
        if (result.noise) noise += 1;
        else triaged += 1;
      } catch (err) {
        this.logger.error(`triage failed on ${signal.ref}: ${(err as Error).message}`);
        skipped += 1;
      }
    }

    if (actor) await this.access.allow(actor, RESOURCE, 'run');
    this.logger.log(`triage: ${triaged} filed, ${noise} dismissed as noise, ${skipped} skipped`);
    return { triaged, noise, skipped };
  }

  private async ask(register: string, title: string, body: string) {
    const message = await this.client!.messages.create({
      model: MODEL,
      max_tokens: 2_000,
      system: [
        'You file incoming signals against the UZA Solutions register.',
        'A signal is anything that arrived from outside the register: something the founder typed',
        'into a working session, an email, or a document that changed in the repository.',
        '',
        'Your job is to say where it belongs and what should be done about it. You are not',
        'summarising for its own sake — the summary exists so the CEO can decide in one read',
        'whether to act.',
        '',
        'Be strict about noise. Acknowledgements, "do that", "continue", tool output, and',
        'restatements of things already in the register carry nothing and should be marked noise.',
        'A signal is NOT noise if it contains a decision, a commitment, a number, a name, a',
        'constraint, or an instruction that is not already reflected in the register.',
        '',
        'Never invent an initiative reference. If nothing fits, return an empty string and say',
        'in proposedAction that this looks like a new initiative, naming what it would be called.',
      ].join('\n'),
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'file_signal' },
      messages: [
        {
          role: 'user',
          content: `THE REGISTER\n${register}\n\n---\n\nSIGNAL\nTitle: ${redact(title)}\n\n${redact(body).slice(0, 24_000)}`,
        },
      ],
    });

    const call = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!call) return null;
    const input = call.input as {
      summary?: string;
      initiativeRef?: string;
      proposedAction?: string;
      confidence?: number;
      noise?: boolean;
    };
    if (typeof input.summary !== 'string') return null;

    return {
      summary: input.summary,
      initiativeRef: input.initiativeRef?.trim() || null,
      proposedAction: input.proposedAction ?? '',
      confidence:
        typeof input.confidence === 'number' ? Math.max(0, Math.min(1, input.confidence)) : 0,
      noise: input.noise === true,
    };
  }
}
