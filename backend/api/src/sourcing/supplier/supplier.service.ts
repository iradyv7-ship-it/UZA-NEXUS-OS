import { Injectable, NotFoundException } from '@nestjs/common';
import type { Actor, SupplierLifecycle } from '@uza/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../platform/authorization/authorization.service';
import { supplierRef as renderSupplierRef } from '../sourcing-ids';
import { findByClientRequestId } from '../sync';

export interface NewSupplier {
  readonly nameEn: string;
  readonly nameZh: string;
  readonly country?: string;
  readonly relationshipOwnerId?: string;
  /** Offline-capture idempotency key (device-generated). A replay is a no-op. */
  readonly clientRequestId?: string;
}

export interface NewCertification {
  readonly name: string;
  readonly issuer?: string;
  readonly number?: string;
  readonly issuedAt?: Date;
  readonly expiresAt?: Date;
}

/**
 * Suppliers — the head of the sourcing-intelligence record. EN + CN names, a lifecycle,
 * certifications, and a `score` that is a competitive asset. The score is NEVER written
 * here by hand: it moves only through SupplierScoreService, which logs every change with
 * its cause. This service creates and reads the supplier and its static intelligence
 * (certifications, lifecycle), and masks confidential fields on read.
 */
@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async register(actor: Actor, input: NewSupplier) {
    await this.authz.authorize(actor, 'supplier', 'create');

    const existing = await findByClientRequestId(this.prisma.supplier, input.clientRequestId);
    if (existing) return existing;

    return this.prisma.$transaction(async (tx) => {
      const seq = (await tx.supplier.count()) + 1;
      return tx.supplier.create({
        data: {
          ref: renderSupplierRef(seq),
          nameEn: input.nameEn,
          nameZh: input.nameZh,
          country: input.country ?? 'CN',
          relationshipOwnerId: input.relationshipOwnerId ?? null,
          clientRequestId: input.clientRequestId ?? null,
        },
      });
    });
  }

  /** Advance (or suspend/block) a supplier through its lifecycle. */
  async setLifecycle(actor: Actor, ref: string, lifecycle: SupplierLifecycle) {
    await this.authz.authorize(actor, 'supplier', 'update');
    const supplier = await this.prisma.supplier.findUnique({ where: { ref } });
    if (!supplier) throw new NotFoundException(`supplier ${ref} not found`);
    return this.prisma.supplier.update({ where: { ref }, data: { lifecycle } });
  }

  async addCertification(actor: Actor, ref: string, cert: NewCertification) {
    await this.authz.authorize(actor, 'supplier', 'update');
    const supplier = await this.prisma.supplier.findUnique({ where: { ref } });
    if (!supplier) throw new NotFoundException(`supplier ${ref} not found`);
    return this.prisma.supplierCertification.create({
      data: {
        supplierRef: ref,
        name: cert.name,
        issuer: cert.issuer ?? null,
        number: cert.number ?? null,
        issuedAt: cert.issuedAt ?? null,
        expiresAt: cert.expiresAt ?? null,
      },
    });
  }

  async read(actor: Actor, ref: string) {
    await this.authz.authorize(actor, 'supplier', 'read');
    const supplier = await this.prisma.supplier.findUnique({
      where: { ref },
      include: { certifications: true, scoreEvents: true },
    });
    if (!supplier) throw new NotFoundException(`supplier ${ref} not found`);
    return this.authz.mask(actor, { ...supplier });
  }
}
