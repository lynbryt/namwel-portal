'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveChildScenario } from '@/app/(portal)/sign/_actions/children';
import { requiredDocsForScenario } from '@/lib/uploads/doc-types';
import { t } from '@/lib/i18n';

type Minor = { id: string; full_name: string; date_of_birth: string; role: string; ordinal: number };
type Scenario = {
  id: string;
  traveller_id: string;
  scenario: 'both_parents' | 'one_parent' | 'grandparent_guardian' | 'unaccompanied';
  non_travelling_parent_name?: string | null;
  non_travelling_parent_id_last4?: string | null;
  receiving_person_name?: string | null;
  receiving_person_address?: string | null;
  notes?: string | null;
};
type Upload = {
  id: string;
  doc_type: string;
  traveller_id: string | null;
  original_filename: string;
  uploaded_at: string;
};

const SCENARIO_OPTIONS: Array<{ value: Scenario['scenario']; label: string; needs: string[] }> = [
  { value: 'both_parents',        label: 'Both parents travelling', needs: ['unabridged_birth_cert'] },
  { value: 'one_parent',          label: 'One parent travelling', needs: ['unabridged_birth_cert', 'parental_consent_affidavit', 'non_travelling_parent_id'] },
  { value: 'grandparent_guardian', label: 'Grandparent/relative/guardian', needs: ['unabridged_birth_cert', 'parental_consent_affidavit', 'non_travelling_parent_id'] },
  { value: 'unaccompanied',       label: 'Unaccompanied minor', needs: ['unabridged_birth_cert', 'parental_consent_affidavit', 'non_travelling_parent_id', 'receiving_person_letter', 'receiving_person_id'] },
];

const DOC_LABELS: Record<string, string> = {
  unabridged_birth_cert: 'Unabridged birth certificate',
  parental_consent_affidavit: 'Parental consent affidavit',
  non_travelling_parent_id: 'Non-travelling parent ID/passport copy',
  receiving_person_letter: 'Letter from receiving person',
  receiving_person_id: 'Receiving person ID/passport copy',
};

export function ChildrenView({ minors, scenarios, uploads }: { minors: Minor[]; scenarios: Scenario[]; uploads: Upload[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const i18n = t('en');

  const [activeId, setActiveId] = useState<string>(minors[0]?.id ?? '');
  const active = minors.find((m) => m.id === activeId);
  const sc = scenarios.find((s) => s.traveller_id === activeId);
  const childUploads = uploads.filter((u) => u.traveller_id === activeId);

  if (minors.length === 0) {
    return (
      <div className="bg-white border border-ink/10 rounded-lg p-8 text-center">
        <p className="text-ink-soft">No children in this party. You can continue to the checklist.</p>
        <button
          onClick={() => router.push('/sign/checklist')}
          className="mt-4 bg-terracotta text-white font-medium px-6 py-2 rounded"
        >
          {i18n.common.continue}
        </button>
      </div>
    );
  }

  const requiredDocs = sc ? requiredDocsForScenario(sc.scenario) : [];
  const uploadedTypes = new Set(childUploads.map((u) => u.doc_type));
  const allRequiredUploaded = requiredDocs.every((d) => uploadedTypes.has(d));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {minors.map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveId(m.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeId === m.id
                ? 'bg-terracotta text-white'
                : 'bg-white border border-ink/20 text-ink hover:bg-sand'
            }`}
          >
            {m.full_name}
          </button>
        ))}
      </div>

      {active && (
        <div className="bg-white border border-ink/10 rounded-lg p-6 md:p-8">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-ink-soft">{i18n.children.childName}</div>
            <div className="font-display text-2xl text-ink">{active.full_name}</div>
            <div className="text-xs text-ink-soft mt-1">DOB {active.date_of_birth}</div>
          </div>

          <ScenarioForm
            travellerId={active.id}
            initial={sc}
            onSaved={() => router.refresh()}
          />

          {sc && (
            <div className="mt-8 border-t border-ink/10 pt-6">
              <h3 className="text-sm font-medium text-ink mb-3">{i18n.children.requiredDocs}</h3>
              <p className="text-xs text-ink-soft mb-4">{i18n.children.uploadEach}</p>
              <div className="space-y-3">
                {requiredDocs.map((docType) => {
                  const existing = childUploads.find((u) => u.doc_type === docType);
                  return (
                    <UploadRow
                      key={docType}
                      docType={docType}
                      label={DOC_LABELS[docType] ?? docType}
                      travellerId={active.id}
                      existing={existing}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-gradient-to-t from-sand via-sand to-transparent">
        <button
          onClick={() => router.push('/sign/checklist')}
          disabled={!allRequiredUploaded || pending}
          className="w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {allRequiredUploaded ? i18n.common.continue : `Complete all child docs to continue`}
        </button>
      </div>
    </div>
  );
}

function ScenarioForm({ travellerId, initial, onSaved }: {
  travellerId: string;
  initial?: Scenario;
  onSaved: () => void;
}) {
  const i18n = t('en');
  const [scenario, setScenario] = useState<Scenario['scenario']>(initial?.scenario ?? 'both_parents');
  const [nonTravellingParentName, setNonTravellingParentName] = useState(initial?.non_travelling_parent_name ?? '');
  const [nonTravellingParentIdLast4, setNonTravellingParentIdLast4] = useState(initial?.non_travelling_parent_id_last4 ?? '');
  const [receivingPersonName, setReceivingPersonName] = useState(initial?.receiving_person_name ?? '');
  const [receivingPersonAddress, setReceivingPersonAddress] = useState(initial?.receiving_person_address ?? '');
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveChildScenario({
          traveller_id: travellerId,
          scenario,
          non_travelling_parent_name: nonTravellingParentName || null,
          non_travelling_parent_id_last4: nonTravellingParentIdLast4 || null,
          receiving_person_name: receivingPersonName || null,
          receiving_person_address: receivingPersonAddress || null,
        });
        setSaved(true);
        onSaved();
      } catch (err: any) {
        setError(err?.message ?? i18n.common.error);
      }
    });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-2">{i18n.children.scenario}</label>
      <div className="space-y-2">
        {SCENARIO_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-3 p-3 border border-ink/10 rounded cursor-pointer hover:bg-sand">
            <input
              type="radio"
              name={`scenario-${travellerId}`}
              value={opt.value}
              checked={scenario === opt.value}
              onChange={() => setScenario(opt.value)}
              className="accent-terracotta"
            />
            <span className="text-sm text-ink">{opt.label}</span>
          </label>
        ))}
      </div>

      {scenario !== 'both_parents' && (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-soft mb-1">{i18n.children.nonTravellingParent}</label>
            <input
              value={nonTravellingParentName}
              onChange={(e) => setNonTravellingParentName(e.target.value)}
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">{i18n.children.nonTravellingParentId}</label>
            <input
              value={nonTravellingParentIdLast4}
              onChange={(e) => setNonTravellingParentIdLast4(e.target.value)}
              maxLength={10}
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm font-mono"
            />
          </div>
        </div>
      )}

      {scenario === 'unaccompanied' && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-soft mb-1">{i18n.children.receivingPersonName}</label>
            <input
              value={receivingPersonName}
              onChange={(e) => setReceivingPersonName(e.target.value)}
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-1">{i18n.children.receivingPersonAddress}</label>
            <input
              value={receivingPersonAddress}
              onChange={(e) => setReceivingPersonAddress(e.target.value)}
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="px-5 py-2 bg-ink text-white text-sm rounded hover:bg-ink-soft disabled:opacity-50"
        >
          {pending ? i18n.common.saving : i18n.common.save}
        </button>
        {saved && <span className="text-xs text-success">{i18n.common.saved}</span>}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}

function UploadRow({ docType, label, travellerId, existing }: {
  docType: string;
  label: string;
  travellerId: string;
  existing?: Upload;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const i18n = t('en');

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setPending(true);
    try {
      const buf = await f.arrayBuffer();
      const hash = await crypto.subtle.digest('SHA-256', buf);
      const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');

      const fd = new FormData();
      fd.append('file', f);
      fd.append('doc_type', docType);
      fd.append('traveller_id', travellerId);
      fd.append('client_sha256', hex);
      fd.append('original_filename', f.name);

      const res = await fetch('/api/upload-document', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Upload failed');
      }
    } catch (err: any) {
      setError(err?.message ?? i18n.common.error);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 border border-ink/10 rounded bg-sand/50">
      <div className="flex-1">
        <div className="text-sm font-medium text-ink">{label}</div>
        {existing ? (
          <div className="text-xs text-success mt-0.5">
            ✓ {existing.original_filename} (uploaded {new Date(existing.uploaded_at).toLocaleDateString()})
          </div>
        ) : (
          <div className="text-xs text-ink-soft mt-0.5">Not uploaded</div>
        )}
        {error && <div className="text-xs text-danger mt-1">{error}</div>}
      </div>
      <label className="cursor-pointer">
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} disabled={pending} />
        <span className="inline-block px-3 py-1.5 bg-white border border-ink/20 rounded text-xs font-medium text-ink hover:bg-sand">
          {pending ? '…' : existing ? 'Replace' : i18n.common.upload}
        </span>
      </label>
    </div>
  );
}
