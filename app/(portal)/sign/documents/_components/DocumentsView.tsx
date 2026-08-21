'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

type Required = { doc_type: string; traveller_id: string | null; label: string };
type Upload = {
  id: string;
  doc_type: string;
  traveller_id: string | null;
  original_filename: string;
  byte_size: number;
  uploaded_at: string;
  verified_by_admin: boolean;
  rejected_reason?: string | null;
};

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function DocumentsView({ required, uploads }: { required: Required[]; uploads: Upload[] }) {
  const router = useRouter();
  const i18n = t('en');

  const requiredKeys = required.map((r) => `${r.doc_type}|${r.traveller_id ?? ''}`);
  const uploadedByKey = new Map(uploads.map((u) => [`${u.doc_type}|${u.traveller_id ?? ''}`, u]));
  const allUploaded = requiredKeys.every((k) => uploadedByKey.has(k));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-ink/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand">
            <tr>
              <th className="text-left px-5 py-3 font-medium">Document</th>
              <th className="text-left px-5 py-3 font-medium w-32">Status</th>
              <th className="text-right px-5 py-3 font-medium w-32">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {required.map((r) => {
              const key = `${r.doc_type}|${r.traveller_id ?? ''}`;
              const u = uploadedByKey.get(key);
              return (
                <tr key={key}>
                  <td className="px-5 py-4">
                    <div className="text-ink font-medium">{r.label}</div>
                    <div className="text-xs text-ink-soft font-mono mt-0.5">{r.doc_type}</div>
                  </td>
                  <td className="px-5 py-4">
                    {u ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.verified_by_admin ? 'bg-success/10 text-success' : 'bg-ink/5 text-ink-soft'
                      }`}>
                        {u.verified_by_admin ? i18n.documents.statusVerified : i18n.documents.statusUploaded}
                      </span>
                    ) : (
                      <span className="text-xs text-danger">{i18n.documents.statusPending}</span>
                    )}
                    {u && (
                      <div className="text-[10px] text-ink-soft mt-1">
                        {u.original_filename} ({(u.byte_size / 1024).toFixed(0)} KB)
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <DocUploader docType={r.doc_type} travellerId={r.traveller_id} existing={u} onUploaded={() => router.refresh()} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-gradient-to-t from-sand via-sand to-transparent">
        <button
          onClick={() => router.push('/sign/sign')}
          disabled={!allUploaded}
          className="w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {allUploaded ? i18n.common.continue : `Upload all required documents to continue`}
        </button>
      </div>
    </div>
  );
}

function DocUploader({ docType, travellerId, existing, onUploaded }: {
  docType: string;
  travellerId: string | null;
  existing?: Upload;
  onUploaded: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handle = async (f: File) => {
    setError(null);
    if (!ALLOWED.includes(f.type)) {
      setError('Only PDF, JPG, PNG, WebP');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('File too large (max 15 MB)');
      return;
    }
    setPending(true);
    try {
      const buf = await f.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', buf);
      const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');

      const fd = new FormData();
      fd.append('file', f);
      fd.append('doc_type', docType);
      if (travellerId) fd.append('traveller_id', travellerId);
      fd.append('client_sha256', hex);
      fd.append('original_filename', f.name);

      const res = await fetch('/api/upload-document', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Upload failed');
      }
      onUploaded();
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handle(f);
        }}
        className={`inline-block cursor-pointer px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
          dragging
            ? 'bg-terracotta/10 border-terracotta text-terracotta'
            : 'bg-white border-ink/20 text-ink hover:bg-sand'
        }`}
      >
        <input
          type="file"
          accept={ALLOWED.join(',')}
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
          disabled={pending}
        />
        {pending ? '…' : existing ? 'Replace' : 'Upload'}
      </label>
      {error && <div className="text-[10px] text-danger mt-1">{error}</div>}
    </div>
  );
}
