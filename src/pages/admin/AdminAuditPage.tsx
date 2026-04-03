import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AuditAction {
  id: string;
  year: number;
  event: string;
  bucket_id: string;
  object_path: string;
  file_name: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

const DEFAULT_BUCKET = "audit-reports";

export default function AdminAuditPage() {
  const { role, isSuperAdmin, isAdmin } = useAdminAuth();

  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AuditAction | null>(null);

  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    event: "",
  });

  const [auditFile, setAuditFile] = useState<File | null>(null);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { data: records, isLoading } = useQuery({
    queryKey: ["audit-actions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_actions")
        .select("*")
        .order("year", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as AuditAction[];
    },
  });

  const years = useMemo(() => {
    const set = new Set<number>();
    (records ?? []).forEach((r) => set.add(r.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [records]);

  const recordsForYear = (year: number) =>
    (records ?? []).filter((r) => r.year === year);

  useEffect(() => {
    const run = async () => {
      try {
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();
        if (authErr) throw authErr;

        const uid = authData?.user?.id ?? null;
        setCurrentUserId(uid);
      } catch (e) {
        console.error("load user batch/year failed", e);
      }
    };
    run();
  }, []);

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear(),
      event: "",
    });
    setAuditFile(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { auditFile?: File }) => {
      if (!data.auditFile) throw new Error("Please select a file");

      const safeEvent = data.event.trim().replace(/\s+/g, "_");
      const fileName = `${data.year}_${safeEvent}_audit_summary.pdf`;
      const objectName = fileName.replace(/[^\w.-]/g, "_");

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(DEFAULT_BUCKET)
        .upload(objectName, data.auditFile);

      if (uploadError) throw uploadError;

      const { data: result, error } = await supabase
        .from("audit_actions")
        .insert({
          year: data.year,
          event: data.event,
          bucket_id: DEFAULT_BUCKET,
          object_path: uploadData.path,
          file_name: fileName,
          file_size: data.auditFile.size,
          uploaded_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-actions"] });
      toast.success("Audit file created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error(
        "Failed to create audit file: " +
          ((error as Error)?.message || "Unknown error")
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (
      data: { id: string } & typeof formData & { auditFile?: File }
    ) => {
      let objectPath = editingRecord?.object_path ?? "";
      let fileName = editingRecord?.file_name ?? null;
      let fileSize = editingRecord?.file_size ?? null;

      if (data.auditFile) {
        const safeEvent = data.event.trim().replace(/\s+/g, "_");
        const newFileName = `${data.year}_${safeEvent}_audit_summary.pdf`;
        const objectName = newFileName.replace(/[^\w.-]/g, "_");

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(DEFAULT_BUCKET)
          .upload(objectName, data.auditFile, { upsert: true });

        if (uploadError) throw uploadError;
        if (
          editingRecord?.object_path &&
          editingRecord.object_path !== uploadData.path
        ) {
          await supabase.storage
            .from(DEFAULT_BUCKET)
            .remove([editingRecord.object_path]);
        }
        objectPath = uploadData.path;
        fileName = newFileName;
        fileSize = data.auditFile.size;
      }

      const { data: result, error } = await supabase
        .from("audit_actions")
        .update({
          year: data.year,
          event: data.event,
          bucket_id: DEFAULT_BUCKET,
          object_path: objectPath,
          file_name: fileName,
          file_size: fileSize,
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-actions"] });
      toast.success("Audit file updated successfully");
      setEditingRecord(null);
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error(
        "Failed to update audit file: " +
          ((error as Error)?.message || "Unknown error")
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (record: AuditAction) => {
      if (record.bucket_id && record.object_path) {
        await supabase.storage
          .from(record.bucket_id)
          .remove([record.object_path]);
      }
      const { error } = await supabase
        .from("audit_actions")
        .delete()
        .eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-actions"] });
      toast.success("Audit file deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(
        "Failed to delete audit file: " +
          ((error as Error)?.message || "Unknown error")
      );
    },
  });

  const handleCreate = () => {
    if (!isSuperAdmin) {
      toast.error("Only super admins can create audit files");
      return;
    }
    if (!formData.event.trim()) {
      toast.error("Please enter an event name");
      return;
    }
    if (!auditFile) {
      toast.error("Please select a file");
      return;
    }
    createMutation.mutate({ ...formData, auditFile });
  };

  const handleUpdate = () => {
    if (!editingRecord || !formData.event.trim()) {
      toast.error("Please enter an event name");
      return;
    }
    updateMutation.mutate({ id: editingRecord.id, ...formData, auditFile });
  };

  const handleEdit = (record: AuditAction) => {
    setEditingRecord(record);
    setFormData({
      year: record.year,
      event: record.event,
    });
    setIsCreateDialogOpen(false);
  };

  const handleDelete = (record: AuditAction) => {
    if (
      confirm(
        "Are you sure you want to delete this audit file? This action cannot be undone."
      )
    ) {
      deleteMutation.mutate(record);
    }
  };

  const handleOpenAuditFile = async (record: AuditAction) => {
    try {
      const { data, error } = await supabase.storage
        .from(record.bucket_id)
        .createSignedUrl(record.object_path, 300);

      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Failed to create file link");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to open audit file:", err);
      toast.error("Failed to open file");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit (Accounts)</h1>
          <p className="text-muted-foreground">
            Committee year — expand to view event files
          </p>
        </div>

        {isSuperAdmin && (
          <Dialog
            open={isCreateDialogOpen || !!editingRecord}
            onOpenChange={(open) => {
              if (!open) {
                setIsCreateDialogOpen(false);
                setEditingRecord(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Audit File
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingRecord ? "Edit Audit File" : "Add Audit File"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="audit-year">Committee Year</Label>
                  <Input
                    id="audit-year"
                    type="number"
                    value={formData.year}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        year: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="event-name">Event Name</Label>
                  <Input
                    id="event-name"
                    value={formData.event}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        event: e.target.value,
                      }))
                    }
                    placeholder="Enter event name"
                    className="bg-background/50"
                  />
                </div>

                <div>
                  <Label htmlFor="audit-file">Audit File (PDF)</Label>
                  <Input
                    id="audit-file"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setAuditFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={editingRecord ? handleUpdate : handleCreate}
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                    className="flex-1"
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {editingRecord ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {years.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No records found
            </CardContent>
          </Card>
        ) : (
          years.map((yr) => {
            const isOpen = expandedYear === yr;
            const list = recordsForYear(yr);

            return (
              <Card key={yr}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">
                        Committee Year: {yr}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground">
                        {list.length} event{list.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setExpandedYear(isOpen ? null : yr)}
                    >
                      {isOpen ? "Hide" : "View"}
                    </Button>
                  </div>
                </CardHeader>

                {isOpen && (
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event Name</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead className="w-[160px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {list.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{record.event}</TableCell>
                            <TableCell>
                              {record.object_path ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenAuditFile(record)}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  {record.file_name || "View"}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">
                                  No file
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              {isSuperAdmin && (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(record)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>

                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(record)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}

                        {list.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={3}
                              className="text-center text-muted-foreground py-8"
                            >
                              No events for this year
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
