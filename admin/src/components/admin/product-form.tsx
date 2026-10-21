'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { AdminProduct, BrandWithModels, CategoryRow, SupplierRow } from '@/lib/admin-types';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, Input, MoneyInput, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { Panel } from './ui';
import { useCan } from './session';

interface Compat {
  brandId: string;
  modelId: string;
}

export function ProductForm({ product, kind, categories, brands, suppliers }: { product?: AdminProduct; kind: 'ACCESSORY' | 'PART'; categories: CategoryRow[]; brands: BrandWithModels[]; suppliers: SupplierRow[] }) {
  const router = useRouter();
  const can = useCan();
  const { notify } = useToast();
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [categoryId, setCategoryId] = useState(product?.category.id ?? '');
  const [supplierId, setSupplierId] = useState(product?.supplier?.id ?? '');
  const [price, setPrice] = useState(product ? String(product.salePrice) : '');
  const [threshold, setThreshold] = useState(String(product?.lowStockThreshold ?? 2));
  const [published, setPublished] = useState(product?.published ?? true);
  const [description, setDescription] = useState(product?.description ?? '');
  const [compat, setCompat] = useState<Compat[]>(product?.compatibility.map((c) => ({ brandId: c.brandId, modelId: c.modelId ?? '' })) ?? []);
  const [initialStock, setInitialStock] = useState('');
  const [initialCost, setInitialCost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cats = categories.filter((c) => c.kind === kind && (c.active || c.id === categoryId));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!categoryId) return setError('Choisissez une catégorie.');
    if (price === '') return setError('Indiquez un prix de vente (0 pour une pièce non vendue seule).');
    if (Number(initialStock) > 0 && initialCost === '') return setError('Indiquez le coût unitaire du stock initial.');
    setSaving(true);
    const body = {
      name: name.trim(),
      sku: sku.trim() || undefined,
      categoryId,
      supplierId: supplierId || null,
      salePrice: Number(price),
      lowStockThreshold: Number(threshold) || 0,
      published: kind === 'ACCESSORY' ? published : false,
      description: description.trim(),
      compatibility: compat.filter((c) => c.brandId).map((c) => ({ brandId: c.brandId, modelId: c.modelId || null })),
    };
    try {
      if (product) {
        await api.patch(`/products/${product.id}`, body);
        notify('Article enregistré.');
        router.refresh();
        router.push(`/produits/${product.id}`);
      } else {
        const created = await api.post<AdminProduct>('/products', {
          ...body,
          kind,
          initialStock: Number(initialStock) || undefined,
          initialUnitCost: initialCost !== '' ? Number(initialCost) : undefined,
        });
        notify('Article créé. Ajoutez maintenant ses photos.');
        router.push(`/produits/${created.id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Panel title="Informations">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Désignation" className="sm:col-span-2">
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={140} />}
          </Field>
          <Field label="Référence" optional hint={product ? undefined : 'Générée automatiquement si vide.'}>
            {(p) => <Input {...p} value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} maxLength={40} className="font-mono uppercase" />}
          </Field>
          <Field label="Catégorie">
            {(p) => (
              <Select {...p} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                <option value="">Choisir…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={kind === 'PART' ? 'Prix de vente au détail' : 'Prix de vente'} hint={kind === 'PART' ? 'Mettez 0 si la pièce n’est pas vendue seule.' : undefined}>
            {(p) => <MoneyInput {...p} value={price} onChange={(e) => setPrice(e.target.value)} required />}
          </Field>
          <Field label="Seuil d’alerte" hint="Alerte « stock faible » à partir de ce nombre disponible.">
            {(p) => <Input {...p} type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="num" />}
          </Field>
          {can('suppliers.manage') && (
            <Field label="Fournisseur habituel" optional>
              {(p) => (
                <Select {...p} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">Aucun</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field label="Description" optional className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="Caractéristiques utiles au client : puissance, longueur, matière…" />}
          </Field>
          {kind === 'ACCESSORY' && <Checkbox className="sm:col-span-2" checked={published} onChange={(e) => setPublished(e.target.checked)} label="Visible sur le site" description="Décochez pour un article vendu uniquement au comptoir." />}
        </div>
      </Panel>

      <Panel
        title="Compatibilité"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setCompat([...compat, { brandId: '', modelId: '' }])}>
            <Plus className="size-4" /> Ajouter
          </Button>
        }
      >
        {compat.length === 0 ? (
          <p className="text-[13.5px] text-muted">Article universel. Ajoutez des marques ou modèles pour permettre le filtrage par téléphone.</p>
        ) : (
          <ul className="space-y-2">
            {compat.map((c, i) => {
              const brand = brands.find((b) => b.id === c.brandId);
              return (
                <li key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Select value={c.brandId} onChange={(e) => setCompat(compat.map((x, j) => (j === i ? { brandId: e.target.value, modelId: '' } : x)))} aria-label="Marque">
                    <option value="">Marque…</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                  <Select value={c.modelId} disabled={!brand} onChange={(e) => setCompat(compat.map((x, j) => (j === i ? { ...x, modelId: e.target.value } : x)))} aria-label="Modèle">
                    <option value="">Tous les modèles</option>
                    {brand?.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                  <button type="button" onClick={() => setCompat(compat.filter((_, j) => j !== i))} aria-label="Retirer" className="inline-flex size-10 items-center justify-center text-muted hover:text-bad">
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {!product && (
        <Panel title="Stock initial" actions={<span className="text-[12px] text-muted">facultatif</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Quantité en stock">{(p) => <Input {...p} type="number" min={0} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} className="num" />}</Field>
            <Field label="Coût d’achat unitaire" hint="Sert au calcul du coût moyen et des marges.">
              {(p) => <MoneyInput {...p} value={initialCost} onChange={(e) => setInitialCost(e.target.value)} />}
            </Field>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">Pour les achats suivants, utilisez « Approvisionnements » : les frais annexes y sont répartis et le coût moyen recalculé.</p>
        </Panel>
      )}

      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {product ? 'Enregistrer' : 'Créer l’article'}
        </Button>
        <Button variant="ghost" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
