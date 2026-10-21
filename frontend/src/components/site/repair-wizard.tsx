'use client';

import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { RepairCatalog, RepairEstimate } from '@/lib/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { waLink } from '@/lib/whatsapp';
import { BrandStep, EstimateStep, FreeDeviceStep, IssueStep, ModelStep, type Brand, type Model, type ModelPrice, type RepairType } from './repair-steps';

type Step = 'brand' | 'model' | 'device' | 'issue' | 'estimate';
const STEPS: Step[][] = [['brand'], ['model', 'device'], ['issue'], ['estimate']];

/**
 * Devis de réparation : marque, modèle, panne, estimation.
 * La demande part ensuite directement sur le WhatsApp de la boutique, avec un message pré-rempli.
 */
export function RepairWizard({ catalog, initialBrand, whatsapp }: { catalog: RepairCatalog; initialBrand?: string; whatsapp: string | null }) {
  const [step, setStep] = useState<Step>('brand');
  const [brand, setBrand] = useState<Brand | null>(null);
  const [freeBrand, setFreeBrand] = useState('');
  const [model, setModel] = useState<Model | null>(null);
  const [freeModel, setFreeModel] = useState('');
  const [type, setType] = useState<RepairType | null>(null);
  const [prices, setPrices] = useState<ModelPrice[] | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialBrand) return;
    if (initialBrand === 'autre') return setStep('device');
    const b = catalog.brands.find((x) => x.slug === initialBrand);
    if (b) {
      setBrand(b);
      setStep('model');
    }
  }, [initialBrand, catalog.brands]);

  useEffect(() => {
    if (!model) return setPrices(null);
    setLoadingPrices(true);
    api
      .get<ModelPrice[]>(`/repair-catalog/models/${model.id}/prices`)
      .then(setPrices)
      .catch(() => setPrices([]))
      .finally(() => setLoadingPrices(false));
  }, [model]);

  const go = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const deviceLabel = [brand?.name ?? freeBrand, model?.name ?? freeModel].filter(Boolean).join(' ');
  const estimate: RepairEstimate | null = (type && prices?.find((p) => p.repairTypeId === type.id)) || null;
  const current = STEPS.findIndex((s) => s.includes(step));
  const message = type
    ? [
        'Bonjour TH Store, je souhaite un devis de réparation :',
        `• Téléphone : ${deviceLabel}`,
        `• Panne : ${type.name}`,
        estimate ? `• Estimation affichée sur le site : ${formatPrice(estimate.totalPrice)}` : '• Estimation personnalisée demandée',
      ].join('\n')
    : '';

  const back = () => {
    if (step === 'model' || (step === 'device' && !brand)) go('brand');
    else if (step === 'device') go('model');
    else if (step === 'issue') go(model ? 'model' : 'device');
    else if (step === 'estimate') go('issue');
  };

  return (
    <div ref={top} className="mx-auto max-w-3xl scroll-mt-28">
      <ol className="mb-8 grid grid-cols-4 gap-1.5" aria-label="Progression">
        {STEPS.map((s, i) => (
          <li key={i} aria-current={i === current ? 'step' : undefined}>
            <span className={cn('block h-1 rounded-full transition-colors', i <= current ? 'bg-ochre' : 'bg-line')} />
          </li>
        ))}
      </ol>
      {step !== 'brand' && (
        <button type="button" onClick={back} className="mb-4 inline-flex items-center gap-1.5 text-[14px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Retour
        </button>
      )}
      <div key={step} className="animate-slide-up">
        {step === 'brand' && (
          <BrandStep
            brands={catalog.brands}
            onPick={(b) => {
              setBrand(b);
              setModel(null);
              setFreeBrand('');
              go(b.models.length ? 'model' : 'device');
            }}
            onOther={() => {
              setBrand(null);
              setModel(null);
              go('device');
            }}
          />
        )}
        {step === 'model' && brand && (
          <ModelStep
            brand={brand}
            onPick={(m) => {
              setModel(m);
              setFreeModel('');
              go('issue');
            }}
            onOther={() => go('device')}
          />
        )}
        {step === 'device' && (
          <FreeDeviceStep
            askBrand={!brand}
            initialBrand={brand?.name ?? freeBrand}
            onSubmit={(b, m) => {
              if (!brand) setFreeBrand(b);
              setModel(null);
              setFreeModel(m);
              go('issue');
            }}
          />
        )}
        {step === 'issue' && (
          <IssueStep
            types={catalog.types}
            prices={model ? prices : []}
            loadingPrices={Boolean(model) && loadingPrices}
            onPick={(t) => {
              setType(t);
              go('estimate');
            }}
          />
        )}
        {step === 'estimate' && type && <EstimateStep estimate={estimate} deviceLabel={deviceLabel} issueLabel={type.name} whatsappHref={waLink(whatsapp, message)} />}
      </div>
    </div>
  );
}
