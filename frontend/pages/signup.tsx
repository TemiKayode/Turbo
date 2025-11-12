import { useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabase';
import Link from 'next/link';
import BrandMark from '../components/BrandMark';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const signup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert('Register error: ' + error.message);
      alert('Registered. Check your email to confirm (if enabled). You can now login.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="turbo-auth-shell">
      <div className="turbo-auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <BrandMark size="md" />
        </div>
        <h1 className="turbo-auth-title">Create your Turbo ID</h1>
        <p className="turbo-auth-subtitle">Create a new account</p>

        <div className="turbo-form-group">
          <label htmlFor="signup-email">Email</label>
          <input id="signup-email" aria-label="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="turbo-form-group">
          <label htmlFor="signup-password">Password</label>
          <input id="signup-password" aria-label="password" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="turbo-form-actions">
          <button onClick={signup} disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Please wait…' : 'Create account'}
          </button>
        </div>

        <div className="turbo-form-footer" style={{ justifyContent: 'flex-start' }}>
          <Link href="/login" className="turbo-link">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
