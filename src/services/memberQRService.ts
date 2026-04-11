import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

export interface GenerateQRCodeInput {
  mem_id: number;
  expires_at: Date;
  member_name: string;
  member_batch: number;
}

export interface QRCodeRecord {
  id: string;
  mem_id: number;
  qr_token: string;
  generated_at: string;
  expires_at: string;
  is_active: boolean;
  is_expired_manually: boolean;
  scanned_count: number;
  last_scanned_at?: string;
}

/**
 * Generate a unique verification token for QR code
 */
function generateQRToken(): string {
  return `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate QR code image as data URL
 */
export async function generateQRImage(qrToken: string, memberName: string): Promise<string> {
  try {
    // Construct verification URL with query parameter (safer for URL encoding)
    const verificationUrl = `${window.location.origin}/verify-member?token=${encodeURIComponent(qrToken)}`;
    
    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    
    return dataUrl;
  } catch (err) {
    console.error('Failed to generate QR image:', err);
    throw new Error('Failed to generate QR code image');
  }
}

/**
 * Create a new QR code in database
 */
export async function createQRCode(input: GenerateQRCodeInput): Promise<QRCodeRecord> {
  try {
    const qrToken = generateQRToken();
    
    // Get current user to know who generated this
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // Get member details
    const { data: memberData, error: memberError } = await (supabase as any)
      .from('members')
      .select('mem_id,fullname,batch,nic,gender,profile_path,profile_bucket')
      .eq('mem_id', input.mem_id)
      .single();
    
    if (memberError || !memberData) {
      console.error('Member fetch error:', memberError);
      throw new Error('Member not found');
    }

    console.log('Member data fetched:', memberData);

    // Check if member already has an active QR code
    const { data: existingQR, error: existingError } = await (supabase as any)
      .from('member_qr_codes')
      .select('id, qr_token, is_active')
      .eq('mem_id', input.mem_id)
      .eq('is_active', true)
      .eq('is_expired_manually', false)
      .maybeSingle();

    // If an active QR exists, delete it before creating new one
    if (existingQR && !existingError) {
      console.log('Deleting existing QR:', existingQR.qr_token);
      const { error: deleteError } = await (supabase as any)
        .from('member_qr_codes')
        .delete()
        .eq('id', existingQR.id);
      
      if (deleteError) {
        console.error('Error deleting existing QR:', deleteError);
        throw new Error('Failed to delete existing QR code');
      }
    }

    // Prepare QR data (what gets encoded in the QR code)
    const qrData = {
      token: qrToken,
      mem_id: input.mem_id,
      fullname: input.member_name || memberData.fullname,
      batch: input.member_batch || memberData.batch,
      nic: memberData.nic,
      gender: memberData.gender,
      profile_path: memberData.profile_path,
      profile_bucket: memberData.profile_bucket,
      generated_at: new Date().toISOString(),
      expires_at: input.expires_at.toISOString(),
    };
    console.log('QR data to store:', qrData);

    // Create QR code in database
    const { data, error } = await (supabase as any)
      .from('member_qr_codes')
      .insert({
        mem_id: input.mem_id,
        qr_token: qrToken,
        qr_data: qrData,
        generated_by: user.id,
        expires_at: input.expires_at.toISOString(),
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error:', error);
      throw new Error(error.message || 'Failed to create QR code');
    }

    return data as QRCodeRecord;
  } catch (err) {
    console.error('Error creating QR code:', err);
    throw err;
  }
}

/**
 * Fetch all QR codes for a member
 */
export async function getQRCodesForMember(mem_id: number): Promise<QRCodeRecord[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('member_qr_codes')
      .select('*')
      .eq('mem_id', mem_id)
      .order('generated_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as QRCodeRecord[];
  } catch (err) {
    console.error('Error fetching QR codes:', err);
    return [];
  }
}

/**
 * Fetch all active QR codes (admin view)
 */
export async function getAllQRCodes(limit: number = 100): Promise<QRCodeRecord[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('member_qr_codes')
      .select('*')
      .eq('is_active', true)
      .eq('is_expired_manually', false)
      .order('generated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return (data || []) as QRCodeRecord[];
  } catch (err) {
    console.error('Error fetching QR codes:', err);
    return [];
  }
}

/**
 * Fetch all QR codes including inactive ones (for admin dashboard/bulk operations)
 */
export async function getAllQRCodesIncludingInactive(limit: number = 1000): Promise<QRCodeRecord[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('member_qr_codes')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return (data || []) as QRCodeRecord[];
  } catch (err) {
    console.error('Error fetching all QR codes:', err);
    return [];
  }
}

/**
 * Manually expire a QR code (admin action)
 */
export async function expireQRCode(qr_code_id: string): Promise<void> {
  try {
    // Delete the QR code entirely from database
    const { error } = await (supabase as any)
      .from('member_qr_codes')
      .delete()
      .eq('id', qr_code_id);
    
    if (error) throw error;
    console.log('QR code deleted successfully:', qr_code_id);
  } catch (err) {
    console.error('Error deleting QR code:', err);
    throw err;
  }
}

/**
 * Deactivate a QR code (without manually expiring)
 */
export async function deactivateQRCode(qr_code_id: string): Promise<QRCodeRecord> {
  try {
    const { data, error } = await (supabase as any)
      .from('member_qr_codes')
      .update({
        is_active: false,
      })
      .eq('id', qr_code_id)
      .select()
      .single();
    
    if (error) throw error;
    return data as QRCodeRecord;
  } catch (err) {
    console.error('Error deactivating QR code:', err);
    throw err;
  }
}

/**
 * Get scan logs for a QR code
 */
export async function getQRCodeScanLogs(qr_code_id: string, limit: number = 50) {
  try {
    const { data, error } = await (supabase as any)
      .from('member_qr_scan_logs')
      .select('*')
      .eq('qr_code_id', qr_code_id)
      .order('scanned_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching scan logs:', err);
    return [];
  }
}

/**
 * Download QR code as PNG
 */
export async function downloadQRCodeAsImage(qrImageDataUrl: string, memberName: string) {
  try {
    const link = document.createElement('a');
    link.href = qrImageDataUrl;
    link.download = `${memberName}-AUSDAV-QR-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error downloading QR code:', err);
    throw new Error('Failed to download QR code');
  }
}

/**
 * Download QR code as PDF (with member details)
 */
export async function downloadQRCodeAsPDF(
  qrImageDataUrl: string,
  memberName: string,
  memberBatch: number,
  memberEmail: string
) {
  try {
    // Dynamically import jsPDF to avoid larger bundle
    const { jsPDF } = await import('jspdf');
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'A4',
    });

    // Add title
    pdf.setFontSize(16);
    pdf.text('AUSDAV Member Verification QR Code', 20, 20);

    // Add QR code image
    const qrSize = 100;
    const xCenter = (210 - qrSize) / 2;
    pdf.addImage(qrImageDataUrl, 'PNG', xCenter, 40, qrSize, qrSize);

    // Add member details
    pdf.setFontSize(12);
    pdf.text(`Name: ${memberName}`, 20, 150);
    pdf.text(`Batch: ${memberBatch}`, 20, 160);
    pdf.text(`Email: ${memberEmail}`, 20, 170);
    pdf.text('Scan this QR code to verify membership', 20, 185);

    // Save PDF
    pdf.save(`${memberName}-AUSDAV-QR.pdf`);
  } catch (err) {
    console.error('Error downloading QR code as PDF:', err);
    throw new Error('Failed to download QR code as PDF');
  }
}
