import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VerificationResult {
  verified: boolean;
  status: string;
  message: string;
  member?: {
    name: string;
    batch: number;
    nic?: string;
    gender?: string;
    photo_url?: string;
  };
  scanned_at?: string;
}

export default function VerifyMemberPage() {
  const [searchParams] = useSearchParams();
  const qr_token = searchParams.get('token');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyQRCode();
  }, [qr_token]);

  const verifyQRCode = async () => {
    if (!qr_token) {
      setError('Invalid QR code token');
      setLoading(false);
      return;
    }

    try {
      // Query Supabase directly for QR code verification
      const { data: qrData, error: qrError } = await (supabase as any)
        .from('member_qr_codes')
        .select(`
          id,
          mem_id,
          is_active,
          is_expired_manually,
          expires_at,
          scanned_count,
          qr_data
        `)
        .eq('qr_token', qr_token)
        .single();

      console.log('QR Token:', qr_token);
      console.log('QR Error:', qrError);
      console.log('QR Data:', qrData);

      if (qrError || !qrData) {
        const data: VerificationResult = {
          verified: false,
          status: 'not_found',
          message: 'QR code not found or invalid',
        };
        setResult(data);
        setError(`QR code not found or invalid. Error: ${qrError?.message || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      // Check if QR is manually expired
      if (qrData.is_expired_manually) {
        // Log the scan attempt
        await (supabase as any).from('member_qr_scan_logs').insert({
          qr_code_id: qrData.id,
          mem_id: qrData.mem_id,
          verification_status: 'expired',
        });

        const data: VerificationResult = {
          verified: false,
          status: 'expired',
          message: 'This QR code has been expired by admin',
        };
        setResult(data);
        setError('QR code expired');
        setLoading(false);
        return;
      }

      // Check if QR has natural expiry
      const now = new Date();
      const expiryDate = new Date(qrData.expires_at);
      if (now > expiryDate) {
        // Log the scan attempt
        await (supabase as any).from('member_qr_scan_logs').insert({
          qr_code_id: qrData.id,
          mem_id: qrData.mem_id,
          verification_status: 'expired',
        });

        const data: VerificationResult = {
          verified: false,
          status: 'date_expired',
          message: `QR code expired on ${expiryDate.toLocaleDateString()}`,
        };
        setResult(data);
        setError('QR code expired');
        setLoading(false);
        return;
      }

      // Check if QR is active
      if (!qrData.is_active) {
        await (supabase as any).from('member_qr_scan_logs').insert({
          qr_code_id: qrData.id,
          mem_id: qrData.mem_id,
          verification_status: 'inactive',
        });

        const data: VerificationResult = {
          verified: false,
          status: 'inactive',
          message: 'This QR code is currently inactive',
        };
        setResult(data);
        setError('QR code inactive');
        setLoading(false);
        return;
      }

      // Extract member info from qr_data JSONB
      const memberData = (qrData?.qr_data as any) || {};
      console.log('Member data from QR:', memberData);
      // Convert gender boolean to string (true=Male, false=Female)
      const genderText = memberData.gender === true ? 'Male' : memberData.gender === false ? 'Female' : 'N/A';
      const member = {
        name: memberData.fullname || 'Unknown',
        batch: memberData.batch || 0,
        nic: memberData.nic || 'N/A',
        gender: genderText,
        profile_path: memberData.profile_path,
        profile_bucket: memberData.profile_bucket,
      };
      console.log('Extracted member info:', member);

      // Get photo URL if exists
      let photoUrl: string | undefined;
      if (member?.profile_path) {
        try {
          const bucket = member.profile_bucket || 'member-profiles';
          const { data: signedUrl, error: urlError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(member.profile_path, 60 * 60); // 1 hour validity

          if (!urlError && signedUrl?.signedUrl) {
            photoUrl = signedUrl.signedUrl;
          }
        } catch (err) {
          console.error('Failed to generate photo URL:', err);
        }
      }

      const scannedAt = new Date().toISOString();

      // Log the successful scan
      await (supabase as any).from('member_qr_scan_logs').insert({
        qr_code_id: qrData.id,
        mem_id: qrData.mem_id,
        verification_status: 'verified',
      });

      // Update scan count and last_scanned_at
      await (supabase as any)
        .from('member_qr_codes')
        .update({
          scanned_count: (qrData.scanned_count || 0) + 1,
          last_scanned_at: scannedAt,
        })
        .eq('id', qrData.id);

      const data: VerificationResult = {
        verified: true,
        status: 'verified',
        message: `Verified! ${member.name} is a member of AUSDAV`,
        member: {
          name: member.name,
          batch: member.batch,
          nic: member.nic,
          gender: member.gender,
          photo_url: photoUrl,
        },
        scanned_at: scannedAt,
      };
      setResult(data);
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify QR code');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12">
        <div className="w-full max-w-md mx-auto px-4">
          <Card className="bg-card/50 border-border">
            <CardContent className="p-8 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-center text-muted-foreground">Verifying QR code...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="py-20 md:py-24">
      <div className="w-full max-w-md mx-auto px-4">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white">Member Verification</h1>
        </div>

        {/* Verification Result Card */}
        <Card className="border-2 border-border bg-card/40 backdrop-blur-sm">
          <CardContent className="p-8">
            

            {/* Main Message - Only show for errors */}
            {!result?.verified && (
              <p className="text-center text-lg font-medium mb-6 text-muted-foreground">
                {result?.message || error}
              </p>
            )}

            {/* Member Details (if verified) */}
            {result?.verified && result?.member && (
              <div className="space-y-4 mt-8 pt-6 border-t border-border">
                {/* Member Photo */}
                {result.member.photo_url && (
                  <div className="flex justify-center mb-6">
                    <img
                      src={result.member.photo_url}
                      alt={result.member.name}
                      className="h-40 w-40 rounded-full object-cover border-4 border-green-400"
                    />
                  </div>
                )}

                {/* Member Details */}
                <div className="bg-black/30 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-lg font-semibold">{result.member.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Batch</p>
                    <p className="text-lg font-semibold">{result.member.batch}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">NIC</p>
                    <p className="text-sm">{result.member.nic}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gender</p>
                    <p className="text-sm">{result.member.gender}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Details */}
            {!result?.verified && result?.status && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mt-6">
                <p className="text-sm">
                  <span className="font-semibold">Status: </span>
                  <span className="capitalize">{result.status.replace('_', ' ')}</span>
                </p>
              </div>
            )}

            {/* Info Box - Only show for errors */}
            {!result?.verified && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mt-6">
                <p className="text-xs text-muted-foreground text-center">
                  ℹ️ This QR code can be used to verify AUSDAV membership. 
                  Each scan is logged for security purposes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
