'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

interface LibraryImage {
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

interface Props {
  currentUrl?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

async function getCroppedBlob(imageSrc: string, cropArea: Area, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, cropArea.width, cropArea.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, mimeType, 0.92);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

export function ImagePickerModal({ currentUrl, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<'upload' | 'library'>('upload');

  // Upload + crop state
  const [rawDataUrl, setRawDataUrl] = useState<string | null>(null);
  const [rawMime, setRawMime] = useState('image/jpeg');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library state
  const [library, setLibrary] = useState<LibraryImage[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawMime(file.type || 'image/jpeg');
    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => setRawDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUploadCropped() {
    if (!rawDataUrl || !croppedArea) return;
    setUploading(true);
    setUploadError('');
    try {
      const blob = await getCroppedBlob(rawDataUrl, croppedArea, rawMime);
      const ext = rawMime.split('/')[1] ?? 'jpg';
      const file = new File([blob], `crop.${ext}`, { type: rawMime });
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error ?? 'Upload mislukt.'); return; }
      onSelect(json.url);
    } catch {
      setUploadError('Upload mislukt. Probeer opnieuw.');
    } finally {
      setUploading(false);
    }
  }

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const res = await fetch('/api/admin/upload');
      const json = await res.json();
      if (!res.ok) { setLibraryError(json.error ?? 'Laden mislukt.'); return; }
      setLibrary(json.files ?? []);
    } catch {
      setLibraryError('Laden mislukt.');
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'library') loadLibrary();
  }, [tab]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-[#363848] bg-[#252732] shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#363848]">
          <h3 className="text-base font-semibold text-white">Afbeelding kiezen</h3>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#363848]">
          {(['upload', 'library'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-[#68b0a6] border-b-2 border-[#68b0a6]'
                  : 'text-[#9ca3af] hover:text-white'
              }`}
            >
              {t === 'upload' ? 'Nieuw uploaden' : 'Bibliotheek'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Upload + crop tab */}
          {tab === 'upload' && (
            <div className="space-y-4">
              {!rawDataUrl ? (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[#363848] bg-[#1e2028] px-6 py-12 hover:border-[#68b0a6] hover:bg-[#252732] transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-[#9ca3af]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-[#9ca3af]">Klik om een afbeelding te kiezen</span>
                    <span className="text-xs text-[#6b7280]">JPG, PNG, WebP — max 10 MB</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Cropper */}
                  <div className="relative w-full h-72 bg-[#1e2028] rounded-xl overflow-hidden">
                    <Cropper
                      image={rawDataUrl}
                      crop={crop}
                      zoom={zoom}
                      aspect={16 / 10}
                      onCropChange={setCrop}
                      onZoomChange={setZoom}
                      onCropComplete={onCropComplete}
                    />
                  </div>

                  {/* Zoom slider */}
                  <div className="flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#9ca3af] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 accent-[#68b0a6]"
                    />
                  </div>

                  {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={handleUploadCropped}
                      disabled={uploading}
                      className="flex-1 rounded-lg bg-[#68b0a6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#7ec4ba] disabled:opacity-50 transition-colors"
                    >
                      {uploading ? 'Uploaden...' : 'Bijsnijden & uploaden'}
                    </button>
                    <button
                      onClick={() => { setRawDataUrl(null); setCroppedArea(null); setZoom(1); }}
                      disabled={uploading}
                      className="rounded-lg border border-[#363848] px-4 py-2.5 text-sm text-[#9ca3af] hover:bg-[#363848] transition-colors"
                    >
                      Andere foto
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Library tab */}
          {tab === 'library' && (
            <div>
              {libraryLoading && (
                <div className="flex items-center justify-center py-16">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#68b0a6] border-t-transparent" />
                </div>
              )}
              {libraryError && <p className="text-sm text-red-400">{libraryError}</p>}
              {!libraryLoading && !libraryError && library.length === 0 && (
                <p className="text-sm text-[#9ca3af] text-center py-12">Nog geen afbeeldingen geüpload.</p>
              )}
              {!libraryLoading && library.length > 0 && (
                <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {library.map((img) => (
                    <button
                      key={img.name}
                      onClick={() => onSelect(img.url)}
                      className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all hover:border-[#68b0a6] ${
                        currentUrl === img.url ? 'border-[#68b0a6]' : 'border-transparent'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      {currentUrl === img.url && (
                        <div className="absolute inset-0 bg-[#68b0a6]/20 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!libraryLoading && (
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-[#9ca3af]">{library.length} afbeelding{library.length !== 1 ? 'en' : ''}</span>
                  <button onClick={loadLibrary} className="text-xs text-[#68b0a6] hover:text-white transition-colors">
                    Vernieuwen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
