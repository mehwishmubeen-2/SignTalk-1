import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Lock, Eye, EyeOff } from 'lucide-react';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 'loading' | 'ready' | 'error'
  const [sessionState, setSessionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase auto-detects the ?code= param on init and fires PASSWORD_RECOVERY.
    // Subscribe FIRST so we never miss that event, then check for an existing session
    // in case the exchange already completed before this component mounted.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setSessionState('ready');
      }
    });

    // Check if Supabase already has a session (exchange finished before we subscribed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionState('ready');
      }
    });

    const timer = setTimeout(() => {
      setSessionState((prev) => {
        if (prev === 'loading') return 'error';
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleReset = async () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated successfully!');
      navigate('/auth');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fffaf0_0%,#f2fbf8_48%,#fff3ed_100%)]">
        <div className="bg-white/90 rounded-2xl shadow-2xl shadow-teal-900/10 p-8 w-full max-w-sm text-center backdrop-blur-sm">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-orange-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  if (sessionState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fffaf0_0%,#f2fbf8_48%,#fff3ed_100%)]">
        <div className="bg-white/90 rounded-2xl shadow-2xl shadow-teal-900/10 p-8 w-full max-w-sm text-center backdrop-blur-sm">
          <p className="text-red-500 font-medium mb-4">Invalid or expired reset link.</p>
          <Button
            onClick={() => navigate('/auth')}
            className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fffaf0_0%,#f2fbf8_48%,#fff3ed_100%)]">
      <div className="bg-white/90 rounded-2xl shadow-2xl shadow-teal-900/10 p-8 w-full max-w-sm backdrop-blur-sm">
        <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">Set New Password</h1>
        <p className="text-sm text-gray-500 mb-6">Choose a strong new password</p>

        <div className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            onClick={handleReset}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90"
          >
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </div>
    </div>
  );
}
