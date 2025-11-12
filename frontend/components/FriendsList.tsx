import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import Image from 'next/image';

const getAvatar = (id: string) => {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(`avatar_${id}`);
  } catch {
    return null;
  }
};

export default function FriendsList({ currentUser, ws, selected, onSelect }: { currentUser?: any; ws?: any; selected?: string | null; onSelect?: (id: string | null) => void }) {
  const [friends, setFriends] = useState<Array<{ id: string; name: string }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [friendId, setFriendId] = useState('');
  const [secret, setSecret] = useState('');
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem('rt_friends');
      if (raw) setFriends(JSON.parse(raw));
    } catch {}
  }, []);

  const save = (next: any) => {
    setFriends(next);
    localStorage.setItem('rt_friends', JSON.stringify(next));
  };

  const addFriend = () => {
    if (!friendId) return;
    const next = [...friends, { id: friendId, name: friendId }];
    save(next);
    setShowAdd(false);
    setFriendId('');
    setSecret('');
    // For real E2EE you'd exchange the secret out-of-band; here we store the passphrase locally for demo
    if (secret) localStorage.setItem(`rt_key_${friendId}`, secret);
  };

  const removeFriend = (id: string) => {
    const next = friends.filter((f) => f.id !== id);
    save(next);
  };

  return (
    <div>
      <div className="turbo-sidebar-section-label">Direct Messages</div>
      <div className="turbo-friend-list">
        {friends.map((f) => {
          const avatar = getAvatar(f.id);
          return (
            <div
              key={f.id}
              className={clsx('turbo-friend-card', selected === f.id && 'is-active')}
              onClick={() => onSelect && onSelect(f.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect && onSelect(f.id);
                }
              }}
            >
              <div className="turbo-friend-main">
                <div className="turbo-friend-avatar">
                  {avatar && !avatarErrors[f.id] ? (
                    <Image
                      src={avatar}
                      alt={f.name}
                      fill
                      sizes="44px"
                      unoptimized
                      onError={() => setAvatarErrors((prev) => ({ ...prev, [f.id]: true }))}
                    />
                  ) : (
                    <span>{(f.name || '').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="turbo-friend-meta">
                  <span className="turbo-friend-name">{f.name}</span>
                  <span className="turbo-friend-status">offline</span>
                </div>
              </div>
              <div className="turbo-friend-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFriend(f.id);
                    if (selected === f.id) onSelect && onSelect(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        {showAdd ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="Friend id" value={friendId} onChange={(e) => setFriendId(e.target.value)} />
            <input placeholder="Shared secret (for E2EE)" value={secret} onChange={(e) => setSecret(e.target.value)} />
            <div className="turbo-actions-row">
              <button className="turbo-pill positive" onClick={addFriend}>
                Add
              </button>
              <button
                className="turbo-pill secondary"
                onClick={() => {
                  setShowAdd(false);
                  setFriendId('');
                  setSecret('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="turbo-pill" style={{ width: '100%' }} onClick={() => setShowAdd(true)}>
            Add Friend
          </button>
        )}
      </div>
    </div>
  );
}
