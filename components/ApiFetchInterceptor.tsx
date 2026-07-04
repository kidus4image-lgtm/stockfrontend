'use client';

import { useEffect } from 'react';
import { normalizeApiRequest } from '../lib/api';

type FetchLike = typeof window.fetch;

function installFetchInterceptor() {
  if (typeof window === 'undefined') {
    return;
  }

  const win = window as Window & {
    __apiFetchOriginal?: FetchLike;
    __apiFetchPatched?: boolean;
  };

  if (win.__apiFetchPatched) {
    return;
  }

  const originalFetch = win.fetch.bind(win);
  win.__apiFetchOriginal = originalFetch;
  win.__apiFetchPatched = true;

  win.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const normalizedInput = normalizeApiRequest(input);
    return originalFetch(normalizedInput as RequestInfo | URL, init);
  }) as FetchLike;
}

installFetchInterceptor();

export default function ApiFetchInterceptor() {
  useEffect(() => {
    return () => {
      const win = window as Window & {
        __apiFetchOriginal?: FetchLike;
        __apiFetchPatched?: boolean;
      };

      if (win.__apiFetchOriginal) {
        win.fetch = win.__apiFetchOriginal;
      }
      delete win.__apiFetchOriginal;
      delete win.__apiFetchPatched;
    };
  }, []);

  return null;
}
