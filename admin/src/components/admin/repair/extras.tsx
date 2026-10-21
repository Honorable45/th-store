'use client';

import { Eye, Printer } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { RepairDetail, StaffMember } from '@/lib/admin-types';
import { formatDate, formatDateTime, formatPhone, formatPrice } from '@/lib/format';
import { ROLES } from '@/lib/labels';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { DetailList, Panel } from '../ui';
import { QrCode } from '../qr-code';
import { useCan } from '../session';

type Update = (r: RepairDetail) => void;

export function ImeiValue({ repair }: { repair: RepairDetail }) {
  const can = useCan();
  const { notify } = useToast();
  const [imei, setImei] = useState<string | null>(null);
  if (!repair.hasImei) return <span className="text-faint">Non renseigné</span>;
  if (imei) return <span className="font-mono">{imei}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">•••• {repair.imeiLast4}</span>
      {can('repairs.imei') && (
        <button
          type="button"
          onClick={async () => {
            try {
              setImei((await api.post<{ imei: string | null }>(`/repairs/${repair.id}/imei`)).imei);
            } catch (err) {
              notify(errorMessage(err), 'bad');
            }
          }}
          className="inline-flex items-center gap-1 text-[12.5px] text-accent underline"
        >
          <Eye className="size-3.5" /> Afficher
        </button>
      )}
    </span>
  );
}

/** Diagnostic, travaux, réparateur, échéance, notes internes. */
export function WorkPanel({ repair, onUpdate, staff }: { repair: RepairDetail; onUpdate: Update; staff: StaffMember[] }) {
  const can = useCan();
  const { notify } = useToast();
  const editable = can('repairs.write') && repair.status !== 'PICKED_UP';
  const initial = {
    diagnosis: repair.diagnosis ?? '',
    workDone: repair.workDone ?? '',
    technicianId: repair.technicianId ?? '',
    dueAt: repair.dueAt ? new Date(repair.dueAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Lome' }) : '',
    internalNotes: repair.internalNotes ?? '',
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setForm(initial), [repair.diagnosis, repair.workDone, repair.technicianId, repair.dueAt, repair.internalNotes]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    try {
      onUpdate(
        await api.patch<RepairDetail>(`/repairs/${repair.id}`, {
          diagnosis: form.diagnosis.trim() || null,
          workDone: form.workDone.trim() || null,
          technicianId: form.technicianId || null,
          dueAt: form.dueAt ? new Date(`${form.dueAt}T18:00:00`).toISOString() : null,
          internalNotes: form.internalNotes.trim() || null,
        }),
      );
      notify('Dossier mis à jour.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setSaving(false);
    }
  };

  if (!editable) {
    return (
      <Panel title="Intervention">
        <DetailList
          items={[
            ['Diagnostic', repair.diagnosis && <span className="whitespace-pre-line">{repair.diagnosis}</span>],
            ['Réparation effectuée', repair.workDone && <span className="whitespace-pre-line">{repair.workDone}</span>],
            ['Réparateur', repair.technician?.name],
            ['Date prévue', repair.dueAt && formatDate(repair.dueAt)],
            ['Notes internes', repair.internalNotes && <span className="whitespace-pre-line">{repair.internalNotes}</span>],
          ]}
        />
      </Panel>
    );
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Panel title="Intervention">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Diagnostic" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} value={form.diagnosis} onChange={set('diagnosis')} maxLength={4000} placeholder="Constat du réparateur" />}
        </Field>
        <Field label="Réparation effectuée" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={2} value={form.workDone} onChange={set('workDone')} maxLength={4000} />}
        </Field>
        <Field label="Réparateur responsable">
          {(p) => (
            <Select {...p} value={form.technicianId} onChange={set('technicianId')}>
              <option value="">Non attribué</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {ROLES[u.role]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date prévue">{(p) => <Input {...p} type="date" value={form.dueAt} onChange={set('dueAt')} />}</Field>
        <Field label="Notes internes" className="sm:col-span-2" hint="Jamais visibles par le client.">
          {(p) => <Textarea {...p} rows={2} value={form.internalNotes} onChange={set('internalNotes')} maxLength={2000} />}
        </Field>
      </div>
      {dirty && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={save} loading={saving}>
            Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setForm(initial)}>
            Annuler
          </Button>
        </div>
      )}
    </Panel>
  );
}

/** Bon de dépôt imprimable remis au client. */
export function TrackingPanel({ repair, shopName }: { repair: RepairDetail; shopName: string }) {
  const [printing, setPrinting] = useState(false);
  return (
    <Panel title="Bon de dépôt">
      <Button size="sm" variant="secondary" onClick={() => setPrinting(true)}>
        <Printer className="size-4" /> Imprimer le bon de dépôt
      </Button>
      <Dialog open={printing} onClose={() => setPrinting(false)} title="Bon de dépôt" footer={<Button onClick={() => window.print()}><Printer className="size-4" /> Imprimer</Button>}>
        <div className="print-area bg-white p-2 text-[13px] text-ink">
          <div className="flex items-start justify-between border-b border-ink pb-3">
            <div>
              <p className="font-serif text-[22px] font-semibold">{shopName}</p>
              <p className="text-[12px] text-muted">Bon de dépôt — réparation</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[16px]">{repair.number}</p>
              <p className="text-[12px]">{formatDateTime(repair.receivedAt)}</p>
            </div>
          </div>
          <DetailList
            className="mt-3"
            items={[
              ['Client', `${repair.customer.name} · ${formatPhone(repair.customer.phone)}`],
              ['Appareil', `${repair.brandName} ${repair.modelName}`],
              ['Panne signalée', repair.reportedIssue],
              ['Montant convenu', repair.billedAmount ? formatPrice(repair.billedAmount) : 'Sur devis après diagnostic'],
              ['Date prévue', repair.dueAt ? formatDate(repair.dueAt) : '—'],
            ]}
          />
          <p className="mt-4 text-[11px] text-muted">Aucune intervention n’est réalisée sans votre accord sur le devis. Conservez ce bon : il est demandé lors du retrait.</p>
        </div>
      </Dialog>
    </Panel>
  );
}

/** Code d'avis vérifié : généré une fois la réparation terminée, montré une seule fois. */
export function ReviewCodePanel({ repair, onUpdate }: { repair: RepairDetail; onUpdate: Update }) {
  const can = useCan();
  const { notify } = useToast();
  const [code, setCode] = useState<{ code: string; url: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  if (!can('reviews.tokens')) return null;
  const done = repair.status === 'COMPLETED' || repair.status === 'PICKED_UP';
  const token = repair.reviewTokens[0];
  const active = token && !token.revokedAt && !token.usedAt && new Date(token.expiresAt) > new Date();

  const generate = async () => {
    setLoading(true);
    try {
      setCode(await api.post(`/repairs/${repair.id}/review-code`));
    } catch (err) {
      notify(errorMessage(err), 'bad');
    } finally {
      setLoading(false);
    }
  };
  const revoke = async () => {
    try {
      onUpdate(await api.post<RepairDetail>(`/repairs/${repair.id}/review-code/revoke`));
      setCode(null);
      notify('Code révoqué.');
    } catch (err) {
      notify(errorMessage(err), 'bad');
    }
  };

  return (
    <Panel title="Avis vérifié">
      {repair.review ? (
        <p className="text-[13.5px]">
          Avis reçu le {formatDate(repair.review.createdAt)} ({repair.review.rating}/5).{' '}
          <Link href="/avis" className="text-accent underline">
            Voir les avis
          </Link>
        </p>
      ) : !done ? (
        <p className="text-[13.5px] text-muted">Disponible lorsque la réparation est terminée.</p>
      ) : code ? (
        <div className="print-area">
          <div className="flex items-start gap-4">
            <QrCode value={code.url} size={104} />
            <div>
              <p className="text-[12.5px] text-muted">Code à remettre au client</p>
              <p className="font-mono text-[22px] tracking-[0.16em]">{code.code}</p>
              <p className="mt-1 text-[12px] text-muted">Valable jusqu’au {formatDate(code.expiresAt)}, utilisable une seule fois.</p>
            </div>
          </div>
          <p className="mt-3 text-[12px] text-muted">Ce code n’est affiché qu’une fois. Notez-le, imprimez-le ou faites scanner le QR code au client.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-[13.5px]">
          <p className="text-muted">{active ? `Un code actif a été généré le ${formatDate(token.createdAt)}.` : 'Remettez au client un code unique pour publier un avis « Réparation vérifiée ».'}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" onClick={generate} loading={loading}>
              {active ? 'Générer un nouveau code' : 'Générer le code'}
            </Button>
            {active && (
              <Button size="sm" variant="ghost" onClick={revoke}>
                Révoquer
              </Button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
