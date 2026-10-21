'use client';

import { ArrowRight, Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RepairCatalog, RepairEstimate, ShopBrand } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatDuration, formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { WhatsAppButton } from './whatsapp';

export type Brand = ShopBrand;
export type Model = { id: string; name: string };
export type RepairType = RepairCatalog['types'][number];
export type ModelPrice = RepairEstimate & { repairTypeId: string };

const choice =
  'flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border bg-surface px-5 py-3 text-left text-[15px] transition-all hover:-translate-y-0.5 hover:border-navy hover:shadow-card focus-visible:border-accent';

export function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[12px] text-faint">Étape {n}</p>
      <h2 className="display mt-1 text-[26px] sm:text-[30px]">{title}</h2>
      {hint && <p className="mt-1.5 text-[14px] text-muted">{hint}</p>}
    </div>
  );
}

export function BrandStep({ brands, onPick, onOther }: { brands: Brand[]; onPick: (b: Brand) => void; onOther: () => void }) {
  return (
    <div>
      <StepTitle n={1} title="Votre marque" />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {brands.map((b) => (
          <li key={b.id}>
            <button type="button" className={cn(choice, 'border-line-2 font-medium')} onClick={() => onPick(b)}>
              {b.name}
              <ArrowRight className="size-4 text-faint" />
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={cn(choice, 'border-dashed border-line-2 text-ink-2')} onClick={onOther}>
            Autre marque
            <ArrowRight className="size-4 text-faint" />
          </button>
        </li>
      </ul>
    </div>
  );
}

export function ModelStep({ brand, onPick, onOther }: { brand: Brand; onPick: (m: Model) => void; onOther: () => void }) {
  const [q, setQ] = useState('');
  const models = useMemo(() => brand.models.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase())), [brand, q]);
  return (
    <div>
      <StepTitle n={2} title={`Votre modèle ${brand.name}`} />
      {brand.models.length > 8 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un modèle" aria-label="Rechercher un modèle" className="pl-9" />
        </div>
      )}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {models.map((m) => (
          <li key={m.id}>
            <button type="button" className={cn(choice, 'border-line-2')} onClick={() => onPick(m)}>
              {m.name}
              <ArrowRight className="size-4 text-faint" />
            </button>
          </li>
        ))}
      </ul>
      {models.length === 0 && <p className="py-4 text-[14px] text-muted">Aucun modèle ne correspond à « {q} ».</p>}
      <button type="button" onClick={onOther} className="mt-4 text-[14px] font-medium text-accent underline">
        Mon modèle n’est pas dans la liste
      </button>
    </div>
  );
}

export function FreeDeviceStep({ askBrand, initialBrand, onSubmit }: { askBrand: boolean; initialBrand: string; onSubmit: (brand: string, model: string) => void }) {
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (brand.trim() && model.trim()) onSubmit(brand.trim(), model.trim());
      }}
    >
      <StepTitle n={2} title="Votre téléphone" />
      <div className="grid gap-4 sm:grid-cols-2">
        {askBrand && <Field label="Marque">{(p) => <Input {...p} value={brand} onChange={(e) => setBrand(e.target.value)} required maxLength={60} placeholder="Ex. Huawei" />}</Field>}
        <Field label="Modèle">{(p) => <Input {...p} value={model} onChange={(e) => setModel(e.target.value)} required maxLength={80} placeholder="Ex. P30 Lite" />}</Field>
      </div>
      <Button type="submit" className="mt-5" disabled={!brand.trim() || !model.trim()}>
        Continuer
      </Button>
    </form>
  );
}

export function IssueStep({ types, prices, loadingPrices, onPick }: { types: RepairType[]; prices: ModelPrice[] | null; loadingPrices: boolean; onPick: (t: RepairType) => void }) {
  return (
    <div>
      <StepTitle n={3} title="La panne" />
      <ul className="divide-y divide-line border-y border-line">
        {types.map((t) => {
          const price = prices?.find((p) => p.repairTypeId === t.id);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onPick(t)} className="group flex w-full items-center justify-between gap-4 py-4 text-left">
                <span>
                  <span className="block text-[15.5px] font-medium text-ink group-hover:underline">{t.name}</span>
                </span>
                <span className="shrink-0 text-right">
                  {loadingPrices ? (
                    <span className="block h-4 w-16 animate-pulse rounded-xs bg-paper-2" />
                  ) : price ? (
                    <span className="num block text-[15px] font-semibold">{formatPrice(price.totalPrice)}</span>
                  ) : (
                    <span className="block text-[13px] text-muted">Sur diagnostic</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function EstimateStep({ estimate, deviceLabel, issueLabel, whatsappHref }: { estimate: RepairEstimate | null; deviceLabel: string; issueLabel: string; whatsappHref: string }) {
  return (
    <div>
      <StepTitle n={4} title={`${deviceLabel} — ${issueLabel}`} />
      {estimate ? (
        <div className="glass-light rounded-3xl p-6">
          <p className="text-[13px] text-muted">Prix estimé</p>
          <p className="num mt-1 text-[40px] font-semibold leading-none text-accent">{formatPrice(estimate.totalPrice)}</p>
          <p className="mt-3 text-[13.5px] text-muted">
            Pièces {formatPrice(estimate.partsPrice)} · main-d’œuvre {formatPrice(estimate.laborPrice)}
            {estimate.durationMinutes ? ` · ${formatDuration(estimate.durationMinutes)}` : ''}
          </p>
          {estimate.conditions && <p className="mt-1 text-[13.5px] text-muted">{estimate.conditions}</p>}
        </div>
      ) : (
        <div className="glass-light rounded-3xl p-6">
          <p className="text-[17px] font-medium">Cette réparation nécessite une estimation personnalisée.</p>
        </div>
      )}
      <p className="mt-4 flex items-start gap-2 text-[13.5px] text-muted">
        <Check className="mt-0.5 size-4 shrink-0 text-ok" />
        Prix confirmé après diagnostic, avant toute intervention.
      </p>
      <WhatsAppButton href={whatsappHref} className="mt-6 w-full sm:w-auto">
        Envoyer ma demande sur WhatsApp
      </WhatsAppButton>
    </div>
  );
}
