import type { Metadata } from 'next';
import { ManualDocs } from './manual-docs';

export const metadata: Metadata = {
  title: 'Manual operativo | OpenFireDetection',
  description: 'Guía de guardia para vigilancia, incidentes, recursos, análisis e historial de OpenFireDetection.',
};

export default function ManualPage() {
  return <ManualDocs />;
}
