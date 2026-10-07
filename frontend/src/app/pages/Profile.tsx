import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, MapPin, Calendar, Camera, Award, BookOpen, Target, Lock, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function Profile() {
  const { user, updatePassword, deleteAccount } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    location: '',
    joined: '',
    bio: '',
  });

  const [settings, setSettings] = useState({
    emailNotifications: true,
    practiceReminders: true,
    weeklyProgress: true,
    soundEffects: false,
  });

  // ── Load profile from Supabase on mount ──────────────────────────
  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (first time user)
        toast.error('Failed to load profile');
      }

      if (data) {
        setProfile({
          name: data.name || user.user_metadata?.full_name || '',
          email: data.email || user.email || '',
          location: data.location || '',
          bio: data.bio || '',
          joined: data.joined || new Date(user.created_at)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        });
      } else {
        // First time: pre-fill from auth metadata
        setProfile({
          name: user.user_metadata?.full_name || '',
          email: user.email || '',
          location: '',
          bio: '',
          joined: new Date(user.created_at)
            .toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        });
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [user]);

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    const pw = passwordData.newPassword;
    if (pw.length < 8 || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      toast.error('Password does not meet the requirements');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    setCurrentPasswordError(false);
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: passwordData.currentPassword,
      });
      if (signInError) {
        setCurrentPasswordError(true);
        toast.error('Current password is incorrect');
        setPasswordLoading(false);
        return;
      }
      await updatePassword(passwordData.newPassword);
      toast.success('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Save profile to Supabase ──────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profile.name,
          email: profile.email,
          location: profile.location,
          bio: profile.bio,
          joined: profile.joined,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      await deleteAccount();
      toast.success('Account deleted. Goodbye!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeletingAccount(false);
    }
  };

  const achievements = [
    { id: 1, name: 'Early Bird', description: 'Completed first lesson', date: 'Jan 15, 2026', icon: '🎯', gradient: 'from-teal-700 to-emerald-500' },
    { id: 2, name: 'Week Warrior', description: '7-day learning streak', date: 'Jan 22, 2026', icon: '🔥', gradient: 'from-orange-500 to-red-500' },
    { id: 3, name: 'Fast Learner', description: 'Learned 50 signs', date: 'Feb 1, 2026', icon: '⚡', gradient: 'from-yellow-500 to-amber-500' },
    { id: 4, name: 'Quiz Master', description: 'Scored 100% on quiz', date: 'Feb 5, 2026', icon: '🏆', gradient: 'from-orange-500 to-amber-400' },
    { id: 5, name: 'Dedicated', description: '30-day streak', date: 'Mar 1, 2026', icon: '💪', gradient: 'from-green-500 to-emerald-500' },
    { id: 6, name: 'Community Helper', description: 'Helped 10 learners', date: 'Mar 15, 2026', icon: '🤝', gradient: 'from-rose-500 to-orange-400' },
  ];

  const stats = [
    { label: 'Total Signs Learned', value: '0', icon: BookOpen, gradient: 'from-teal-700 to-emerald-500' },
    { label: 'Lessons Completed', value: '0', icon: Award, gradient: 'from-green-500 to-emerald-500' },
    { label: 'Quiz Score Average', value: '0%', icon: Target, gradient: 'from-orange-500 to-amber-400' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  // ── Loading state ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-orange-400 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Animated Background — keep exactly as you had it */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute top-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
          animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }} />
        <motion.div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
          animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }} />
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible"
        className="relative z-10 max-w-5xl mx-auto space-y-6 px-4 sm:px-0">

        <motion.div variants={itemVariants} className="space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">
            Profile
          </h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your account and view your progress</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="profile" className="text-xs sm:text-sm">
                <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ── */}
            <TabsContent value="profile" className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <motion.div whileHover={{ scale: 1.05 }}
                          className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-700 via-emerald-600 to-orange-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-teal-900/15">
                          {profile.name ? profile.name.split(' ').map(n => n[0]).join('') : '?'}
                        </motion.div>
                        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full border-2 border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-md">
                          <Camera className="w-4 h-4 text-gray-600" />
                        </motion.button>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{profile.name || 'Your Name'}</h3>
                        <p className="text-gray-600">Member since {profile.joined}</p>
                        <Badge className="mt-2 bg-gradient-to-r from-teal-700 to-emerald-600 border-0">
                          Pro Member
                        </Badge>
                      </div>
                    </div>

                    {/* Form */}
                    <AnimatePresence mode="wait">
                      <motion.div key={isEditing ? 'editing' : 'viewing'}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={profile.name}
                              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                              disabled={!isEditing}
                              className={isEditing ? 'border-teal-300' : ''} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-1">
                              Email
                              <Lock className="w-3 h-3 text-gray-400" />
                            </Label>
                            <Input id="email" type="email" value={profile.email}
                              disabled
                              className="bg-gray-50 text-gray-500 cursor-not-allowed" />
                            <p className="text-xs text-gray-400">Email address cannot be changed</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location">Location</Label>
                          <Input id="location" value={profile.location}
                            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                            disabled={!isEditing}
                            className={isEditing ? 'border-teal-300' : ''} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bio">Bio</Label>
                          <Textarea id="bio" value={profile.bio} rows={3}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            disabled={!isEditing}
                            className={isEditing ? 'border-teal-300' : ''} />
                        </div>

                        <div className="flex gap-2">
                          {!isEditing ? (
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button onClick={() => setIsEditing(true)}
                                className="bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90">
                                Edit Profile
                              </Button>
                            </motion.div>
                          ) : (
                            <>
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button onClick={handleSaveProfile} disabled={isSaving}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90">
                                  {isSaving ? (
                                    <span className="flex items-center gap-2">
                                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      Saving...
                                    </span>
                                  ) : 'Save Changes'}
                                </Button>
                              </motion.div>
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button variant="outline" onClick={() => setIsEditing(false)}>
                                  Cancel
                                </Button>
                              </motion.div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Change Password Card ── */}
              {user?.app_metadata?.provider !== 'google' ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Lock className="w-5 h-5" />
                          Change Password
                        </CardTitle>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsChangingPassword(!isChangingPassword);
                              setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                              setCurrentPasswordError(false);
                            }}
                            className="text-sm"
                          >
                            {isChangingPassword ? 'Cancel' : 'Change Password'}
                          </Button>
                        </motion.div>
                      </div>
                    </CardHeader>

                    <AnimatePresence>
                      {isChangingPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <CardContent className="space-y-4 pt-0">
                            {/* Current Password */}
                            <div className="space-y-2">
                              <Label htmlFor="currentPassword" className={currentPasswordError ? 'text-red-500' : ''}>
                                Current Password
                              </Label>
                              <div className="relative">
                                <Lock className={`absolute left-3 top-3 w-5 h-5 ${currentPasswordError ? 'text-red-500' : 'text-gray-400'}`} />
                                <Input
                                  id="currentPassword"
                                  type={showPasswords ? 'text' : 'password'}
                                  placeholder={currentPasswordError ? '✗ Incorrect password' : 'Enter current password'}
                                  value={passwordData.currentPassword}
                                  onChange={(e) => {
                                    setPasswordData({ ...passwordData, currentPassword: e.target.value });
                                    if (currentPasswordError) setCurrentPasswordError(false);
                                  }}
                                  className={`pl-10 ${currentPasswordError ? 'border-red-500 text-red-500 placeholder:text-red-400 focus-visible:ring-red-500' : 'border-teal-300'}`}
                                />
                                {currentPasswordError && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute right-3 top-3 text-red-500"
                                  >
                                    <AlertTriangle className="w-5 h-5" />
                                  </motion.div>
                                )}
                              </div>
                              {currentPasswordError && (
                                <motion.p
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="text-xs text-red-500 font-medium"
                                >
                                  ✗ Current password is incorrect
                                </motion.p>
                              )}
                            </div>

                            {/* New Password */}
                            <div className="space-y-2">
                              <Label htmlFor="newPassword">New Password</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <Input
                                  id="newPassword"
                                  type={showPasswords ? 'text' : 'password'}
                                  placeholder="Min 8 chars, A-Z, 0-9, special char"
                                  value={passwordData.newPassword}
                                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                  className="pl-10 pr-10 border-teal-300"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPasswords(!showPasswords)}
                                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                                >
                                  {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                              </div>
                              {/* Password requirements checklist */}
                              <div className="space-y-1 pt-1">
                                {[
                                  { met: passwordData.newPassword.length >= 8, label: 'At least 8 characters' },
                                  { met: /[A-Z]/.test(passwordData.newPassword), label: 'One uppercase letter (A-Z)' },
                                  { met: /[0-9]/.test(passwordData.newPassword), label: 'One digit (0–9)' },
                                  { met: /[^A-Za-z0-9]/.test(passwordData.newPassword), label: 'One special character (!@#$…)' },
                                ].map(({ met, label }) => (
                                  <p key={label} className={`flex items-center gap-1 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
                                    <span className="font-bold">{met ? '✓' : '○'}</span>
                                    {label}
                                  </p>
                                ))}
                              </div>
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                              <Label htmlFor="confirmPassword">Confirm New Password</Label>
                              <div className="relative">
                                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                <Input
                                  id="confirmPassword"
                                  type={showPasswords ? 'text' : 'password'}
                                  placeholder="Confirm new password"
                                  value={passwordData.confirmPassword}
                                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                  className="pl-10 border-teal-300"
                                />
                              </div>
                            </div>

                            {/* Password strength indicator */}
                            {passwordData.newPassword.length > 0 && (
                              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4].map((level) => (
                                    <div
                                      key={level}
                                      className={`h-1 flex-1 rounded-full transition-colors ${
                                        passwordData.newPassword.length >= level * 3
                                          ? level <= 1 ? 'bg-red-500'
                                            : level <= 2 ? 'bg-yellow-500'
                                            : level <= 3 ? 'bg-orange-500'
                                            : 'bg-green-500'
                                          : 'bg-gray-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {passwordData.newPassword.length < 3 ? 'Too weak'
                                    : passwordData.newPassword.length < 6 ? 'Weak'
                                    : passwordData.newPassword.length < 9 ? 'Good'
                                    : 'Strong'}
                                </p>
                              </motion.div>
                            )}

                            {/* Match indicator */}
                            {passwordData.confirmPassword.length > 0 && (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`text-xs font-medium ${
                                  passwordData.newPassword === passwordData.confirmPassword
                                    ? 'text-green-600'
                                    : 'text-red-500'
                                }`}
                              >
                                {passwordData.newPassword === passwordData.confirmPassword
                                  ? '✓ Passwords match'
                                  : '✗ Passwords do not match'}
                              </motion.p>
                            )}

                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                              <Button
                                onClick={handleChangePassword}
                                disabled={passwordLoading}
                                className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90"
                              >
                                {passwordLoading ? (
                                  <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Updating Password...
                                  </span>
                                ) : (
                                  <>
                                    <Lock className="w-4 h-4 mr-2" />
                                    Update Password
                                  </>
                                )}
                              </Button>
                            </motion.div>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!isChangingPassword && (
                      <CardContent className="pt-0">
                        <p className="text-sm text-gray-500">
                          Click "Change Password" to update your password securely.
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </motion.div>
              ) : (
                <Card className="shadow-lg">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 text-gray-500">
                      <Lock className="w-5 h-5" />
                      <p className="text-sm">
                        You signed in with Google. Password management is handled by your Google account.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats & Quick Info — keep exactly as you had them */}
              <div className="grid md:grid-cols-3 gap-4">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <motion.div key={index}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + index * 0.1 }} whileHover={{ scale: 1.05, y: -5 }}>
                      <Card className="shadow-lg hover:shadow-xl transition-all">
                        <CardContent className="pt-6 text-center">
                          <motion.div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}
                            whileHover={{ rotate: 360 }} transition={{ duration: 0.6 }}>
                            <Icon className="w-6 h-6 text-white" />
                          </motion.div>
                          <p className="text-3xl font-bold mb-1">{stat.value}</p>
                          <p className="text-sm text-gray-600">{stat.label}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Card className="shadow-lg bg-gradient-to-r from-teal-50 to-orange-50 border-teal-200">
                  <CardContent className="pt-6">
                    <div className="grid md:grid-cols-3 gap-6">
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-teal-700" />
                        <div>
                          <p className="text-sm text-gray-600">Email</p>
                          <p className="font-medium">{profile.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-orange-500" />
                        <div>
                          <p className="text-sm text-gray-600">Location</p>
                          <p className="font-medium">{profile.location || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                        <div>
                          <p className="text-sm text-gray-600">Member Since</p>
                          <p className="font-medium">{profile.joined}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Danger Zone ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card className="shadow-lg border-red-200 bg-red-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="w-5 h-5" />
                      Alert
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Once you delete your account, all your data including profile, progress, and achievements will be permanently removed. This action cannot be undone.
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          className="flex items-center gap-2"
                          disabled={isDeletingAccount}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            Delete Account
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-2">
                            <span className="block">
                              Are you sure you want to permanently delete your account?
                            </span>
                            <span className="block font-medium text-gray-800">
                              This will erase all your data and you will need to sign up again. This cannot be undone.
                            </span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                          >
                            {isDeletingAccount ? (
                              <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Deleting...
                              </span>
                            ) : (
                              'Yes, delete my account'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Achievements & Settings tabs — keep exactly as you had them */}
            {/* ... paste your existing achievements and settings TabsContent here unchanged ... */}

          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}