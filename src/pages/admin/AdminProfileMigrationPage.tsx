import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, Image as ImageIcon, X, Zap, FileText, Download, Upload, Loader2 } from 'lucide-react';
import {
  getAllMembersWithProfiles,
  getMembersWithoutProfiles,
  migrateSingleMemberProfile,
  getMemberProfileStats,
  MemberProfile,
  MigrationResult,
} from '@/services/profileMigration';
import { compressImageBlob } from '@/lib/imageCompression';
import { DownloadCompressionDialog } from '@/components/DownloadCompressionDialog';
import { useDownloadWithCompression } from '@/hooks/useDownloadWithCompression';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { universityOptions, schoolOptions, designationOptions } from '@/utils/universityOptions';

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

export default function AdminProfileMigrationPage() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { isSuperAdmin, isAdmin } = useAdminAuth();
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
  const [membersWithoutPictures, setMembersWithoutPictures] = useState<MemberProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'without-pictures'>('without-pictures');
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

  const [imageUpload, setImageUpload] = useState<{
    member: MemberProfile | null;
    uploading: boolean;
  }>({
    member: null,
    uploading: false,
  });

  // State for single member upload card
  const [singleMemberUpload, setSingleMemberUpload] = useState<{
    selectedMemberId: number | null;
    selectedFile: File | null;
    previewUrl: string | null;
    uploading: boolean;
  }>({
    selectedMemberId: null,
    selectedFile: null,
    previewUrl: null,
    uploading: false,
  });

  // State for add new member form
  const [newMemberForm, setNewMemberForm] = useState<{
    fullname: string;
    username: string;
    nic: string;
    gender: 'male' | 'female' | '';
    batch: string;
    university: string;
    school: string;
    designation: string;
    role: 'member' | 'honourable';
    submitting: boolean;
  }>({
    fullname: '',
    username: '',
    nic: '',
    gender: '',
    batch: '',
    university: '',
    school: '',
    designation: '',
    role: 'member',
    submitting: false,
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
      const membersNoPhotos = await getMembersWithoutProfiles();
      const statsData = await getMemberProfileStats();
      console.log('Members with pictures:', membersData.length);
      console.log('Members without pictures:', membersNoPhotos.length, membersNoPhotos);
      setMembers(membersData);
      setMembersWithoutPictures(membersNoPhotos);
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

  // Handler for adding new member
  const handleAddNewMember = async () => {
    // Check permissions
    if (!isAdmin && !isSuperAdmin) {
      toast.error('Only admins can add new members');
      return;
    }

    // Validation
    if (!newMemberForm.fullname.trim()) {
      toast.error('Fullname is required');
      return;
    }
    if (!newMemberForm.username.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!newMemberForm.nic.trim() || newMemberForm.nic.length !== 12) {
      toast.error('NIC must be 12 characters');
      return;
    }
    if (!newMemberForm.gender) {
      toast.error('Please select gender');
      return;
    }
    if (!newMemberForm.batch.trim()) {
      toast.error('Batch is required');
      return;
    }
    if (!newMemberForm.university.trim()) {
      toast.error('University is required');
      return;
    }
    if (!newMemberForm.school.trim()) {
      toast.error('School is required');
      return;
    }

    setNewMemberForm(prev => ({ ...prev, submitting: true }));

    try {
      const { data, error } = await supabase
        .from('members')
        .insert({
          fullname: newMemberForm.fullname.trim(),
          username: newMemberForm.username.trim(),
          nic: newMemberForm.nic.trim(),
          gender: newMemberForm.gender === 'male',
          batch: parseInt(newMemberForm.batch, 10),
          university: newMemberForm.university.trim(),
          school: newMemberForm.school.trim(),
          phone: '',
          designation: newMemberForm.designation.trim() || null,
          role: newMemberForm.role,
        })
        .select();

      if (error) throw error;

      toast.success(`✅ New member "${newMemberForm.fullname}" added successfully!`);

      // Reset form
      setNewMemberForm({
        fullname: '',
        username: '',
        nic: '',
        gender: '',
        batch: '',
        university: '',
        school: '',
        designation: '',
        role: 'member',
        submitting: false,
      });

      // Reload members
      loadMembers();
    } catch (err: any) {
      console.error('Add member error:', err);
      const errorMsg = err.message || 'Failed to add member';
      
      // Check if it's an RLS error (404 from Supabase means RLS policy blocked)
      if (err.status === 404 || errorMsg.includes('404')) {
        toast.error('Permission denied: Only super admins/admins can add members');
      } else {
        toast.error(`Failed to add member: ${errorMsg}`);
      }
      setNewMemberForm(prev => ({ ...prev, submitting: false }));
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

  // Handlers for single member upload card
  const handleSelectMemberForUpload = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const memId = parseInt(e.target.value, 10);
    setSingleMemberUpload(prev => ({
      ...prev,
      selectedMemberId: memId || null,
    }));
  };

  const handleSelectFileForSingleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSingleMemberUpload(prev => ({
      ...prev,
      selectedFile: file,
      previewUrl: previewUrl,
    }));
  };

  const handleSaveSingleMemberPicture = async () => {
    if (!singleMemberUpload.selectedMemberId || !singleMemberUpload.selectedFile) {
      toast.error('Please select both member and image');
      return;
    }

    setSingleMemberUpload(prev => ({ ...prev, uploading: true }));

    try {
      // Get member details for path creation
      const allMembersToSearch = [...members, ...membersWithoutPictures];
      const member = allMembersToSearch.find(m => m.mem_id === singleMemberUpload.selectedMemberId);
      
      if (!member) {
        throw new Error('Member not found');
      }

      // Compress image
      const compressedBlob = await compressImageBlob(singleMemberUpload.selectedFile, {
        maxSize: 1200,
        quality: 0.92,
        mimeType: 'image/jpeg',
      });

      const compressedSize = compressedBlob.size;
      const originalSize = singleMemberUpload.selectedFile.size;
      const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

      // Create path: {batch}/{username}_{mem_id}.jpg
      const newPath = `${member.batch}/${member.username}_${member.mem_id}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('member-profiles')
        .upload(newPath, compressedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Update member in database
      const { error: updateError } = await supabase
        .from('members')
        .update({ profile_path: newPath })
        .eq('mem_id', member.mem_id);

      if (updateError) throw updateError;

      // Update local state
      setMembersWithoutPictures(prev => prev.filter(m => m.mem_id !== member.mem_id));
      setMembers(prev => {
        const exists = prev.find(m => m.mem_id === member.mem_id);
        if (exists) {
          return prev.map(m => m.mem_id === member.mem_id 
            ? { ...m, profile_path: newPath, format_status: 'new' as const }
            : m
          );
        }
        return [...prev, { ...member, profile_path: newPath, format_status: 'new' as const }];
      });

      toast.success(`✅ Picture saved for ${member.username}! (${savingsPercent}% smaller)`);
      
      // Reset form
      if (singleMemberUpload.previewUrl) {
        URL.revokeObjectURL(singleMemberUpload.previewUrl);
      }
      setSingleMemberUpload({
        selectedMemberId: null,
        selectedFile: null,
        previewUrl: null,
        uploading: false,
      });
    } catch (err: any) {
      toast.error(`Failed to save: ${err.message}`);
      setSingleMemberUpload(prev => ({ ...prev, uploading: false }));
    }
  };

  return (
    <div className={cn('min-h-screen p-4 md:p-8', bg)}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className={cn('text-3xl font-bold mb-2', textMain)}>Profile Picture Migration</h1>
          <p className={cn('text-sm', textSub)}>
            Migrate member profile pictures one-by-one to new organized folder structure
          </p>

          {/* Add New Member Card */}
          <div className="mt-6 mb-8">
            <Card className={cardClass}>
              <div className="p-6">
                <h2 className={cn('text-lg font-semibold mb-4 flex items-center gap-2', textMain)}>
                  + Add New Member
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {/* Fullname */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>Fullname *</label>
                    <input
                      type="text"
                      value={newMemberForm.fullname}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, fullname: e.target.value }))}
                      placeholder="Enter fullname"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>Username *</label>
                    <input
                      type="text"
                      value={newMemberForm.username}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Enter username"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    />
                  </div>

                  {/* NIC */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>NIC (12 digits) *</label>
                    <input
                      type="text"
                      value={newMemberForm.nic}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, nic: e.target.value }))}
                      placeholder="XXXXXXXXXX"
                      maxLength={12}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>Gender *</label>
                    <select
                      value={newMemberForm.gender}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' | '' }))}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    >
                      <option value="">-- Select --</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  {/* Batch */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>Batch *</label>
                    <input
                      type="number"
                      value={newMemberForm.batch}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, batch: e.target.value }))}
                      placeholder="e.g., 2024"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    />
                  </div>

                  {/* University */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>University *</label>
                    <select
                      value={newMemberForm.university}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, university: e.target.value }))}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    >
                      <option value="">-- Select University --</option>
                      {universityOptions.map((uni) => (
                        <option key={uni} value={uni}>
                          {uni}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* School */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>School *</label>
                    <select
                      value={newMemberForm.school}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, school: e.target.value }))}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    >
                      <option value="">-- Select School --</option>
                      {schoolOptions.map((school) => (
                        <option key={school} value={school}>
                          {school}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Designation */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>Designation</label>
                    <select
                      value={newMemberForm.designation}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, designation: e.target.value }))}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    >
                      <option value="">-- None --</option>
                      {designationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Role */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-2', textMain)}>Role</label>
                    <select
                      value={newMemberForm.role}
                      onChange={(e) => setNewMemberForm(prev => ({ ...prev, role: e.target.value as 'member' | 'honourable' }))}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'
                      )}
                      disabled={newMemberForm.submitting}
                    >
                      <option value="member">Member</option>
                      <option value="honourable">Honourable</option>
                    </select>
                  </div>
                </div>

                {/* Add Button */}
                <Button
                  onClick={handleAddNewMember}
                  disabled={newMemberForm.submitting}
                  className="w-full mt-6 bg-cyan-500 hover:bg-cyan-600"
                >
                  {newMemberForm.submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Member'
                  )}
                </Button>
              </div>
            </Card>
          </div>

        </div>

        {/* Members Without Profile Pictures */}
        <Card className={cn('mt-6', cardClass)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn('text-xl font-semibold', textMain)}>
                Members Without Profile Pictures ({membersWithoutPictures.length})
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
              ) : membersWithoutPictures.length === 0 ? (
                <div className={cn('text-center py-8', textSub)}>Great! All members have uploaded profile pictures</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={cn('border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
                        <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>ID</th>
                        <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>Username</th>
                        <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>Batch</th>
                        <th className={cn('text-left px-4 py-3 font-semibold', textSub)}>Status</th>
                        <th className={cn('text-right px-4 py-3 font-semibold', textSub)}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membersWithoutPictures.map(member => (
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
                          <td className="px-4 py-3">
                            <span className={cn('text-xs px-2 py-1 rounded', isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700')}>
                              Missing Picture
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-2 justify-end items-center">
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
                                id={`upload-no-pic-${member.mem_id}`}
                                disabled={imageUpload.uploading}
                              />
                              <Button
                                onClick={() => document.getElementById(`upload-no-pic-${member.mem_id}`)?.click()}
                                disabled={imageUpload.uploading}
                                size="sm"
                                variant="default"
                                title="Upload image"
                              >
                                {imageUpload.uploading && imageUpload.member?.mem_id === member.mem_id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3 h-3 mr-1" />
                                    Upload
                                  </>
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
