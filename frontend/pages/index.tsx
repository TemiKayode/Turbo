import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import supabase from '../lib/supabase';
import { ReconnectingWebSocket } from '../components/ws';
import VirtualizedMessageList from '../components/VirtualizedMessageList';
import Composer from '../components/Composer';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/router';
import FriendsList from '../components/FriendsList';
import Link from 'next/link';
import Image from 'next/image';
import BrandMark from '../components/BrandMark';

type Message = {
  id: string;
  author: string;
  text: string;
  ts: number;
  reactions?: Record<string, string[]>;
  to?: string | null;
  authorEmail?: string | null;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presenceCount, setPresenceCount] = useState<number>(0);
  const [connected, setConnected] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('auth_user');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.email || parsed?.name || parsed?.id || null;
    } catch { return null; }
  });
  const [profileAvatar, setProfileAvatar] = useState<string>(() => {
    try {
      if (typeof window === 'undefined') return '';
      return localStorage.getItem('profile_avatar') || '';
    } catch { return ''; }
  });
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [profileAvatar]);

  const profileInitial = useMemo(() => {
    if (!currentUser) return 'U';
    const trimmed = String(currentUser).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
  }, [currentUser]);

  const router = useRouter();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // If not logged in, redirect to /login
    if (!currentUser) {
      router.replace('/login');
    }
  }, [currentUser, router]);

  // keep in sync across tabs (storage events) and react to Supabase auth changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === 'profile_avatar') {
          setProfileAvatar(e.newValue || '');
        }
        if (e.key === 'auth_user' || e.key === 'auth_token') {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('auth_user') : null;
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              setCurrentUser(parsed?.email || parsed?.name || parsed?.id || null);
            } catch { setCurrentUser(null); }
          } else {
            setCurrentUser(null);
          }
        }
      } catch (err) {}
    };
    window.addEventListener('storage', onStorage);

    // rehydrate from Supabase auth state and subscribe to future changes
    (async () => {
      try {
        const s = await supabase.auth.getSession();
        const session = s?.data?.session;
        if (session?.user) setCurrentUser((session.user as any).email || (session.user as any).id || null);
      } catch (err) {}
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      try {
        if (session && session.user) {
          // prefer email when present
          setCurrentUser((session.user as any).email || (session.user as any).id || null);
        } else {
          setCurrentUser(null);
        }
      } catch (e) {}
    });

    return () => {
      window.removeEventListener('storage', onStorage);
      try { authListener?.subscription?.unsubscribe(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    // fetch recent messages history
    (async () => {
      try {
        const res = await axios.get((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api/messages?limit=100');
        if (res.data && Array.isArray(res.data)) {
          const mapped = (res.data as any[]).map((m) => ({
            id: String(m.id),
            author: (m.author && (m.author.display_name || m.author.email)) || (m.author && String(m.author)) || 'anon',
            authorEmail: m.author && m.author.email ? m.author.email : null,
            text: m.text || '',
            ts: m.ts || Date.now(),
            to: m.to || m.recipient || null,
            reactions: m.reactions || {},
            images: m.images || [],
          }));
          setMessages(mapped as unknown as Message[]);
        }
      } catch (e) {}
    })();

    // handler for reaction events (uses wsRef)
    const onReact = (ev: Event) => {
      try {
        // @ts-ignore
        const d = ev.detail;
        if (!d) return;
        wsRef.current?.send({ type: 'reaction', id: d.id, emoji: d.emoji, user: currentUser || 'web' });
      } catch {}
    };

    // connect: get supabase token then create websocket
    (async () => {
      let token: string | null = localStorage.getItem('auth_token');
      try {
        const s = await supabase.auth.getSession();
        if (s?.data?.session?.access_token) token = s.data.session.access_token;
      } catch {}

      const base = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';
      const url = base;

      const ws = new ReconnectingWebSocket(url, {
        onopen: (self) => {
          setConnected(true);
          try { self?.send({ type: 'auth', token }); } catch {}
        },
        onclose: () => setConnected(false),
        onmessage: (data) => {
          if (!data || !data.type) return;
          switch (data.type) {
            case 'message': {
              // data.author may be an object with email/display_name/avatar_url
              let authorName = 'anon';
              let authorEmail = null;
              if (data.author) {
                if (typeof data.author === 'string') {
                  authorName = data.author;
                } else if (typeof data.author === 'object') {
                  authorName = data.author.display_name || data.author.email || JSON.stringify(data.author);
                  authorEmail = data.author.email || null;
                }
              }
              const m: Message = {
                id: data.id || nanoid(),
                author: authorName,
                authorEmail: authorEmail,
                text: data.text || '',
                ts: data.ts || Date.now(),
                to: data.to || data.recipient || null,
                reactions: data.reactions || {},
              };
              // persist author avatar for demo convenience
              try {
                if (data.author && typeof data.author === 'object' && data.author.email && data.author.avatar_url) {
                  localStorage.setItem(`avatar_${data.author.email}`, data.author.avatar_url);
                }
              } catch (e) {}
              setMessages((prev) => [...prev, m]);
              break;
            }
            case 'reaction': {
              const { id, emoji, user } = data;
              setMessages((prev) => prev.map((m) => {
                if (m.id !== id) return m;
                const reactions = { ...(m.reactions || {}) };
                reactions[emoji] = Array.from(new Set([...(reactions[emoji] || []), user]));
                return { ...m, reactions };
              }));
              break;
            }
            case 'typing': {
              const who = data.author;
              setTypingUsers((prev) => Array.from(new Set([...prev, who])));
              setTimeout(() => setTypingUsers((prev) => prev.filter(p => p !== who)), 3000);
              break;
            }
            case 'presence': {
              setPresenceCount(data.count || 0);
              break;
            }
            case 'auth_ok': {
              break;
            }
            default:
              break;
          }
        }
      });

      wsRef.current = ws;
      window.addEventListener('client:react', onReact as EventListener);
    })();

    return () => {
      window.removeEventListener('client:react', onReact as EventListener);
      wsRef.current?.close();
    };
  }, [currentUser]);

  const sendMessage = (text: string) => {
    const payload: any = { type: 'message', text, author: currentUser || 'web', ts: Date.now(), id: nanoid() };
    if (selectedFriend) payload.to = selectedFriend;
    wsRef.current?.send(payload);
    setMessages((m) => [...m, { ...payload, reactions: {} }]);
  };

  // accept images array from composer
  const sendMessageWithImages = (text: string, images?: any[]) => {
    const payload: any = { type: 'message', text, author: currentUser || 'web', ts: Date.now(), id: nanoid() };
    if (images && images.length) payload.images = images;
    if (selectedFriend) payload.to = selectedFriend;
    wsRef.current?.send(payload);
    setMessages((m) => [...m, { ...payload, reactions: {} }]);
  };

  const sendTyping = () => {
    wsRef.current?.send({ type: 'typing', author: currentUser || 'web' });
  };

  return (
    <div className="turbo-shell">
      <aside className="turbo-sidebar">
        <div className="turbo-brand">
          <BrandMark size="lg" />
          <span className="turbo-brand-subtitle">Realtime Messaging</span>
        </div>
        <FriendsList currentUser={currentUser} ws={wsRef} selected={selectedFriend} onSelect={setSelectedFriend} />
      </aside>

      <main className="turbo-main">
        <div className="turbo-topbar">
          <BrandMark size="sm" showWordmark={false} className="turbo-topbar-mark" />
          <div className="turbo-channel-info">
            <span className="turbo-channel-title">{selectedFriend ? `DM · ${selectedFriend}` : '# General'}</span>
            <span className="turbo-channel-sub">secure realtime transport • low latency delivery</span>
          </div>
          <div className="turbo-status">
            <span className={`turbo-status-indicator ${connected ? 'is-online' : ''}`} />
            <span>{connected ? 'Connected' : 'Disconnected'}</span>
            <span>• {presenceCount} active</span>
            <Link href="/profile" className="turbo-avatar-pill" aria-label="Open profile">
              {profileAvatar && !avatarError ? (
                <Image
                  src={profileAvatar}
                  alt={currentUser || 'me'}
                  fill
                  sizes="42px"
                  unoptimized
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="turbo-avatar-initial" suppressHydrationWarning>
                  {isHydrated ? profileInitial : '•'}
                </span>
              )}
            </Link>
            <button
              className="turbo-logout-button"
              onClick={async () => {
                try {
                  try {
                    await supabase.auth.signOut();
                  } catch (e) {
                    /* ignore */
                  }
                } finally {
                  localStorage.removeItem('auth_token');
                  localStorage.removeItem('auth_user');
                  localStorage.removeItem('profile_avatar');
                  localStorage.removeItem('profile_displayName');
                  localStorage.removeItem('profile_bio');
                  router.replace('/login');
                }
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div className="turbo-content">
          {selectedFriend ? (
            <VirtualizedMessageList
              messages={messages.filter(
                (m) =>
                  (m.to === selectedFriend && (m.authorEmail === currentUser || m.author === currentUser)) ||
                  (m.to === currentUser && (m.authorEmail === selectedFriend || m.author === selectedFriend))
              ) as any}
              currentUser={currentUser}
            />
          ) : (
            <div className="turbo-messages-empty">Select a friend to begin a direct conversation</div>
          )}
        </div>

        <div className="turbo-typing">{typingUsers.length > 0 ? `${typingUsers.join(', ')} is typing…` : ''}</div>
        <Composer onSend={sendMessageWithImages} onTyping={sendTyping} ws={wsRef} currentUser={currentUser} recipient={selectedFriend} />
      </main>
    </div>
  );
}


