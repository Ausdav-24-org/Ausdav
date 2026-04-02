import { useEffect, useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  MoreVertical,
  Upload,
  Download,
  Loader2,
  FileText,
  Users,
  TrendingUp,
  ArrowUpDown,
  Save,
  RotateCcw,
  Settings2,
  Pencil,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/integrations/supabase/functions';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

type AppSettings = {
  allow_results_view: boolean;

  // subject-specific ranges saved as default
  phy_grade_a_min?: number | null;
  phy_grade_b_min?: number | null;
  phy_grade_c_min?: number | null;
  phy_grade_s_min?: number | null;

  che_grade_a_min?: number | null;
  che_grade_b_min?: number | null;
  che_grade_c_min?: number | null;
  che_grade_s_min?: number | null;

  bio_grade_a_min?: number | null;
  bio_grade_b_min?: number | null;
  bio_grade_c_min?: number | null;
  bio_grade_s_min?: number | null;

  maths_grade_a_min?: number | null;
  maths_grade_b_min?: number | null;
  maths_grade_c_min?: number | null;
  maths_grade_s_min?: number | null;
};

interface Applicant {
  applicant_id: number;
  index_no: string;
  fullname: string;
  stream: string;
  gender: boolean;
  nic: string;
  phone: string | null;
  email: string | null;
  school: string;
  created_at: string;
  year: number;
}

interface Result {
  result_id: number;
  index_no: string;
  stream: string;
  physics_marks: number | null;
  chemistry_marks: number | null;
  maths_marks: number | null;
  bio_marks: number | null;

  phy_a_min: number;
  phy_b_min: number;
  phy_c_min: number;
  phy_s_min: number;

  che_a_min: number;
  che_b_min: number;
  che_c_min: number;
  che_s_min: number;

  bio_a_min: number;
  bio_b_min: number;
  bio_c_min: number;
  bio_s_min: number;

  maths_a_min: number;
  maths_b_min: number;
  maths_c_min: number;
  maths_s_min: number;

  physics_grade: string | null;
  chemistry_grade: string | null;
  maths_grade: string | null;
  bio_grade: string | null;

  zscore: number | null;
  rank: number | null;
  year: number;

  created_at: string;
  updated_at: string;
}

interface ApplicantWithResult extends Applicant {
  result?: Result | null;
}

type GradeRanges = {
  A_min: number;
  B_min: number;
  C_min: number;
  S_min: number;
};

// ✅ UPDATED: add 'all'
type SubjectKey = 'all' | 'physics' | 'chemistry' | 'bio' | 'maths';

const DEFAULT_SL_RANGES: GradeRanges = { A_min: 75, B_min: 65, C_min: 55, S_min: 35 };

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || String(v).trim() === '') return '-';
  return String(v);
}

function gradeBadgeClass(g: string | null | undefined): string {
  const grade = (g || '').toString().toUpperCase();
  switch (grade) {
    case 'A':
      return 'bg-emerald-600 text-white';
    case 'B':
      return 'bg-blue-600 text-white';
    case 'C':
      return 'bg-yellow-400 text-black';
    case 'S':
      return 'bg-orange-400 text-black';
    case 'F':
      return 'bg-red-600 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function validateRanges(r: GradeRanges): string | null {
  const vals = [r.A_min, r.B_min, r.C_min, r.S_min];
  if (vals.some((x) => !Number.isFinite(x))) return 'All ranges must be numbers';
  if (vals.some((x) => x < 0 || x > 100)) return 'Ranges must be between 0 and 100';
  if (!(r.A_min > r.B_min && r.B_min > r.C_min && r.C_min > r.S_min)) return 'Must be A > B > C > S';
  return null;
}

function gradeFromMark(mark: unknown, ranges: GradeRanges): 'A' | 'B' | 'C' | 'S' | 'F' | null {
  const n = toNumberOrNull(mark);
  if (n === null) return null;
  if (n >= ranges.A_min) return 'A';
  if (n >= ranges.B_min) return 'B';
  if (n >= ranges.C_min) return 'C';
  if (n >= ranges.S_min) return 'S';
  return 'F';
}

type SortMode = 'default' | 'rank_asc' | 'rank_desc';

function makeBellCurveBuckets(values: number[]) {
  const buckets: Record<string, number> = {};
  for (let i = 0; i <= 100; i += 10) {
    const label = `${i}-${i + 9}`;
    buckets[label] = 0;
  }
  buckets['100'] = 0;

  for (const v of values) {
    const n = Math.max(0, Math.min(100, Math.round(v)));
    if (n === 100) {
      buckets['100'] += 1;
      continue;
    }
    const start = Math.floor(n / 10) * 10;
    const label = `${start}-${start + 9}`;
    buckets[label] += 1;
  }

  const order: string[] = [];
  for (let i = 0; i <= 90; i += 10) order.push(`${i}-${i + 9}`);
  order.push('100');

  return order.map((name) => ({ name, count: buckets[name] || 0 }));
}

export default function AdminResultsPage() {
  const { isAdmin, isSuperAdmin } = useAdminAuth();
  const canManageSettings = isAdmin || isSuperAdmin;

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStream, setFilterStream] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [chartHeight, setChartHeight] = useState(320);
  const [isMobileView, setIsMobileView] = useState(false);

  const [allowResultsView, setAllowResultsView] = useState<boolean | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [resultsSaving, setResultsSaving] = useState(false);

  // ✅ UPDATED: default to 'all'
  const [selectedSubjectForGrade, setSelectedSubjectForGrade] = useState<SubjectKey>('all');

  // ✅ UPDATED: include 'all'
  const [gradeRangesDraftBySubject, setGradeRangesDraftBySubject] = useState<Record<SubjectKey, GradeRanges>>({
    all: DEFAULT_SL_RANGES,
    physics: DEFAULT_SL_RANGES,
    chemistry: DEFAULT_SL_RANGES,
    bio: DEFAULT_SL_RANGES,
    maths: DEFAULT_SL_RANGES,
  });

  const [gradeRangesAppliedBySubject, setGradeRangesAppliedBySubject] = useState<Record<SubjectKey, GradeRanges>>({
    all: DEFAULT_SL_RANGES,
    physics: DEFAULT_SL_RANGES,
    chemistry: DEFAULT_SL_RANGES,
    bio: DEFAULT_SL_RANGES,
    maths: DEFAULT_SL_RANGES,
  });

  const [rangesSaving, setRangesSaving] = useState(false);

  const rangesDifferent = useMemo(() => {
    const subject = selectedSubjectForGrade;
    const draft = gradeRangesDraftBySubject[subject];
    const applied = gradeRangesAppliedBySubject[subject];
    return (
      draft.A_min !== applied.A_min ||
      draft.B_min !== applied.B_min ||
      draft.C_min !== applied.C_min ||
      draft.S_min !== applied.S_min
    );
  }, [selectedSubjectForGrade, gradeRangesDraftBySubject, gradeRangesAppliedBySubject]);

  const [sortMode, setSortMode] = useState<SortMode>('default');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantWithResult | null>(null);

  // Edit applicant dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingApplicant, setEditingApplicant] = useState<ApplicantWithResult | null>(null);
  const [editForm, setEditForm] = useState({
    fullname: '',
    gender: true,
    stream: '',
    nic: '',
    phone: '',
    email: '',
    school: '',
    physics_marks: '',
    chemistry_marks: '',
    maths_marks: '',
    bio_marks: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  const uniqueYears = useMemo(() => {
    // Exclude null/undefined years for the year selector; we'll handle null-year applicants separately.
    const years = [...new Set(applicants.map((a) => a.year).filter((y) => y !== null && y !== undefined))] as number[];
    years.sort((a, b) => b - a);
    return years;
  }, [applicants]);

  useEffect(() => {
    if (uniqueYears.length > 0 && selectedYear === null) {
      setSelectedYear(uniqueYears[0]);
    } else if (uniqueYears.length === 0 && applicants.length > 0 && selectedYear === null) {
      // No explicit year values present in the dataset; pick the first applicant's year (may be null)
      setSelectedYear(applicants[0].year ?? null);
    }
  }, [uniqueYears, selectedYear, applicants]);

  useEffect(() => {
    fetchApplicants();
    loadResultsSetting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Handle responsive chart heights and mobile view detection
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setChartHeight(250);
        setIsMobileView(true);
      } else if (window.innerWidth < 1024) {
        setChartHeight(280);
        setIsMobileView(false);
      } else {
        setChartHeight(320);
        setIsMobileView(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadResultsSetting = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase.from('app_settings' as any).select('*').eq('id', 1).maybeSingle();
      if (error) throw error;

      const settings = data as unknown as AppSettings | null;
      setAllowResultsView(settings?.allow_results_view ?? false);

      // ✅ UPDATED: include 'all'
      const loadedBySubject: Record<SubjectKey, GradeRanges> = {
        all: {
          A_min: Number(settings?.phy_grade_a_min ?? DEFAULT_SL_RANGES.A_min),
          B_min: Number(settings?.phy_grade_b_min ?? DEFAULT_SL_RANGES.B_min),
          C_min: Number(settings?.phy_grade_c_min ?? DEFAULT_SL_RANGES.C_min),
          S_min: Number(settings?.phy_grade_s_min ?? DEFAULT_SL_RANGES.S_min),
        },
        physics: {
          A_min: Number(settings?.phy_grade_a_min ?? DEFAULT_SL_RANGES.A_min),
          B_min: Number(settings?.phy_grade_b_min ?? DEFAULT_SL_RANGES.B_min),
          C_min: Number(settings?.phy_grade_c_min ?? DEFAULT_SL_RANGES.C_min),
          S_min: Number(settings?.phy_grade_s_min ?? DEFAULT_SL_RANGES.S_min),
        },
        chemistry: {
          A_min: Number(settings?.che_grade_a_min ?? DEFAULT_SL_RANGES.A_min),
          B_min: Number(settings?.che_grade_b_min ?? DEFAULT_SL_RANGES.B_min),
          C_min: Number(settings?.che_grade_c_min ?? DEFAULT_SL_RANGES.C_min),
          S_min: Number(settings?.che_grade_s_min ?? DEFAULT_SL_RANGES.S_min),
        },
        bio: {
          A_min: Number(settings?.bio_grade_a_min ?? DEFAULT_SL_RANGES.A_min),
          B_min: Number(settings?.bio_grade_b_min ?? DEFAULT_SL_RANGES.B_min),
          C_min: Number(settings?.bio_grade_c_min ?? DEFAULT_SL_RANGES.C_min),
          S_min: Number(settings?.bio_grade_s_min ?? DEFAULT_SL_RANGES.S_min),
        },
        maths: {
          A_min: Number(settings?.maths_grade_a_min ?? DEFAULT_SL_RANGES.A_min),
          B_min: Number(settings?.maths_grade_b_min ?? DEFAULT_SL_RANGES.B_min),
          C_min: Number(settings?.maths_grade_c_min ?? DEFAULT_SL_RANGES.C_min),
          S_min: Number(settings?.maths_grade_s_min ?? DEFAULT_SL_RANGES.S_min),
        },
      };

      setGradeRangesDraftBySubject(loadedBySubject);
      setGradeRangesAppliedBySubject(loadedBySubject);
    } catch (error) {
      console.error('Error loading setting:', error);
      toast.error('Failed to load publish setting');
      setAllowResultsView(false);

      const fallback: Record<SubjectKey, GradeRanges> = {
        all: DEFAULT_SL_RANGES,
        physics: DEFAULT_SL_RANGES,
        chemistry: DEFAULT_SL_RANGES,
        bio: DEFAULT_SL_RANGES,
        maths: DEFAULT_SL_RANGES,
      };

      setGradeRangesDraftBySubject(fallback);
      setGradeRangesAppliedBySubject(fallback);
    } finally {
      setSettingsLoading(false);
    }
  };

  const toggleResultsSetting = async () => {
    if (allowResultsView === null || resultsSaving) return;
    if (!canManageSettings) return;

    const next = !allowResultsView;
    setResultsSaving(true);
    setAllowResultsView(next);

    try {
      const { data, error } = await invokeFunction('update-results-publish', { allow_results_view: next });
      if (error) throw error;

      const updated = data?.updated ?? [];
      if (!updated || (Array.isArray(updated) && updated.length === 0)) {
        throw new Error('No rows updated — check permissions or server logs');
      }

      toast.success(next ? 'Results published' : 'Results unpublished');
    } catch (error: any) {
      console.error('Error updating setting via function:', error);
      setAllowResultsView(!next);
      toast.error(error?.message || 'Failed to update publish setting');
    } finally {
      await loadResultsSetting();
      setResultsSaving(false);
    }
  };

  const fetchApplicants = async () => {
    try {
      // Use edge function with service role for admins so RLS does not hide rows
      if (isAdmin || isSuperAdmin) {
        const { data, error } = await invokeFunction('fetch-applicants', {});
        if (error) throw error;

        console.log('invoke fetch-applicants returned', data);

        const fetchedApplicants = (data?.applicants as Applicant[]) || [];
        const fetchedResults = (data?.results as Result[]) || [];

        // If edge function returned results but no applicants, attempt a client-side fallback
        if (Array.isArray(fetchedResults) && fetchedResults.length > 0 && (!Array.isArray(fetchedApplicants) || fetchedApplicants.length === 0)) {
          console.warn('fetch-applicants returned results but no applicants; trying client-side fallback');
          try {
            const { data: applicantsData, error: applicantsError } = await supabase
              .from('applicants' as any)
              .select('*')
              .order('created_at', { ascending: false });
            if (!applicantsError && Array.isArray(applicantsData) && applicantsData.length > 0) {
              console.log('Client fallback got applicants count', applicantsData.length);
              const normalized = (applicantsData as any[]).map((a) => ({
                ...a,
                index_no: String(a.index_no ?? a.index_no ?? ''),
                year: a.year !== undefined && a.year !== null ? Number(a.year) : null,
              }));
              setApplicants(normalized as Applicant[]);
            } else {
              console.log('Client fallback returned no applicants', { applicantsError, applicantsData });
              setApplicants([]);
            }
          } catch (e) {
            console.error('Client-side applicants fallback failed', e);
            setApplicants([]);
          }
        } else {
          const normalized = (fetchedApplicants || []).map((a: any) => ({
            ...a,
            index_no: String(a.index_no ?? ''),
            year: a.year !== undefined && a.year !== null ? Number(a.year) : null,
          }));
          setApplicants(normalized as Applicant[]);
        }

        setResults(fetchedResults);
      } else {
        const { data: applicantsData, error: applicantsError } = await supabase
          .from('applicants' as any)
          .select('*')
          .order('created_at', { ascending: false });
        if (applicantsError) throw applicantsError;
        setApplicants((applicantsData as unknown as Applicant[]) || []);

        const { data: resultsData, error: resultsError } = await supabase
          .from('results' as any)
          .select('*')
          .order('created_at', { ascending: false });
        if (resultsError) throw resultsError;
        setResults((resultsData as unknown as Result[]) || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // include year in key to avoid collisions
  const resultsMap = useMemo(() => {
    const map = new Map<string, Result>();
    for (const r of results) map.set(`${r.index_no}__${r.year}`, r);
    return map;
  }, [results]);

  const applicantsWithResults = useMemo(() => {
    return applicants.map((a) => ({
      ...a,
      result: resultsMap.get(`${a.index_no}__${a.year}`) || null,
    })) as ApplicantWithResult[];
  }, [applicants, resultsMap]);

  const yearApplicants = useMemo(() => {
    if (selectedYear === null) return [];
    return applicantsWithResults.filter((a) => a.year === selectedYear);
  }, [applicantsWithResults, selectedYear]);

  const zScoreMap = useMemo(() => {
    const totals: Array<{ id: number; total: number; stream: string }> = [];

    for (const a of yearApplicants) {
      const result = a.result;
      if (!result) continue;

      const p = toNumberOrNull(result.physics_marks);
      const c = toNumberOrNull(result.chemistry_marks);
      const m =
        a.stream === 'Maths' ? toNumberOrNull(result.maths_marks) : toNumberOrNull(result.bio_marks);

      if (m === null || p === null || c === null) continue;
      totals.push({ id: a.applicant_id, total: m + p + c, stream: a.stream });
    }

    if (totals.length === 0) return new Map<number, number | null>();

    const streamTotals = new Map<string, number[]>();
    for (const t of totals) {
      if (!streamTotals.has(t.stream)) streamTotals.set(t.stream, []);
      streamTotals.get(t.stream)!.push(t.total);
    }

    const streamStats = new Map<string, { mean: number; std: number }>();
    for (const [stream, vals] of streamTotals) {
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
      const std = Math.sqrt(variance);
      streamStats.set(stream, { mean, std });
    }

    const map = new Map<number, number | null>();
    for (const t of totals) {
      const stats = streamStats.get(t.stream);
      if (!stats) continue;
      if (!stats.std || stats.std === 0) {
        map.set(t.id, 0);
        continue;
      }
      const z = (t.total - stats.mean) / stats.std;
      map.set(t.id, Number.isFinite(z) ? Number(z.toFixed(4)) : null);
    }

    return map;
  }, [yearApplicants]);

  const filteredApplicants = useMemo(() => {
    const base = yearApplicants.filter((applicant) => {
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        applicant.fullname.toLowerCase().includes(q) ||
        applicant.index_no.toLowerCase().includes(q) ||
        applicant.email?.toLowerCase().includes(q) ||
        applicant.school.toLowerCase().includes(q) ||
        String(applicant.nic).toLowerCase().includes(q);

      const matchesStream = filterStream === 'all' || applicant.stream === filterStream;
      const matchesGender =
        filterGender === 'all' ||
        (filterGender === 'male' && applicant.gender) ||
        (filterGender === 'female' && !applicant.gender);

      const matchesSchool = filterSchool === 'all' || applicant.school === filterSchool;

      return matchesSearch && matchesStream && matchesGender && matchesSchool;
    });

    const sorted = [...base];
    if (sortMode === 'rank_asc') {
      sorted.sort((a, b) => (a.result?.rank ?? Infinity) - (b.result?.rank ?? Infinity));
    } else if (sortMode === 'rank_desc') {
      sorted.sort((a, b) => (b.result?.rank ?? -Infinity) - (a.result?.rank ?? -Infinity));
    }
    return sorted;
  }, [yearApplicants, searchQuery, filterStream, filterGender, filterSchool, sortMode]);

  const uniqueStreams = useMemo(() => [...new Set(yearApplicants.map((a) => a.stream))], [yearApplicants]);
  const uniqueSchools = useMemo(() => [...new Set(yearApplicants.map((a) => a.school))], [yearApplicants]);

  const stats = useMemo(() => {
    const maleCount = filteredApplicants.filter((a) => a.gender).length;
    const femaleCount = filteredApplicants.filter((a) => !a.gender).length;

    const buckets = [
      { name: '< 0.00', min: -Infinity, max: 0 },
      { name: '0.00–0.99', min: 0, max: 1 },
      { name: '1.00–1.99', min: 1, max: 2 },
      { name: '2.00–2.99', min: 2, max: 3 },
      { name: '≥ 3.00', min: 3, max: Infinity },
      { name: 'Not Available', min: NaN, max: NaN },
    ];

    const zBucketCounts: Record<string, number> = {};
    buckets.forEach((b) => (zBucketCounts[b.name] = 0));

    filteredApplicants.forEach((a) => {
      let z: number | null = null;
      if (zScoreMap.has(a.applicant_id)) z = zScoreMap.get(a.applicant_id) ?? null;
      else z = a.result?.zscore ?? null;

      if (z === null || Number.isNaN(z)) {
        zBucketCounts['Not Available'] += 1;
        return;
      }
      const b = z < 0 ? '< 0.00' : z < 1 ? '0.00–0.99' : z < 2 ? '1.00–1.99' : z < 3 ? '2.00–2.99' : '≥ 3.00';
      zBucketCounts[b] += 1;
    });

    const zScoreData = [
      { name: '< 0.00', count: zBucketCounts['< 0.00'] },
      { name: '0.00–0.99', count: zBucketCounts['0.00–0.99'] },
      { name: '1.00–1.99', count: zBucketCounts['1.00–1.99'] },
      { name: '2.00–2.99', count: zBucketCounts['2.00–2.99'] },
      { name: '≥ 3.00', count: zBucketCounts['≥ 3.00'] },
      { name: 'Not Available', count: zBucketCounts['Not Available'] },
    ];

    return { maleCount, femaleCount, zScoreData };
  }, [filteredApplicants, zScoreMap]);

  const bellCurveData = useMemo(() => {
    const mathsValues: number[] = [];
    const bioValues: number[] = [];
    const physicsValues: number[] = [];
    const chemistryValues: number[] = [];

    for (const a of filteredApplicants) {
      const result = a.result;
      if (!result) continue;

      const isMathStream = a.stream === 'Maths';
      const isBioStream = a.stream === 'Biology';

      const m = isMathStream ? toNumberOrNull(result.maths_marks) : toNumberOrNull(result.bio_marks);
      const p = toNumberOrNull(result.physics_marks);
      const c = toNumberOrNull(result.chemistry_marks);

      if (m !== null) {
        if (isMathStream) mathsValues.push(m);
        else if (isBioStream) bioValues.push(m);
      }
      if (p !== null) physicsValues.push(p);
      if (c !== null) chemistryValues.push(c);
    }

    const mathsBuckets = makeBellCurveBuckets(mathsValues);
    const bioBuckets = makeBellCurveBuckets(bioValues);
    const phyBuckets = makeBellCurveBuckets(physicsValues);
    const cheBuckets = makeBellCurveBuckets(chemistryValues);

    const map = new Map<string, any>();

    for (const b of mathsBuckets) map.set(b.name, { name: b.name, maths: b.count, bio: 0, physics: 0, chemistry: 0 });
    for (const b of bioBuckets) {
      const row = map.get(b.name) ?? { name: b.name, maths: 0, bio: 0, physics: 0, chemistry: 0 };
      row.bio = b.count;
      map.set(b.name, row);
    }
    for (const b of phyBuckets) {
      const row = map.get(b.name) ?? { name: b.name, maths: 0, bio: 0, physics: 0, chemistry: 0 };
      row.physics = b.count;
      map.set(b.name, row);
    }
    for (const b of cheBuckets) {
      const row = map.get(b.name) ?? { name: b.name, maths: 0, bio: 0, physics: 0, chemistry: 0 };
      row.chemistry = b.count;
      map.set(b.name, row);
    }

    const order = [];
    for (let i = 0; i <= 90; i += 10) order.push(`${i}-${i + 9}`);
    order.push('100');
    return order.map((k) => map.get(k) ?? { name: k, maths: 0, bio: 0, physics: 0, chemistry: 0 });
  }, [filteredApplicants]);

  const bellCurveChartConfig: ChartConfig = {
    maths: { label: 'Maths', color: '#60A5FA' },
    bio: { label: 'Bio', color: '#A78BFA' },
    physics: { label: 'Physics', color: '#34D399' },
    chemistry: { label: 'Chemistry', color: '#FBBF24' },
  };

  const zScoreChartConfig: ChartConfig = {
    count: { label: 'Count', color: '#60A5FA' },
  };

  const downloadCsvTemplate = () => {
    const headers = ['index_no', 'stream', 'physics_marks', 'chemistry_marks', 'maths_marks', 'bio_marks'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marks_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadFilteredApplicantsCsv = () => {
    if (filteredApplicants.length === 0) {
      toast.error('No applicants to download');
      return;
    }

    const headers = [
      'index_no',
      'fullname',
      'stream',
      'physics_marks',
      'physics_grade',
      'chemistry_marks',
      'chemistry_grade',
      'maths_marks',
      'maths_grade',
      'bio_marks',
      'bio_grade',
      'zscore',
      'rank',
      'gender',
      'nic',
      'phone',
      'email',
      'school',
      'year',
      'created_at',
    ];

    const csvRows = [
      headers.join(','),
      ...filteredApplicants.map((a) => {
        const result = a.result;
        const zVal = zScoreMap.has(a.applicant_id) ? zScoreMap.get(a.applicant_id) ?? null : result?.zscore ?? null;
        const z = zVal !== null && zVal !== undefined ? String((zVal as number).toFixed(4)) : '-';

        return [
          `"${a.index_no}"`,
          `"${a.fullname}"`,
          `"${a.stream}"`,
          `"${result?.physics_marks ?? ''}"`,
          `"${result?.physics_grade ?? '-'}"`,
          `"${result?.chemistry_marks ?? ''}"`,
          `"${result?.chemistry_grade ?? '-'}"`,
          `"${result?.maths_marks ?? ''}"`,
          `"${result?.maths_grade ?? '-'}"`,
          `"${result?.bio_marks ?? ''}"`,
          `"${result?.bio_grade ?? '-'}"`,
          `"${z}"`,
          `"${result?.rank ?? '-'}"`,
          a.gender ? 'male' : 'female',
          `"${a.nic}"`,
          `"${a.phone || ''}"`,
          `"${a.email || ''}"`,
          `"${a.school}"`,
          a.year,
          `"${a.created_at}"`,
        ].join(',');
      }),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filteredApplicants.length} results`);
  };

  const recalcZScoreAndRankForYear = async (year: number) => {
    try {
      await supabase.rpc('compute_results_rankings' as any, { p_year: year, p_stream: 'Maths' });
      await supabase.rpc('compute_results_rankings' as any, { p_year: year, p_stream: 'Biology' });

      toast.success('Z-scores and ranks recalculated');
      await fetchApplicants();
    } catch (error) {
      console.error('Error recalculating:', error);
      toast.error('Failed to recalculate z-scores and ranks');
    }
  };

  // ✅ UPDATED: support subject === 'all'
  const regradeForYearBySubject = async (subject: SubjectKey, ranges: GradeRanges, yearParam?: number) => {
    const year = yearParam ?? selectedYear;
    if (year === null) return;

    const yearResults = results.filter((r) => r.year === year);

    const subjectsToApply: Array<Exclude<SubjectKey, 'all'>> =
      subject === 'all' ? ['physics', 'chemistry', 'maths', 'bio'] : [subject];

    const chunkSize = 120;

    for (const sub of subjectsToApply) {
      for (let i = 0; i < yearResults.length; i += chunkSize) {
        const chunk = yearResults.slice(i, i + chunkSize);

        await Promise.all(
          chunk.map((r) => {
            const updates: any = {};

            if (sub === 'physics') {
              updates.physics_grade = gradeFromMark(r.physics_marks, ranges);
              updates.phy_a_min = ranges.A_min;
              updates.phy_b_min = ranges.B_min;
              updates.phy_c_min = ranges.C_min;
              updates.phy_s_min = ranges.S_min;
            } else if (sub === 'chemistry') {
              updates.chemistry_grade = gradeFromMark(r.chemistry_marks, ranges);
              updates.che_a_min = ranges.A_min;
              updates.che_b_min = ranges.B_min;
              updates.che_c_min = ranges.C_min;
              updates.che_s_min = ranges.S_min;
            } else if (sub === 'maths') {
              updates.maths_grade = gradeFromMark(r.maths_marks, ranges);
              updates.maths_a_min = ranges.A_min;
              updates.maths_b_min = ranges.B_min;
              updates.maths_c_min = ranges.C_min;
              updates.maths_s_min = ranges.S_min;
            } else if (sub === 'bio') {
              updates.bio_grade = gradeFromMark(r.bio_marks, ranges);
              updates.bio_a_min = ranges.A_min;
              updates.bio_b_min = ranges.B_min;
              updates.bio_c_min = ranges.C_min;
              updates.bio_s_min = ranges.S_min;
            }

            return supabase.from('results' as any).update(updates).eq('result_id', r.result_id);
          })
        );
      }
    }
  };

  // ✅ UPDATED: All => updates all subject columns + regrades all
  const saveGradeRanges = async () => {
    if (!canManageSettings) return toast.error('Only admins can change grade ranges');
    if (selectedYear === null) return toast.error('Please select a year');

    const subject = selectedSubjectForGrade;
    const draft = gradeRangesDraftBySubject[subject];
    const msg = validateRanges(draft);
    if (msg) return toast.error(msg);

    setRangesSaving(true);

    try {
      const subjectsToApply: Array<Exclude<SubjectKey, 'all'>> =
        subject === 'all' ? ['physics', 'chemistry', 'maths', 'bio'] : [subject];

      // update applied local state
      setGradeRangesAppliedBySubject((prev) => {
        const next = { ...prev };
        if (subject === 'all') {
          next.all = draft;
          for (const s of subjectsToApply) next[s] = draft;
        } else {
          next[subject] = draft;
        }
        return next;
      });

      // Build payload to persist into app_settings (only if those columns exist)
      const payload: any = {};
      const applyPayloadFor = (s: Exclude<SubjectKey, 'all'>) => {
        if (s === 'physics') {
          payload.phy_grade_a_min = draft.A_min;
          payload.phy_grade_b_min = draft.B_min;
          payload.phy_grade_c_min = draft.C_min;
          payload.phy_grade_s_min = draft.S_min;
        } else if (s === 'chemistry') {
          payload.che_grade_a_min = draft.A_min;
          payload.che_grade_b_min = draft.B_min;
          payload.che_grade_c_min = draft.C_min;
          payload.che_grade_s_min = draft.S_min;
        } else if (s === 'bio') {
          payload.bio_grade_a_min = draft.A_min;
          payload.bio_grade_b_min = draft.B_min;
          payload.bio_grade_c_min = draft.C_min;
          payload.bio_grade_s_min = draft.S_min;
        } else if (s === 'maths') {
          payload.maths_grade_a_min = draft.A_min;
          payload.maths_grade_b_min = draft.B_min;
          payload.maths_grade_c_min = draft.C_min;
          payload.maths_grade_s_min = draft.S_min;
        }
      };
      for (const s of subjectsToApply) applyPayloadFor(s);

      const { data: existingSettings, error: readErr } = await supabase
        .from('app_settings' as any)
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message || 'Failed to read settings');

      const existingKeys = existingSettings ? Object.keys(existingSettings) : [];
      const allowedPayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (existingKeys.includes(k)) allowedPayload[k] = v;
      }

      if (Object.keys(allowedPayload).length > 0) {
        const { error } = await supabase.from('app_settings' as any).update(allowedPayload).eq('id', 1);
        if (error) throw new Error(error.message || 'Failed to update settings');
      } else {
        // If DB columns missing, still proceed with DB regrade using results-table columns
        console.warn('Grade range columns missing in app_settings; skipping global persistence.');
      }

      await regradeForYearBySubject(subject, draft, selectedYear);
      await recalcZScoreAndRankForYear(selectedYear);

      toast.success(
        subject === 'all'
          ? `Saved ranges & regraded ALL subjects for ${selectedYear}`
          : `Saved ranges & regraded ${subject} for ${selectedYear}`
      );

      await fetchApplicants();
    } catch (e: any) {
      console.error('saveGradeRanges error:', e);
      toast.error(e?.message || 'Failed to save ranges');
    } finally {
      setRangesSaving(false);
    }
  };

  // ✅ UPDATED: All => reset all + regrade all
  const resetGradeRanges = async () => {
    if (!canManageSettings) return toast.error('Only admins can reset grade ranges');
    if (selectedYear === null) return toast.error('Please select a year');

    const subject = selectedSubjectForGrade;

    setRangesSaving(true);
    try {
      const subjectsToApply: Array<Exclude<SubjectKey, 'all'>> =
        subject === 'all' ? ['physics', 'chemistry', 'maths', 'bio'] : [subject];

      setGradeRangesDraftBySubject((prev) => {
        const next = { ...prev };
        if (subject === 'all') {
          next.all = DEFAULT_SL_RANGES;
          for (const s of subjectsToApply) next[s] = DEFAULT_SL_RANGES;
        } else {
          next[subject] = DEFAULT_SL_RANGES;
        }
        return next;
      });

      setGradeRangesAppliedBySubject((prev) => {
        const next = { ...prev };
        if (subject === 'all') {
          next.all = DEFAULT_SL_RANGES;
          for (const s of subjectsToApply) next[s] = DEFAULT_SL_RANGES;
        } else {
          next[subject] = DEFAULT_SL_RANGES;
        }
        return next;
      });

      const payload: any = {};
      const applyPayloadFor = (s: Exclude<SubjectKey, 'all'>) => {
        if (s === 'physics') {
          payload.phy_grade_a_min = DEFAULT_SL_RANGES.A_min;
          payload.phy_grade_b_min = DEFAULT_SL_RANGES.B_min;
          payload.phy_grade_c_min = DEFAULT_SL_RANGES.C_min;
          payload.phy_grade_s_min = DEFAULT_SL_RANGES.S_min;
        } else if (s === 'chemistry') {
          payload.che_grade_a_min = DEFAULT_SL_RANGES.A_min;
          payload.che_grade_b_min = DEFAULT_SL_RANGES.B_min;
          payload.che_grade_c_min = DEFAULT_SL_RANGES.C_min;
          payload.che_grade_s_min = DEFAULT_SL_RANGES.S_min;
        } else if (s === 'bio') {
          payload.bio_grade_a_min = DEFAULT_SL_RANGES.A_min;
          payload.bio_grade_b_min = DEFAULT_SL_RANGES.B_min;
          payload.bio_grade_c_min = DEFAULT_SL_RANGES.C_min;
          payload.bio_grade_s_min = DEFAULT_SL_RANGES.S_min;
        } else if (s === 'maths') {
          payload.maths_grade_a_min = DEFAULT_SL_RANGES.A_min;
          payload.maths_grade_b_min = DEFAULT_SL_RANGES.B_min;
          payload.maths_grade_c_min = DEFAULT_SL_RANGES.C_min;
          payload.maths_grade_s_min = DEFAULT_SL_RANGES.S_min;
        }
      };
      for (const s of subjectsToApply) applyPayloadFor(s);

      const { data: existingSettings, error: readErr } = await supabase
        .from('app_settings' as any)
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message || 'Failed to read settings');

      const existingKeys = existingSettings ? Object.keys(existingSettings) : [];
      const allowedPayload: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (existingKeys.includes(k)) allowedPayload[k] = v;
      }

      if (Object.keys(allowedPayload).length > 0) {
        const { error } = await supabase.from('app_settings' as any).update(allowedPayload).eq('id', 1);
        if (error) throw new Error(error.message || 'Failed to update settings');
      } else {
        console.warn('Grade range columns missing in app_settings; skipping global persistence.');
      }

      await regradeForYearBySubject(subject, DEFAULT_SL_RANGES, selectedYear);
      await recalcZScoreAndRankForYear(selectedYear);

      toast.success(
        subject === 'all'
          ? `Reset & regraded ALL subjects for ${selectedYear}`
          : `Reset & regraded ${subject} for ${selectedYear}`
      );

      await fetchApplicants();
    } catch (e: any) {
      console.error('resetGradeRanges error:', e);
      toast.error(e?.message || 'Failed to reset ranges');
    } finally {
      setRangesSaving(false);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return toast.error('Please select a CSV file');
    if (selectedYear === null) return toast.error('Please select a year');

    setUploading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

      const expectedHeaders = ['index_no', 'stream', 'physics_marks', 'chemistry_marks', 'maths_marks', 'bio_marks'];
      const headerMap: Record<string, number> = {};
      expectedHeaders.forEach((expected) => {
        const idx = headers.indexOf(expected);
        if (idx === -1) throw new Error(`Missing required column: ${expected}`);
        headerMap[expected] = idx;
      });

      const records: Array<{
        index_no: string;
        stream: string;
        physics_marks: number | null;
        chemistry_marks: number | null;
        maths_marks: number | null;
        bio_marks: number | null;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < headers.length) continue;

        const index_no = (values[headerMap.index_no] ?? '').trim();
        if (!index_no) throw new Error(`Row ${i + 1}: index_no is required`);

        const stream = (values[headerMap.stream] ?? '').trim();
        if (!stream || (stream !== 'Maths' && stream !== 'Biology')) {
          throw new Error(`Row ${i + 1}: stream must be 'Maths' or 'Biology'`);
        }

        const phyVal = (values[headerMap.physics_marks] ?? '').trim();
        const cheVal = (values[headerMap.chemistry_marks] ?? '').trim();
        const mathsVal = (values[headerMap.maths_marks] ?? '').trim();
        const bioVal = (values[headerMap.bio_marks] ?? '').trim();

        records.push({
          index_no,
          stream,
          physics_marks: phyVal ? Number(phyVal) : null,
          chemistry_marks: cheVal ? Number(cheVal) : null,
          maths_marks: mathsVal ? Number(mathsVal) : null,
          bio_marks: bioVal ? Number(bioVal) : null,
        });
      }

      if (records.length === 0) throw new Error('No valid records found in CSV');

      // ✅ Use applied ranges for each subject
      const phyRanges = gradeRangesAppliedBySubject.physics;
      const cheRanges = gradeRangesAppliedBySubject.chemistry;
      const mathsRanges = gradeRangesAppliedBySubject.maths;
      const bioRanges = gradeRangesAppliedBySubject.bio;

      const chunkSize = 120;
      let successCount = 0;
      let errorCount = 0;
      const errorMessages: string[] = [];

      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);

        const results = await Promise.all(
          chunk.map(async (r) => {
            const physics_grade = gradeFromMark(r.physics_marks, phyRanges);
            const chemistry_grade = gradeFromMark(r.chemistry_marks, cheRanges);
            const maths_grade = r.stream === 'Maths' ? gradeFromMark(r.maths_marks, mathsRanges) : null;
            const bio_grade = r.stream === 'Biology' ? gradeFromMark(r.bio_marks, bioRanges) : null;

            // Upsert into results table
            const { error } = await supabase
              .from('results' as any)
              .upsert({
                index_no: r.index_no,
                stream: r.stream,
                year: selectedYear,
                physics_marks: r.physics_marks,
                chemistry_marks: r.chemistry_marks,
                maths_marks: r.maths_marks,
                bio_marks: r.bio_marks,
                physics_grade,
                chemistry_grade,
                maths_grade,
                bio_grade,
                phy_a_min: phyRanges.A_min,
                phy_b_min: phyRanges.B_min,
                phy_c_min: phyRanges.C_min,
                phy_s_min: phyRanges.S_min,
                che_a_min: cheRanges.A_min,
                che_b_min: cheRanges.B_min,
                che_c_min: cheRanges.C_min,
                che_s_min: cheRanges.S_min,
                maths_a_min: mathsRanges.A_min,
                maths_b_min: mathsRanges.B_min,
                maths_c_min: mathsRanges.C_min,
                maths_s_min: mathsRanges.S_min,
                bio_a_min: bioRanges.A_min,
                bio_b_min: bioRanges.B_min,
                bio_c_min: bioRanges.C_min,
                bio_s_min: bioRanges.S_min,
              }, { onConflict: 'index_no' });

            if (error) {
              console.error(`Error upserting ${r.index_no}:`, error);
              return { success: false, index_no: r.index_no, error: error.message };
            }
            return { success: true, index_no: r.index_no };
          })
        );

        for (const result of results) {
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            if (errorMessages.length < 5) {
              errorMessages.push(`${result.index_no}: ${result.error}`);
            }
          }
        }
      }

      await fetchApplicants();
      if (successCount > 0 && selectedYear) {
        await recalcZScoreAndRankForYear(selectedYear);
      }

      if (errorCount > 0) {
        const errorSummary = errorMessages.join('\n');
        toast.error(`Failed to upload ${errorCount} records. First errors:\n${errorSummary}`);
        if (successCount > 0) {
          toast.success(`Successfully uploaded ${successCount} results`);
        }
      } else {
        toast.success(`Successfully uploaded ${successCount} results`);
      }
      
      setUploadOpen(false);
      setCsvFile(null);
      await fetchApplicants();
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast.error(error.message || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };



  const openDetails = (applicant: ApplicantWithResult) => {
    setSelectedApplicant(applicant);
    setDetailsOpen(true);
  };

  // Edit applicant handlers
  const openEditDialog = (applicant: ApplicantWithResult) => {
    setEditingApplicant(applicant);
    setEditForm({
      fullname: applicant.fullname,
      gender: applicant.gender,
      stream: applicant.stream,
      nic: applicant.nic,
      phone: applicant.phone || '',
      email: applicant.email || '',
      school: applicant.school,
      physics_marks: applicant.result?.physics_marks?.toString() || '',
      chemistry_marks: applicant.result?.chemistry_marks?.toString() || '',
      maths_marks: applicant.result?.maths_marks?.toString() || '',
      bio_marks: applicant.result?.bio_marks?.toString() || '',
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingApplicant) return;

    if (!editForm.fullname.trim()) {
      toast.error('Full name is required');
      return;
    }
    if (!editForm.stream.trim()) {
      toast.error('Stream is required');
      return;
    }
    if (!editForm.nic.trim()) {
      toast.error('NIC is required');
      return;
    }
    if (!editForm.school.trim()) {
      toast.error('School is required');
      return;
    }

    setEditSaving(true);
    try {
      // Update applicant info
      const { error: applicantError } = await supabase
        .from('applicants' as any)
        .update({
          fullname: editForm.fullname.trim(),
          gender: editForm.gender,
          stream: editForm.stream.trim(),
          nic: editForm.nic.trim(),
          phone: editForm.phone.trim() || null,
          email: editForm.email.trim() || null,
          school: editForm.school.trim(),
        })
        .eq('applicant_id', editingApplicant.applicant_id);

      if (applicantError) throw applicantError;

      // Parse marks
      const physicsMarks = editForm.physics_marks.trim() ? Number(editForm.physics_marks) : null;
      const chemistryMarks = editForm.chemistry_marks.trim() ? Number(editForm.chemistry_marks) : null;
      const mathsMarks = editForm.maths_marks.trim() ? Number(editForm.maths_marks) : null;
      const bioMarks = editForm.bio_marks.trim() ? Number(editForm.bio_marks) : null;

      // Compute grades based on current ranges
      const phyRanges = gradeRangesAppliedBySubject.physics;
      const cheRanges = gradeRangesAppliedBySubject.chemistry;
      const mathsRanges = gradeRangesAppliedBySubject.maths;
      const bioRanges = gradeRangesAppliedBySubject.bio;

      const physics_grade = gradeFromMark(physicsMarks, phyRanges);
      const chemistry_grade = gradeFromMark(chemistryMarks, cheRanges);
      const maths_grade = editForm.stream === 'Maths' ? gradeFromMark(mathsMarks, mathsRanges) : null;
      const bio_grade = editForm.stream === 'Biology' ? gradeFromMark(bioMarks, bioRanges) : null;

      // Update or insert results
      if (editingApplicant.result) {
        // Update existing result
        const { error: resultError } = await supabase
          .from('results' as any)
          .update({
            stream: editForm.stream.trim(),
            physics_marks: physicsMarks,
            chemistry_marks: chemistryMarks,
            maths_marks: mathsMarks,
            bio_marks: bioMarks,
            physics_grade,
            chemistry_grade,
            maths_grade,
            bio_grade,
          })
          .eq('result_id', editingApplicant.result.result_id);

        if (resultError) throw resultError;
      } else if (physicsMarks !== null || chemistryMarks !== null || mathsMarks !== null || bioMarks !== null) {
        // Insert new result if any marks are provided
        const { error: resultError } = await supabase
          .from('results' as any)
          .insert({
            index_no: editingApplicant.index_no,
            stream: editForm.stream.trim(),
            year: editingApplicant.year,
            physics_marks: physicsMarks,
            chemistry_marks: chemistryMarks,
            maths_marks: mathsMarks,
            bio_marks: bioMarks,
            physics_grade,
            chemistry_grade,
            maths_grade,
            bio_grade,
            phy_a_min: phyRanges.A_min,
            phy_b_min: phyRanges.B_min,
            phy_c_min: phyRanges.C_min,
            phy_s_min: phyRanges.S_min,
            che_a_min: cheRanges.A_min,
            che_b_min: cheRanges.B_min,
            che_c_min: cheRanges.C_min,
            che_s_min: cheRanges.S_min,
            maths_a_min: mathsRanges.A_min,
            maths_b_min: mathsRanges.B_min,
            maths_c_min: mathsRanges.C_min,
            maths_s_min: mathsRanges.S_min,
            bio_a_min: bioRanges.A_min,
            bio_b_min: bioRanges.B_min,
            bio_c_min: bioRanges.C_min,
            bio_s_min: bioRanges.S_min,
          });

        if (resultError) throw resultError;
      }

      // Recalculate z-scores and ranks for the year
      if (selectedYear) {
        await recalcZScoreAndRankForYear(selectedYear);
      }

      toast.success('Applicant updated successfully');
      setEditOpen(false);
      setEditingApplicant(null);
      await fetchApplicants();
    } catch (error) {
      console.error('Error updating applicant:', error);
      toast.error('Failed to update applicant');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const PageContent = (
    <div className="space-y-6">
      <AdminHeader title="Applicants Management" />

      {/* Year Selection + Publish Button */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            {/* Title and Badge Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-lg">Select Year</CardTitle>

              <Badge className={allowResultsView ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-muted-foreground'}>
                {settingsLoading ? 'Loading...' : allowResultsView ? 'Results Published' : 'Results Not Published'}
              </Badge>
            </div>

            {/* Action Button - Responsive */}
            <div>
              <Button
                className={allowResultsView ? 'bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto' : 'bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto'}
                size="sm"
                onClick={toggleResultsSetting}
                disabled={!canManageSettings || settingsLoading || resultsSaving || allowResultsView === null}
                title={canManageSettings ? undefined : 'Only admins can change this setting'}
              >
                {resultsSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {allowResultsView ? 'Unpublish Results' : 'Publish Results'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {uniqueYears.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No applicants found</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {uniqueYears.map((year) => {
                const yearCount = applicants.filter((a) => a.year === year).length;
                return (
                  <Button
                    key={year}
                    variant={selectedYear === year ? 'default' : 'outline'}
                    onClick={() => setSelectedYear(year)}
                    className="flex-1 sm:flex-none min-w-[100px]"
                  >
                    {year}
                    <Badge variant="secondary" className="ml-2 bg-background/20">
                      {yearCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filters for {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, index, NIC, email, school..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                  disabled={selectedYear === null}
                />
              </div>
            </div>

            {/* Filters Row - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select value={filterStream} onValueChange={setFilterStream} disabled={selectedYear === null}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Streams</SelectItem>
                  {uniqueStreams.map((stream) => (
                    <SelectItem key={stream} value={stream}>
                      {stream}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterGender} onValueChange={setFilterGender} disabled={selectedYear === null}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSchool} onValueChange={setFilterSchool} disabled={selectedYear === null}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="School" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  {uniqueSchools.map((school) => (
                    <SelectItem key={school} value={school}>
                      {school}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons - Responsive Stack */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} disabled={selectedYear === null} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-1" />
                Template
              </Button>
              <Button variant="outline" size="sm" onClick={downloadFilteredApplicantsCsv} disabled={filteredApplicants.length === 0 || selectedYear === null} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)} disabled={selectedYear === null} className="w-full sm:w-auto">
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Applicants</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
                  {filteredApplicants.length}
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Male</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-500 text-sm font-bold">M</span>
                  </div>
                  {stats.maleCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filteredApplicants.length > 0 ? Math.round((stats.maleCount / filteredApplicants.length) * 100) : 0}%)
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Female</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-pink-500/20 flex items-center justify-center">
                    <span className="text-pink-500 text-sm font-bold">F</span>
                  </div>
                  {stats.femaleCount}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filteredApplicants.length > 0 ? Math.round((stats.femaleCount / filteredApplicants.length) * 100) : 0}%)
                  </span>
                </CardTitle>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Streams Represented</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-green-500" />
                  {uniqueStreams.length}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bell Curve Distribution (Marks)</CardTitle>
                <CardDescription>Maths, Bio, Physics and Chemistry mark distribution by buckets</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center overflow-x-auto">
                <div className="w-full min-h-[250px] sm:min-h-[280px] md:min-h-[320px]">
                  <ChartContainer config={bellCurveChartConfig} className="h-[250px] sm:h-[280px] md:h-[320px] w-full min-w-[400px]">
                    <BarChart 
                      data={bellCurveData} 
                      margin={{ bottom: isMobileView ? 80 : 30, right: 10, top: 10, left: 0 }}
                    >
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: isMobileView ? 9 : 12 }} 
                        angle={isMobileView ? -60 : 0}
                        textAnchor={isMobileView ? "end" : "middle"}
                        height={isMobileView ? 100 : 30}
                        interval={isMobileView ? 1 : 0}
                      />
                      <YAxis tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: isMobileView ? '20px' : '0px' }} />
                      <Bar dataKey="maths" fill="#60A5FA" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bio" fill="#A78BFA" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="physics" fill="#34D399" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="chemistry" fill="#FBBF24" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Z-Score Distribution</CardTitle>
                <CardDescription>Bucketed distribution of applicants by Z-score</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                {stats.zScoreData.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <ChartContainer 
                      config={zScoreChartConfig} 
                      className="h-[250px] sm:h-[280px] md:h-[320px] w-full min-w-[350px]"
                    >
                      <BarChart 
                        data={stats.zScoreData} 
                        layout="vertical" 
                        margin={{ left: isMobileView ? 45 : 100, right: 10, top: 5, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={isMobileView ? 45 : 100} 
                          tick={{ fontSize: isMobileView ? 9 : 11, fill: 'hsl(var(--foreground))' }}
                          interval={0}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="#60A5FA" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                ) : (
                  <div className="h-[250px] sm:h-[280px] md:h-[320px] w-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Grade Range Card with SUBJECT selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Set range for the grade
              </CardTitle>
              <CardDescription>
                Select a subject and set grade boundaries. Maths applies for Maths stream, Bio applies for Bio stream.
                Select <b>All</b> to apply same ranges to all subjects.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 items-start sm:flex-row sm:items-end sm:flex-wrap">
                <div className="w-full sm:w-52">
                  <Label>Subject</Label>
                  <Select value={selectedSubjectForGrade} onValueChange={(v) => setSelectedSubjectForGrade(v as SubjectKey)}>
                    <SelectTrigger className="w-full sm:w-52">
                      <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* ✅ NEW */}
                      <SelectItem value="all">All (All Subjects)</SelectItem>

                      <SelectItem value="physics">Physics</SelectItem>
                      <SelectItem value="chemistry">Chemistry</SelectItem>
                      <SelectItem value="maths">Maths (Maths Stream)</SelectItem>
                      <SelectItem value="bio">Bio (Bio Stream)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Badge variant="secondary" className="h-auto sm:h-9 flex items-center text-xs sm:text-sm py-1 sm:py-0">
                  Applied: A≥{gradeRangesAppliedBySubject[selectedSubjectForGrade].A_min} | B≥
                  {gradeRangesAppliedBySubject[selectedSubjectForGrade].B_min} | C≥
                  {gradeRangesAppliedBySubject[selectedSubjectForGrade].C_min} | S≥
                  {gradeRangesAppliedBySubject[selectedSubjectForGrade].S_min}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>A minimum</Label>
                  <Input
                    type="number"
                    value={gradeRangesDraftBySubject[selectedSubjectForGrade].A_min}
                    onChange={(e) =>
                      setGradeRangesDraftBySubject((p) => ({
                        ...p,
                        [selectedSubjectForGrade]: {
                          ...p[selectedSubjectForGrade],
                          A_min: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>B minimum</Label>
                  <Input
                    type="number"
                    value={gradeRangesDraftBySubject[selectedSubjectForGrade].B_min}
                    onChange={(e) =>
                      setGradeRangesDraftBySubject((p) => ({
                        ...p,
                        [selectedSubjectForGrade]: {
                          ...p[selectedSubjectForGrade],
                          B_min: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>C minimum</Label>
                  <Input
                    type="number"
                    value={gradeRangesDraftBySubject[selectedSubjectForGrade].C_min}
                    onChange={(e) =>
                      setGradeRangesDraftBySubject((p) => ({
                        ...p,
                        [selectedSubjectForGrade]: {
                          ...p[selectedSubjectForGrade],
                          C_min: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>S minimum</Label>
                  <Input
                    type="number"
                    value={gradeRangesDraftBySubject[selectedSubjectForGrade].S_min}
                    onChange={(e) =>
                      setGradeRangesDraftBySubject((p) => ({
                        ...p,
                        [selectedSubjectForGrade]: {
                          ...p[selectedSubjectForGrade],
                          S_min: Number(e.target.value),
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 items-start sm:items-center">
                <Button onClick={saveGradeRanges} disabled={!canManageSettings || rangesSaving || !rangesDifferent} className="w-full sm:w-auto">
                  {rangesSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>

                <Button variant="outline" onClick={resetGradeRanges} disabled={!canManageSettings || rangesSaving} className="w-full sm:w-auto">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset (Sri Lankan Default)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Applicants Table */}
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Applicants List ({filteredApplicants.length})
              </CardTitle>

              <div className="flex flex-wrap gap-2">
                <Button variant={sortMode === 'default' ? 'default' : 'outline'} size="sm" onClick={() => setSortMode('default')} className="flex-1 sm:flex-none">
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  Default
                </Button>
                <Button variant={sortMode === 'rank_asc' ? 'default' : 'outline'} size="sm" onClick={() => setSortMode('rank_asc')} className="flex-1 sm:flex-none">
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  Rank ↑
                </Button>
                <Button variant={sortMode === 'rank_desc' ? 'default' : 'outline'} size="sm" onClick={() => setSortMode('rank_desc')} className="flex-1 sm:flex-none">
                  <ArrowUpDown className="h-4 w-4 mr-1" />
                  Rank ↓
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px] text-xs sm:text-sm p-2 sm:p-4">Index No</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm p-2 sm:p-4">Stream</TableHead>

                      <TableHead className="hidden md:table-cell text-xs sm:text-sm p-2 sm:p-4">Bio/Maths</TableHead>
                      <TableHead className="hidden lg:table-cell text-xs sm:text-sm p-2 sm:p-4">Bio/Maths Result</TableHead>

                      <TableHead className="hidden lg:table-cell text-xs sm:text-sm p-2 sm:p-4">Physics</TableHead>
                      <TableHead className="hidden lg:table-cell text-xs sm:text-sm p-2 sm:p-4">Physics Result</TableHead>

                      <TableHead className="hidden lg:table-cell text-xs sm:text-sm p-2 sm:p-4">Chemistry</TableHead>
                      <TableHead className="hidden lg:table-cell text-xs sm:text-sm p-2 sm:p-4">Chemistry Result</TableHead>

                      <TableHead className="text-xs sm:text-sm p-2 sm:p-4">Z-Score</TableHead>
                      <TableHead className="text-xs sm:text-sm p-2 sm:p-4">Rank</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm p-2 sm:p-4 w-10"></TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredApplicants.map((a) => {
                      const result = a.result;
                      const zVal = zScoreMap.has(a.applicant_id) ? zScoreMap.get(a.applicant_id) ?? null : result?.zscore ?? null;
                      const z = zVal !== null && zVal !== undefined ? String((zVal as number).toFixed(4)) : '-';

                      const isMathStream = a.stream === 'Maths';
                      const mathsOrBioMarks = isMathStream ? result?.maths_marks : result?.bio_marks;
                      const mathsOrBioGrade = isMathStream ? result?.maths_grade : result?.bio_grade;

                      return (
                        <TableRow key={a.applicant_id}>
                          <TableCell className="font-medium text-xs sm:text-sm p-2 sm:p-4">{a.index_no}</TableCell>
                          <TableCell className="hidden sm:table-cell p-2 sm:p-4">
                            <Badge variant="outline" className="text-xs">{a.stream}</Badge>
                          </TableCell>

                          <TableCell className="hidden md:table-cell font-mono text-xs p-2 sm:p-4">{fmt(mathsOrBioMarks)}</TableCell>
                          <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                            <Badge className={gradeBadgeClass(mathsOrBioGrade)}>{mathsOrBioGrade ?? '-'}</Badge>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell font-mono text-xs p-2 sm:p-4">{fmt(result?.physics_marks)}</TableCell>
                          <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                            <Badge className={gradeBadgeClass(result?.physics_grade)}>{result?.physics_grade ?? '-'}</Badge>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell font-mono text-xs p-2 sm:p-4">{fmt(result?.chemistry_marks)}</TableCell>
                          <TableCell className="hidden lg:table-cell p-2 sm:p-4">
                            <Badge className={gradeBadgeClass(result?.chemistry_grade)}>{result?.chemistry_grade ?? '-'}</Badge>
                          </TableCell>

                          <TableCell className="font-mono text-xs p-2 sm:p-4">{z}</TableCell>
                          <TableCell className="font-mono text-xs p-2 sm:p-4">{result?.rank ?? '-'}</TableCell>

                          <TableCell className="text-right p-2 sm:p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 sm:h-10 sm:w-10">
                                  <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(a)} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDetails(a)} className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer">
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {filteredApplicants.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">No applicants found for the selected filters</div>
              )}
            </CardContent>
          </Card>

      {/* CSV Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Applicants CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with applicant marks data.
              Columns required: index_no, stream, physics_marks, chemistry_marks, maths_marks, bio_marks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file">CSV File</Label>
              <Input id="csv-file" type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCsvUpload} disabled={uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedApplicant(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Applicant Details</DialogTitle>
            <DialogDescription>Full details for the selected applicant.</DialogDescription>
          </DialogHeader>

          {selectedApplicant ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Basic</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Index No</span>
                    <span className="font-mono">{selectedApplicant.index_no}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Name</span>
                    <span className="text-right">{selectedApplicant.fullname}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Stream</span>
                    <span className="text-right">{selectedApplicant.stream}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Gender</span>
                    <span className="text-right">{selectedApplicant.gender ? 'Male' : 'Female'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="text-right">{selectedApplicant.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-right">{selectedApplicant.email || '-'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">School</span>
                    <span className="text-right">{selectedApplicant.school}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Scores</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground">{selectedApplicant.stream === 'Maths' ? 'Maths' : 'Biology'}</div>
                    <div className="font-mono">
                      {fmt(selectedApplicant.stream === 'Maths' ? selectedApplicant.result?.maths_marks : selectedApplicant.result?.bio_marks)}{' '}
                      <Badge className={gradeBadgeClass(selectedApplicant.stream === 'Maths' ? selectedApplicant.result?.maths_grade : selectedApplicant.result?.bio_grade)}>
                        {selectedApplicant.stream === 'Maths' ? selectedApplicant.result?.maths_grade : selectedApplicant.result?.bio_grade}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground">Physics</div>
                    <div className="font-mono">
                      {fmt(selectedApplicant.result?.physics_marks)} <Badge className={gradeBadgeClass(selectedApplicant.result?.physics_grade)}>{selectedApplicant.result?.physics_grade ?? '-'}</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground">Chemistry</div>
                    <div className="font-mono">
                      {fmt(selectedApplicant.result?.chemistry_marks)} <Badge className={gradeBadgeClass(selectedApplicant.result?.chemistry_grade)}>{selectedApplicant.result?.chemistry_grade ?? '-'}</Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground">Z-Score</div>
                    <div className="font-mono">
                      {(() => {
                        const zVal = zScoreMap.has(selectedApplicant.applicant_id)
                          ? zScoreMap.get(selectedApplicant.applicant_id) ?? null
                          : selectedApplicant.result?.zscore ?? null;
                        return zVal !== null && zVal !== undefined ? (zVal as number).toFixed(4) : '-';
                      })()}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border">
                    <div className="text-muted-foreground">Rank</div>
                    <div className="font-mono">{selectedApplicant.result?.rank ?? '-'}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Identification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">NIC</span>
                    <span className="font-mono text-right">{selectedApplicant.nic}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Year</span>
                    <span className="text-right">{selectedApplicant.year}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Created</span>
                    <span className="text-right">{new Date(selectedApplicant.created_at).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">No applicant selected</div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Applicant Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingApplicant(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Applicant</DialogTitle>
            <DialogDescription>
              Update applicant details and marks. Index number cannot be changed.
            </DialogDescription>
          </DialogHeader>

          {editingApplicant && (
            <div className="space-y-6">
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Index No: </span>
                <span className="font-mono font-medium">{editingApplicant.index_no}</span>
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Personal Information</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-fullname">Full Name *</Label>
                    <Input
                      id="edit-fullname"
                      value={editForm.fullname}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, fullname: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Gender *</Label>
                    <Select
                      value={editForm.gender ? 'male' : 'female'}
                      onValueChange={(v) => setEditForm((prev) => ({ ...prev, gender: v === 'male' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-stream">Stream *</Label>
                    <Select
                      value={editForm.stream}
                      onValueChange={(v) => setEditForm((prev) => ({ ...prev, stream: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select stream" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Maths">Maths</SelectItem>
                        <SelectItem value="Biology">Biology</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-nic">NIC *</Label>
                    <Input
                      id="edit-nic"
                      value={editForm.nic}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, nic: e.target.value }))}
                      placeholder="Enter NIC"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="edit-school">School *</Label>
                    <Input
                      id="edit-school"
                      value={editForm.school}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, school: e.target.value }))}
                      placeholder="Enter school name"
                    />
                  </div>
                </div>
              </div>

              {/* Marks */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Marks (leave empty if not available)</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-physics">Physics</Label>
                    <Input
                      id="edit-physics"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.physics_marks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, physics_marks: e.target.value }))}
                      placeholder="0-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-chemistry">Chemistry</Label>
                    <Input
                      id="edit-chemistry"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.chemistry_marks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, chemistry_marks: e.target.value }))}
                      placeholder="0-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-maths">
                      Maths {editForm.stream === 'Biology' && <span className="text-muted-foreground">(N/A)</span>}
                    </Label>
                    <Input
                      id="edit-maths"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.maths_marks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, maths_marks: e.target.value }))}
                      placeholder="0-100"
                      disabled={editForm.stream === 'Biology'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-bio">
                      Biology {editForm.stream === 'Maths' && <span className="text-muted-foreground">(N/A)</span>}
                    </Label>
                    <Input
                      id="edit-bio"
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.bio_marks}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, bio_marks: e.target.value }))}
                      placeholder="0-100"
                      disabled={editForm.stream === 'Maths'}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Grades will be automatically calculated based on current grade ranges. Z-scores and ranks will be recalculated after saving.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isAdmin) return PageContent;

  return (
    <PermissionGate permissionKey="applicant" permissionName="Applicant Handling">
      {PageContent}
    </PermissionGate>
  );
}