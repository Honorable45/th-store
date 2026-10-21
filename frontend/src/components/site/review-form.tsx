'use client';

import { BadgeCheck, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input, Select, Textarea } from '@/components/ui/field';

function RatingInput({ label, value, onChange, required }: { label: string; value: number; onChange: (v: number) => void; required?: boolean }) {
  const words = ['', 'Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];
  return (
    <fieldset>
      <legend className="text-[14px] font-medium text-ink">
        {label}
        {!required && <span className="ml-1.5 text-[12.5px] font-normal text-faint">facultatif</span>}
      </legend>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={label} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="flex size-11 items-center justify-center rounded-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent" aria-hidden="true">
              <Star className={cn('size-7 transition-colors', n <= value ? 'fill-ochre text-ochre' : 'text-line-2')} strokeWidth={1.4} />
            </span>
            <span className="sr-only">
              {n} sur 5 — {words[n]}
            </span>
          </label>
        ))}
        <span className="ml-2 text-[13.5px] text-muted" aria-hidden="true">
          {words[value]}
        </span>
      </div>
    </fieldset>
  );
}

export function ReviewForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [verified, setVerified] = useState<{ device: string } | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [service, setService] = useState('REPAIR');
  const [rating, setRating] = useState(0);
  const [ratingRepair, setRatingRepair] = useState(0);
  const [ratingWelcome, setRatingWelcome] = useState(0);
  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ verified: boolean } | null>(null);

  useEffect(() => {
    if (!initialCode) return;
    api
      .get<{ device: string }>(`/reviews/check-code?code=${encodeURIComponent(initialCode)}`)
      .then((r) => {
        setVerified(r);
        setService('REPAIR');
      })
      .catch((err) => setCodeError(errorMessage(err)));
  }, [initialCode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return setError('Choisissez une note générale.');
    setSending(true);
    setError(null);
    try {
      const res = await api.post<{ verified: boolean }>('/reviews', {
        rating,
        ratingRepair: ratingRepair || undefined,
        ratingWelcome: ratingWelcome || undefined,
        ratingValue: ratingValue || undefined,
        comment: comment.trim() || undefined,
        displayName: displayName.trim() || undefined,
        serviceType: verified ? 'REPAIR' : service,
        code: code.trim() || undefined,
      });
      setDone(res);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="animate-slide-up text-center">
        <h2 className="display text-[28px]">Merci pour votre avis.</h2>
        <p className="mt-3 text-[15px] text-ink-2">
          {done.verified ? 'Il est lié à votre réparation et portera la mention « Réparation vérifiée ».' : ''} Il sera publié après une vérification de forme.
        </p>
        <Link href="/" className="mt-6 inline-block text-[14.5px] font-medium text-accent underline">
          Retour à l’accueil
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-7">
      {verified ? (
        <p className="flex items-start gap-2.5 border-l-2 border-ok bg-ok-soft px-4 py-3 text-[14.5px] text-ok">
          <BadgeCheck className="mt-0.5 size-4 shrink-0" />
          <span>
            Réparation vérifiée : {verified.device}. Votre avis portera cette mention.
          </span>
        </p>
      ) : (
        <>
          <Field label="Votre expérience concerne">
            {(p) => (
              <Select {...p} value={service} onChange={(e) => setService(e.target.value)}>
                <option value="REPAIR">Une réparation</option>
                <option value="ACCESSORY_PURCHASE">L’achat d’accessoires</option>
                <option value="PHONE_PURCHASE">L’achat d’un téléphone</option>
                <option value="OTHER">Autre</option>
              </Select>
            )}
          </Field>
          {service === 'REPAIR' && (
            <Field label="Code de vérification" optional error={codeError} hint="Remis par l’atelier à la fin de la réparation. Il permet d’afficher la mention « Réparation vérifiée ».">
              {(p) => <Input {...p} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className="font-mono uppercase tracking-widest" maxLength={16} />}
            </Field>
          )}
        </>
      )}

      <RatingInput label="Note générale" value={rating} onChange={setRating} required />
      {(verified || service === 'REPAIR') && <RatingInput label="Qualité de la réparation" value={ratingRepair} onChange={setRatingRepair} />}
      <RatingInput label="Accueil" value={ratingWelcome} onChange={setRatingWelcome} />
      <RatingInput label="Rapport qualité-prix" value={ratingValue} onChange={setRatingValue} />

      <Field label="Commentaire" optional>
        {(p) => <Textarea {...p} rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1500} />}
      </Field>
      <Field label="Prénom ou pseudonyme affiché" optional hint="Laissez vide pour publier anonymement.">
        {(p) => <Input {...p} value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />}
      </Field>

      <FormError message={error} />
      <Button type="submit" size="lg" loading={sending} className="w-full">
        Publier mon avis
      </Button>
    </form>
  );
}
