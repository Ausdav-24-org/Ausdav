import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Loader2,
  Printer,
  Download,
  Eye,
  Users,
  QrCode,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateQRImage, createQRCode } from '@/services/memberQRService';
import AUSDAVLogo from '@/assets/logo/AUSDAV_llogo.png';

interface MemberData {
  mem_id: number;
  fullname: string;
  nic: string;
  batch: number;
  gender: boolean; // true = Male, false = Female
  role: string;
  profile_path?: string;
  profile_bucket?: string;
  university?: string;
  school?: string;
  designation?: string;
}

export default function AdminIDCardPage() {
  const { isMasterAdmin } = useAdminAuth();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<MemberData[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrImage, setQRImage] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [view, setView] = useState<'front' | 'back'>('front');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('members')
        .select('mem_id, fullname, nic, batch, gender, role, profile_path, profile_bucket, university, school, designation')
        .order('fullname', { ascending: true })
        .limit(500);

      if (error) {
        console.error('Fetch error:', error);
        throw error;
      }
      
      console.log('Members fetched:', data);
      if (data && data.length > 0) {
        console.log('First member:', data[0]); // Show first member
      }
      
      setMembers((data as MemberData[]) || []);
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

  const handleMemberSelect = async (member: MemberData) => {
    console.log('Selected member data:', member);
    console.log('Member university:', member.university);
    setSelectedMember(member);
    setSearchQuery('');
    
    // Generate QR code
    await generateQRForMember(member);
    
    // Load profile image
    await loadProfileImage(member);
  };

  const generateQRForMember = async (member: MemberData) => {
    setIsGeneratingQR(true);
    try {
      // First, create the QR code in database (this handles deletion of old active QR)
      const qrRecord = await createQRCode({
        mem_id: member.mem_id,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
        member_name: member.fullname,
        member_batch: member.batch,
      });

      // Generate QR image with the actual token from database
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

  const loadProfileImage = async (member: MemberData) => {
    if (!member.profile_path || !member.profile_bucket) {
      setProfileImage(null);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(member.profile_bucket)
        .createSignedUrl(member.profile_path, 3600); // 1 hour validity
      
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

  const filteredMembers = searchQuery.trim() === '' 
    ? [] 
    : members.filter(m =>
        m.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.mem_id.toString().includes(searchQuery) ||
        m.nic.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handlePrint = () => {
    window.print();
  };

  if (!isMasterAdmin) {
    return (
      <div className="p-8">
        <h3 className="text-lg font-medium">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-2">Only Master Admin can access ID card generation.</p>
      </div>
    );
  }

  return (
    <div className="admin-container print:p-0">
      <AdminHeader
        title="ID Card Generator"
        breadcrumb="Admin / ID Card Generator"
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
          className="mt-6 space-y-6 print:space-y-0"
        >
          {!selectedMember ? (
            // Member Selection
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Select Member
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, or NIC..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>

                {searchQuery.trim() === '' ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Start typing to search for a member...</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No members found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredMembers.map((member) => (
                      <button
                        key={member.mem_id}
                        onClick={() => handleMemberSelect(member)}
                        className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                      >
                        <div className="font-medium text-sm group-hover:text-primary transition-colors">
                          {member.fullname}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          ID: {member.mem_id} | Batch: {member.batch} | {member.gender ? 'Male' : 'Female'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            // ID Card Display
            <div className="space-y-4">
              {/* Controls */}
              <div className="flex flex-wrap gap-3 print:hidden">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm transition-colors"
                >
                  ← Back to Search
                </button>
                <button
                  onClick={() => setView('front')}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    view === 'front'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Front
                </button>
                <button
                  onClick={() => setView('back')}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    view === 'back'
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
                  {/* FRONT OF ID CARD - Professional Format */}
                  <div className={`${view === 'front' ? 'block' : 'hidden'} print:block`}
                       style={{
                         width: '340px',
                         height: '214px',
                         aspectRatio: '1.586',
                       }}
                  >
                    <div className="bg-gradient-to-b from-blue-700 to-blue-900 rounded-lg shadow-2xl text-white overflow-hidden h-full"
                         style={{
                           width: '100%',
                           height: '100%',
                           display: 'flex',
                           flexDirection: 'column',
                           boxSizing: 'border-box'
                         }}
                    >
                      {/* TOP HEADER SECTION */}
                      <div className="px-4 py-2 flex items-center justify-between bg-blue-900/30 border-b border-blue-400/30">
                        <div className="flex-1">
                          <div className="text-sm font-bold tracking-wide">ALL UNIVERSITY STUDENTS' DEVELOPMENT ASSOCIATION</div>
    
                        </div>
                        <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-white/95 p-0.5 shadow-md">
                          <img 
                            src={AUSDAVLogo} 
                            alt="AUSDAV Logo" 
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>

                      {/* MAIN CONTENT AREA */}
                      <div className="flex-1 px-4 py-3 flex gap-3" style={{ minHeight: '0' }}>
                        {/* PHOTO SECTION - Left Side */}
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-20 h-24 rounded border-2 border-white/80 overflow-hidden bg-white/10 shadow-lg flex-shrink-0">
                            {profileImage ? (
                              <img
                                src={profileImage}
                                alt={selectedMember.fullname}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-white/50">
                                No Photo
                              </div>
                            )}
                          </div>
                        </div>

                        {/* INFO SECTION - Right Side */}
                        <div className="flex-1 flex flex-col justify-between">
                          {/* Name Section */}
                          <div className="border-b border-white/30 pb-1.5">
                            <div className="text-[7px] font-semibold opacity-75 tracking-wider">NAME</div>
                            <div className="font-bold text-sm leading-tight truncate">{selectedMember.fullname}</div>
                          </div>

                          {/* Main Info Grid */}
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

                      {/* FOOTER SECTION */}
                      <div className="px-4 py-2 bg-blue-900/40 border-t border-blue-400/30 text-center">
                        <div className="text-[8px] opacity-80 leading-tight">Valid for Membership Verification</div>
                      </div>
                    </div>
                  </div>

                  {/* BACK OF ID CARD */}
                  <div className={`${view === 'back' ? 'block' : 'hidden'} print:block`}
                       style={{
                         width: '340px',
                         height: '214px',
                         aspectRatio: '1.586',
                       }}
                  >
                    <div className="bg-white rounded-xl shadow-2xl text-gray-900 h-full"
                         style={{
                           width: '100%',
                           height: '100%',
                           border: '2px solid #1e40af',
                           padding: '10px',
                           boxSizing: 'border-box',
                           display: 'flex',
                           flexDirection: 'column'
                         }}
                    >
                      {/* Header - Compact */}
                      <div className="text-center pb-2 border-b border-blue-600" style={{ height: '28px' }}>
                        <div className="text-xs font-bold text-blue-600 leading-tight">AUSDAV MEMBERSHIP</div>
                        <div className="text-[8px] text-gray-600 leading-tight truncate px-1 min-h-[12px]">
                          {selectedMember?.university && selectedMember.university.trim() !== '' 
                            ? selectedMember.university 
                            : 'No University'}
                        </div>
                      </div>

                      {/* Content Row - QR + Details */}
                      <div className="flex-1 flex gap-2 py-2 overflow-hidden">
                        {/* QR Code - Fixed Size */}
                        <div style={{ width: '65px', height: '65px', flexShrink: 0 }}>
                          {isGeneratingQR ? (
                            <div className="w-full h-full rounded bg-gray-200 flex items-center justify-center">
                              <Loader2 className="h-3 w-3 animate-spin" />
                            </div>
                          ) : qrImage ? (
                            <img
                              src={qrImage}
                              alt="QR Code"
                              className="w-full h-full rounded bg-white p-0.5 border border-gray-300 object-contain"
                            />
                          ) : (
                            <div className="w-full h-full rounded bg-gray-100 flex items-center justify-center text-[7px] text-gray-500">
                              QR
                            </div>
                          )}
                        </div>

                        {/* Details Grid - Compact */}
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

                      {/* Footer - Compact */}
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
    </div>
  );
}
