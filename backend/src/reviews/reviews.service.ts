import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewService, ReviewStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { CryptoService } from '../common/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { DONE_STATUSES } from '../repairs/repair-rules';

export interface ReviewInput {
  rating: number;
  ratingRepair?: number;
  ratingWelcome?: number;
  ratingValue?: number;
  comment?: string;
  displayName?: string;
  serviceType: ReviewService;
  code?: string;
}

export const SERVICE_LABELS: Record<ReviewService, string> = {
  REPAIR: 'Réparation',
  ACCESSORY_PURCHASE: "Achat d'accessoires",
  PHONE_PURCHASE: "Achat d'un téléphone",
  OTHER: 'Autre',
};

const CODE_ERROR = 'Ce code de vérification est invalide, expiré ou déjà utilisé.';

/**
 * Avis clients.
 * - Sans code : avis non vérifié, en attente de modération.
 * - Avec code : le backend vérifie que le code existe, n'est ni révoqué, ni expiré, ni utilisé,
 *   que la réparation est terminée et qu'aucun avis n'existe déjà pour ce dossier.
 *   L'avis est alors marqué « Réparation vérifiée » (et reste soumis à modération).
 * - Le contenu d'un avis n'est jamais modifié ; la modération ne change que son statut.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  /** Vérifie un code sans le consommer (affichage du contexte sur la page d'avis). */
  async checkCode(code: string) {
    const token = await this.findToken(code);
    return { valid: true, device: `${token.repairJob.brandName} ${token.repairJob.modelName}`, serviceType: 'REPAIR' as const };
  }

  private async findToken(code: string) {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 8 || normalized.length > 16) throw new BadRequestException(CODE_ERROR);
    const token = await this.prisma.reviewVerificationToken.findUnique({
      where: { codeHash: this.crypto.hmac(normalized, 'review') },
      include: { repairJob: { select: { id: true, status: true, brandName: true, modelName: true } } },
    });
    if (!token || token.revokedAt || token.usedAt || token.expiresAt < new Date() || !DONE_STATUSES.includes(token.repairJob.status)) {
      throw new BadRequestException(CODE_ERROR);
    }
    return token;
  }

  async submit(input: ReviewInput, ip: string | null) {
    const base = {
      rating: input.rating,
      ratingRepair: input.ratingRepair ?? null,
      ratingWelcome: input.ratingWelcome ?? null,
      ratingValue: input.ratingValue ?? null,
      comment: input.comment?.trim() || null,
      displayName: input.displayName?.trim().slice(0, 40) || null,
      ipHash: ip ? this.crypto.hmac(ip, 'ip') : null,
    };

    if (!input.code?.trim()) {
      await this.prisma.review.create({ data: { ...base, serviceType: input.serviceType, verified: false } });
      return { verified: false };
    }

    const token = await this.findToken(input.code);
    await this.prisma.run(async (tx) => {
      // Consommation atomique du code : une seule requête peut le marquer comme utilisé.
      const { count } = await tx.reviewVerificationToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (!count) throw new BadRequestException(CODE_ERROR);
      if (await tx.review.findUnique({ where: { repairJobId: token.repairJobId } })) {
        throw new ConflictException('Un avis a déjà été publié pour cette réparation.');
      }
      await tx.review.create({ data: { ...base, serviceType: 'REPAIR', verified: true, repairJobId: token.repairJobId } });
      await tx.repairStatusHistory.create({ data: { repairJobId: token.repairJobId, type: 'REVIEW', message: 'Avis client vérifié reçu' } });
    });
    return { verified: true };
  }

  async moderate(id: string, status: ReviewStatus, note: string | undefined, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Avis introuvable.');
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status, moderatedAt: new Date(), moderatedById: userId, moderationNote: note?.trim() || null },
    });
    await this.audit.log({ userId, action: 'review.moderate', entity: 'Review', entityId: id, summary: `Avis ${review.status} → ${status}${note ? ` : ${note}` : ''}` });
    return updated;
  }

  async reply(id: string, reply: string | null, userId: string) {
    const updated = await this.prisma.review.update({ where: { id }, data: { shopReply: reply?.trim() || null } });
    await this.audit.log({ userId, action: 'review.reply', entity: 'Review', entityId: id, summary: reply ? 'Réponse publique ajoutée' : 'Réponse publique retirée' });
    return updated;
  }
}
