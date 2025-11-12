import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import supabase from '../lib/supabase';
import { deriveKeyFromPassphrase, encryptWithKey } from '../lib/crypto';

export default function Composer({ onSend, onTyping, ws, currentUser, recipient: propRecipient }: { onSend: (text: string, images?: any[]) => void; onTyping?: () => void; ws?: any; currentUser?: any; recipient?: string | null }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [encrypt, setEncrypt] = useState(false);
  const [recipient, setRecipient] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof propRecipient !== 'undefined' && propRecipient !== null) {
      setRecipient(propRecipient || '');
    }
  }, [propRecipient]);

  useEffect(() => {
    return () => {};
  }, []);

  const handleChange = (v: string) => {
    setText(v);
    if (onTyping) onTyping();
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    // if encryption requested and recipient provided, encrypt message before sending
    if (encrypt && recipient) {
      const pass = localStorage.getItem(`rt_key_${recipient}`) || '';
      if (!pass) {
        alert('No shared secret found for recipient. Add friend and set secret first.');
        return;
      }
      (async () => {
        const key = await deriveKeyFromPassphrase(pass, recipient);
        const ct = await encryptWithKey(key, t);
        // send encrypted payload
        onSend('', [{ encrypted: true, ciphertext: ct, to: recipient }]);
        setText('');
      })();
      return;
    }
    onSend(t);
    setText('');
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setUploading(true);
    try {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads';
      const path = `images/${Date.now()}_${f.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(path, f, { cacheControl: '3600', upsert: false });
      if (uploadError) {
        throw uploadError;
      }
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
      const imageUrl = publicData.publicUrl;
      const img = { url: imageUrl, filename: f.name, filesize: f.size };
      // send as a message with image metadata
      onSend(text || '', [img]);
      setText('');
    } catch (err) {
      console.error(err);
      alert('upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="turbo-composer">
      <div className="turbo-composer-row">
        <input
          className="turbo-composer-input"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={recipient ? `Message ${recipient}` : 'Message #general'}
        />

        <div className="turbo-composer-controls">
          <span className="turbo-composer-label">Encrypt</span>
          <div className="turbo-composer-encrypt">
            <input
              className="turbo-composer-checkbox"
              type="checkbox"
              checked={encrypt}
              onChange={(e) => setEncrypt(e.target.checked)}
            />
            <input
              className="turbo-composer-target"
              placeholder="recipient id"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
        </div>

        <div className="turbo-composer-file">
          <button
            type="button"
            className="turbo-pill secondary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Attach'}
          </button>
          <input ref={fileRef} type="file" onChange={onFileChange} style={{ display: 'none' }} />
        </div>

        <button className="turbo-composer-send" onClick={send} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
