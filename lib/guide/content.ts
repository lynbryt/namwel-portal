// Guide content loader.
// Reads from the pinned guide_versions row. The version_id is set on the
// session at creation and never changes.

import { getAdmin } from '@/lib/supabase/admin';

export type GuideSubheading = {
  title?: string;
  table?: { headers: string[]; rows: string[][] };
  footnote?: string;
};

export type GuideSection = {
  key: string;
  title: string;
  estimated_minutes?: number;
  intro?: string;
  paragraphs?: string[];
  subheadings?: GuideSubheading[];
  callout?: string;
  warning?: string;
  reminders?: string[];
  critical?: boolean;
  checklist_grouped?: { group: string; items: string[] }[];
};

export type GuideContent = {
  version: string;
  issued_at: string;
  title: string;
  subtitle: string;
  regions: string[];
  disclaimer: string;
  sections: GuideSection[];
  checklist: { key: string; group: string; label: string }[];
  declarations: { key: string; label: string }[];
  doc_type_labels: Record<string, string>;
};

export async function loadGuide(guideVersionId: string): Promise<GuideContent> {
  const { data, error } = await getAdmin()
    .from('guide_versions')
    .select('content_json, version')
    .eq('id', guideVersionId)
    .single();

  if (error || !data) {
    throw new Error(`guide version ${guideVersionId} not found`);
  }
  return data.content_json as GuideContent;
}

export async function loadCurrentGuide(): Promise<GuideContent> {
  const { data, error } = await getAdmin()
    .from('guide_versions')
    .select('id, content_json')
    .is('retired_at', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('no active guide version');
  }
  return data.content_json as GuideContent;
}

// Group sections for the wizard's left rail.
export type ReadingGroup = {
  key: string;
  title: string;
  sectionKeys: string[];
};

export function groupSections(sections: GuideSection[]): ReadingGroup[] {
  // Map by section key for quick lookup
  const byKey = new Map(sections.map((s) => [s.key, s]));

  return [
    { key: 'grp_visas',     title: 'Visas & arrival',          sectionKeys: ['sec_1_passports', 'sec_2_arrival'] },
    { key: 'grp_children',  title: 'Children (preview)',       sectionKeys: ['sec_3_children'] },
    { key: 'grp_borders',   title: 'Borders & vehicle',        sectionKeys: ['sec_4_borders'] },
    { key: 'grp_health',    title: 'Health & insurance',       sectionKeys: ['sec_5_health'] },
    { key: 'grp_money',     title: 'Money & driving',          sectionKeys: ['sec_6_money', 'sec_7_driving'] },
    { key: 'grp_climate',   title: 'Climate & connectivity',   sectionKeys: ['sec_8_climate', 'sec_9_connectivity'] },
    { key: 'grp_emergency', title: 'Emergency & checklist',    sectionKeys: ['sec_10_emergency', 'sec_11_checklist'] },
  ].filter((g) => g.sectionKeys.every((k) => byKey.has(k)));
}
