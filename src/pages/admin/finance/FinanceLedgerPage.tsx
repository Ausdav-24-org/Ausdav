import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DollarSign,
  Download,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  Upload,
  Plus,
  Pencil,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { compressImageBlob } from "@/lib/imageCompression";
import { Tables } from "@/integrations/supabase/types";

interface Transaction {
  fin_id: number;
  exp_type: "income" | "expense";
  party_role: "payer" | "payee";
  amount: number;
  txn_date: string | null;
  category: string;
  description: string;
  created_at: string;
  submitted_by: string | null;
  verified_by: string | null;
  creator_name?: string;
  photo_path: string | null;
  approved: boolean;
}

// categories will be pulled dynamically from the finance table
// so users can filter based on whatever events have been recorded.

// NOTE: allCategories is derived below using useMemo inside the component.

interface TransactionFormData {
  exp_type: "income" | "expense";
  party_role: "payer" | "payee";
  amount: string;
  txn_date: string;
  category: string;
  description: string;
}

const emptyFormData: TransactionFormData = {
  exp_type: "income",
  party_role: "payer",
  amount: "",
  txn_date: new Date().toISOString().split("T")[0],
  category: "",
  description: "",
};

// ✅ Receipt bucket (change if your storage bucket name is different)
const RECEIPT_BUCKET = "finance-photos";
const AUDIT_BUCKET = "audit-reports";
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;

export default function FinanceLedgerPage() {
  const { user, isSuperAdmin, isAdmin } = useAdminAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const allCategories = useMemo(
    () => ["All Categories", ...categories],
    [categories]
  );

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All Categories");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDescription, setFilterDescription] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditEventName, setAuditEventName] = useState("");
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());
  const [auditUploading, setAuditUploading] = useState(false);

  // Stats
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  // Add/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [formData, setFormData] = useState<TransactionFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);

  // ✅ NEW: Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(
    null
  );
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(
    null
  );
  const [existingReceiptLoading, setExistingReceiptLoading] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] =
    useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View Receipt modal state
  const [viewReceiptOpen, setViewReceiptOpen] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);
  const [loadingReceiptView, setLoadingReceiptView] = useState(false);

  const canEdit = isSuperAdmin || isAdmin;

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Cleanup: reset all loading states on unmount
  useEffect(() => {
    return () => {
      setSaving(false);
      setDeleting(false);
      setAuditUploading(false);
      setLoading(false);
      setLoadingReceiptView(false);
    };
  }, []);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Fetch only approved finance records for the ledger
      const { data, error } = await supabase
        .from("finance")
        .select("*")
        .eq("approved", true)
        .order("txn_date", { ascending: false });

      if (error) throw error;

      // pull distinct categories from returned rows
      const uniqueCats = [
        ...new Set((data || []).map((t: Tables<"finance">) => t.category))
      ].filter(Boolean) as string[];
      setCategories(uniqueCats);

      // pull distinct descriptions from returned rows
      const uniqueDescs = [
        ...new Set((data || []).map((t: Tables<"finance">) => t.description).filter(Boolean))
      ].filter(Boolean) as string[];
      setDescriptions(uniqueDescs);

      // Fetch creator names from members or profiles
      const submitterIds = [
        ...new Set(
          data
            ?.map((t: Tables<"finance">) => t.submitted_by || t.verified_by)
            .filter(Boolean)
        ),
      ];
      const { data: membersData } = await supabase
        .from("members")
        .select("auth_user_id, fullname")
        .in("auth_user_id", submitterIds as string[]);

      const transactionsWithNames = (data || []).map(
        (txn: Tables<"finance">) => ({
          ...txn,
          creator_name:
            membersData?.find(
              (m) => m.auth_user_id === (txn.submitted_by || txn.verified_by)
            )?.fullname || "System",
        })
      ) as Transaction[];

      setTransactions(transactionsWithNames);

      // Calculate totals
      const income = transactionsWithNames
        .filter((t) => t.exp_type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
      const expense = transactionsWithNames
        .filter((t) => t.exp_type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      setTotalIncome(income);
      setTotalExpense(expense);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to fetch transactions");
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      txn.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === "All Categories" || txn.category === filterCategory;

    const matchesType = filterType === "all" || txn.exp_type === filterType;

    const matchesDescription =
      filterDescription === "all" ||
      txn.description === filterDescription;

    const matchesDateFrom =
      !dateFrom || (txn.txn_date && txn.txn_date >= dateFrom);
    const matchesDateTo = !dateTo || (txn.txn_date && txn.txn_date <= dateTo);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesType &&
      matchesDescription &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  // Recalculate filtered totals
  const filteredIncome = filteredTransactions
    .filter((t) => t.exp_type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const filteredExpense = filteredTransactions
    .filter((t) => t.exp_type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const getReceiptDataUrl = async (
    photoPath: string
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(photoPath, 300);

      if (error) throw error;
      const response = await fetch(data.signedUrl);
      if (!response.ok) return null;
      const blob = await response.blob();

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () =>
          reject(new Error("Failed to read receipt image"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to load receipt image:", error);
      return null;
    }
  };

  const buildLedgerPdfDoc = async () => {
    if (filteredTransactions.length === 0) {
      toast.error("No transactions to export");
      throw new Error("No transactions to export");
    }

    const sorted = [...filteredTransactions].sort((a, b) =>
      (a.txn_date || "").localeCompare(b.txn_date || "")
    );

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const title = "Finance Ledger";
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 58);

    const summaryHead = [["Date", "Type", "Category", "Amount", "Description"]];
    const summaryBody = sorted.map((txn) => [
      txn.txn_date ? new Date(txn.txn_date).toLocaleDateString() : "-",
      txn.exp_type,
      txn.category,
      `Rs. ${txn.amount.toLocaleString()}`,
      txn.description || "-",
    ]);

    autoTable(doc, {
      head: summaryHead,
      body: summaryBody,
      startY: 74,
      styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [33, 150, 243] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 55 },
        2: { cellWidth: 80 },
        3: { cellWidth: 70 },
        4: { cellWidth: 220 },
      },
    });

    const imageRows = sorted.filter((txn) => txn.photo_path);
    if (imageRows.length > 0) {
      const imageDataList = await Promise.all(
        imageRows.map((txn) => getReceiptDataUrl(txn.photo_path!))
      );

      for (let i = 0; i < imageRows.length; i += 4) {
        doc.addPage();
        const pageImages = imageDataList.slice(i, i + 4);
        const margin = 40;
        const gap = 12;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const cellWidth = (pageWidth - margin * 2 - gap) / 2;
        const cellHeight = (pageHeight - margin * 2 - gap) / 2;

        pageImages.forEach((imageData, index) => {
          const row = Math.floor(index / 2);
          const col = index % 2;
          const cellX = margin + col * (cellWidth + gap);
          const cellY = margin + row * (cellHeight + gap);

          if (!imageData) {
            doc.setFontSize(10);
            doc.text("No receipt", cellX + 4, cellY + 14);
            return;
          }

          const format = imageData.startsWith("data:image/png")
            ? "PNG"
            : "JPEG";
          const padding = 8;
          const imgProps = doc.getImageProperties(imageData);
          const maxWidth = cellWidth - padding * 2;
          const maxHeight = cellHeight - padding * 2;
          const ratio = Math.min(
            maxWidth / imgProps.width,
            maxHeight / imgProps.height
          );
          const imgWidth = imgProps.width * ratio;
          const imgHeight = imgProps.height * ratio;
          const x = cellX + padding + (maxWidth - imgWidth) / 2;
          const y = cellY + padding + (maxHeight - imgHeight) / 2;

          doc.addImage(imageData, format, x, y, imgWidth, imgHeight);
        });
      }
    }

    return doc;
  };

  const exportPDF = async () => {
    setExportingPdf(true);
    try {
      const doc = await buildLedgerPdfDoc();
      doc.save(`finance-ledger-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exported successfully");
    } catch (error) {
      console.error("Failed to export PDF:", error);
      toast.error("Failed to export PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const resetReceiptState = () => {
    setReceiptFile(null);
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptPreviewUrl(null);
    setExistingReceiptUrl(null);
  };

  const loadExistingReceipt = async (photoPath: string | null) => {
    if (!photoPath) {
      setExistingReceiptUrl(null);
      return;
    }

    setExistingReceiptLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(photoPath, 300);

      if (error) throw error;
      setExistingReceiptUrl(data.signedUrl);
    } catch (error) {
      console.error("Error loading receipt:", error);
      setExistingReceiptUrl(null);
    } finally {
      setExistingReceiptLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setEditingTransaction(null);
    setFormData(emptyFormData);
    resetReceiptState();
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (txn: Transaction) => {
    setEditingTransaction(txn);
    setFormData({
      exp_type: txn.exp_type,
      party_role: txn.party_role,
      amount: txn.amount.toString(),
      txn_date: txn.txn_date || new Date().toISOString().split("T")[0],
      category: txn.category,
      description: txn.description || "",
    });
    resetReceiptState();
    loadExistingReceipt(txn.photo_path);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTransaction(null);
    setFormData(emptyFormData);
    resetReceiptState();
  };

  const handleViewReceipt = async (photoPath: string | null) => {
    if (!photoPath) {
      toast.error("No receipt image available");
      return;
    }

    setLoadingReceiptView(true);
    try {
      const { data, error } = await supabase.storage
        .from("finance-photos")
        .createSignedUrl(photoPath, 3600);

      if (error) throw error;

      setViewingReceiptUrl(data.signedUrl);
      setViewReceiptOpen(true);
    } catch (error) {
      console.error("Error loading receipt:", error);
      toast.error("Failed to load receipt image");
    } finally {
      setLoadingReceiptView(false);
    }
  };

  const handleReceiptChange = (file: File | null) => {
    if (file && file.size > MAX_RECEIPT_SIZE_BYTES) {
      toast.error("Receipt image must be 5 MB or smaller");
      return;
    }

    setReceiptFile(file);
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptPreviewUrl(file ? URL.createObjectURL(file) : null);
    if (file) setExistingReceiptUrl(null);
  };

  const uploadReceiptIfAny = async (): Promise<string | null> => {
    if (!receiptFile) return null;
    if (receiptFile.size > MAX_RECEIPT_SIZE_BYTES) {
      toast.error("Receipt image must be 5 MB or smaller");
      return null;
    }

    try {
      setReceiptUploading(true);

      // Compress receipt image before uploading
      const compressedBlob = await compressImageBlob(receiptFile, {
        maxSize: 1200,
        quality: 0.92,
        mimeType: "image/jpeg",
      });

      const compressedSize = compressedBlob.size;
      const originalSize = receiptFile.size;
      const savingsPercent = Math.round(((originalSize - compressedSize) / originalSize) * 100);

      const safeName = receiptFile.name.replace(/[^\w.-]/g, "_");
      const path = `${user?.id || "admin"}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(path, compressedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });

      if (error) throw error;

      if (savingsPercent > 0) {
        toast.success(`Receipt compressed! (${savingsPercent}% smaller)`);
      }

      return path;
    } finally {
      setReceiptUploading(false);
    }
  };

  const deleteOldReceiptIfNeeded = async (newPath: string | null) => {
    if (!editingTransaction?.photo_path) return;
    if (!newPath || newPath === editingTransaction.photo_path) return;

    const { error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .remove([editingTransaction.photo_path]);

    if (error) {
      console.error("Failed to delete old receipt:", error);
      toast.warning("New receipt saved, but failed to delete the old receipt");
    }
  };

  const deleteReceiptForTransaction = async (txn: Transaction) => {
    if (!txn.photo_path) return;

    const { error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .remove([txn.photo_path]);

    if (error) {
      console.error("Failed to delete receipt:", error);
      toast.warning("Transaction deleted, but failed to delete the receipt");
    }
  };

  const handleSaveTransaction = async () => {
    if (!formData.category || !formData.amount || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      // ✅ Upload receipt image if provided
      let uploadedPhotoPath: string | null = null;
      if (receiptFile) {
        uploadedPhotoPath = await uploadReceiptIfAny();
      }

      if (editingTransaction) {
        // Update existing transaction
        const { error } = await supabase
          .from("finance")
          .update({
            exp_type: formData.exp_type,
            party_role: formData.party_role,
            amount: parseFloat(formData.amount),
            txn_date: formData.txn_date,
            category: formData.category,
            description: formData.description,
            // ✅ Keep existing unless a new receipt is uploaded
            photo_path:
              uploadedPhotoPath ?? editingTransaction.photo_path ?? null,
          })
          .eq("fin_id", editingTransaction.fin_id);

        if (error) throw error;
        await deleteOldReceiptIfNeeded(uploadedPhotoPath);
        toast.success("Transaction updated successfully");
      } else {
        // Create new transaction (admin direct entry - already approved)
        const { error } = await supabase.from("finance").insert({
          exp_type: formData.exp_type,
          party_role: formData.party_role,
          amount: parseFloat(formData.amount),
          txn_date: formData.txn_date,
          category: formData.category,
          description: formData.description,
          photo_bucket: RECEIPT_BUCKET,
          approved: true, // Admin entries are pre-approved
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          // ✅ Save receipt path if uploaded
          photo_path: uploadedPhotoPath,
        });

        if (error) throw error;
        toast.success("Transaction added successfully");
      }

      // Close dialog and refresh
      handleCloseDialog();
      await fetchTransactions();
    } catch (error: unknown) {
      console.error("Error saving transaction:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save transaction"
      );
      // Don't close dialog on error - let user fix and retry
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAuditPdf = async () => {
    if (!auditEventName.trim()) {
      toast.error("Please enter an event name");
      return;
    }

    setAuditUploading(true);
    try {
      const doc = await buildLedgerPdfDoc();
      const blob = doc.output("blob") as Blob;
      const safeEvent = auditEventName.trim().replace(/\s+/g, "_");
      const fileName = `${auditYear}_${safeEvent}_audit_summary.pdf`;
      const objectName = `${auditYear}_${safeEvent}_${Date.now()}_audit_summary.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(AUDIT_BUCKET)
        .upload(objectName, blob, { contentType: "application/pdf" });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("audit_actions")
        .insert({
          year: auditYear,
          event: auditEventName.trim(),
          bucket_id: AUDIT_BUCKET,
          object_path: uploadData.path,
          file_name: fileName,
          file_size: blob.size,
          uploaded_by: user?.id ?? null,
        });

      if (insertError) throw insertError;

      toast.success("Audit summary uploaded successfully");
      setAuditDialogOpen(false);
      setAuditEventName("");
      setAuditYear(new Date().getFullYear());
    } catch (error: unknown) {
      console.error("Failed to upload audit summary:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload audit summary"
      );
    } finally {
      setAuditUploading(false);
    }
  };

  const handleConfirmDelete = (txn: Transaction) => {
    setTransactionToDelete(txn);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("finance")
        .delete()
        .eq("fin_id", transactionToDelete.fin_id);

      if (error) throw error;

      await deleteReceiptForTransaction(transactionToDelete);
      toast.success("Transaction deleted successfully");
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      fetchTransactions();
    } catch (error: unknown) {
      const err = error as Error;
      toast.error(err.message || "Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PermissionGate permissionKey="finance" permissionName="Finance Handling">
      <div className="min-h-screen">
        <AdminHeader title="Finance Ledger" breadcrumb="Finance" />

        <div className="p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Income</p>
                      <p className="text-2xl font-bold text-green-400">
                        Rs. {filteredIncome.toLocaleString()}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expense</p>
                      <p className="text-2xl font-bold text-red-400">
                        Rs. {filteredExpense.toLocaleString()}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Net Balance
                      </p>
                      <p
                        className={cn(
                          "text-2xl font-bold",
                          filteredIncome - filteredExpense >= 0
                            ? "text-primary"
                            : "text-red-400"
                        )}
                      >
                        Rs.{" "}
                        {(filteredIncome - filteredExpense).toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Filters */}
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="p-2 sm:p-4">
              <div className="flex flex-col gap-2 sm:gap-3">
                {/* Search bar - full width on mobile */}
                <div className="w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                    />
                  </div>
                </div>

                {/* Category and Type dropdowns - side by side on sm+, stack on mobile */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                  <Select
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                  >
                    <SelectTrigger className="w-full sm:w-[160px] bg-background/50 text-xs sm:text-sm h-8 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full sm:w-[120px] bg-background/50 text-xs sm:text-sm h-8 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Description filter */}
                <div className="w-full">
                  <Select value={filterDescription} onValueChange={setFilterDescription}>
                    <SelectTrigger className="w-full bg-background/50 text-xs sm:text-sm h-8 sm:h-9">
                      <SelectValue placeholder="All Descriptions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Descriptions</SelectItem>
                      {descriptions.map((desc) => (
                        <SelectItem key={desc} value={desc}>
                          {desc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range - stack on mobile, side by side on sm+ */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                    placeholder="From"
                  />
                  <span className="hidden sm:block text-muted-foreground">to</span>
                  <span className="text-xs sm:hidden text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                    placeholder="To"
                  />
                </div>

                {/* Buttons - full width on mobile, side by side on sm+ */}
                <div className="flex flex-col sm:flex-row gap-2 w-full">
                  <Button
                    variant="outline"
                    onClick={exportPDF}
                    disabled={exportingPdf}
                    className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <Download className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                    {exportingPdf ? "Exporting..." : "Export PDF"}
                  </Button>

                  {canEdit && (
                    <Button onClick={handleOpenAddDialog} className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9">
                      <Plus className="h-3 sm:h-4 w-3 sm:w-4 mr-1 sm:mr-2" />
                      Add Record
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle>Audit Summary Instructions</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                Use the filters above to prepare the event-wise ledger summary.
              </div>
              <div>
                Click{" "}
                <span className="font-medium text-foreground">
                  Upload Audit PDF
                </span>{" "}
                to generate the filtered PDF and save it in the Audit page.
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setAuditDialogOpen(true)}
                  disabled={
                    !canEdit ||
                    filterCategory === "All Categories" ||
                    filteredTransactions.length === 0
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Audit PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Transactions
                <Badge className="ml-2">
                  {filteredTransactions.length} records
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[80px]">Receipt</TableHead>
                      {canEdit && <TableHead className="w-[40px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((txn) => (
                      <TableRow key={txn.fin_id}>
                        <TableCell>
                          {txn.txn_date
                            ? new Date(txn.txn_date).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              txn.exp_type === "income"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            )}
                          >
                            {txn.exp_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{txn.category}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-sm">
                          {txn.description || "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            txn.exp_type === "income"
                              ? "text-green-400"
                              : "text-red-400"
                          )}
                        >
                          {txn.exp_type === "income" ? "+" : "-"} Rs.{" "}
                          {txn.amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {txn.photo_path ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewReceipt(txn.photo_path)}
                              disabled={loadingReceiptView}
                              className="gap-1 text-xs h-8 px-2"
                            >
                              <ImageIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">
                                {loadingReceiptView ? "Loading..." : "View"}
                              </span>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              -
                            </span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleOpenEditDialog(txn)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleConfirmDelete(txn)}
                                  className="text-red-400"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add/Edit Transaction Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[90vw] sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-3 sm:gap-4">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-base sm:text-lg">
                {editingTransaction
                  ? "Edit Transaction"
                  : "Add New Transaction"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                {editingTransaction
                  ? "Update the transaction details below."
                  : "Enter the details for the new finance record."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 sm:space-y-4 py-2 sm:py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Transaction Type *</Label>
                  <Select
                    value={formData.exp_type}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        exp_type: v as "income" | "expense",
                        party_role: v === "income" ? "payer" : "payee",
                      })
                    }
                  >
                    <SelectTrigger className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Amount (Rs.) *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Date *</Label>
                  <Input
                    type="date"
                    value={formData.txn_date}
                    onChange={(e) =>
                      setFormData({ ...formData, txn_date: e.target.value })
                    }
                    className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Event *</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    placeholder="e.g. Pentathlon"
                    className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                  />
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Description *</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Details about this transaction..."
                  className="bg-background/50 text-xs sm:text-sm"
                  rows={3}
                />
              </div>

              {/* ✅ NEW: Receipt image upload */}
              <div className="space-y-1 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Receipt Image (optional)</Label>

                {editingTransaction?.photo_path && !receiptFile && (
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span>Existing receipt attached.</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9 flex-1"
                    onChange={(e) =>
                      handleReceiptChange(e.target.files?.[0] ?? null)
                    }
                  />
                  {receiptFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReceiptChange(null)}
                      title="Remove"
                      className="h-8 sm:h-9"
                    >
                      <X className="h-3 sm:h-4 w-3 sm:w-4" />
                    </Button>
                  )}
                </div>

                {receiptPreviewUrl && (
                  <div className="mt-1 sm:mt-2 overflow-hidden rounded-lg border border-border bg-background/40">
                    <img
                      src={receiptPreviewUrl}
                      alt="Receipt preview"
                      className="w-full h-32 sm:h-48 object-contain"
                    />
                  </div>
                )}

                {!receiptPreviewUrl && existingReceiptUrl && (
                  <div className="mt-1 sm:mt-2 overflow-hidden rounded-lg border border-border bg-background/40">
                    <img
                      src={existingReceiptUrl}
                      alt="Existing receipt"
                      className="w-full h-32 sm:h-48 object-contain"
                    />
                  </div>
                )}

                {!receiptPreviewUrl && existingReceiptLoading && (
                  <div className="mt-1 sm:mt-2 text-xs text-muted-foreground">
                    Loading receipt...
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={handleCloseDialog}
                disabled={saving || receiptUploading}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTransaction}
                disabled={saving || receiptUploading}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                {saving || receiptUploading ? (
                  <>
                    <Loader2 className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4 animate-spin" />
                    {receiptUploading ? "Uploading..." : "Saving..."}
                  </>
                ) : editingTransaction ? (
                  "Update Transaction"
                ) : (
                  "Add Transaction"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
          <DialogContent className="w-[90vw] sm:w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 gap-3 sm:gap-4">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-base sm:text-lg">Upload Audit Summary</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                This will generate a PDF from the current filters and save it to
                the Audit page.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 sm:space-y-4 py-2 sm:py-4">
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="audit-event" className="text-xs sm:text-sm">Event Name *</Label>
                <Input
                  id="audit-event"
                  value={auditEventName}
                  onChange={(e) => setAuditEventName(e.target.value)}
                  placeholder="Enter event name"
                  className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
              <div className="space-y-1 sm:space-y-2">
                <Label htmlFor="audit-year" className="text-xs sm:text-sm">Committee Year *</Label>
                <Input
                  id="audit-year"
                  type="number"
                  value={auditYear}
                  onChange={(e) => setAuditYear(Number(e.target.value))}
                  className="bg-background/50 text-xs sm:text-sm h-8 sm:h-9"
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setAuditDialogOpen(false)}
                disabled={auditUploading}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUploadAuditPdf} 
                disabled={auditUploading}
                className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
              >
                {auditUploading ? (
                  <>
                    <Loader2 className="mr-1 sm:mr-2 h-3 sm:h-4 w-3 sm:w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload PDF"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
              <AlertDialogDescription>
                <div>
                  Are you sure you want to delete this transaction? This action
                  cannot be undone.
                  {transactionToDelete && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm">
                        <strong>Category:</strong>{" "}
                        {transactionToDelete.category}
                      </p>
                      <p className="text-sm">
                        <strong>Amount:</strong> Rs.{" "}
                        {transactionToDelete.amount.toLocaleString()}
                      </p>
                      <p className="text-sm">
                        <strong>Date:</strong>{" "}
                        {transactionToDelete.txn_date
                          ? new Date(
                              transactionToDelete.txn_date
                            ).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTransaction}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600"
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* View Receipt Image Dialog */}
        <Dialog open={viewReceiptOpen} onOpenChange={setViewReceiptOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Receipt Image</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              {viewingReceiptUrl ? (
                <img
                  src={viewingReceiptUrl}
                  alt="Receipt"
                  className="max-w-full max-h-[70vh] rounded-lg object-contain border border-border"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading receipt image...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
