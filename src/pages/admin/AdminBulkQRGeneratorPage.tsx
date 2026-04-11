import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

interface MemberDetails {
  mem_id: number;
  fullname: string;
  batch?: number;
  role: string;
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

export default function AdminBulkQRGeneratorPage() {
  const { isMasterAdmin } = useAdminAuth();
  const { toast } = useToast();

  // States
  const [members, setMembers] = useState<MemberDetails[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
  const [qrExpiryDays, setQRExpiryDays] = useState(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [deleteInactiveCount, setDeleteInactiveCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingMemberId, setGeneratingMemberId] = useState<number | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

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
        .select('mem_id, fullname, batch, role')
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

  // Get unique batches
  const uniqueBatches = useMemo(() => {
    const batches = members
      .map(m => m.batch)
      .filter((b): b is number => b !== undefined && b !== null);
    return [...new Set(batches)].sort((a, b) => a - b);
  }, [members]);

  // Filter members based on selected batches
  const filteredMembers = useMemo(() => {
    if (selectedBatches.length === 0) return [];
    return members.filter(m => selectedBatches.includes(m.batch || 0));
  }, [members, selectedBatches]);

  // Toggle batch selection
  const toggleBatch = (batch: number) => {
    setSelectedBatches(prev => 
      prev.includes(batch) 
        ? prev.filter(b => b !== batch)
        : [...prev, batch]
    );
  };

  // Select all batches
  const selectAllBatches = () => {
    setSelectedBatches(uniqueBatches);
  };

  // Deselect all batches
  const deselectAllBatches = () => {
    setSelectedBatches([]);
  };

  // Generate QR codes for filtered members
  const handleBulkGenerateQR = async () => {
    if (filteredMembers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select at least one batch',
      });
      return;
    }

    if (!window.confirm(`Generate QR codes for ${filteredMembers.length} members? This will delete any existing active QRs for these members.`)) {
      return;
    }

    setIsGenerating(true);
    let successCount = 0;
    let errorCount = 0;

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
        } catch (err: any) {
          console.error(`Error generating QR for ${member.fullname}:`, err);
          errorCount++;
        }
      }

      setGeneratedCount(successCount);
      toast({
        title: 'Bulk Generation Complete',
        description: `✅ Generated ${successCount} QR codes${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
      });

      // Refresh QR codes list
      await fetchQRCodes();
    } catch (err: any) {
      console.error('Error during bulk generation:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to generate QR codes',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete all inactive QR codes
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
      // Delete inactive QR codes (where is_active is false OR is_expired_manually is true)
      let query = (supabase as any)
        .from('member_qr_codes')
        .delete();
      
      // Delete rows where is_active = false
      const { error } = await query
        .eq('is_active', false);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Deleted inactive QR codes`,
      });

      // Refresh QR codes
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

  // Download all selected QR codes as ZIP (simplified: just show download info)
  const handleDownloadQRs = async () => {
    if (filteredMembers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select at least one batch',
      });
      return;
    }

    toast({
      title: 'Info',
      description: `Download feature for ${filteredMembers.length} QR codes coming soon`,
    });
  };

  // Generate QR code for individual member
  const handleGenerateIndividualQR = async (member: MemberDetails) => {
    setGeneratingMemberId(member.mem_id);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + qrExpiryDays);

      await createQRCode({
        mem_id: member.mem_id,
        expires_at: expiryDate,
        member_name: member.fullname,
        member_batch: member.batch || 0,
      });

      toast({
        title: 'Success',
        description: `QR code generated for ${member.fullname}`,
      });

      // Refresh QR codes list
      await fetchQRCodes();
    } catch (err: any) {
      console.error(`Error generating QR for ${member.fullname}:`, err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to generate QR for ${member.fullname}`,
      });
    } finally {
      setGeneratingMemberId(null);
    }
  };

  // Delete QR code for individual member
  const handleDeleteIndividualQR = async (member: MemberDetails) => {
    const memberQR = qrCodes.find(qr => qr.mem_id === member.mem_id);
    if (!memberQR) {
      toast({
        title: 'Info',
        description: `No active QR code for ${member.fullname}`,
      });
      return;
    }

    if (!window.confirm(`Delete QR code for ${member.fullname}?`)) {
      return;
    }

    setDeletingMemberId(member.mem_id);
    try {
      const { error } = await (supabase as any)
        .from('member_qr_codes')
        .delete()
        .eq('id', memberQR.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `QR code deleted for ${member.fullname}`,
      });

      // Refresh QR codes list
      await fetchQRCodes();
    } catch (err: any) {
      console.error(`Error deleting QR for ${member.fullname}:`, err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to delete QR for ${member.fullname}`,
      });
    } finally {
      setDeletingMemberId(null);
    }
  };

  // Search and filter members
  const searchedMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(member =>
      member.fullname.toLowerCase().includes(query) ||
      member.mem_id.toString().includes(query) ||
      member.batch?.toString().includes(query)
    );
  }, [members, searchQuery]);

  if (!isMasterAdmin) {
    return (
      <div className="p-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-2">Only admins can access bulk QR generation.</p>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <AdminHeader
        title="Bulk QR Code Generator"
        breadcrumb="Admin / Bulk QR Generator"
      />

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
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
              {/* Quick Actions */}
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

              {/* Batch Grid */}
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

              {/* Member Preview */}
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

              {/* Action Buttons */}
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
                
                <button
                  onClick={handleDownloadQRs}
                  disabled={filteredMembers.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download QRs
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Status & Cleanup */}
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Database Cleanup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Generated Count */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">✅ Generated Today</p>
                  <p className="text-3xl font-bold text-emerald-400">{generatedCount}</p>
                </div>

                {/* Inactive QR Count */}
                <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">⏸️ Inactive QRs</p>
                  <p className="text-3xl font-bold text-orange-400">{deleteInactiveCount}</p>
                </div>

                {/* Delete Button */}
                <div className="flex items-end">
                  <button
                    onClick={handleDeleteInactiveQRs}
                    disabled={isDeleting || deleteInactiveCount === 0}
                    className="w-full px-4 py-3 bg-destructive/20 text-destructive hover:bg-destructive/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete Inactive
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">ℹ️ How it works:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Select one or more batches</li>
                    <li>Click "Generate QR" to create QR codes for all members in selected batches</li>
                    <li>Existing active QRs for those members will be automatically deleted</li>
                    <li>Click "Delete Inactive" to clean up deactivated QR codes from the database</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual QR Generator */}
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Individual QR Generator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Members List */}
              <div className="overflow-x-auto border border-border rounded-lg">
                <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-primary/40 scrollbar-track-muted/20">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold w-1/4">Member Name</th>
                        <th className="text-left p-3 font-semibold w-1/12">ID</th>
                        <th className="text-left p-3 font-semibold w-1/6">Batch</th>
                        <th className="text-left p-3 font-semibold w-1/6">Role</th>
                        <th className="text-left p-3 font-semibold w-1/6">QR Status</th>
                        <th className="text-right p-3 font-semibold w-1/4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center p-8 text-muted-foreground">
                            No members found
                          </td>
                        </tr>
                      ) : (
                        searchedMembers.map((member) => {
                          const memberQR = qrCodes.find(qr => qr.mem_id === member.mem_id);
                          const hasActiveQR = memberQR && memberQR.is_active;
                          return (
                            <tr key={member.mem_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="p-3 w-1/4 break-words">{member.fullname}</td>
                              <td className="p-3 w-1/12 text-muted-foreground">{member.mem_id}</td>
                              <td className="p-3 w-1/6">
                                <Badge variant="outline">Batch {member.batch || 0}</Badge>
                              </td>
                              <td className="p-3 w-1/6 text-xs">{member.role}</td>
                              <td className="p-3 w-1/6">
                                {hasActiveQR ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400">
                                    <Check className="h-3 w-3 mr-1" />
                                    Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    No QR
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 w-1/4">
                                <div className="flex justify-end gap-2">
                                  {!hasActiveQR ? (
                                    <button
                                      onClick={() => handleGenerateIndividualQR(member)}
                                      disabled={generatingMemberId === member.mem_id}
                                      className="px-3 py-1 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
                                    >
                                      {generatingMemberId === member.mem_id ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          <QrCode className="h-3 w-3" />
                                          Generate
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleGenerateIndividualQR(member)}
                                        disabled={generatingMemberId === member.mem_id}
                                        className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
                                        title="Regenerate QR code (old one will be deleted)"
                                      >
                                        {generatingMemberId === member.mem_id ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Generating...
                                          </>
                                        ) : (
                                          <>
                                            <QrCode className="h-3 w-3" />
                                            Regenerate
                                          </>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => handleDeleteIndividualQR(member)}
                                        disabled={deletingMemberId === member.mem_id}
                                        className="px-3 py-1 text-xs bg-destructive/20 text-destructive hover:bg-destructive/30 disabled:opacity-50 rounded transition-colors flex items-center gap-1 whitespace-nowrap"
                                      >
                                        {deletingMemberId === member.mem_id ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Deleting...
                                          </>
                                        ) : (
                                          <>
                                            <Trash2 className="h-3 w-3" />
                                            Delete
                                          </>
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {searchedMembers.length === 0 && (
                  <div className="text-center p-8 text-muted-foreground">
                    No members found
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Showing {searchedMembers.length} of {members.length} members
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
