'use client';

import dynamic from 'next/dynamic';

const GlobalSearch = dynamic(() => import('./GlobalSearch'), { ssr: false });

export default function GlobalSearchWrapper() {
  return <GlobalSearch />;
}
