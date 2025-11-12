import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import ReactionPicker from './ReactionPicker';
import { deriveKeyFromPassphrase, decryptWithKey } from '../lib/crypto';
import clsx from 'clsx';
import Image from 'next/image';

export type MessageType = {
  id: string;
  author: string;
  text: string;
  ts: number;
  reactions?: Record<string, string[]>; // emoji -> array of user ids
  to?: string | null;
};

export default function MessageItem({
  message,
  isOwn,
}: {
  message: MessageType;
  isOwn?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const avatar = useMemo(() => {
    try {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(`avatar_${message.author}`);
    } catch {
      return null;
    }
  }, [message.author]);

  useEffect(() => {
    setAvatarError(false);
  }, [message.author]);

  useEffect(() => {
    (async () => {
      try {
        // if message contains encrypted image-like payload
        if ((message as any).images && Array.isArray((message as any).images)) {
          const imgs = (message as any).images as any[];
          const enc = imgs.find(i => i.encrypted && i.ciphertext);
          if (enc) {
            const pass = localStorage.getItem(`rt_key_${enc.to}`) || '';
            if (!pass) return;
            const key = await deriveKeyFromPassphrase(pass, enc.to);
            const pt = await decryptWithKey(key, enc.ciphertext);
            if (pt) setDecrypted(pt);
          }
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [message]);

  const handleReact = (emoji: string) => {
    // emit reaction by dispatching a custom event so parent can pick it up via DOM event listener
    const ev = new CustomEvent('client:react', { detail: { id: message.id, emoji } });
    window.dispatchEvent(ev);
    setShowPicker(false);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={clsx('turbo-message', isOwn && 'is-own')}
    >
      <div className="turbo-message-row">
        <div className="turbo-message-avatar">
          {avatar && !avatarError ? (
            <Image
              src={avatar}
              alt={message.author}
              fill
              sizes="46px"
              unoptimized
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span>{(message.author || '').slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="turbo-message-meta">
          <div className="turbo-message-header">
            <span className="turbo-message-author">{message.author}</span>
            <span className="turbo-message-timestamp">{dayjs(message.ts).format('HH:mm')}</span>
          </div>
          <div className="turbo-message-body">{decrypted ?? message.text}</div>

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div className="turbo-message-actions">
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <button key={emoji} className="turbo-reaction-chip" onClick={() => handleReact(emoji)}>
                  <span>{emoji}</span>
                  <span>{users.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="turbo-message-toolbar">
          {hover && (
            <div className="turbo-message-toolbar-inner">
              <button className="turbo-reaction-trigger" onClick={() => setShowPicker((s) => !s)}>
                React
              </button>
              {showPicker && <ReactionPicker onPick={handleReact} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
