'use client';

import { useState, useRef, useCallback } from 'react';

export function FeedbackForm() {
  const [type, setType] = useState<'bug' | 'feature'>('bug');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readImageFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setScreenshot(e.target?.result as string);
      setScreenshotName(file.name);
    };
    reader.readAsDataURL(file);
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((i) => i.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        readImageFile(file);
        e.preventDefault();
      }
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readImageFile(file);
  }

  async function captureScreen() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const imageCapture = new (window as unknown as { ImageCapture: new (t: MediaStreamTrack) => { grabFrame(): Promise<ImageBitmap> } }).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      track.stop();
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      setScreenshot(canvas.toDataURL('image/png'));
      setScreenshotName('schermafbeelding.png');
    } catch {
      // user cancelled or not supported
    }
  }

  async function submit() {
    if (!description.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          description,
          screenshot: screenshot ?? undefined,
          url: window.location.href,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      setStatus('sent');
      setDescription('');
      setScreenshot(null);
      setScreenshotName('');
    } catch {
      setStatus('error');
      setErrorMsg('Versturen mislukt. Probeer het opnieuw.');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-[#68b0a6]/20 bg-[#68b0a6]/5 p-6 text-center">
        <div className="text-2xl mb-2">✓</div>
        <p className="text-sm font-medium text-[#68b0a6]">Bedankt voor je melding!</p>
        <p className="text-xs text-[#9ca3af] mt-1">We nemen dit zo snel mogelijk op.</p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-4 text-xs text-[#9ca3af] underline hover:text-white"
        >
          Nog een melding indienen
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#363848] bg-[#252732] p-5 space-y-4">
      {/* Type toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setType('bug')}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            type === 'bug'
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-[#363848] bg-[#1e2028] text-[#9ca3af] hover:text-white'
          }`}
        >
          <span>🐛</span> Bug melden
        </button>
        <button
          onClick={() => setType('feature')}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            type === 'feature'
              ? 'border-[#68b0a6]/40 bg-[#68b0a6]/10 text-[#68b0a6]'
              : 'border-[#363848] bg-[#1e2028] text-[#9ca3af] hover:text-white'
          }`}
        >
          <span>✨</span> Functiewens
        </button>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
          {type === 'bug' ? 'Wat ging er mis? Wat verwachtte je?' : 'Welke functionaliteit wil je toevoegen?'}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onPaste={handlePaste}
          placeholder={
            type === 'bug'
              ? 'Beschrijf de bug zo concreet mogelijk. Je kunt ook een screenshot plakken (Ctrl+V) in dit veld.'
              : 'Beschrijf wat je wilt en waarom dit handig zou zijn...'
          }
          rows={4}
          className="w-full rounded-lg border border-[#363848] bg-[#1e2028] px-3 py-2.5 text-sm text-white placeholder-[#6b7280] focus:border-[#68b0a6]/50 focus:outline-none resize-y"
        />
      </div>

      {/* Screenshot (bugs only) */}
      {type === 'bug' && (
        <div>
          <label className="block text-xs font-medium text-[#9ca3af] mb-1.5">
            Screenshot{' '}
            <span className="text-[#6b7280] font-normal">(optioneel)</span>
          </label>

          {screenshot ? (
            <div className="relative rounded-lg border border-[#363848] overflow-hidden">
              <img src={screenshot} alt="Screenshot" className="w-full max-h-48 object-contain bg-[#1e2028]" />
              <div className="flex items-center justify-between px-3 py-2 bg-[#1e2028] border-t border-[#363848]">
                <span className="text-xs text-[#9ca3af] truncate">{screenshotName}</span>
                <button
                  onClick={() => { setScreenshot(null); setScreenshotName(''); }}
                  className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0"
                >
                  Verwijderen
                </button>
              </div>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                dragOver
                  ? 'border-[#68b0a6]/50 bg-[#68b0a6]/5'
                  : 'border-[#363848] bg-[#1e2028]'
              }`}
            >
              <div className="flex flex-col items-center gap-2">
                <svg className="h-6 w-6 text-[#6b7280]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 3v18M3 3l18 18" />
                </svg>
                <p className="text-xs text-[#9ca3af]">
                  Sleep een afbeelding hierheen, plak (Ctrl+V) of
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-[#363848] bg-[#252732] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
                  >
                    Kies bestand
                  </button>
                  <button
                    onClick={captureScreen}
                    className="rounded-md border border-[#363848] bg-[#252732] px-3 py-1.5 text-xs text-[#9ca3af] hover:text-white transition-colors"
                  >
                    Scherm vastleggen
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readImageFile(file);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!description.trim() || status === 'sending'}
        className="rounded-lg bg-[#68b0a6] px-5 py-2 text-sm font-medium text-[#14151b] hover:bg-[#5a9e94] disabled:opacity-40 transition-colors"
      >
        {status === 'sending' ? 'Versturen…' : 'Indienen'}
      </button>
    </div>
  );
}
