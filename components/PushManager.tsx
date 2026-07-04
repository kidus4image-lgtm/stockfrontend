'use client';

import { useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';

const VAPID_PUBLIC_KEY = 'BEzPpJDchW2HWFnsWu_6o_92j6Ed3ELTF1mDDtYQ2-xdQ1lFPsa10Zxia-AKQQMZgLM46jy7piOPKULI1I2hh5Q';

export default function PushManager() {
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (subscribedRef.current) return;

    const token = localStorage.getItem('token');
    if (!token) return;
    subscribedRef.current = true;

    async function init() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await existing.unsubscribe();
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY
        });

        const subJSON = subscription.toJSON();
        await apiFetch('http://localhost:5000/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJSON.endpoint,
            keys: subJSON.keys
          })
        });
      } catch (err) {
        console.error('Push subscription failed:', err);
      }
    }

    init();

    return () => {
      subscribedRef.current = false;
    };
  }, []);

  return null;
}
