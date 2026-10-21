import { Tx } from '../prisma/prisma.service';

/**
 * Incrémente atomiquement un compteur et renvoie la nouvelle valeur.
 * INSERT … ON CONFLICT garantit l'unicité même en cas d'appels simultanés.
 */
export async function nextCounter(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0].value;
}

/** Numéro lisible annuel : PREFIX-AAAA-00001 */
export async function nextYearlyNumber(tx: Tx, prefix: string, date = new Date(), pad = 5): Promise<string> {
  const year = date.getUTCFullYear();
  const value = await nextCounter(tx, `${prefix}-${year}`);
  return `${prefix}-${year}-${String(value).padStart(pad, '0')}`;
}

/** Référence séquentielle simple : PREFIX-0001 */
export async function nextReference(tx: Tx, prefix: string, pad = 4): Promise<string> {
  const value = await nextCounter(tx, prefix);
  return `${prefix}-${String(value).padStart(pad, '0')}`;
}
