import React, { useEffect, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import supabase from '../lib/supabase';
import { resizeAndCompressImage, fileToDataUrl, getCroppedImg } from '../lib/image';
import Image from 'next/image';

export default function Profile() {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('auth_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        setDisplayName(u.user_metadata?.display_name || u.email || '');
        setBio(u.user_metadata?.bio || '');
        setAvatarUrl(u.user_metadata?.avatar_url || localStorage.getItem('profile_avatar') || null);
      }
    } catch (e) {}
  }, []);

  // handle a raw file: preview and open cropper (upload happens after cropping)
  const handleFile = async (f: File) => {
    setSelectedFile(f);
    try {
      const preview = await fileToDataUrl(f);
      setPreviewUrl(preview);
      setShowCropper(true);
    } catch {}
  };

  const onCropComplete = useCallback((_: any, croppedAreaPixelsArg: any) => {
    setCroppedAreaPixels(croppedAreaPixelsArg);
    // generate a small preview thumbnail for the crop
    (async () => {
      try {
        if (previewUrl && croppedAreaPixelsArg) {
          const blob = await getCroppedImg(previewUrl, croppedAreaPixelsArg);
          const url = URL.createObjectURL(blob);
          // revoke previous
          if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
          setCroppedPreviewUrl(url);
        }
      } catch (e) {}
    })();
  }, [croppedPreviewUrl, previewUrl]);

  const uploadBlobWithRetry = async (blob: Blob, originalName = 'avatar.jpg') => {
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'avatars';
    const maxTries = 3;
    let attempt = 0;
    setProgress(5);
    while (attempt < maxTries) {
      attempt++;
      try {
        setUploading(true);
        // request signed url from backend
        const path = `avatars/${Date.now()}_${originalName.replace(/\.[^.]+$/, '')}.jpg`;
        const token = localStorage.getItem('auth_token') || '';
        const signRes = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api/sign-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ bucket, path })
        });
        if (!signRes.ok) throw new Error('sign failed');
        const signJson = await signRes.json();
        const signedUrl = signJson.signedURL || signJson.signedUrl || signJson.signed_url || signJson.signedurl || signJson.uploadURL || signJson.uploadUrl || signJson.url;
        const publicUrl = signJson.publicUrl || signJson.publicURL || signJson.public_url;
        if (!signedUrl) throw new Error('no signed url returned');

        // upload via XHR to track progress
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedUrl);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const p = Math.round((ev.loaded / ev.total) * 100);
              setProgress(Math.min(90, 20 + Math.round(p * 0.7)));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error('upload failed status ' + xhr.status));
            }
          };
          xhr.onerror = () => reject(new Error('upload error'));
          xhr.send(blob);
        });

        // finalize: persist publicUrl
        if (publicUrl) {
          setProgress(95);
          setAvatarUrl(publicUrl);
          localStorage.setItem('profile_avatar', publicUrl);
          try {
            if (token) {
              await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ display_name: displayName, avatar_url: publicUrl, bio })
              });
            }
          } catch (e) {}
        }
        setProgress(100);
        return;
      } catch (err) {
        console.warn('upload attempt failed', attempt, err);
        await new Promise((res) => setTimeout(res, 500 * attempt));
      } finally {
        setUploading(false);
      }
    }
    throw new Error('upload failed after retries');
  };

  const applyCropAndUpload = async () => {
    if (!previewUrl || !croppedAreaPixels) return;
    try {
      setProgress(10);
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      setProgress(30);
      // resize/compress the cropped blob to target size
      const outBlob = await resizeAndCompressImage(new File([croppedBlob], 'crop.jpg', { type: 'image/jpeg' }), 512, 0.85);
      await uploadBlobWithRetry(outBlob, selectedFile?.name || 'avatar.jpg');
      setShowCropper(false);
      setPreviewUrl(null);
      setSelectedFile(null);
    } catch (err) {
      console.error('crop/upload failed', err);
      alert('Upload failed, please try again');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    void handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    void handleFile(f);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeAvatar = async () => {
    setAvatarUrl(null);
    setPreviewUrl(null);
    setSelectedFile(null);
    localStorage.removeItem('profile_avatar');
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ display_name: displayName, avatar_url: '', bio })
        });
      }
    } catch (e) {}
  };

  const saveProfile = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      if (token) {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080') + '/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ display_name: displayName, avatar_url: avatarUrl, bio })
        });
        if (!res.ok) {
          console.warn('profile save failed', res.status);
        }
      }
    } catch (e) {
      console.warn('profile save error', e);
    }
    const raw = { displayName, bio, avatarUrl };
    localStorage.setItem('profile_displayName', displayName);
    localStorage.setItem('profile_bio', bio);
    if (avatarUrl) localStorage.setItem('profile_avatar', avatarUrl);
    // also set a convenience avatar_<email> key so others can pick it up locally in demos
    try {
      const auRaw = localStorage.getItem('auth_user');
      if (auRaw) {
        const u = JSON.parse(auRaw);
        const email = u.email || u.user?.email || null;
        if (email && avatarUrl) localStorage.setItem(`avatar_${email}`, avatarUrl);
      }
    } catch (e) {}
    alert('Profile saved (local & server attempted).');
  };

  return (
    <div className="turbo-profile-shell">
      <h2 className="turbo-channel-title" style={{ marginBottom: 24, letterSpacing: '0.16em' }}>
        Profile
      </h2>
      <div className="turbo-profile-header">
        <div className="turbo-profile-avatar">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="avatar" fill sizes="128px" unoptimized />
          ) : (
            <span>{(displayName || '').slice(0, 2).toUpperCase() || 'U'}</span>
          )}
        </div>
        <div className="turbo-profile-form">
          <div className="turbo-form-group">
            <label htmlFor="profile-display">Display name</label>
            <input id="profile-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="turbo-form-group">
            <label htmlFor="profile-bio">Bio</label>
            <textarea id="profile-bio" className="turbo-textarea" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
          <div className="turbo-dropzone" onDrop={onDrop} onDragOver={onDragOver}>
            <div className="turbo-dropzone-thumb">
              {previewUrl && showCropper ? (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
              ) : previewUrl ? (
                <Image src={previewUrl} alt="preview" fill sizes="96px" unoptimized />
              ) : avatarUrl ? (
                <Image src={avatarUrl} alt="avatar" fill sizes="96px" unoptimized />
              ) : (
                <span>Drop or click to choose</span>
              )}
            </div>
            <div className="turbo-dropzone-info">
              <span>{selectedFile ? selectedFile.name : 'Avatar'}</span>
              <span>PNG / JPG recommended — will be resized to 512px and compressed</span>
            </div>
            <input type="file" accept="image/*" onChange={onFile} />
          </div>
          <div className="turbo-actions-row">
            <button className="turbo-pill positive" onClick={saveProfile}>
              {uploading ? 'Uploading…' : 'Save profile'}
            </button>
            <button className="turbo-pill destructive" onClick={removeAvatar} disabled={!avatarUrl && !previewUrl}>
              Remove avatar
            </button>
            {showCropper && (
              <>
                <button className="turbo-pill positive" onClick={applyCropAndUpload} disabled={uploading}>
                  Apply crop & upload
                </button>
                <button
                  className="turbo-pill secondary"
                  onClick={() => {
                    setShowCropper(false);
                    setPreviewUrl(null);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </button>
                {croppedPreviewUrl && (
                  <div className="turbo-crop-preview">
                    <Image src={croppedPreviewUrl} alt="crop preview" fill sizes="52px" unoptimized />
                  </div>
                )}
              </>
            )}
          </div>
          {uploading && (
            <div style={{ marginTop: 14 }}>
              <div className="turbo-progress">
                <div className="turbo-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
