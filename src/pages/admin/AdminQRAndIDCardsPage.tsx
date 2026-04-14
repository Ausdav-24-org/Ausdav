import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Trash2,
  Download,
  Loader2,
  Filter,
  Check,
  AlertCircle,
  Search,
  Plus,
  X,
  Printer,
  Eye,
  Users,
  IdCard,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  createQRCode, 
  generateQRImage,
  getAllQRCodesIncludingInactive,
  downloadQRCodeAsImage
} from '@/services/memberQRService';
import AUSDAVLogo from '@/assets/logo/AUSDAV_llogo.png';

interface MemberDetails {
  mem_id: number;
  fullname: string;
  batch?: number;
  role: string;
  nic?: string;
  gender?: boolean;
  profile_path?: string;
  profile_bucket?: string;
  university?: string;
  school?: string;
  designation?: string;
}

interface QRCode {
  id: string;
  mem_id: number;
  qr_token: string;
  is_active: boolean;
  is_expired_manually: boolean;
  expires_at: string;
  generated_at: string;
}

export default function AdminQRAndIDCardsPage() {
  const { isMasterAdmin } = useAdminAuth();
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'bulk-qr' | 'id-card'>('bulk-qr');

  // Shared states
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);

  // Bulk QR states
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
  const [qrExpiryDays, setQRExpiryDays] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [deleteInactiveCount, setDeleteInactiveCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingMemberId, setGeneratingMemberId] = useState<number | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

  // ID Card states
  const [selectedMember, setSelectedMember] = useState<MemberDetails | null>(null);
  const [searchQueryIdCard, setSearchQueryIdCard] = useState('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrImage, setQRImage] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'front' | 'back'>('front');
  const printRef = useRef<HTMLDivElement>(null);

  // Batch-wise ID Card states
  const [selectedBatchesIdCard, setSelectedBatchesIdCard] = useState<number[]>([]);
  const [bulkIdCardMode, setBulkIdCardMode] = useState(false);
  const [bulkIdCardMembers, setBulkIdCardMembers] = useState<MemberDetails[]>([]);
  const [idCardData, setIdCardData] = useState<Map<number, { qr: string; profile: string | null }>>(new Map());
  const [isLoadingIdCards, setIsLoadingIdCards] = useState(false);

  // Fetch members on mount
  useEffect(() => {
    fetchMembers();
    fetchQRCodes();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('members')
        .select('mem_id, fullname, batch, role, nic, gender, profile_path, profile_bucket, university, school, designation')
        .order('batch', { ascending: true });
      
      if (error) throw error;
      setMembers((data as MemberDetails[]) || []);
    } catch (err: any) {
      console.error('Error fetching members:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load members',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchQRCodes = async () => {
    try {
      const data = await getAllQRCodesIncludingInactive(1000);
      setQRCodes(data);
      const inactiveCount = data.filter(qr => !qr.is_active || qr.is_expired_manually).length;
      setDeleteInactiveCount(inactiveCount);
    } catch (err: any) {
      console.error('Error fetching QR codes:', err);
    }
  };

  // ===== BULK QR GENERATOR FUNCTIONS =====
  const uniqueBatches = useMemo(() => {
    const batches = members
      .map(m => m.batch)
      .filter((b) => b !== undefined) as number[];
    return Array.from(new Set(batches)).sort((a, b) => a - b);
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => selectedBatches.includes(m.batch || 0));
  }, [members, selectedBatches]);

  const toggleBatch = (batch: number) => {
    setSelectedBatches(prev =>
      prev.includes(batch)
        ? prev.filter(b => b !== batch)
        : [...prev, batch]
    );
  };

  const selectAllBatches = () => {
    setSelectedBatches(uniqueBatches);
  };

  const deselectAllBatches = () => {
    setSelectedBatches([]);
  };

  const handleBulkGenerateQR = async () => {
    if (filteredMembers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select at least one batch',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedCount(0);
    let successCount = 0;

    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + qrExpiryDays);

      for (const member of filteredMembers) {
        try {
          await createQRCode({
            mem_id: member.mem_id,
            expires_at: expiryDate,
            member_name: member.fullname,
            member_batch: member.batch || 0,
          });
          successCount++;
          setGeneratedCount(successCount);
        } catch (err) {
          console.error(`Failed to generate QR for ${member.fullname}:`, err);
        }
      }

      toast({
        title: 'Success',
        description: `Generated QR codes for ${successCount} member(s)`,
      });

      await fetchQRCodes();
    } catch (err: any) {
      console.error('Error in bulk QR generation:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Bulk QR generation failed',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteInactiveQRs = async () => {
    if (deleteInactiveCount === 0) {
      toast({
        title: 'Info',
        description: 'No inactive QR codes to delete',
      });
      return;
    }

    if (!window.confirm(`Delete ${deleteInactiveCount} inactive QR codes? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await (supabase as any)
        .from('member_qr_codes')
        .delete()
        .eq('is_active', false);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Deleted inactive QR codes`,
      });

      await fetchQRCodes();
    } catch (err: any) {
      console.error('Error deleting inactive QRs:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete inactive QR codes',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ===== ID CARD FUNCTIONS =====
  const generateQRForMember = async (member: MemberDetails) => {
    setIsGeneratingQR(true);
    try {
      const qrRecord = await createQRCode({
        mem_id: member.mem_id,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        member_name: member.fullname,
        member_batch: member.batch || 0,
      });

      const qrImageUrl = await generateQRImage(qrRecord.qr_token, member.fullname);
      setQRImage(qrImageUrl);

      toast({
        title: 'QR Code Generated',
        description: `QR code created for ${member.fullname}`,
      });
    } catch (err: any) {
      console.error('Error generating QR:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'Failed to generate QR code',
      });
      setQRImage(null);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const loadProfileImage = async (member: MemberDetails) => {
    if (!member.profile_path || !member.profile_bucket) {
      setProfileImage(null);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(member.profile_bucket)
        .createSignedUrl(member.profile_path, 3600);
      
      if (error) {
        console.error('Error creating signed URL:', error);
        setProfileImage(null);
      } else {
        setProfileImage(data?.signedUrl || null);
      }
    } catch (err: any) {
      console.error('Error loading profile image:', err);
      setProfileImage(null);
    }
  };

  const handleMemberSelect = async (member: MemberDetails) => {
    setSelectedMember(member);
    setSearchQueryIdCard('');
    
    await generateQRForMember(member);
    await loadProfileImage(member);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredMembersIdCard = useMemo(() => {
    return searchQueryIdCard.trim() === ''
      ? []
      : members.filter(m =>
          m.fullname.toLowerCase().includes(searchQueryIdCard.toLowerCase()) ||
          m.mem_id.toString().includes(searchQueryIdCard) ||
          (m.nic && m.nic.toLowerCase().includes(searchQueryIdCard.toLowerCase()))
        );
  }, [members, searchQueryIdCard]);

  // ===== BATCH-WISE ID CARD FUNCTIONS =====
  const uniqueBatchesIdCard = useMemo(() => {
    const batches = members
      .map(m => m.batch)
      .filter((b) => b !== undefined) as number[];
    return Array.from(new Set(batches)).sort((a, b) => a - b);
  }, [members]);

  const toggleBatchIdCard = (batch: number) => {
    setSelectedBatchesIdCard(prev =>
      prev.includes(batch)
        ? prev.filter(b => b !== batch)
        : [...prev, batch]
    );
  };

  const selectAllBatchesIdCard = () => {
    setSelectedBatchesIdCard(uniqueBatchesIdCard);
  };

  const deselectAllBatchesIdCard = () => {
    setSelectedBatchesIdCard([]);
  };

  const generateBulkIdCards = async () => {
    if (selectedBatchesIdCard.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select at least one batch',
      });
      return;
    }

    const selectedMembers = members.filter(m => selectedBatchesIdCard.includes(m.batch || 0));
    setBulkIdCardMembers(selectedMembers);
    setIsLoadingIdCards(true);

    try {
      const newIdCardData = new Map(idCardData);

      for (const member of selectedMembers) {
        try {
          // Generate QR code
          const qrRecord = await createQRCode({
            mem_id: member.mem_id,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            member_name: member.fullname,
            member_batch: member.batch || 0,
          });

          const qrImageUrl = await generateQRImage(qrRecord.qr_token, member.fullname);

          // Get profile image
          let profileUrl: string | null = null;
          if (member.profile_path && member.profile_bucket) {
            try {
              const { data, error } = await supabase.storage
                .from(member.profile_bucket)
                .createSignedUrl(member.profile_path, 3600);
              
              if (!error && data) {
                profileUrl = data.signedUrl;
              }
            } catch (err) {
              console.error('Error loading profile:', err);
            }
          }

          newIdCardData.set(member.mem_id, { qr: qrImageUrl, profile: profileUrl });
        } catch (err) {
          console.error(`Failed to load data for ${member.fullname}:`, err);
        }
      }

      setIdCardData(newIdCardData);
      setBulkIdCardMode(true);

      toast({
        title: 'Success',
        description: `Loaded ID card data for ${selectedMembers.length} member(s)`,
      });
    } catch (err: any) {
      console.error('Error generating bulk ID cards:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate bulk ID cards',
      });
    } finally {
      setIsLoadingIdCards(false);
    }
  };

  if (!isMasterAdmin) {
    return (
      <div className="p-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-2">Only admins can access QR codes and ID cards.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <AdminHeader
        title="QR Codes & ID Cards"
        breadcrumb="Admin / QR Codes & ID Cards"
      />

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="mt-6 border-b border-border overflow-x-auto">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('bulk-qr')}
                className={`px-4 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'bulk-qr'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <QrCode className="inline mr-2 h-4 w-4" />
                Bulk QR Generator
              </button>
              <button
                onClick={() => setActiveTab('id-card')}
                className={`px-4 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'id-card'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <IdCard className="inline mr-2 h-4 w-4" />
                ID Card Generator
              </button>
            </div>
          </div>

          {/* Bulk QR Tab */}
          {activeTab === 'bulk-qr' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 space-y-6"
            >
              {/* Batch Selection */}
              <Card className="bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Select Batches
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllBatches}
                      className="px-3 py-2 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllBatches}
                      className="px-3 py-2 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-lg transition-colors"
                    >
                      Clear All
                    </button>
                    <span className="ml-auto text-sm text-muted-foreground">
                      Selected: {selectedBatches.length} / {uniqueBatches.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {uniqueBatches.map((batch) => (
                      <button
                        key={batch}
                        onClick={() => toggleBatch(batch)}
                        className={`p-3 rounded-lg text-center transition-all ${
                          selectedBatches.includes(batch)
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                            : 'bg-card border border-border hover:border-primary'
                        }`}
                      >
                        <div className="font-semibold">{batch}</div>
                        <div className="text-xs text-muted-foreground">
                          {members.filter(m => m.batch === batch).length} members
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Generation Settings */}
              <Card className="bg-card/50 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    Generation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      QR Code Expiry Duration
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="365"
                        value={qrExpiryDays}
                        onChange={(e) => setQRExpiryDays(parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-semibold min-w-20">
                        {qrExpiryDays} days
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Expires on: {new Date(Date.now() + qrExpiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2">Affected Members:</p>
                    {filteredMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No members selected</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {filteredMembers.map((member) => (
                          <div key={member.mem_id} className="text-xs flex justify-between">
                            <span>{member.fullname}</span>
                            <Badge className="ml-2">Batch {member.batch}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleBulkGenerateQR}
                      disabled={isGenerating || filteredMembers.length === 0}
                      className="flex-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <QrCode className="h-4 w-4" />
                          Generate QR for {filteredMembers.length} Members
                        </>
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Status & Cleanup */}
              <Card className="bg-muted/50 border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Cleanup</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Inactive QR codes: <span className="font-semibold">{deleteInactiveCount}</span></p>
                  </div>
                  <button
                    onClick={handleDeleteInactiveQRs}
                    disabled={isDeleting || deleteInactiveCount === 0}
                    className="px-4 py-2 bg-destructive/20 text-destructive hover:bg-destructive/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete Inactive
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ID Card Tab */}
          {activeTab === 'id-card' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 space-y-6"
            >
              {!bulkIdCardMode && !selectedMember ? (
                <>
                  {/* Batch Selection for Bulk ID Cards */}
                  <Card className="bg-card/50 border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Batch-wise ID Card Generator
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllBatchesIdCard}
                          className="px-3 py-2 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded-lg transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={deselectAllBatchesIdCard}
                          className="px-3 py-2 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-lg transition-colors"
                        >
                          Clear All
                        </button>
                        <span className="ml-auto text-sm text-muted-foreground">
                          Selected: {selectedBatchesIdCard.length} / {uniqueBatchesIdCard.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {uniqueBatchesIdCard.map((batch) => (
                          <button
                            key={batch}
                            onClick={() => toggleBatchIdCard(batch)}
                            className={`p-3 rounded-lg text-center transition-all ${
                              selectedBatchesIdCard.includes(batch)
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                                : 'bg-card border border-border hover:border-primary'
                            }`}
                          >
                            <div className="font-semibold">{batch}</div>
                            <div className="text-xs text-muted-foreground">
                              {members.filter(m => m.batch === batch).length} members
                            </div>
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={generateBulkIdCards}
                        disabled={isLoadingIdCards || selectedBatchesIdCard.length === 0}
                        className="w-full px-4 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {isLoadingIdCards ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading ID Cards...
                          </>
                        ) : (
                          <>
                            <IdCard className="h-4 w-4" />
                            Generate ID Cards for {members.filter(m => selectedBatchesIdCard.includes(m.batch || 0)).length} Members
                          </>
                        )}
                      </button>
                    </CardContent>
                  </Card>

                  {/* Individual Member Selection */}
                  <Card className="bg-card/50 border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Or Select Individual Member
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search by name, ID, or NIC..."
                          value={searchQueryIdCard}
                          onChange={(e) => setSearchQueryIdCard(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg"
                        />
                      </div>

                      {filteredMembersIdCard.length > 0 && (
                        <div className="grid gap-2 max-h-96 overflow-y-auto">
                        {filteredMembersIdCard.map((member) => (
                          <button
                            key={member.mem_id}
                            onClick={() => handleMemberSelect(member)}
                            className="p-3 rounded-lg bg-card border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
                          >
                            <div className="font-medium text-sm">{member.fullname}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {member.mem_id} | Batch: {member.batch}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                </>
              ) : bulkIdCardMode && bulkIdCardMembers.length > 0 ? (
                <div className="space-y-4">
                  {/* Bulk ID Cards Display */}
                  <div className="flex flex-wrap gap-3 print:hidden">
                    <button
                      onClick={() => {
                        setBulkIdCardMode(false);
                        setSelectedBatchesIdCard([]);
                        setBulkIdCardMembers([]);
                        setIdCardData(new Map());
                      }}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      ← Back to Selection
                    </button>
                    <button
                      onClick={() => {
                        const allElements = document.querySelectorAll('[data-card-id]');
                        const printWindow = window.open('', '', 'width=1400,height=1000');
                        if (printWindow) {
                          let html = `
                            <!DOCTYPE html>
                            <html>
                              <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>AUSDAV ID Cards - Bulk Print</title>
                                <script src="https://cdn.tailwindcss.com"></script>
                                <style>
                                  * {
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                  }
                                  body {
                                    margin: 0;
                                    padding: 20px;
                                    background: white;
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                  }
                                  .cards-grid {
                                    display: grid;
                                    grid-template-columns: repeat(2, 1fr);
                                    gap: 24px;
                                    max-width: 100%;
                                  }
                                  .card-wrapper {
                                    display: flex;
                                    flex-direction: column;
                                    gap: 12px;
                                  }
                                  .card-title {
                                    padding: 8px;
                                    font-size: 13px;
                                    font-weight: 600;
                                  }
                                  .card-title-name {
                                    font-size: 14px;
                                    font-weight: 500;
                                  }
                                  .card-title-info {
                                    font-size: 11px;
                                    color: #666;
                                  }
                                  .id-card {
                                    width: 340px;
                                    height: 214px;
                                    border-radius: 8px;
                                    box-shadow: 0 4px 6px rgba(0,0,0,0.15);
                                    overflow: hidden;
                                  }
                                  @media print {
                                    body {
                                      padding: 10mm;
                                    }
                                    .cards-grid {
                                      grid-template-columns: repeat(2, 1fr);
                                      gap: 15mm;
                                    }
                                    .id-card {
                                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                                    }
                                    @page {
                                      size: A4;
                                      margin: 10mm;
                                    }
                                  }
                                </style>
                              </head>
                              <body>
                                <div class="cards-grid">
                          `;
                          allElements.forEach(el => {
                            html += '<div class="card-wrapper">' + el.innerHTML + '</div>';
                          });
                          html += `
                                </div>
                              </body>
                            </html>
                          `;
                          printWindow.document.write(html);
                          printWindow.document.close();
                          setTimeout(() => printWindow.print(), 500);
                        }
                      }}
                      className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Print All Cards
                    </button>
                    <div className="ml-auto text-sm text-muted-foreground">
                      {bulkIdCardMembers.length} cards generated
                    </div>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                    {bulkIdCardMembers.map((member) => {
                      const cardData = idCardData.get(member.mem_id);
                      return (
                        <div key={member.mem_id} data-card-id={member.mem_id} className="flex flex-col gap-3">
                          {/* Card Title */}
                          <div className="px-2 py-1">
                            <div className="font-medium text-sm">{member.fullname}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {member.mem_id} | Batch: {member.batch}
                            </div>
                          </div>

                          {/* Front Card */}
                          <div style={{ width: '340px', height: '214px' }} className="rounded-lg overflow-hidden shadow-lg">
                            <div className="bg-gradient-to-b from-blue-700 to-blue-900 text-white h-full"
                                 style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                              <div className="px-4 py-2 flex items-center justify-between bg-blue-900/30 border-b border-blue-400/30">
                                <div className="flex-1">
                                  <div className="text-sm font-bold tracking-wide">ALL UNIVERSITY STUDENTS' DEVELOPMENT ASSOCIATION</div>
                                </div>
                                <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-white/95 p-0.5 shadow-md">
                                  <img src={AUSDAVLogo} alt="AUSDAV Logo" className="w-full h-full object-contain" />
                                </div>
                              </div>

                              <div className="flex-1 px-4 py-3 flex gap-3" style={{ minHeight: '0' }}>
                                <div className="flex flex-col items-center gap-1">
                                  <div className="w-20 h-24 rounded border-2 border-white/80 overflow-hidden bg-white/10 shadow-lg flex-shrink-0">
                                    {cardData?.profile ? (
                                      <img src={cardData.profile} alt={member.fullname} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[9px] text-white/50">
                                        No Photo
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex-1 flex flex-col justify-between">
                                  <div className="border-b border-white/30 pb-1.5">
                                    <div className="text-[7px] font-semibold opacity-75 tracking-wider">NAME</div>
                                    <div className="font-bold text-sm leading-tight truncate">{member.fullname}</div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                                    <div>
                                      <div className="text-[7px] font-semibold opacity-75 tracking-wider">MEMBER ID</div>
                                      <div className="font-bold text-[13px]">{member.mem_id}</div>
                                    </div>
                                    <div>
                                      <div className="text-[7px] font-semibold opacity-75 tracking-wider">BATCH</div>
                                      <div className="font-bold text-[13px]">{member.batch}</div>
                                    </div>
                                    <div>
                                      <div className="text-[7px] font-semibold opacity-75 tracking-wider">GENDER</div>
                                      <div className="font-bold text-[11px]">{member.gender ? 'Male' : 'Female'}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="px-4 py-2 bg-blue-900/40 border-t border-blue-400/30 text-center">
                                <div className="text-[8px] opacity-80 leading-tight">Valid for Membership Verification</div>
                              </div>
                            </div>
                          </div>

                          {/* Back Card */}
                          <div style={{ width: '340px', height: '214px' }} className="rounded-xl overflow-hidden shadow-lg">
                            <div className="bg-white text-gray-900 h-full"
                                 style={{ border: '2px solid #1e40af', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                              <div className="text-center pb-2 border-b border-blue-600" style={{ height: '28px' }}>
                                <div className="text-xs font-bold text-blue-600 leading-tight">AUSDAV MEMBERSHIP</div>
                                <div className="text-[8px] text-gray-600 leading-tight truncate px-1 min-h-[12px]">
                                  {member.university && member.university.trim() !== '' 
                                    ? member.university 
                                    : 'No University'}
                                </div>
                              </div>

                              <div className="flex-1 flex gap-2 py-2 overflow-hidden">
                                <div style={{ width: '65px', height: '65px', flexShrink: 0 }}>
                                  {cardData?.qr ? (
                                    <img src={cardData.qr} alt="QR Code" className="w-full h-full rounded bg-white p-0.5 border border-gray-300 object-contain" />
                                  ) : (
                                    <div className="w-full h-full rounded bg-gray-100 flex items-center justify-center text-[7px] text-gray-500">
                                      Loading...
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 grid grid-cols-2 gap-1 text-[8px]">
                                  <div>
                                    <div className="font-bold text-blue-600 leading-tight">
                                      {member.designation && member.designation !== 'none' ? 'Designation' : 'ID'}
                                    </div>
                                    <div className="text-gray-700 leading-tight capitalize">
                                      {member.designation && member.designation !== 'none' 
                                        ? member.designation 
                                        : member.mem_id}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="font-bold text-blue-600 leading-tight">Batch</div>
                                    <div className="text-gray-700 leading-tight">{member.batch}</div>
                                  </div>
                                  <div className="col-span-2">
                                    <div className="font-bold text-blue-600 leading-tight">School</div>
                                    <div className="text-gray-700 leading-tight capitalize">{member.school}</div>
                                  </div>
                                  <div className="col-span-2">
                                    <div className="font-bold text-blue-600 leading-tight">NIC</div>
                                    <div className="text-gray-700 font-mono text-[7px] leading-tight">{member.nic}</div>
                                  </div>
                                </div>
                              </div>

                              <div className="text-center text-[7px] text-gray-500 border-t border-blue-600 pt-1 leading-tight">
                                <div>Issued: {new Date().toLocaleDateString()}</div>
                                <div>For verification only</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3 print:hidden">
                    <button
                      onClick={() => setSelectedMember(null)}
                      className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
                    >
                      ← Back to Search
                    </button>
                    <button
                      onClick={() => setViewMode('front')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        viewMode === 'front'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <Eye className="h-4 w-4" />
                      Front
                    </button>
                    <button
                      onClick={() => setViewMode('back')}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                        viewMode === 'back'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      <Eye className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm transition-colors flex items-center gap-2 ml-auto"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                  </div>

                  {/* ID Card Container */}
                  <div ref={printRef} className="flex justify-center print:p-0">
                    <div className="w-full max-w-md print:flex print:gap-8 print:flex-wrap print:items-flex-start print:justify-center">
                      {/* Front Card */}
                      <div className={`${viewMode === 'front' ? 'block' : 'hidden'} print:block`}
                           style={{ width: '340px', height: '214px' }}>
                        <div className="bg-gradient-to-b from-blue-700 to-blue-900 rounded-lg shadow-2xl text-white overflow-hidden h-full"
                             style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                          <div className="px-4 py-2 flex items-center justify-between bg-blue-900/30 border-b border-blue-400/30">
                            <div className="flex-1">
                              <div className="text-sm font-bold tracking-wide">ALL UNIVERSITY STUDENTS' DEVELOPMENT ASSOCIATION</div>
                            </div>
                            <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-white/95 p-0.5 shadow-md">
                              <img src={AUSDAVLogo} alt="AUSDAV Logo" className="w-full h-full object-contain" />
                            </div>
                          </div>

                          <div className="flex-1 px-4 py-3 flex gap-3" style={{ minHeight: '0' }}>
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-20 h-24 rounded border-2 border-white/80 overflow-hidden bg-white/10 shadow-lg flex-shrink-0">
                                {profileImage ? (
                                  <img src={profileImage} alt={selectedMember.fullname} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-white/50">
                                    No Photo
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex-1 flex flex-col justify-between">
                              <div className="border-b border-white/30 pb-1.5">
                                <div className="text-[7px] font-semibold opacity-75 tracking-wider">NAME</div>
                                <div className="font-bold text-sm leading-tight truncate">{selectedMember.fullname}</div>
                              </div>

                              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                                <div>
                                  <div className="text-[7px] font-semibold opacity-75 tracking-wider">MEMBER ID</div>
                                  <div className="font-bold text-[13px]">{selectedMember.mem_id}</div>
                                </div>
                                <div>
                                  <div className="text-[7px] font-semibold opacity-75 tracking-wider">BATCH</div>
                                  <div className="font-bold text-[13px]">{selectedMember.batch}</div>
                                </div>
                                <div>
                                  <div className="text-[7px] font-semibold opacity-75 tracking-wider">GENDER</div>
                                  <div className="font-bold text-[11px]">{selectedMember.gender ? 'Male' : 'Female'}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="px-4 py-2 bg-blue-900/40 border-t border-blue-400/30 text-center">
                            <div className="text-[8px] opacity-80 leading-tight">Valid for Membership Verification</div>
                          </div>
                        </div>
                      </div>

                      {/* Back Card */}
                      <div className={`${viewMode === 'back' ? 'block' : 'hidden'} print:block`}
                           style={{ width: '340px', height: '214px' }}>
                        <div className="bg-white rounded-xl shadow-2xl text-gray-900 h-full"
                             style={{ border: '2px solid #1e40af', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
                          <div className="text-center pb-2 border-b border-blue-600" style={{ height: '28px' }}>
                            <div className="text-xs font-bold text-blue-600 leading-tight">AUSDAV MEMBERSHIP</div>
                            <div className="text-[8px] text-gray-600 leading-tight truncate px-1 min-h-[12px]">
                              {selectedMember.university && selectedMember.university.trim() !== '' 
                                ? selectedMember.university 
                                : 'No University'}
                            </div>
                          </div>

                          <div className="flex-1 flex gap-2 py-2 overflow-hidden">
                            <div style={{ width: '65px', height: '65px', flexShrink: 0 }}>
                              {isGeneratingQR ? (
                                <div className="w-full h-full rounded bg-gray-200 flex items-center justify-center">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                </div>
                              ) : qrImage ? (
                                <img src={qrImage} alt="QR Code" className="w-full h-full rounded bg-white p-0.5 border border-gray-300 object-contain" />
                              ) : (
                                <div className="w-full h-full rounded bg-gray-100 flex items-center justify-center text-[7px] text-gray-500">
                                  QR
                                </div>
                              )}
                            </div>

                            <div className="flex-1 grid grid-cols-2 gap-1 text-[8px]">
                              <div>
                                <div className="font-bold text-blue-600 leading-tight">
                                  {selectedMember.designation && selectedMember.designation !== 'none' ? 'Designation' : 'ID'}
                                </div>
                                <div className="text-gray-700 leading-tight capitalize">
                                  {selectedMember.designation && selectedMember.designation !== 'none' 
                                    ? selectedMember.designation 
                                    : selectedMember.mem_id}
                                </div>
                              </div>
                              <div>
                                <div className="font-bold text-blue-600 leading-tight">Batch</div>
                                <div className="text-gray-700 leading-tight">{selectedMember.batch}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="font-bold text-blue-600 leading-tight">School</div>
                                <div className="text-gray-700 leading-tight capitalize">{selectedMember.school}</div>
                              </div>
                              <div className="col-span-2">
                                <div className="font-bold text-blue-600 leading-tight">NIC</div>
                                <div className="text-gray-700 font-mono text-[7px] leading-tight">{selectedMember.nic}</div>
                              </div>
                            </div>
                          </div>

                          <div className="text-center text-[7px] text-gray-500 border-t border-blue-600 pt-1 leading-tight">
                            <div>Issued: {new Date().toLocaleDateString()}</div>
                            <div>For verification only</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print Styles */}
                  <style>{`
                    @media print {
                      body {
                        background: white;
                      }
                      * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      aside,
                      nav,
                      .sidebar,
                      .navbar,
                      header,
                      footer {
                        display: none !important;
                      }
                    }
                  `}</style>
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
