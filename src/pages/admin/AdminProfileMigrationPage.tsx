import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Image as ImageIcon, X, Zap, FileText, Download, Upload, Loader2 } from 'lucide-react';
import {
  getAllMembersWithProfiles,
  migrateSingleMemberProfile,
  getMemberProfileStats,
  MemberProfile,
  MigrationResult,
} from '@/services/profileMigration';
import { compressImageBlob } from '@/lib/imageCompression';
import { compressPDFBlob, getPDFCompressionDetails } from '@/lib/pdfCompression';
import { DownloadCompressionDialog } from '@/components/DownloadCompressionDialog';
import { useDownloadWithCompression } from '@/hooks/useDownloadWithCompression';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type MigrationState = 'idle' | 'migrating' | 'success' | 'error';

interface MemberMigrationState {
  memId: number;
  status: MigrationState;
  error?: string;
}

interface ImageViewerState {
  member: MemberProfile | null;
  imageUrl: string | null;
  compressedImageUrl: string | null;
  originalSize: number | null;
  compressedSize: number | null;
  compressing: boolean;
  reUploading: boolean;
}

interface PDFFile {
  name: string;
  bucket: string;
  path: string;
  size: number;
}

interface PDFCompressionState {
  pdfs: PDFFile[];
  loading: boolean;
  selectedQuality: 'low' | 'medium' | 'high';
  compressing: Record<string, boolean>; // Track which PDFs are being compressed
}

export default function AdminProfileMigrationPage() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    dialogOpen,
    selectedFile,
    isDownloading,
    openDownloadDialog,
    closeDownloadDialog,
    handleDownload,
  } = useDownloadWithCompression();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [memberFileSizes, setMemberFileSizes] = useState<Record<number, number>>({});
  const [stats, setStats] = useState({ total: 0, newFormat: 0, oldFormat: 0 });
  const [memberMigrations, setMemberMigrations] = useState<Record<number, MemberMigrationState>>({});
  const [error, setError] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<ImageViewerState>({
    member: null,
    imageUrl: null,
    compressedImageUrl: null,
    originalSize: null,
    compressedSize: null,
    compressing: false,
    reUploading: false,
  });

  const [pdfCompression, setPdfCompression] = useState<PDFCompressionState>({
    pdfs: [],
    loading: false,
    selectedQuality: 'high',
    compressing: {},
  });

  const [imageUpload, setImageUpload] = useState<{
    member: MemberProfile | null;
    uploading: boolean;
  }>({
    member: null,
    uploading: false,
  });

  // Load members on mount
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const membersData = await getAllMembersWithProfiles();
      const statsData = await getMemberProfileStats();
      setMembers(membersData);
      setStats(statsData);

      // Fetch file sizes for each member
      const fileSizes: Record<number, number> = {};
      for (const member of membersData) {
        if (member.profile_path && member.profile_bucket) {
          try {
            const { data } = await supabase.storage
              .from(member.profile_bucket)
              .list(member.profile_path.split('/')[0]); // List the batch folder
            
            if (data) {
              const fileData = data.find(f => f.name === member.profile_path.split('/').pop());
              if (fileData) {
                fileSizes[member.mem_id] = fileData.metadata?.size || 0;
              }
            }
          } catch (err) {
            // Silently fail for individual files
          }
        }
      }
      setMemberFileSizes(fileSizes);
    } catch (err: any) {
      setError(err.message || 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const loadPDFs = async () => {
    setPdfCompression(prev => ({ ...prev, loading: true }));
    try {
      const pdfBuckets = ['exam-papers', 'schemes', 'seminar-papers', 'answers'];
      const allPDFs: PDFFile[] = [];

      for (const bucket of pdfBuckets) {
        try {
          const { data } = await supabase.storage.from(bucket).list();
          if (data) {
            for (const file of data) {
              if (file.name.endsWith('.pdf')) {
                allPDFs.push({
                  name: file.name,
                  bucket,
                  path: file.name,
                  size: file.metadata?.size || 0,
                });
              }
            }
          }
        } catch (err) {
          // Silently skip buckets that don't exist
        }
      }

      setPdfCompression(prev => ({ ...prev, pdfs: allPDFs }));
    } catch (err: any) {
      alert('Failed to load PDFs: ' + err.message);
    } finally {
      setPdfCompression(prev => ({ ...prev, loading: false }));
    }
  };

  const downloadPDFWithQuality = async (pdf: PDFFile) => {
    // Open the download dialog with compression quality options
    openDownloadDialog(pdf.bucket, pdf.path, pdf.name, 'pdf', pdf.size);
  };

  const handleMigrateOne = (member: MemberProfile) => {
    if (member.format_status === 'new') {
      setMemberMigrations(prev => ({
        ...prev,
        [member.mem_id]: { memId: member.mem_id, status: 'success' },
      }));
      return;
    }

    // Mark as migrating immediately
    setMemberMigrations(prev => ({
      ...prev,
      [member.mem_id]: { memId: member.mem_id, status: 'migrating' },
    }));

    // Yield to browser, then show confirm and handle migration
    Promise.resolve().then(() => {
      const confirmed = window.confirm(
        `Migrate ${member.username}'s profile picture to new format?\n\nOld: ${member.profile_path}\n\nThis cannot be undone.`
      );

      if (!confirmed) {
        // Reset state if cancelled
        setMemberMigrations(prev => ({
          ...prev,
          [member.mem_id]: { memId: member.mem_id, status: 'idle' },
        }));
        return;
      }

      // Start migration in background
      (async () => {
        try {
          await migrateSingleMemberProfile(member.mem_id);

          setMemberMigrations(prev => ({
            ...prev,
            [member.mem_id]: { memId: member.mem_id, status: 'success' },
          }));

          // Update member status locally
          setMembers(prev =>
            prev.map(m =>
              m.mem_id === member.mem_id ? { ...m, format_status: 'new' } : m
            )
          );

          // Refresh stats
          setTimeout(() => loadMembers(), 500);
        } catch (err: any) {
          setMemberMigrations(prev => ({
            ...prev,
            [member.mem_id]: {
              memId: member.mem_id,
              status: 'error',
              error: err.message,
            },
          }));
        }
      })();
    });
  };

  const handleViewImage = async (member: MemberProfile) => {
    try {
      setImageViewer(prev => ({ ...prev, member, compressing: true }));

      if (!member.profile_path || !member.profile_bucket) {
        setImageViewer(prev => ({ ...prev, member: null, compressing: false }));
        return;
      }

      // Get signed URL to view the image
      const { data, error } = await supabase.storage
        .from(member.profile_bucket)
        .createSignedUrl(member.profile_path, 3600);

      if (error || !data) throw new Error('Failed to load image');

      // Fetch the original image to get its size
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const originalSize = blob.size;

      setImageViewer(prev => ({
        ...prev,
        imageUrl: data.signedUrl,
        originalSize: originalSize,
        compressing: false,
      }));
    } catch (err: any) {
      alert('Failed to load image: ' + err.message);
      setImageViewer(prev => ({ ...prev, member: null, compressing: false }));
    }
  };

  const handleCompressAndSave = async () => {
    if (!imageViewer.member || !imageViewer.imageUrl || !imageViewer.originalSize) return;

    setImageViewer(prev => ({ ...prev, compressing: true }));

    try {
      // Fetch the original image
      const response = await fetch(imageViewer.imageUrl);
      const blob = await response.blob();

      // Detect best format (WebP for better compression, fallback to JPEG)
      const isWebPSupported = await supportsWebP();
      const bestMimeType = isWebPSupported ? 'image/webp' : 'image/jpeg';

      // Compress with high quality (0.92 = 92% quality - minimal information loss)
      // Use 1200px max for profile pictures (enough detail, good compression)
      const compressedBlob = await compressImageBlob(blob, {
        maxSize: 1200,
        quality: 0.92, // High quality = better information preservation
        mimeType: bestMimeType,
      });

      const compressedSize = compressedBlob.size;

      // Create a preview URL for the compressed image
      const compressedPreviewUrl = URL.createObjectURL(compressedBlob);

      setImageViewer(prev => ({ 
        ...prev, 
        compressedSize, 
        compressedImageUrl: compressedPreviewUrl,
        compressing: false 
      }));

      // Ask for confirmation
      const savings = imageViewer.originalSize - compressedSize;
      const savingsPercent = Math.round((savings / imageViewer.originalSize) * 100);

      const confirmed = window.confirm(
        `High-Quality Compression (92% Quality, ${bestMimeType === 'image/webp' ? 'WebP' : 'JPEG'} Format)\n\n` +
        `Original: ${(imageViewer.originalSize / 1024).toFixed(2)} KB\n` +
        `Compressed: ${(compressedSize / 1024).toFixed(2)} KB\n` +
        `Savings: ${(savings / 1024).toFixed(2)} KB (${savingsPercent}%)\n\n` +
        `Quality: Excellent (minimal information loss)\n` +
        `Save this compressed version?`
      );

      if (!confirmed) {
        URL.revokeObjectURL(compressedPreviewUrl);
        setImageViewer(prev => ({ ...prev, compressedSize: null, compressedImageUrl: null }));
        return;
      }

      // Re-upload the compressed image
      setImageViewer(prev => ({ ...prev, reUploading: true }));

      const { error } = await supabase.storage
        .from(imageViewer.member.profile_bucket!)
        .upload(imageViewer.member.profile_path!, compressedBlob, { upsert: true });

      if (error) throw error;

      alert(`✅ Image saved with best compression!\n\nFormat: ${bestMimeType === 'image/webp' ? 'WebP' : 'JPEG'}\nQuality: 92% (Excellent)\nSaved ${(savings / 1024).toFixed(2)} KB (${savingsPercent}%)\n\nMinimal information loss - image quality preserved!`);
      URL.revokeObjectURL(compressedPreviewUrl);
      setImageViewer({ member: null, imageUrl: null, compressedImageUrl: null, originalSize: null, compressedSize: null, compressing: false, reUploading: false });
    } catch (err: any) {
      alert('Failed to compress/save: ' + err.message);
      setImageViewer(prev => ({ ...prev, compressing: false, reUploading: false }));
    }
  };

  const closeImageViewer = () => {
    if (imageViewer.compressedImageUrl) {
      URL.revokeObjectURL(imageViewer.compressedImageUrl);
    }
    setImageViewer({ member: null, imageUrl: null, compressedImageUrl: null, originalSize: null, compressedSize: null, compressing: false, reUploading: false });
  };

  const handleUploadImage = async (file: File, member: MemberProfile) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setImageUpload(prev => ({ ...prev, uploading: true }));

    try {
      // Compress image before uploading
      const compressedBlob = await compressImageBlob(file, {
        maxSize: 1200,
        quality: 0.92,
        mimeType: 'image/jpeg',
      });

      const compressedSize = compressedBlob.size;
      const originalSize = file.size;
      const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

      // Create new path in format: {batch}/{username}_{mem_id}.jpg
      const newPath = `${member.batch}/${member.username}_${member.mem_id}.jpg`;

      // Upload to member-profiles bucket
      const { error: uploadError } = await supabase.storage
        .from('member-profiles')
        .upload(newPath, compressedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Update member's profile_path in database
      const { error: updateError } = await supabase
        .from('members')
        .update({ profile_path: newPath })
        .eq('mem_id', member.mem_id);

      if (updateError) throw updateError;

      // Update local state
      setMembers(prev => prev.map(m => 
        m.mem_id === member.mem_id 
          ? { ...m, profile_path: newPath, format_status: 'new' as const }
          : m
      ));

      setMemberFileSizes(prev => ({
        ...prev,
        [member.mem_id]: compressedSize,
      }));

      toast.success(`Image uploaded and compressed! (${savingsPercent}% smaller)`);
      setImageUpload({ member: null, uploading: false });
    } catch (err: any) {
      toast.error(`Failed to upload: ${err.message}`);
      setImageUpload(prev => ({ ...prev, uploading: false }));
    }
  };

  const supportsWebP = async (): Promise<boolean> => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').includes('image/webp');
    } catch {
      return false;
    }
  };

  const bg = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const cardClass = cn(
    'rounded-lg border',
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  );
  const textMain = isDark ? 'text-white' : 'text-slate-900';
  const textSub = isDark ? 'text-slate-400' : 'text-slate-600';

  const pendingMembers = members.filter(m => m.format_status === 'old');
  const migratedMembers = members.filter(m => m.format_status === 'new');

  return (
    <div className={cn('min-h-screen p-4 md:p-8', bg)}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className={cn('text-3xl font-bold mb-2', textMain)}>Profile Picture Migration</h1>
          <p className={cn('text-sm', textSub)}>
            Migrate member profile pictures one-by-one to new organized folder structure
          </p>
        </div>

        {/* Stats */}
        <Card className={cardClass}>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className={cn('p-4 rounded-lg', isDark ? 'bg-slate-700' : 'bg-slate-100')}>
                <div className={cn('text-sm font-medium mb-1', textSub)}>Total Profiles</div>
                <div className={cn('text-2xl font-bold', textMain)}>{stats.total}</div>
              </div>

              <div className={cn('p-4 rounded-lg', isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200')}>
                <div className="text-sm font-medium text-green-600 mb-1">Migrated</div>
                <div className="text-2xl font-bold text-green-600">{migratedMembers.length}</div>
              </div>

              <div className={cn('p-4 rounded-lg', isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200')}>
                <div className="text-sm font-medium text-yellow-600 mb-1">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">{pendingMembers.length}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className={textSub}>Progress</span>
                <span className={textMain}>
                  {stats.total > 0 ? Math.round((migratedMembers.length / stats.total) * 100) : 0}%
                </span>
              </div>
              <Progress value={(migratedMembers.length / Math.max(stats.total, 1)) * 100} className="h-2" />
            </div>
          </div>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert className="mt-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        {/* Members Table */}
        <Card className={cn('mt-6', cardClass)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-xl font-semibold', textMain)}>
                Members ({members.length})
              </h2>
              <Button
                onClick={loadMembers}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className={cn('text-center py-8', textSub)}>Loading members...</div>
            ) : members.length === 0 ? (
              <div className={cn('text-center py-8', textSub)}>No members with profile pictures</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={cn('border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
                      <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>ID</th>
                      <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>Username</th>
                      <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>Batch</th>
                      <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>File Size</th>
                      <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>Status</th>
                      <th className={cn('text-right px-4 py-3 font-semibold', textSub)}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(member => {
                      const migState = memberMigrations[member.mem_id];
                      return (
                        <tr
                          key={member.mem_id}
                          className={cn(
                            'border-b',
                            isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'
                          )}
                        >
                          <td className={cn('px-4 py-3 font-mono text-xs', textMain)}>
                            {member.mem_id}
                          </td>
                          <td className={cn('px-4 py-3', textMain)}>
                            {member.username}
                          </td>
                          <td className={cn('px-4 py-3 font-mono', textMain)}>
                            {member.batch}
                          </td>
                          <td className={cn('px-4 py-3 text-sm font-semibold', textMain)}>
                            {memberFileSizes[member.mem_id] ? (
                              <span className="text-blue-600">
                                {(memberFileSizes[member.mem_id] / 1024).toFixed(2)} KB
                              </span>
                            ) : (
                              <span className={textSub}>-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {migState?.status === 'migrating' && (
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-blue-500 animate-spin" />
                                <span className="text-blue-600 text-xs">Migrating...</span>
                              </div>
                            )}
                            {migState?.status === 'success' || member.format_status === 'new' ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-green-600 text-xs">Migrated</span>
                              </div>
                            ) : migState?.status === 'error' ? (
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <span className="text-red-600 text-xs">Error</span>
                              </div>
                            ) : (
                              <span className={cn('text-xs', 'text-yellow-600')}>Pending</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-2 justify-end items-center">
                              {member.profile_path ? (
                                <Button
                                  onClick={() => handleViewImage(member)}
                                  size="sm"
                                  variant="outline"
                                  title="View and compress image"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                </Button>
                              ) : (
                                <>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleUploadImage(file, member);
                                        e.target.value = '';
                                      }
                                    }}
                                    className="hidden"
                                    id={`upload-${member.mem_id}`}
                                    disabled={imageUpload.uploading}
                                  />
                                  <Button
                                    onClick={() => document.getElementById(`upload-${member.mem_id}`)?.click()}
                                    disabled={imageUpload.uploading}
                                    size="sm"
                                    variant="outline"
                                    title="Upload image"
                                  >
                                    {imageUpload.uploading && imageUpload.member?.mem_id === member.mem_id ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      </>
                                    ) : (
                                      <Upload className="w-3 h-3" />
                                    )}
                                  </Button>
                                </>
                              )}
                              <Button
                                onClick={() => handleMigrateOne(member)}
                                disabled={migState?.status === 'migrating' || member.format_status === 'new'}
                                size="sm"
                                variant={member.format_status === 'new' ? 'outline' : 'default'}
                              >
                                {migState?.status === 'migrating' ? (
                                  <>
                                    <Clock className="w-3 h-3 mr-1 animate-spin" />
                                    Migrating
                                  </>
                                ) : member.format_status === 'new' ? (
                                  'Done'
                                ) : (
                                  'Migrate'
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        {/* PDF Compression Card */}
        <Card className={cn('mt-6', cardClass)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-xl font-semibold flex items-center gap-2', textMain)}>
                <FileText className="w-5 h-5 text-red-500" />
                PDF Compression
              </h2>
              <Button
                onClick={loadPDFs}
                disabled={pdfCompression.loading}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', pdfCompression.loading && 'animate-spin')} />
                Scan PDFs
              </Button>
            </div>

            <p className={cn('text-sm mb-4', textSub)}>
              Compress PDF files from exam papers, schemes, and seminar resources
            </p>

            {/* Quality Selection */}
            <div className="mb-6 p-4 rounded-lg border" style={{ borderColor: isDark ? 'rgb(55, 65, 81)' : 'rgb(226, 232, 240)' }}>
              <div className={cn('text-sm font-semibold mb-3', textMain)}>Compression Quality</div>
              <div className="grid grid-cols-3 gap-3">
                {(['low', 'medium', 'high'] as const).map(quality => (
                  <button
                    key={quality}
                    onClick={() => setPdfCompression(prev => ({ ...prev, selectedQuality: quality }))}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all',
                      pdfCompression.selectedQuality === quality
                        ? isDark
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-blue-500 bg-blue-50'
                        : isDark
                        ? 'border-slate-600 hover:border-slate-500'
                        : 'border-slate-300 hover:border-slate-400'
                    )}
                  >
                    <div className={cn('text-sm font-semibold capitalize', quality === pdfCompression.selectedQuality ? 'text-blue-600' : textMain)}>
                      {quality}
                    </div>
                    <div className={cn('text-xs', textSub)}>
                      {quality === 'low' && '150 DPI (70% smaller)'}
                      {quality === 'medium' && '200 DPI (50% smaller)'}
                      {quality === 'high' && '300 DPI (30% smaller)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* PDFs List */}
            {pdfCompression.loading ? (
              <div className={cn('text-center py-8', textSub)}>Loading PDFs...</div>
            ) : pdfCompression.pdfs.length === 0 ? (
              <div className={cn('text-center py-8', textSub)}>No PDFs found. Click "Scan PDFs" to search.</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {pdfCompression.pdfs.map((pdf, idx) => {
                  const details = getPDFCompressionDetails(pdf.size, pdfCompression.selectedQuality);
                  return (
                    <div
                      key={`${pdf.bucket}-${pdf.path}-${idx}`}
                      className={cn(
                        'p-3 rounded-lg border flex items-center justify-between',
                        isDark ? 'border-slate-700 hover:bg-slate-700/30' : 'border-slate-200 hover:bg-slate-50'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm font-semibold truncate', textMain)}>{pdf.name}</div>
                        <div className={cn('text-xs', textSub)}>
                          {pdf.bucket} • {(pdf.size / 1024).toFixed(2)} KB
                        </div>
                        <div className={cn('text-xs mt-1', pdfCompression.selectedQuality === 'high' ? 'text-green-600' : 'text-yellow-600')}>
                          Est. {(details.estimatedCompressed / 1024).toFixed(2)} KB after compression ({details.savingsPercent}% smaller)
                        </div>
                      </div>
                      <Button
                        onClick={() => downloadPDFWithQuality(pdf)}
                        disabled={pdfCompression.compressing[`${pdf.bucket}-${pdf.path}`] || false}
                        size="sm"
                        variant="outline"
                        className="ml-2 flex-shrink-0"
                      >
                        {pdfCompression.compressing[`${pdf.bucket}-${pdf.path}`] ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                            Compressing...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-1" />
                            Compress
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* Error Details */}
        {Object.values(memberMigrations).some(m => m.status === 'error') && (
          <Card className={cn('mt-6', cardClass)}>
            <div className="p-6">
              <h3 className={cn('font-semibold mb-4 flex items-center gap-2', 'text-red-600')}>
                <AlertCircle className="w-5 h-5" />
                Migration Errors
              </h3>
              <div className="space-y-2">
                {Object.values(memberMigrations)
                  .filter(m => m.status === 'error')
                  .map(m => (
                    <div
                      key={m.memId}
                      className={cn('text-sm p-3 rounded-lg', isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200')}
                    >
                      <span className="font-mono text-red-600">Member {m.memId}:</span>
                      <span className={cn('ml-2', textSub)}>{m.error}</span>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Image Compression Viewer Modal */}
      {imageViewer.member && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className={cn('w-full max-w-2xl', cardClass)}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className={cn('text-xl font-semibold flex items-center gap-2', textMain)}>
                  <ImageIcon className="w-5 h-5" />
                  {imageViewer.member.username} - Image Compression
                </h2>
                <button onClick={closeImageViewer} disabled={imageViewer.compressing || imageViewer.reUploading}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview - Original and Compressed Side by Side */}
              {imageViewer.imageUrl ? (
                <div className={cn('mb-4 p-4 rounded-lg', isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original */}
                    <div className="flex flex-col">
                      <div className={cn('mb-2 p-3 rounded-lg', isDark ? 'bg-slate-800 border border-blue-500/30' : 'bg-blue-50 border border-blue-300')}>
                        <div className={cn('text-sm font-semibold', 'text-blue-600')}>Before (Original)</div>
                        {imageViewer.originalSize && (
                          <div className={cn('text-xl font-bold', 'text-blue-700')}>
                            {(imageViewer.originalSize / 1024).toFixed(2)} KB
                          </div>
                        )}
                      </div>
                      <img
                        src={imageViewer.imageUrl}
                        alt={`${imageViewer.member.username} - Original`}
                        className="w-full h-auto rounded-lg border-2 border-blue-300 flex-1"
                      />
                    </div>

                    {/* Compressed Preview */}
                    {imageViewer.compressedImageUrl ? (
                      <div className="flex flex-col">
                        <div className={cn('mb-2 p-3 rounded-lg', isDark ? 'bg-slate-800 border border-green-500/30' : 'bg-green-50 border border-green-300')}>
                          <div className={cn('text-sm font-semibold', 'text-green-600')}>After (Compressed)</div>
                          {imageViewer.compressedSize && (
                            <div className={cn('text-xl font-bold', 'text-green-700')}>
                              {(imageViewer.compressedSize / 1024).toFixed(2)} KB
                            </div>
                          )}
                          {imageViewer.originalSize && imageViewer.compressedSize && (
                            <div className={cn('text-xs mt-1', 'text-green-600')}>
                              Save: {((imageViewer.originalSize - imageViewer.compressedSize) / 1024).toFixed(2)} KB ({Math.round(((imageViewer.originalSize - imageViewer.compressedSize) / imageViewer.originalSize) * 100)}%)
                            </div>
                          )}
                        </div>
                        <img
                          src={imageViewer.compressedImageUrl}
                          alt={`${imageViewer.member.username} - Compressed`}
                          className="w-full h-auto rounded-lg border-2 border-green-300 flex-1"
                        />
                      </div>
                    ) : (
                      <div className={cn('flex items-center justify-center rounded-lg border-2 border-dashed', isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-slate-50', textSub)}>
                        <div className="text-center">
                          <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                          <p className="text-sm font-semibold mb-1">Click button to compress</p>
                          <p className="text-xs text-gray-500">Compress & Preview to see the result</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={cn('mb-4 p-12 rounded-lg text-center', isDark ? 'bg-slate-900' : 'bg-slate-100', textSub)}>
                  {imageViewer.compressing ? 'Loading image...' : 'No image loaded'}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                {!imageViewer.compressedSize ? (
                  <Button
                    onClick={handleCompressAndSave}
                    disabled={imageViewer.compressing || !imageViewer.imageUrl}
                    className="flex-1"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {imageViewer.compressing ? 'Processing...' : 'Compress & Preview'}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleCompressAndSave}
                      disabled={imageViewer.reUploading}
                      className="flex-1"
                      variant="default"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {imageViewer.reUploading ? 'Saving...' : 'Save Compressed'}
                    </Button>
                  </>
                )}
                <Button
                  onClick={closeImageViewer}
                  disabled={imageViewer.compressing || imageViewer.reUploading}
                  variant="outline"
                  className="flex-1"
                >
                  {imageViewer.compressedSize ? 'Cancel' : 'Close'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Download Compression Dialog */}
      <DownloadCompressionDialog
        open={dialogOpen}
        onOpenChange={closeDownloadDialog}
        filename={selectedFile?.filename || ''}
        fileType={selectedFile?.fileType || 'pdf'}
        originalSize={selectedFile?.originalSize || 0}
        onDownload={handleDownload}
        isLoading={isDownloading}
      />
    </div>
  );
}
