import type { Metadata } from 'next';
import { RepairWizard } from '@/components/site/repair-wizard';
import { serverGet } from '@/lib/server-api';
import type { PublicSettings, RepairCatalog } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Devis de réparation en ligne',
  description: 'Estimez le prix de la réparation de votre téléphone : écran, batterie, connecteur de charge, caméra… Devis confirmé après diagnostic.',
  alternates: { canonical: '/reparation' },
};

export default async function RepairPage({ searchParams }: { searchParams: Promise<{ marque?: string }> }) {
  const { marque } = await searchParams;
  const [catalog, settings] = await Promise.all([serverGet<RepairCatalog>('/repair-catalog', 120), serverGet<PublicSettings>('/settings/public', 60)]);

  return (
    <div className="container-page pt-40 lg:pt-32">
      <h1 className="display mx-auto mb-8 max-w-3xl text-[40px] sm:text-[52px]">Devis</h1>
      {catalog ? (
        <RepairWizard catalog={catalog} initialBrand={marque} whatsapp={settings?.whatsapp ?? null} />
      ) : (
        <p className="py-16 text-center text-muted">Le service de devis est momentanément indisponible. Réessayez dans quelques instants.</p>
      )}
    </div>
  );
}
