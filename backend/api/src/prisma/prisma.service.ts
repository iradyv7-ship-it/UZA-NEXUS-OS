import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient for the process. Injected everywhere a service needs the
 * database. Transactions are opened with `prisma.$transaction(...)`; the outbox
 * relies on that to write an event row in the SAME transaction as a state change.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
