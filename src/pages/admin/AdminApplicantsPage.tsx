import { useEffect, useState, useMemo } from 'react';
import {
  UserPlus,
  Search,
  MoreVertical,
  Upload,
  Download,
  Loader2,
  FileText,
  Trash2,
  Users,
  TrendingUp,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, Legend } from 'recharts';

/**
 * ✅ SECOND DATABASE CLIENT
 * Set these env vars in your project:
 * - VITE_SUPABASE_URL_2
 * - VITE_SUPABASE_ANON_KEY_2
 */
const supabase2 = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
);

type AppSettings = {
  allow_exam_applications: boolean;
  allow_results_view: boolean;
  // ✅ NEW: manual submission page control for members dashboard
  allow_manual_applications: boolean;
};

interface Applicant {
  applicant_id: number;
  index_no: string;
  fullname: string;
  gender: boolean;
  stream: string;
  nic: string;
  phone: string | null;
  email: string | null;
  school: string;
  created_at: string;
  year: number;
}

export default function AdminApplicantsPage() {
  const { isSuperAdmin, isAdmin } = useAdminAuth();

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStream, setFilterStream] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterSchool, setFilterSchool] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Exam applications setting
  const [allowExamApplications, setAllowExamApplications] = useState<boolean | null>(null);

  // ✅ NEW: manual applications setting (controls members page)
  const [allowManualApplications, setAllowManualApplications] = useState<boolean | null>(null);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // CSV Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'single' | 'bulk' | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [singleForm, setSingleForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    nic: '',
    stream: '',
    school: '',
    gender: '' as 'male' | 'female' | '',
  });

  // Get unique years from all applicants (descending order)
  const uniqueYears = useMemo(() => {
    return [...new Set(applicants.map(a => a.year))].sort((a, b) => b - a);
  }, [applicants]);

  // ✅ UPDATED: Auto-select a year even when DB is empty
  useEffect(() => {
    if (selectedYear === null) {
      if (uniqueYears.length > 0) {
        setSelectedYear(uniqueYears[0]);
      } else {
        setSelectedYear(new Date().getFullYear());
      }
    }
  }, [uniqueYears, selectedYear]);

  useEffect(() => {
    fetchApplicants();
    loadAppSettings();
  }, []);

  // ✅ Load both settings in one go
  const loadAppSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings' as any)
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;

      const settings = data as unknown as AppSettings | null;

      setAllowExamApplications(settings?.allow_exam_applications ?? false);
      setAllowManualApplications(settings?.allow_manual_applications ?? false);
    } catch (error) {
      console.error('Error loading app settings:', error);
      toast.error('Failed to load application settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const toggleExamSetting = async () => {
    if (allowExamApplications === null || settingsSaving) return;
    setSettingsSaving(true);
    try {
      const { data, error } = await supabase
        .from('app_settings' as any)
        .update({ allow_exam_applications: !allowExamApplications })
        .eq('id', 1)
        .select('allow_exam_applications')
        .maybeSingle<AppSettings>();

      if (error) throw error;
      setAllowExamApplications(data?.allow_exam_applications ?? false);
      toast.success(
        data?.allow_exam_applications ? 'Exam applications opened' : 'Exam applications closed'
      );
    } catch (error) {
      console.error('Error updating exam setting:', error);
      toast.error('Failed to update exam application setting');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ✅ NEW: toggle manual applications (members dashboard control)
  const toggleManualSetting = async () => {
    if (allowManualApplications === null || settingsSaving) return;
    setSettingsSaving(true);
    try {
      const { data, error } = await supabase
        .from('app_settings' as any)
        .update({ allow_manual_applications: !allowManualApplications })
        .eq('id', 1)
        .select('allow_manual_applications')
        .maybeSingle<AppSettings>();

      if (error) throw error;

      const newValue = data?.allow_manual_applications ?? false;
      setAllowManualApplications(newValue);

      toast.success(newValue ? 'Manual application page opened (Members)' : 'Manual application page closed (Members)');
    } catch (error) {
      console.error('Error updating manual setting:', error);
      toast.error('Failed to update manual application setting');
    } finally {
      setSettingsSaving(false);
    }
  };

  const fetchApplicants = async () => {
    try {
      const { data, error } = await supabase
        .from('applicants' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplicants((data as unknown as Applicant[]) || []);
    } catch (error) {
      console.error('Error fetching applicants:', error);
      toast.error('Failed to fetch applicants');
    } finally {
      setLoading(false);
    }
  };

  // First filter by selected year, then apply other filters
  const yearApplicants = useMemo(() => {
    if (selectedYear === null) return [];
    return applicants.filter(a => a.year === selectedYear);
  }, [applicants, selectedYear]);

  const filteredApplicants = useMemo(() => {
    return yearApplicants.filter((applicant) => {
      const matchesSearch =
        applicant.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applicant.index_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applicant.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applicant.school.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStream = filterStream === 'all' || applicant.stream === filterStream;
      const matchesGender =
        filterGender === 'all' ||
        (filterGender === 'male' && applicant.gender) ||
        (filterGender === 'female' && !applicant.gender);
      const matchesSchool = filterSchool === 'all' || applicant.school === filterSchool;

      return matchesSearch && matchesStream && matchesGender && matchesSchool;
    });
  }, [yearApplicants, searchQuery, filterStream, filterGender, filterSchool]);

  // Statistics based on filtered applicants
  const stats = useMemo(() => {
    const maleCount = filteredApplicants.filter(a => a.gender).length;
    const femaleCount = filteredApplicants.filter(a => !a.gender).length;

    // School distribution (Top 10)
    const schoolCounts: Record<string, number> = {};
    filteredApplicants.forEach(a => {
      schoolCounts[a.school] = (schoolCounts[a.school] || 0) + 1;
    });
    const schoolData = Object.entries(schoolCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Stream distribution (Pie)
    const streamCounts: Record<string, number> = {};
    filteredApplicants.forEach(a => {
      const s = a.stream || 'Not Available';
      streamCounts[s] = (streamCounts[s] || 0) + 1;
    });
    const streamData = Object.entries(streamCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return { maleCount, femaleCount, schoolData, streamData };
  }, [filteredApplicants]);

  const uniqueStreams = useMemo(() => [...new Set(yearApplicants.map(a => a.stream))], [yearApplicants]);
  const uniqueSchools = useMemo(() => [...new Set(yearApplicants.map(a => a.school))], [yearApplicants]);
  const streamOptions = useMemo(() => {
    const cleaned = uniqueStreams.map((s) => s?.trim()).filter((s) => s);
    return cleaned.length > 0 ? cleaned : ['Maths', 'Biology'];
  }, [uniqueStreams]);

  // --- Index format helpers ---
  const streamLetter = (value: string) => (value?.trim()?.[0] ? value.trim()[0].toUpperCase() : 'S');
  const currentStreamLetter = filterStream !== 'all' ? streamLetter(filterStream) : 'S';

  const exampleYear = selectedYear ?? new Date().getFullYear();
  const exampleYearTwoDigits = String(exampleYear).slice(-2);
  const indexExample = `${exampleYearTwoDigits}0000${currentStreamLetter}`;

  const handleCsvUpload = async () => {
    if (!csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setUploading(true);
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const expectedHeaders = ['index_no', 'fullname', 'gender', 'stream', 'nic', 'phone', 'email', 'school'];
      const headerMap: { [key: string]: number } = {};

      expectedHeaders.forEach(expected => {
        const index = headers.indexOf(expected);
        if (index === -1) {
          throw new Error(`Missing required column: ${expected}`);
        }
        headerMap[expected] = index;
      });

      const importYear = selectedYear ?? new Date().getFullYear();

      const parsedRows: Array<{
        order: number;
        fullname: string;
        gender: boolean;
        stream: string;
        nic: string;
        phone: string | null;
        email: string | null;
        school: string;
        year: number;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length !== headers.length) continue;

        const csvIndexNo = values[headerMap.index_no];
        if (csvIndexNo && csvIndexNo.length > 0) {
          throw new Error(`Row ${i + 1}: index_no must be empty (system will generate it)`);
        }

        parsedRows.push({
          order: i,
          fullname: values[headerMap.fullname],
          gender:
            values[headerMap.gender].toLowerCase() === 'male' ||
            values[headerMap.gender] === '1' ||
            values[headerMap.gender].toLowerCase() === 'true',
          stream: values[headerMap.stream],
          nic: values[headerMap.nic],
          phone: values[headerMap.phone] || null,
          email: values[headerMap.email] || null,
          school: values[headerMap.school],
          year: importYear,
        });
      }

      if (parsedRows.length === 0) {
        throw new Error('No valid records found in CSV');
      }

      parsedRows.sort((a, b) => a.order - b.order);

      const applicantsArray = parsedRows.map(row => ({
        fullname: row.fullname,
        gender: row.gender,
        stream: row.stream,
        nic: row.nic,
        phone: row.phone,
        email: row.email,
        school: row.school,
      }));

      const { data: generatedIndices, error } = await supabase.rpc('bulk_insert_applicants', {
        p_applicants: applicantsArray,
        p_year: importYear,
      });

      if (error) throw error;

      const indicesList = Array.isArray(generatedIndices) ? generatedIndices.join(', ') : 'N/A';
      toast.success(
        `Successfully uploaded ${applicantsArray.length} applicants. Generated index numbers: ${indicesList}`
      );
      setUploadOpen(false);
      setCsvFile(null);
      fetchApplicants();
    } catch (error: any) {
      console.error('Error uploading CSV:', error);
      toast.error(error.message || 'Failed to upload CSV');
    } finally {
      setUploading(false);
    }
  };

  const resetSingleForm = () => {
    setSingleForm({
      fullName: '',
      email: '',
      phone: '',
      nic: '',
      stream: '',
      school: '',
      gender: '',
    });
  };

  const handleSingleApplicantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !singleForm.fullName.trim() ||
      !singleForm.email.trim() ||
      !singleForm.phone.trim() ||
      !singleForm.nic.trim() ||
      !singleForm.stream.trim() ||
      !singleForm.school.trim() ||
      !singleForm.gender
    ) {
      toast.error('Please fill all required fields');
      return;
    }

    if (singleForm.phone.trim().length !== 10) {
      toast.error('Phone number must be 10 digits');
      return;
    }

    if (singleForm.nic.trim().length !== 12) {
      toast.error('NIC must be 12 digits');
      return;
    }

    if (allowExamApplications === false) {
      toast.error('Applications are closed');
      return;
    }

    setSingleSubmitting(true);
    try {
      const year = selectedYear ?? new Date().getFullYear();
      const { data: indexNo, error } = await supabase.rpc('insert_applicant', {
        p_fullname: singleForm.fullName.trim(),
        p_gender: singleForm.gender === 'male',
        p_stream: singleForm.stream.trim(),
        p_nic: singleForm.nic.trim(),
        p_phone: singleForm.phone.trim(),
        p_email: singleForm.email.trim().toLowerCase(),
        p_school: singleForm.school.trim(),
        p_year: year,
      });

      if (error) throw error;
      toast.success(`Applicant added successfully. Index No: ${indexNo}`);
      resetSingleForm();
      fetchApplicants();
    } catch (error: any) {
      console.error('Error submitting applicant:', error);
      toast.error(error?.message || 'Failed to submit applicant');
    } finally {
      setSingleSubmitting(false);
    }
  };

  const downloadCsvTemplate = () => {
    const headers = ['index_no', 'fullname', 'gender', 'stream', 'nic', 'phone', 'email', 'school'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'applicants_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadFilteredApplicantsCsv = () => {
    if (filteredApplicants.length === 0) {
      toast.error('No applicants to download');
      return;
    }

    const headers = ['index_no', 'fullname', 'gender', 'stream', 'nic', 'phone', 'email', 'school', 'year', 'created_at'];
    const csvRows = [
      headers.join(','),
      ...filteredApplicants.map(applicant => [
        `"${applicant.index_no}"`,
        `"${applicant.fullname}"`,
        applicant.gender ? 'male' : 'female',
        `"${applicant.stream}"`,
        `"${applicant.nic}"`,
        `"${applicant.phone || ''}"`,
        `"${applicant.email || ''}"`,
        `"${applicant.school}"`,
        applicant.year,
        `"${applicant.created_at}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `applicants_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filteredApplicants.length} applicants`);
  };

  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDeleteByYear = async () => {
    if (selectedYear === null) {
      toast.error('Please select a year');
      return;
    }

    const applicantsToDelete = applicants.filter(a => a.year === selectedYear);
    if (applicantsToDelete.length === 0) {
      toast.error('No applicants to delete for this year');
      return;
    }

    if (bulkDeleting) return;
    setBulkDeleting(true);

    try {
      // ✅ Delete from FIRST database
      const { error: errorDb1 } = await supabase
        .from('applicants' as any)
        .delete()
        .eq('year', selectedYear);

      if (errorDb1) throw errorDb1;

      // ✅ Delete from SECOND database (same table name)
      const { error: errorDb2 } = await supabase2
        .from('applicants' as any)
        .delete()
        .eq('year', selectedYear);

      if (errorDb2) throw errorDb2;

      toast.success(`Successfully deleted ${applicantsToDelete.length} applicants from ${selectedYear} (both databases)`);

      const remainingApplicants = applicants.filter(a => a.year !== selectedYear);
      setApplicants(remainingApplicants);

      const remainingYears = [...new Set(remainingApplicants.map(a => a.year))].sort((a, b) => b - a);
      setSelectedYear(remainingYears.length > 0 ? remainingYears[0] : null);

      // Also remove index counter for this year so index generation resets
      try {
        const { error: idxErr } = await supabase
          .from('index_counters' as any)
          .delete()
          .eq('year', selectedYear);

        if (idxErr) {
          console.error('Error deleting index_counters for year:', selectedYear, idxErr);
          toast.error('Applicants deleted but failed to clear index counter for the year');
        } else {
          toast.success('Cleared index counter for the deleted year');
        }
      } catch (err) {
        console.error('Error deleting index_counters:', err);
        toast.error('Applicants deleted but failed to clear index counter for the year');
      }
    } catch (error) {
      console.error('Error deleting applicants:', error);
      toast.error('Failed to delete applicants');
    } finally {
      setBulkDeleting(false);
    }
  };

  const schoolChartConfig: ChartConfig = {
    count: { label: "Students", color: "#60A5FA" },
  };

  const streamChartConfig: ChartConfig = {
    count: { label: "Students", color: "#60A5FA" },
  };

  const COLORS = [
    '#60A5FA',
    '#34D399',
    '#FBBF24',
    '#F87171',
    '#A78BFA',
    '#FB7185',
    '#22D3EE',
    '#F97316',
    '#84CC16',
    '#E879F9',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <PermissionGate permissionKey="applicant" permissionName="Applicant Handling">
      <div className="space-y-6">
        <AdminHeader title="Applicants Management" />

        {/* Year Selection Buttons - Pagination Style */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">Select Year</CardTitle>

                {isAdmin && (
                  <>
                    <Badge className={allowExamApplications ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}>
                      {settingsLoading ? 'Loading...' : allowExamApplications ? 'Applications Open' : 'Applications Closed'}
                    </Badge>

                    {/* Admin-only badge: manual applications control */}
                    <Badge className={allowManualApplications ? 'bg-blue-500/20 text-blue-600' : 'bg-muted text-muted-foreground'}>
                      {settingsLoading ? 'Loading...' : allowManualApplications ? 'Manual Page Open' : 'Manual Page Closed'}
                    </Badge>
                  </>
                )}
              </div>

              {/* ✅ BOTH BUTTONS IN SAME ROW */}
              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    variant={allowExamApplications ? 'destructive' : 'default'}
                    size="sm"
                    onClick={toggleExamSetting}
                    disabled={!isAdmin || settingsLoading || settingsSaving || allowExamApplications === null}
                  >
                    {settingsSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {allowExamApplications ? 'Close Applications' : 'Open Applications'}
                  </Button>

                  <Button
                    variant={allowManualApplications ? 'destructive' : 'default'}
                    size="sm"
                    onClick={toggleManualSetting}
                    disabled={!isAdmin || settingsLoading || settingsSaving || allowManualApplications === null}
                  >
                    {settingsSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    {allowManualApplications ? 'Manual Application Close' : 'Manual Application Open'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {uniqueYears.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No applicants found</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {uniqueYears.map((year) => {
                  const yearCount = applicants.filter(a => a.year === year).length;
                  return (
                    <Button
                      key={year}
                      variant={selectedYear === year ? 'default' : 'outline'}
                      onClick={() => setSelectedYear(year)}
                      className="min-w-[100px]"
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

        {selectedYear !== null && (
          <>
            {/* Index No Instructions Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Index Number Instructions
                </CardTitle>
                <CardDescription className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>
                    Do <strong>NOT</strong> create index numbers manually.
                    For CSV imports, keep <span className="font-mono">index_no</span> column empty.
                    The system will generate and save them automatically in order.
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    Format: YY + 4 digits + Stream Letter
                  </Badge>
                  <Badge variant="secondary" className="font-mono">
                    Example: {indexExample}
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground">
                  Digits are auto-generated in sequence from <span className="font-mono">0000</span> to{' '}
                  <span className="font-mono">9999</span>. If the limit is reached, the upload will be blocked.
                </div>
              </CardContent>
            </Card>

            {/* Filters Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Filters for {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, index, email, school..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Select value={filterStream} onValueChange={setFilterStream}>
                    <SelectTrigger className="w-40">
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

                  <Select value={filterGender} onValueChange={setFilterGender}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterSchool} onValueChange={setFilterSchool}>
                    <SelectTrigger className="w-48">
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

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
                      <Download className="h-4 w-4 mr-1" />
                      Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadFilteredApplicantsCsv}
                      disabled={filteredApplicants.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export CSV
                    </Button>
                    <Button size="sm" onClick={() => setUploadOpen(true)}>
                      <Upload className="h-4 w-4 mr-1" />
                      Import
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Section */}
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
                  <CardDescription>Schools Represented</CardDescription>
                  <CardTitle className="text-3xl flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                    {stats.schoolData.length}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">School Distribution (Top 10)</CardTitle>
                  <CardDescription>Distribution of applicants by school</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.schoolData.length > 0 ? (
                    <ChartContainer config={schoolChartConfig} className="h-[300px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={stats.schoolData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                        >
                          {stats.schoolData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend
                          wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value) => (
                            <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stream Distribution</CardTitle>
                  <CardDescription>Distribution of applicants by stream</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.streamData.length > 0 ? (
                    <ChartContainer config={streamChartConfig} className="h-[300px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={stats.streamData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                        >
                          {stats.streamData.map((_, index) => (
                            <Cell key={`stream-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend
                          wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value) => (
                            <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Applicants Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Applicants List ({filteredApplicants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Index No</TableHead>
                        <TableHead>Full Name</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplicants.map((applicant) => (
                        <TableRow key={applicant.applicant_id}>
                          <TableCell className="font-medium">{applicant.index_no}</TableCell>
                          <TableCell>{applicant.fullname}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{applicant.stream}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={applicant.school}>
                        {applicant.school}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedApplicant(applicant);
                                setDetailsOpen(true);
                              }}
                              className="hover:bg-blue-100 dark:hover:bg-blue-950 cursor-pointer"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredApplicants.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No applicants found for the selected filters
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Applicant Details</DialogTitle>
                </DialogHeader>
                {selectedApplicant && (
                  <Card>
                    <CardContent className="p-4 space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-muted-foreground">Index No</div>
                        <div className="font-medium">{selectedApplicant.index_no}</div>
                        <div className="text-muted-foreground">Full Name</div>
                        <div className="font-medium">{selectedApplicant.fullname}</div>
                        <div className="text-muted-foreground">Stream</div>
                        <div className="font-medium">{selectedApplicant.stream}</div>
                        <div className="text-muted-foreground">School</div>
                        <div className="font-medium">{selectedApplicant.school}</div>
                        <div className="text-muted-foreground">Gender</div>
                        <div className="font-medium">{selectedApplicant.gender ? 'Male' : 'Female'}</div>
                        <div className="text-muted-foreground">NIC</div>
                        <div className="font-medium">{selectedApplicant.nic}</div>
                        <div className="text-muted-foreground">Phone</div>
                        <div className="font-medium">{selectedApplicant.phone || '-'}</div>
                        <div className="text-muted-foreground">Email</div>
                        <div className="font-medium">{selectedApplicant.email || '-'}</div>
                        <div className="text-muted-foreground">Year</div>
                        <div className="font-medium">{selectedApplicant.year}</div>
                        <div className="text-muted-foreground">Created</div>
                        <div className="font-medium">
                          {new Date(selectedApplicant.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                          Close
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </DialogContent>
            </Dialog>

            {isSuperAdmin && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Permanently delete all applicants for {selectedYear}. This action cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full sm:w-auto">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All {selectedYear} Applicants ({yearApplicants.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete all <strong>{yearApplicants.length}</strong> applicants from year{' '}
                          <strong>{selectedYear}</strong>. This action cannot be undone and the data cannot be recovered.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDeleteByYear}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={bulkDeleting}
                        >
                          {bulkDeleting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete All'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Dialog
          open={uploadOpen}
          onOpenChange={(open) => {
            setUploadOpen(open);
            if (!open) {
              setImportMode(null);
              setCsvFile(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Applicants</DialogTitle>
              <DialogDescription>
                Choose single applicant or bulk import. Bulk import uses CSV with index_no left empty.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Single Applicant</CardTitle>
                      <CardDescription>
                        Use the exam application form from the Exam page.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportMode(importMode === 'single' ? null : 'single')}
                    >
                      {importMode === 'single' ? 'Hide' : 'Expand'}
                    </Button>
                  </div>
                </CardHeader>
                {importMode === 'single' && (
                  <CardContent className="pt-0 space-y-3">
                    <form onSubmit={handleSingleApplicantSubmit} className="space-y-4">
                      <div>
                        <Label htmlFor="single-fullname">Full Name *</Label>
                        <Input
                          id="single-fullname"
                          value={singleForm.fullName}
                          onChange={(e) => setSingleForm((prev) => ({ ...prev, fullName: e.target.value }))}
                          placeholder="Enter full name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="single-email">Email *</Label>
                        <Input
                          id="single-email"
                          type="email"
                          value={singleForm.email}
                          onChange={(e) => setSingleForm((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="email@example.com"
                        />
                      </div>

                      <div>
                        <Label htmlFor="single-phone">Phone *</Label>
                        <Input
                          id="single-phone"
                          value={singleForm.phone}
                          onChange={(e) => setSingleForm((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="0757575757"
                        />
                      </div>

                      <div>
                        <Label htmlFor="single-nic">NIC *</Label>
                        <Input
                          id="single-nic"
                          value={singleForm.nic}
                          onChange={(e) => setSingleForm((prev) => ({ ...prev, nic: e.target.value }))}
                          placeholder="123456789012"
                        />
                      </div>

                      <div>
                        <Label>Stream *</Label>
                        <Select
                          value={singleForm.stream}
                          onValueChange={(v) => setSingleForm((prev) => ({ ...prev, stream: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select stream" />
                          </SelectTrigger>
                          <SelectContent>
                            {streamOptions.map((stream) => (
                              <SelectItem key={stream} value={stream}>
                                {stream}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="single-school">School *</Label>
                        <Input
                          id="single-school"
                          value={singleForm.school}
                          onChange={(e) => setSingleForm((prev) => ({ ...prev, school: e.target.value }))}
                          placeholder="Enter school name"
                        />
                      </div>

                      <div>
                        <Label>Gender *</Label>
                        <Select
                          value={singleForm.gender}
                          onValueChange={(v) => setSingleForm((prev) => ({ ...prev, gender: v as 'male' | 'female' }))}
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

                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" onClick={resetSingleForm} disabled={singleSubmitting}>
                          Reset
                        </Button>
                        <Button type="submit" disabled={singleSubmitting}>
                          {singleSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Submit Applicant
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                )}
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Bulk Applicants</CardTitle>
                      <CardDescription>
                        Upload a CSV file for multiple applicants.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportMode(importMode === 'bulk' ? null : 'bulk')}
                    >
                      {importMode === 'bulk' ? 'Hide' : 'Expand'}
                    </Button>
                  </div>
                </CardHeader>
                {importMode === 'bulk' && (
                  <CardContent className="pt-0 space-y-4">
                    <div className="text-sm text-muted-foreground">
                      CSV columns: index_no (leave empty), fullname, gender, stream, nic, phone, email, school.
                    </div>
                    <div>
                      <Label htmlFor="csv-file">CSV File</Label>
                      <Input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setUploadOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCsvUpload} disabled={uploading}>
                        {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Import CSV
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setUploadOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
