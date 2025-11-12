import React from 'react';
import Profile from '../components/Profile';
import { useRouter } from 'next/router';
import BrandMark from '../components/BrandMark';

export default function ProfilePage() {
  const router = useRouter();
  return (
    <div className="turbo-shell">
      <aside className="turbo-sidebar">
        <div className="turbo-brand">
          <BrandMark size="lg" />
          <span className="turbo-brand-subtitle">Profile settings</span>
        </div>
        <button className="turbo-pill secondary" onClick={() => router.push('/')}>Back to chat</button>
      </aside>
      <main className="turbo-main">
        <Profile />
      </main>
    </div>
  );
}
