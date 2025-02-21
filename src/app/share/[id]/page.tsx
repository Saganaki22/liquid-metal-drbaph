import { LiquidImage } from '@/hero/hero';
import { Suspense } from 'react';

interface PageProps {
  params: { id: string };
}

// List of predefined logos that we want to pre-render
const PREDEFINED_LOGOS = [
  'punisher',
  'dcshoes',
  'github',
  'linux',
  'huggingface'
];

export async function generateStaticParams() {
  return PREDEFINED_LOGOS.map((id) => ({
    id,
  }));
}

export const dynamicParams = false;

export default function Page({ params }: PageProps) {
  // Ensure id is a string
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <div className="flex min-h-screen flex-col items-center justify-between">
      <div className="w-full flex-1">
        <div className="absolute top-4 right-4">
          <a href="https://drbaph.ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors">
            <img src="/liquid-metal-drbaph/drbaph.svg" alt="drbaph" className="w-32" />
            <span className="text-sm font-medium border-b border-white/20">drbaph</span>
          </a>
        </div>
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="loading"></div></div>}>
          <LiquidImage imageId={id} refraction={0.015} edge={0.4} patternBlur={0.005} liquid={0.07} speed={0.3} patternScale={2} />
        </Suspense>
      </div>
    </div>
  );
}
