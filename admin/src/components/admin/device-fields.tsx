'use client';

import type { BrandWithModels } from '@/lib/admin-types';
import { Field, Input, Select } from '@/components/ui/field';

export interface DeviceValue {
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  /** Marque absente du référentiel (saisie libre). */
  customBrand: boolean;
  /** Modèle absent du référentiel (saisie libre : pas de tarif automatique). */
  customModel: boolean;
}

export const emptyDevice: DeviceValue = { brandId: '', brandName: '', modelId: '', modelName: '', customBrand: false, customModel: false };

export function DeviceFields({ brands, value, onChange, requireKnownBrand }: { brands: BrandWithModels[]; value: DeviceValue; onChange: (v: DeviceValue) => void; requireKnownBrand?: boolean }) {
  const brand = brands.find((b) => b.id === value.brandId);
  const models = brand?.models.filter((m) => m.active) ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Marque">
        {(p) => (
          <Select
            {...p}
            required
            value={value.customBrand ? '__other' : value.brandId}
            onChange={(e) => {
              const b = brands.find((x) => x.id === e.target.value);
              if (b) onChange({ ...emptyDevice, brandId: b.id, brandName: b.name, customModel: b.models.length === 0 });
              else onChange({ ...emptyDevice, customBrand: e.target.value === '__other', customModel: e.target.value === '__other' });
            }}
          >
            <option value="">Choisir…</option>
            {brands
              .filter((b) => b.active)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            {!requireKnownBrand && <option value="__other">Autre marque</option>}
          </Select>
        )}
      </Field>

      {value.customBrand ? (
        <Field label="Nom de la marque">{(p) => <Input {...p} value={value.brandName} onChange={(e) => onChange({ ...value, brandName: e.target.value })} required maxLength={60} />}</Field>
      ) : (
        <Field label="Modèle">
          {(p) => (
            <Select
              {...p}
              disabled={!brand}
              value={value.customModel && brand ? '__other' : value.modelId}
              onChange={(e) => {
                const m = models.find((x) => x.id === e.target.value);
                onChange({ ...value, modelId: m?.id ?? '', modelName: m?.name ?? '', customModel: e.target.value === '__other' });
              }}
            >
              <option value="">{brand ? 'Choisir…' : 'Choisissez d’abord la marque'}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              <option value="__other">Autre modèle</option>
            </Select>
          )}
        </Field>
      )}

      {value.customModel && (value.customBrand || brand) && (
        <Field label="Nom du modèle" className="sm:col-span-2" hint="Modèle hors référentiel : aucun tarif automatique.">
          {(p) => <Input {...p} value={value.modelName} onChange={(e) => onChange({ ...value, modelName: e.target.value })} required maxLength={80} placeholder="Ex. Galaxy A15 5G" />}
        </Field>
      )}
    </div>
  );
}
