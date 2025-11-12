import { useState } from 'react';
import { useRouter } from 'next/router';
import supabase from '../lib/supabase';
import Link from 'next/link';
import BrandMark from '../components/BrandMark';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [showCreds, setShowCreds] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const register = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return alert('Register error: ' + error.message);
      alert('Registered. Check your email to confirm (if enabled). You can now login.');
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert('Login error: ' + error.message);
      const tokenStr = data.session?.access_token;
      setToken(tokenStr || null);
      if (tokenStr) localStorage.setItem('auth_token', tokenStr);
      try {
        const user = data.user || { email };
        localStorage.setItem('auth_user', JSON.stringify(user));
      } catch {}
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  // Demo helper: tries to login, and if user doesn't exist, attempts to register then login.
  const demoLogin = async () => {
    const demoEmail = 'test@turbo.com';
    const demoPassword = 'Tapinrush10@';
    setLoading(true);
    setEmail(demoEmail);
    setPassword(demoPassword);
    try {
      let res = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
      if (res.error) {
        // If login failed, try to register (dev-only convenience).
        // Ignoring confirmation requirements for demo flow; if your Supabase project requires email confirmation,
        // the signUp may require confirming the account before signIn works. In that case, register via dashboard.
        const { error: regErr } = await supabase.auth.signUp({ email: demoEmail, password: demoPassword });
        if (regErr && !/already/.test(regErr.message)) {
          // If it's not 'already registered', report it.
          return alert('Demo register error: ' + regErr.message);
        }
        // Attempt login again
        res = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
        if (res.error) return alert('Demo login error: ' + res.error.message + '\nIf your Supabase instance requires email confirmation, confirm first in the project dashboard.');
      }
      const tokenStr = res.data.session?.access_token;
      if (tokenStr) localStorage.setItem('auth_token', tokenStr);
      try {
        const user = res.data.user || { email: demoEmail };
        localStorage.setItem('auth_user', JSON.stringify(user));
      } catch {}
      router.push('/');
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
        <h1 className="turbo-auth-title">Welcome back</h1>
        <p className="turbo-auth-subtitle">Sign in to continue</p>

        <div className="turbo-form-group">
          <label htmlFor="login-email">Email</label>
          <input id="login-email" aria-label="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="turbo-form-group">
          <label htmlFor="login-password">Password</label>
          <input id="login-password" aria-label="password" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="turbo-form-actions">
          <button onClick={login} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Please wait…' : 'Login'}
          </button>
          <button
            className="turbo-pill secondary"
            onClick={async () => {
              if (!email) return alert('Enter your email to receive a password reset link.');
              setLoading(true);
              try {
                const res = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset' });
                if ((res as any).error) {
                  alert('Reset error: ' + (res as any).error.message);
                } else {
                  alert('If an account exists for that email, a password reset link was sent. Check your inbox.');
                }
              } catch (err: any) {
                alert('Reset error: ' + (err?.message || String(err)));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            Reset password
          </button>
        </div>

        <div className="turbo-form-footer">
          <Link href="/signup" className="turbo-link">
            Create an account
          </Link>
          <button className="turbo-link-button" onClick={demoLogin} disabled={loading}>
            Use demo account
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="turbo-link-button" onClick={() => setShowCreds((s) => !s)}>
            {showCreds ? 'Hide demo credentials' : 'Show demo credentials'}
          </button>
          {showCreds && (
            <div style={{ marginTop: 12, background: 'rgba(15,23,42,0.75)', color: '#f8fafc', padding: 12, borderRadius: 14, border: '1px solid rgba(99,102,241,0.25)' }}>
              <div>
                <strong>Email:</strong> test@turbo.com
              </div>
              <div style={{ marginTop: 6 }}>
                <strong>Password:</strong> Tapinrush10@
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(148,163,184,0.75)' }}>
                Tip: click &ldquo;Use demo account&rdquo; to auto-fill and sign in (will attempt to register if missing).
              </div>
            </div>
          )}
        </div>

        {token && (
          <div style={{ marginTop: 16, fontSize: 12, color: 'rgba(226,232,240,0.9)' }}>
            <div>
              <strong>Token:</strong> {token}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


