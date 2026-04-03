import { useEffect, useState } from 'react';
import {
  Download,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  MoreVertical,
  Phone,
  Users,
  FileText,
  Upload,
  Calendar,
  Hash,
  Image,
} from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
interface AdminContact {
  id: number;
  contact_type: 'contact' | 'patron';
  name: string;
  batch: number | null;
  contact_no: string | null;
  patron_no: string | null;
  description: string | null;
  created_at: string;
}

interface AdminDocument {
  id: number;
  document_name: string;
  document_type: 'pdf' | 'word' | 'excel' | 'image';
  file_path: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export default function AdminDetailsPage() {
  const { isSuperAdmin } = useAdminAuth();
  const { toast } = useToast();

  // Contacts & Patrons state (unified)
  const [allContacts, setAllContacts] = useState<AdminContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showPatronDialog, setShowPatronDialog] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', batch: '', phone: '' });
  const [patronForm, setPatronForm] = useState({ name: '', no: '', phone: '' });
  const [editingContact, setEditingContact] = useState<AdminContact | null>(null);
  const [editingPatron, setEditingPatron] = useState<AdminContact | null>(null);

  // Documents state
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [selectedDocFile, setSelectedDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState('');
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Images state
  const [images, setImages] = useState<AdminDocument[]>([]);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState('');
  const [loadingImages, setLoadingImages] = useState(false);

  // Derived states
  const contacts = allContacts.filter(item => item.contact_type === 'contact');
  const patrons = allContacts.filter(item => item.contact_type === 'patron');
  const documents_filtered = documents.filter(item => item.document_type !== 'image');
  const images_filtered = documents.filter(item => item.document_type === 'image');

  // Load data on mount
  useEffect(() => {
    if (isSuperAdmin) {
      loadContacts();
      loadDocuments();
    }
  }, [isSuperAdmin]);

  // ===== CONTACTS & PATRONS FUNCTIONS (UNIFIED) =====
  const loadContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('admin_contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllContacts(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load contacts and patrons',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      if (editingContact) {
        // Update
        const { error } = await (supabase as any)
          .from('admin_contacts')
          .update({
            name: contactForm.name,
            batch: contactForm.batch ? parseInt(contactForm.batch) : null,
            contact_no: contactForm.phone || null,
          })
          .eq('id', editingContact.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Contact updated successfully' });
      } else {
        // Create
        const { error } = await (supabase as any)
          .from('admin_contacts')
          .insert({
            contact_type: 'contact',
            name: contactForm.name,
            batch: contactForm.batch ? parseInt(contactForm.batch) : null,
            contact_no: contactForm.phone || null,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Contact added successfully' });
      }

      setContactForm({ name: '', batch: '', phone: '' });
      setEditingContact(null);
      setShowContactDialog(false);
      await loadContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save contact',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;

    try {
      setLoading(true);
      const { error } = await (supabase as any)
        .from('admin_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Contact deleted successfully' });
      await loadContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contact',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const editContactItem = (contact: AdminContact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      batch: contact.batch?.toString() || '',
      phone: contact.contact_no || '',
    });
    setShowContactDialog(true);
  };

  const downloadContact = (contact: AdminContact) => {
    const fileName = `${contact.name}+${contact.batch || 'No Batch'}+Senior (Ausdav).txt`;
    const content = `Name: ${contact.name}\nBatch: ${contact.batch || 'N/A'}\nContact No: ${contact.contact_no || 'N/A'}\n\nAUSDAV`;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', fileName);
    element.click();
  };

  const savePatron = async () => {
    if (!patronForm.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      if (editingPatron) {
        // Update
        const { error } = await (supabase as any)
          .from('admin_contacts')
          .update({
            name: patronForm.name,
            patron_no: patronForm.no || null,
            contact_no: patronForm.phone || null,
          })
          .eq('id', editingPatron.id);

        if (error) throw error;
        toast({ title: 'Success', description: 'Patron updated successfully' });
      } else {
        // Create
        const { error } = await (supabase as any)
          .from('admin_contacts')
          .insert({
            contact_type: 'patron',
            name: patronForm.name,
            patron_no: patronForm.no || null,
            contact_no: patronForm.phone || null,
          });

        if (error) throw error;
        toast({ title: 'Success', description: 'Patron added successfully' });
      }

      setPatronForm({ name: '', no: '', phone: '' });
      setEditingPatron(null);
      setShowPatronDialog(false);
      await loadContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save patron',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deletePatron = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this patron?')) return;

    try {
      setLoading(true);
      const { error } = await (supabase as any)
        .from('admin_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Patron deleted successfully' });
      await loadContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete patron',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const editPatronItem = (patron: AdminContact) => {
    setEditingPatron(patron);
    setPatronForm({
      name: patron.name,
      no: patron.patron_no || '',
      phone: patron.contact_no || '',
    });
    setShowPatronDialog(true);
  };

  const downloadPatron = (patron: AdminContact) => {
    const fileName = `${patron.name}+Patron (Ausdav).txt`;
    const content = `Name: ${patron.name}\nPatron No: ${patron.patron_no || 'N/A'}\nDescription: ${patron.description || 'N/A'}\n\nAUSDAV`;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', fileName);
    element.click();
  };

  const downloadAllContacts = () => {
    if (contacts.length === 0) {
      toast({ title: 'Error', description: 'No contacts to download', variant: 'destructive' });
      return;
    }

    let content = '';
    contacts.forEach((contact, index) => {
      const formattedName = contact.batch 
        ? `${contact.name}_Anna(Ausdav_${contact.batch})` 
        : `${contact.name}_Anna(Ausdav)`;
      
      content += 'BEGIN:VCARD\n';
      content += 'VERSION:3.0\n';
      content += `FN:${formattedName}\n`;
      if (contact.contact_no) {
        content += `TEL:${contact.contact_no}\n`;
      }
      if (contact.batch) {
        content += `CATEGORIES:Batch ${contact.batch}\n`;
      }
      content += `UID:contact-${contact.id}-${Date.now()}@ausdav.org\n`;
      content += 'END:VCARD\n';
      if (index < contacts.length - 1) {
        content += '\n';
      }
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/vcard;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `Contacts_${new Date().toLocaleDateString()} (Ausdav).vcf`);
    element.click();

    toast({ title: 'Success', description: `Downloaded ${contacts.length} contacts as VCF` });
  };

  const downloadAllPatrons = () => {
    if (patrons.length === 0) {
      toast({ title: 'Error', description: 'No patrons to download', variant: 'destructive' });
      return;
    }

    let content = '';
    patrons.forEach((patron, index) => {
      const formattedName = `${patron.name}_Sir(Ausdav_patron)`;
      
      content += 'BEGIN:VCARD\n';
      content += 'VERSION:3.0\n';
      content += `FN:${formattedName}\n`;
      if (patron.patron_no) {
        content += `NOTE:Patron No - ${patron.patron_no}\n`;
      }
      if (patron.description) {
        content += `DESCRIPTION:${patron.description}\n`;
      }
      content += `UID:patron-${patron.id}-${Date.now()}@ausdav.org\n`;
      content += 'END:VCARD\n';
      if (index < patrons.length - 1) {
        content += '\n';
      }
    });

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/vcard;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `Patrons_${new Date().toLocaleDateString()} (Ausdav).vcf`);
    element.click();

    toast({ title: 'Success', description: `Downloaded ${patrons.length} patrons as VCF` });
  };

  // ===== DOCUMENTS FUNCTIONS =====
  const loadDocuments = async () => {
    try {
      setLoadingDocs(true);
      const { data, error } = await (supabase as any)
        .from('admin_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoadingDocs(false);
    }
  };

  const uploadDocument = async () => {
    if (!selectedDocFile || !docName.trim()) {
      toast({ title: 'Error', description: 'Please select a file and enter a name', variant: 'destructive' });
      return;
    }

    // Validate file type
    const fileName = selectedDocFile.name.toLowerCase();
    let docType: 'pdf' | 'word' | 'excel' | null = null;
    if (fileName.endsWith('.pdf')) docType = 'pdf';
    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) docType = 'word';
    else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) docType = 'excel';

    if (!docType) {
      toast({ title: 'Error', description: 'Please upload PDF, Word, or Excel file', variant: 'destructive' });
      return;
    }

    try {
      setLoadingDocs(true);
      // Upload to storage
      const filePath = `${Date.now()}-${selectedDocFile.name}`;
      const { error: uploadError } = await (supabase as any).storage
        .from('admin-documents')
        .upload(filePath, selectedDocFile);

      if (uploadError) throw uploadError;

      // Create database record
      const { error: dbError } = await (supabase as any)
        .from('admin_documents')
        .insert({
          document_name: docName,
          document_type: docType,
          file_path: filePath,
          file_size: selectedDocFile.size,
        });

      if (dbError) throw dbError;
      toast({ title: 'Success', description: 'Document uploaded successfully' });
      setDocName('');
      setSelectedDocFile(null);
      setShowDocDialog(false);
      await loadDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setLoadingDocs(false);
    }
  };

  const deleteDocument = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      setLoadingDocs(true);
      const { error } = await (supabase as any)
        .from('admin_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Document deleted successfully' });
      await loadDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setLoadingDocs(false);
    }
  };

  const downloadDocument = async (doc: AdminDocument) => {
    try {
      const { data, error } = await (supabase as any).storage
        .from('admin-documents')
        .download(doc.file_path);

      if (error) throw error;
      const url = URL.createObjectURL(data);
      const element = document.createElement('a');
      element.setAttribute('href', url);
      element.setAttribute('download', doc.document_name);
      element.click();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to download document',
        variant: 'destructive',
      });
    }
  };

  const uploadImage = async () => {
    if (!selectedImageFile || !imageName.trim()) {
      toast({ title: 'Error', description: 'Please select a file and enter a name', variant: 'destructive' });
      return;
    }

    // Validate file type - allow all common image formats
    const fileName = selectedImageFile.name.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff'];
    const isValidImage = imageExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidImage) {
      toast({ title: 'Error', description: 'Please upload a valid image file (JPG, PNG, GIF, WEBP, SVG, BMP, ICO, TIFF)', variant: 'destructive' });
      return;
    }

    try {
      setLoadingImages(true);
      // Upload to storage
      const filePath = `images/${Date.now()}-${selectedImageFile.name}`;
      const { error: uploadError } = await (supabase as any).storage
        .from('admin-documents')
        .upload(filePath, selectedImageFile);

      if (uploadError) throw uploadError;

      // Create database record
      const { error: dbError } = await (supabase as any)
        .from('admin_documents')
        .insert({
          document_name: imageName,
          document_type: 'image',
          file_path: filePath,
          file_size: selectedImageFile.size,
        });

      if (dbError) throw dbError;
      toast({ title: 'Success', description: 'Image uploaded successfully' });
      setImageName('');
      setSelectedImageFile(null);
      setShowImageDialog(false);
      await loadDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setLoadingImages(false);
    }
  };

  const deleteImage = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    try {
      setLoadingImages(true);
      const { error } = await (supabase as any)
        .from('admin_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Success', description: 'Image deleted successfully' });
      await loadDocuments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete image',
        variant: 'destructive',
      });
    } finally {
      setLoadingImages(false);
    }
  };

  const downloadImage = async (img: AdminDocument) => {
    try {
      const { data, error } = await (supabase as any).storage
        .from('admin-documents')
        .download(img.file_path);

      if (error) throw error;
      const url = URL.createObjectURL(data);
      const element = document.createElement('a');
      element.setAttribute('href', url);
      element.setAttribute('download', img.document_name);
      element.click();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to download image',
        variant: 'destructive',
      });
    }
  };

  // ===== UI RENDER =====
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 min-h-screen">
      <div className="space-y-4">
        <AdminHeader title="Admin Details Management" />

        {/* Documents Card */}
        <Card className="shadow-md">
          <CardHeader className="px-4 md:px-6 py-3 md:py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <FileText className="w-5 h-5 flex-shrink-0" />
                <span>Important Documents</span>
              </CardTitle>
              <Button
                onClick={() => {
                  setDocName('');
                  setSelectedDocFile(null);
                  setShowDocDialog(true);
                }}
                size="sm"
                className="w-full sm:w-auto"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Upload Document</span>
                <span className="sm:hidden">Upload</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 md:px-6 py-3 md:py-4">
            {loadingDocs ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : documents_filtered.length === 0 ? (
              <p className="text-center text-gray-300 py-8 text-sm md:text-base">No documents yet</p>
            ) : (
              <div className="space-y-2 md:space-y-3">
                {documents_filtered.map(doc => (
                  <div key={doc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-700 rounded-lg gap-2 sm:gap-3 hover:bg-slate-600 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-white">{doc.document_name}</p>
                    <p className="text-sm text-gray-300">
                      Type: {doc.document_type} • Size: {doc.file_size ? (doc.file_size / 1024).toFixed(2) : 'N/A'} KB
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteDocument(doc.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images Card */}
      <Card className="shadow-md">
        <CardHeader className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Image className="w-5 h-5 flex-shrink-0" />
              <span>Important Images</span>
            </CardTitle>
            <Button
              onClick={() => {
                setImageName('');
                setSelectedImageFile(null);
                setShowImageDialog(true);
              }}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Upload Image</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6 py-3 md:py-4 max-h-96 overflow-y-auto">
          {loadingImages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : images_filtered.length === 0 ? (
            <p className="text-center text-gray-300 py-8 text-sm md:text-base">No images yet</p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {images_filtered.map(img => (
                <div key={img.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-slate-700 rounded-lg gap-2 sm:gap-3 hover:bg-slate-600 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-white">{img.document_name}</p>
                    <p className="text-sm text-gray-300">
                      Size: {img.file_size ? (img.file_size / 1024).toFixed(2) : 'N/A'} KB
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => downloadImage(img)}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => deleteImage(img.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contacts Card */}
      <Card className="shadow-md">
        <CardHeader className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Phone className="w-5 h-5 flex-shrink-0" />
              <span>Honoerable Contacts</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={downloadAllContacts}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Download All</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Button
                onClick={() => {
                  setEditingContact(null);
                  setContactForm({ name: '', batch: '', phone: '' });
                  setShowContactDialog(true);
                }}
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Add Contact</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6 py-3 md:py-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-center text-gray-300 py-8">No contacts yet</p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {[...contacts].sort((a, b) => (b.batch || 0) - (a.batch || 0)).map(contact => (
                <div key={contact.id} className="group bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl border border-slate-700 shadow-sm hover:shadow-md hover:border-slate-600 transition-all duration-200 overflow-hidden">
                  {/* Header with name */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 md:px-5 py-3 md:py-4 flex justify-between items-start sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm md:text-base truncate">{contact.name}</h3>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="flex-shrink-0 text-white hover:bg-white/20">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => editContactItem(contact)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteContact(contact.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Details section */}
                  <div className="px-4 md:px-5 py-3 md:py-4 space-y-2 md:space-y-3">
                    {contact.batch && (
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-300">Batch</p>
                          <p className="font-semibold text-sm text-white">{contact.batch}</p>
                        </div>
                      </div>
                    )}
                    {contact.contact_no && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-300">Phone</p>
                          <p className="font-semibold text-sm text-white">{contact.contact_no}</p>
                        </div>
                      </div>
                    )}
                    {!contact.batch && !contact.contact_no && (
                      <p className="text-xs text-gray-500 italic">No additional details</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patrons Card */}
      <Card className="shadow-md">
        <CardHeader className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Users className="w-5 h-5 flex-shrink-0" />
              <span>Patrons Contacts</span>
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                onClick={downloadAllPatrons}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Download className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Download All</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Button
                onClick={() => {
                  setEditingPatron(null);
                  setPatronForm({ name: '', no: '', phone: '' });
                  setShowPatronDialog(true);
                }}
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Add Contact</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 md:px-6 py-3 md:py-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : patrons.length === 0 ? (
            <p className="text-center text-gray-300 py-8 text-sm md:text-base">No patrons yet</p>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {patrons.map(patron => (
                <div key={patron.id} className="group bg-gradient-to-br from-slate-800 to-slate-700 rounded-xl border border-slate-700 shadow-sm hover:shadow-md hover:border-slate-600 transition-all duration-200 overflow-hidden">
                  {/* Header with name */}
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 md:px-5 py-3 md:py-4 flex justify-between items-start sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm md:text-base truncate">{patron.name}</h3>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="flex-shrink-0 text-white hover:bg-white/20">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => editPatronItem(patron)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deletePatron(patron.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Details section */}
                  <div className="px-4 md:px-5 py-3 md:py-4 space-y-2 md:space-y-3">
                    {patron.patron_no && (
                      <div className="flex items-center gap-3">
                        <Hash className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-300">Patron No</p>
                          <p className="font-semibold text-sm text-white">{patron.patron_no}</p>
                        </div>
                      </div>
                    )}
                    {patron.description && (
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-300">Description</p>
                          <p className="font-semibold text-sm text-white line-clamp-2">{patron.description}</p>
                        </div>
                      </div>
                    )}
                    {!patron.patron_no && !patron.description && (
                      <p className="text-xs text-gray-400 italic">No additional details</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Name *</label>
              <Input
                value={contactForm.name}
                onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Contact name"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Batch</label>
              <Input
                type="number"
                value={contactForm.batch}
                onChange={e => setContactForm({ ...contactForm, batch: e.target.value })}
                placeholder="e.g., 2024"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Phone</label>
              <Input
                value={contactForm.phone}
                onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="Phone number"
                className="text-sm"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowContactDialog(false)} className="w-full sm:w-auto text-sm">
                Cancel
              </Button>
              <Button onClick={saveContact} disabled={loading} className="w-full sm:w-auto text-sm">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patron Dialog */}
      <Dialog open={showPatronDialog} onOpenChange={setShowPatronDialog}>
        <DialogContent className="w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">{editingPatron ? 'Edit Patron' : 'Add New Patron'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Name *</label>
              <Input
                value={patronForm.name}
                onChange={e => setPatronForm({ ...patronForm, name: e.target.value })}
                placeholder="Patron name"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Patron No</label>
              <Input
                value={patronForm.no}
                onChange={e => setPatronForm({ ...patronForm, no: e.target.value })}
                placeholder="e.g., P001"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Contact No</label>
              <Input
                value={patronForm.phone}
                onChange={e => setPatronForm({ ...patronForm, phone: e.target.value })}
                placeholder="Phone number"
                className="text-sm"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPatronDialog(false)} className="w-full sm:w-auto text-sm">
                Cancel
              </Button>
              <Button onClick={savePatron} disabled={loading} className="w-full sm:w-auto text-sm">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Upload Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent className="w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Document Name *</label>
              <Input
                value={docName}
                onChange={e => setDocName(e.target.value)}
                placeholder="e.g., Annual Report 2024"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Select File *</label>
              <Input
                type="file"
                accept=".pdf, .doc, .docx, .xls, .xlsx"
                onChange={e => setSelectedDocFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Supported: PDF, Word (.doc, .docx), Excel (.xls, .xlsx)</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDocDialog(false)} className="w-full sm:w-auto text-sm">
                Cancel
              </Button>
              <Button onClick={uploadDocument} disabled={loadingDocs} className="w-full sm:w-auto text-sm">
                {loadingDocs && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Upload Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="w-[95vw] md:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Upload Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 md:space-y-4">
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Image Name *</label>
              <Input
                value={imageName}
                onChange={e => setImageName(e.target.value)}
                placeholder="e.g., Event Photo 2024"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm font-medium mb-1">Select Image *</label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => setSelectedImageFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Supported: JPG, PNG, GIF, WEBP, SVG, BMP, ICO, TIFF</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowImageDialog(false)} className="w-full sm:w-auto text-sm">
                Cancel
              </Button>
              <Button onClick={uploadImage} disabled={loadingImages} className="w-full sm:w-auto text-sm">
                {loadingImages && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
