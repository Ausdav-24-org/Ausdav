import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Save, Loader2, UploadCloud } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ImageCropper } from '@/components/ui/ImageCropper';

export default function AdminProfilePage() {
  const { profile, role, refreshProfile } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState({
    fullname: profile?.fullname || '',
    username: profile?.username || '',
    nic: profile?.nic || '',
    gender: profile?.gender ? 'male' : 'female',
    batch: profile?.batch?.toString() || '',
    university: profile?.university || '',
    uni_degree: profile?.uni_degree || '',
    school: profile?.school || '',
    phone: profile?.phone || '',
  });
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showUniversitySuggestions, setShowUniversitySuggestions] = useState(false);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  useEffect(() => {
    setFormData({
      fullname: profile?.fullname || '',
      username: profile?.username || '',
      nic: profile?.nic || '',
      gender: profile?.gender ? 'male' : 'female',
      batch: profile?.batch?.toString() || '',
      university: profile?.university || '',
      uni_degree: profile?.uni_degree || '',
      school: profile?.school || '',
      phone: profile?.phone || '',
    });
  }, [profile]);

  const initialFormData = {
    fullname: profile?.fullname || '',
    username: profile?.username || '',
    nic: profile?.nic || '',
    gender: profile?.gender ? 'male' : 'female',
    batch: profile?.batch?.toString() || '',
    university: profile?.university || '',
    uni_degree: profile?.uni_degree || '',
    school: profile?.school || '',
    phone: profile?.phone || '',
  };

  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialFormData);

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
    name.toLowerCase().includes(formData.university.trim().toLowerCase())
  );
  const filteredSchools = schoolOptions.filter((name) =>
    name.toLowerCase().includes(formData.school.trim().toLowerCase())
  );

  useEffect(() => {
    const loadSignedAvatar = async () => {
      if (!profile?.profile_path) {
        setAvatarUrl(undefined);
        return;
      }
      const { data, error } = await supabase.storage
        .from('member-profiles')
        .createSignedUrl(profile.profile_path, 60 * 60); // 1 hour
      if (error) {
        setAvatarUrl(undefined);
        return;
      }
      setAvatarUrl(data?.signedUrl);
    };

    loadSignedAvatar();
  }, [profile?.profile_path]);

  const handleSave = async () => {
    if (!profile) return;

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      return;
    }
    setPhoneError(null);

    setLoading(true);
    try {
      const payload: any = {
        fullname: formData.fullname,
        username: formData.username,
        nic: formData.nic,
        gender: formData.gender === 'male',
        batch: Number(formData.batch),
        university: formData.university,
        uni_degree: formData.uni_degree || null,
        school: formData.school,
        phone: phoneDigits,
      };

      const { error } = await supabase
        .from('members' as any)
        .update(payload as any)
        .eq('mem_id', profile.mem_id);

      if (error) {
        const msg = String(error.message || error);
        if (/uni_degree/i.test(msg)) {
          delete payload.uni_degree;
          const { error: retryError } = await supabase
            .from('members' as any)
            .update(payload as any)
            .eq('mem_id', profile.mem_id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const initials = profile?.fullname
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'admin':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'member':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'honourable':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    try {
      const oldProfilePath = profile.profile_path;
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${profile.auth_user_id || profile.mem_id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('member-profiles')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('members' as any)
        .update({ profile_path: path })
        .eq('mem_id', profile.mem_id);

      if (updateError) throw updateError;

      await refreshProfile();
      if (oldProfilePath && oldProfilePath !== path) {
        const { error: deleteError } = await supabase.storage
          .from('member-profiles')
          .remove([oldProfilePath]);
        if (deleteError) {
          console.warn('Failed to delete old profile image:', deleteError);
        }
      }
      toast.success('Profile picture updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AdminHeader title="Profile" breadcrumb="Settings" />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Profile Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex flex-col items-center gap-2 relative">
                  <button
                    type="button"
                    className="relative rounded-full"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={avatarUrl || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">Edit profile photo</span>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
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
                  />
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
                        handleAvatarUpload(file);
                        setCropperOpen(false);
                        setSelectedImageSrc(null);
                      }}
                    />
                  )}
                </div>
                <div className="text-center md:text-left">
                  <h2 className="text-2xl font-bold">{profile?.fullname || 'User'}</h2>
                  <p className="text-muted-foreground">{profile?.username}</p>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                    <Badge className={cn('capitalize', getRoleBadgeColor(role))}>
                      {role?.replace('_', ' ') || 'Unknown'}
                    </Badge>
                    <Badge className="bg-muted text-muted-foreground border-border">{profile?.designation}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    value={formData.fullname}
                    onChange={(e) =>
                      setFormData({ ...formData, fullname: e.target.value })
                    }
                    placeholder="Enter your full name"
                    className="bg-background/50"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) =>
                        setFormData({ ...formData, username: e.target.value })
                      }
                      placeholder="your.username"
                      className="bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nic">NIC</Label>
                    <Input
                      id="nic"
                      value={formData.nic}
                      onChange={(e) =>
                        setFormData({ ...formData, nic: e.target.value })
                      }
                      placeholder="NIC number"
                      className="bg-background/50"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value: 'male' | 'female') =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger id="gender" className="bg-background/50">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="batch">Batch / Year</Label>
                    <Input
                      id="batch"
                      value={formData.batch}
                      disabled
                      readOnly
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                      if (digitsOnly.length !== 10 && digitsOnly.length > 0) {
                        setPhoneError('Phone number must be exactly 10 digits');
                      } else {
                        setPhoneError(null);
                      }
                      setFormData({ ...formData, phone: digitsOnly });
                    }}
                    placeholder="0xxxxxxxxx"
                    className="bg-background/50"
                  />
                  {phoneError && (
                    <p className="text-xs text-red-500">{phoneError}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-card/50 backdrop-blur-sm border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Educational Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="university">University</Label>
                  <Input
                    id="university"
                    value={formData.university}
                    onChange={(e) =>
                      setFormData({ ...formData, university: e.target.value })
                    }
                    placeholder="University name"
                    className="bg-background/50"
                    onFocus={() => setShowUniversitySuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowUniversitySuggestions(false), 150);
                    }}
                  />
                  {showUniversitySuggestions && (
                    <div className="absolute z-10 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-background shadow-md scrollbar-thin">
                      {(formData.university.trim().length > 0 && filteredUniversities.length === 0) ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matches
                        </div>
                      ) : (
                        (formData.university.trim().length > 0 ? filteredUniversities : ugcUniversities).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onMouseDown={() => {
                              setFormData({ ...formData, university: name });
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
                  <Label htmlFor="uni_degree">Degree / Course</Label>
                  <Input
                    id="uni_degree"
                    value={formData.uni_degree}
                    onChange={(e) =>
                      setFormData({ ...formData, uni_degree: e.target.value })
                    }
                    placeholder="e.g. BSc Computer Science"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2 relative">
                  <Label htmlFor="school">School</Label>
                  <Input
                    id="school"
                    value={formData.school}
                    onChange={(e) =>
                      setFormData({ ...formData, school: e.target.value })
                    }
                    placeholder="School name"
                    className="bg-background/50"
                    onFocus={() => setShowSchoolSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSchoolSuggestions(false), 150);
                    }}
                  />
                  {showSchoolSuggestions && (
                    <div className="absolute z-10 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-background shadow-md scrollbar-thin">
                      {(formData.school.trim().length > 0 && filteredSchools.length === 0) ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No matches
                        </div>
                      ) : (
                        (formData.school.trim().length > 0 ? filteredSchools : schoolOptions).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                            onMouseDown={() => {
                              setFormData({ ...formData, school: name });
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

                <Button onClick={handleSave} disabled={loading || !isDirty} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Role & Designation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div>
                  <p className="font-medium">Role</p>
                  <p className="text-sm text-muted-foreground">Assigned by administrators</p>
                </div>
                <Badge className={cn('capitalize', getRoleBadgeColor(role))}>
                  {role?.replace('_', ' ') || 'member'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div>
                  <p className="font-medium">Designation</p>
                  <p className="text-sm text-muted-foreground">Managed by admins</p>
                </div>
                <Badge className="bg-muted text-muted-foreground border-border">
                  {profile?.designation || 'none'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Contact a super admin to update role or designation.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
