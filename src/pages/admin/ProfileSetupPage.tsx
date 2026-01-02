import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Save, Loader2, Shield, UploadCloud } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageCropper } from '@/components/ui/ImageCropper';

interface FormState {
  fullname: string;
  username: string;
  nic: string;
  gender: 'male' | 'female';
  batch: string;
  university: string;
  uni_degree: string;
  school: string;
  phone: string;
}

const initialForm: FormState = {
  fullname: '',
  username: '',
  nic: '',
  gender: 'male',
  batch: '',
  university: '',
  uni_degree: '',
  school: '',
  phone: '',
};

export default function ProfileSetupPage() {
  const { user, profile, refreshProfile } = useAdminAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchDisabled, setBatchDisabled] = useState(false);
  const [showUniversitySuggestions, setShowUniversitySuggestions] = useState(false);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);

  const ugcUniversities = [
    'University of Colombo',
    'University of Peradeniya',
    'University of Sri Jayewardenepura',
    'University of Kelaniya',
    'University of Moratuwa',
    'University of Jaffna',
    'University of Ruhuna',
    'The Open University of Sri Lanka',
    'Eastern University, Sri Lanka',
    'South Eastern University of Sri Lanka',
    'Rajarata University of Sri Lanka',
    'Sabaragamuwa University of Sri Lanka',
    'Wayamba University of Sri Lanka',
    'Uva Wellassa University',
    'University of the Visual & Performing Arts',
    'Gampaha Wickramarachchi University of Indigenous Medicine',
    'Institute of Technology University of Moratuwa',
    'University of Vavuniya, Sri Lanka',
  ];
  const schoolOptions = [
    'V/Rambaikulam Girls Maha Vidyalayam',
    'V/Vavuniya Tamil Madhya Maha Vidyalayam',
    'V/Vavuniya Muslim Maha Vidyalayam',
    'V/Nelukkulam Kalaimagal Maha Vidyalayam',
    'V/Vipulanantha College',
    'V/Saivapiragasa Ladies College',
    'V/Cheddikulam Maha Vidyalayam',
    'Kanakarayankulam Maha Vidyalayam',
    'Puthukkulam Maha Vidyalayam',
  ];
  const filteredUniversities = ugcUniversities.filter((name) =>
    name.toLowerCase().includes(form.university.trim().toLowerCase())
  );
  const filteredSchools = schoolOptions.filter((name) =>
    name.toLowerCase().includes(form.school.trim().toLowerCase())
  );

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (profile) {
      navigate('/admin/profile');
    }
  }, [user, profile, navigate]);

  useEffect(() => {
    // load configured signup batch from app settings and lock batch if present
    const loadBatchSetting = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('batch').eq('id', 1).maybeSingle();
        if (data && data.batch) {
          setForm((f) => ({ ...f, batch: String(data.batch) }));
          setBatchDisabled(true);
        }
      } catch (err) {
        // ignore - non-critical
      }
    };

    loadBatchSetting();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) return;

    if (!form.fullname || !form.username || !form.nic || !form.batch || !form.university || !form.school || !form.phone) {
      setError('Please fill in all required fields.');
      return;
    }

    const batchNum = Number(form.batch);
    if (Number.isNaN(batchNum)) {
      setError('Batch must be a number.');
      return;
    }

    setLoading(true);
    try {
      let uploadedPath: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop() || 'jpg';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('member-profiles')
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

        if (uploadError) throw uploadError;
        uploadedPath = path;
      }

      // Attempt upsert including uni_degree; if DB lacks the column, retry without it
      const payload: any = {
        fullname: form.fullname,
        username: form.username,
        nic: form.nic,
        gender: form.gender === 'male',
        role: 'member',
        batch: batchNum,
        university: form.university,
        uni_degree: form.uni_degree || null,
        school: form.school,
        phone: form.phone,
        designation: 'none',
        auth_user_id: user.id,
        profile_bucket: 'member-profiles',
        profile_path: uploadedPath,
      };

      const { error: upsertError } = await supabase
        .from('members' as any)
        .upsert(payload as any)
        .eq('auth_user_id', user.id);

      if (upsertError) {
        const msg = String(upsertError.message || upsertError);
        if (/uni_degree/i.test(msg)) {
          // retry without uni_degree
          delete payload.uni_degree;
          const { error: retryError } = await supabase
            .from('members' as any)
            .upsert(payload as any)
            .eq('auth_user_id', user.id);
          if (retryError) throw retryError;
        } else {
          throw upsertError;
        }
      }

      await refreshProfile();
      navigate('/admin/profile');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AdminHeader title="Complete Your Profile" breadcrumb="Onboarding" />

      <div className="p-6 max-w-3xl mx-auto">
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Secure your account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              We just need a few details to set up your member profile. You can update these later from your profile page.
            </p>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={photoPreview || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary">{(form.fullname || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="avatar">Profile picture (optional)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="avatar"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setSelectedImageSrc(reader.result as string);
                            setCropperOpen(true);
                          };
                          reader.readAsDataURL(file);
                        }
                        e.target.value = '';
                      }}
                      className="bg-background/50 cursor-pointer"
                    />
                    {photoPreview && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  {selectedImageSrc && (
                    <ImageCropper
                      open={cropperOpen}
                      onClose={() => {
                        setCropperOpen(false);
                        setSelectedImageSrc(null);
                      }}
                      imageSrc={selectedImageSrc}
                      onCropComplete={(blob) => {
                        const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(blob));
                        setCropperOpen(false);
                        setSelectedImageSrc(null);
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.fullname}
                    onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                    placeholder="Jane Doe"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="janedoe"
                    required
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NIC</Label>
                  <Input
                    value={form.nic}
                    onChange={(e) => setForm({ ...form, nic: e.target.value })}
                    placeholder="NIC number"
                    required
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(value: 'male' | 'female') => setForm({ ...form, gender: value })}
                  >
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Batch / Year</Label>
                  <Input
                    value={form.batch}
                    onChange={(e) => setForm({ ...form, batch: e.target.value })}
                    placeholder="2024"
                    required
                    disabled={batchDisabled}
                    className="bg-background/50"
                  />
                  {batchDisabled && (
                    <p className="text-xs text-muted-foreground mt-1">Batch set by administrator and cannot be edited.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0xxxxxxxxx"
                    required
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="university">University</Label>
                  <Input
                    id="university"
                    value={form.university}
                    onChange={(e) => setForm({ ...form, university: e.target.value })}
                    placeholder="University name"
                    required
                    className="bg-background/50"
                    autoComplete="off"
                    onFocus={() => setShowUniversitySuggestions(true)}
                    onClick={() => setShowUniversitySuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowUniversitySuggestions(false), 150);
                    }}
                  />
                  {showUniversitySuggestions && (
                    <div className="absolute z-50 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-background shadow-md scrollbar-thin">
                      {(form.university.trim().length > 0 && filteredUniversities.length === 0) ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matches
                        </div>
                      ) : (
                        (form.university.trim().length > 0 ? filteredUniversities : ugcUniversities).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onMouseDown={() => {
                              setForm({ ...form, university: name });
                              setShowUniversitySuggestions(false);
                            }}
                          >
                            {name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Degree / Course</Label>
                  <Input
                    value={form.uni_degree}
                    onChange={(e) => setForm({ ...form, uni_degree: e.target.value })}
                    placeholder="e.g. BSc Computer Science"
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="school">School</Label>
                  <Input
                    id="school"
                    value={form.school}
                    onChange={(e) => setForm({ ...form, school: e.target.value })}
                    placeholder="School name"
                    required
                    className="bg-background/50"
                    autoComplete="off"
                    onFocus={() => setShowSchoolSuggestions(true)}
                    onClick={() => setShowSchoolSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSchoolSuggestions(false), 150);
                    }}
                  />
                  {showSchoolSuggestions && (
                    <div className="absolute z-50 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-background shadow-md scrollbar-thin">
                      {(form.school.trim().length > 0 && filteredSchools.length === 0) ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matches
                        </div>
                      ) : (
                        (form.school.trim().length > 0 ? filteredSchools : schoolOptions).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onMouseDown={() => {
                              setForm({ ...form, school: name });
                              setShowSchoolSuggestions(false);
                            }}
                          >
                            {name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Save Profile
                  </span>
                )}
              </Button>

              <Alert className="bg-muted/50 border-border/50">
                <AlertDescription className="text-sm">
                  Your role and designation are fixed to member/none for self-signup. An administrator can update them later if needed.
                </AlertDescription>
              </Alert>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
