import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Hand, Eye, EyeOff, Bot, Video, Target, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

export function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle, resetPassword } = useAuth();

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const passwordRequirements = {
    minLength: formData.password.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasDigit: /[0-9]/.test(formData.password),
    hasSpecial: /[^A-Za-z0-9]/.test(formData.password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPasswordError(false);
    setEmailError('');

    if (!validateEmail(formData.email)) {
      setEmailError('Please enter a valid email address');
      setIsSubmitting(false);
      return;
    }

    if (!isLogin) {
      const { minLength, hasUpperCase, hasDigit, hasSpecial } = passwordRequirements;
      if (!minLength || !hasUpperCase || !hasDigit || !hasSpecial) {
        toast.error('Password does not meet the requirements');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        toast.success('Welcome back!');
        const returnTo = searchParams.get('returnTo');
        navigate(returnTo || '/');
      } else {
        await signup(formData.email, formData.password);
        toast.success('Account created! You can now sign in.');
        setIsLogin(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      if (msg.toLowerCase().includes('email not confirmed')) {
        toast.error('Please confirm your email first. Check your inbox for a confirmation link.');
      } else if (msg.toLowerCase().includes('invalid login credentials')) {
        setPasswordError(true);
        toast.error('Invalid email or password.');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestAccess = () => {
    toast.success('Welcome! Exploring as guest');
    navigate('/');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fffaf0_0%,#f2fbf8_48%,#fff3ed_100%)]">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
            scale: [1, 1.3, 1]
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.5, 1],
            rotate: [0, 180, 360]
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        {/* Floating hand icons */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.3, 0.1],
              rotate: [0, 10, -10, 0]
            }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
              ease: "easeInOut"
            }}
          >
            <Hand className="w-12 h-12 text-teal-300" />
          </motion.div>
        ))}
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md relative z-10"
      >
        {/* Logo/Branding */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-block mb-4"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-700 via-emerald-500 to-orange-400 flex items-center justify-center shadow-lg shadow-teal-900/15">
              <Hand className="w-12 h-12 text-white" />
            </div>
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent mb-2">
            SignTalk
          </h1>
          <p className="text-gray-600">Breaking Communication Barriers</p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="shadow-2xl border-2 border-white/50 backdrop-blur-sm bg-white/90">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">
                {isLogin ? 'Welcome Back!' : 'Create Account'}
              </CardTitle>
              <p className="text-sm text-gray-600">
                {isLogin ? 'Sign in to continue your journey' : 'Start your sign language journey today'}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <Input
                          id="name"
                          type="text"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="pl-10"
                          required={!isLogin}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className={`absolute left-3 top-3 w-5 h-5 ${emailError ? 'text-red-500' : 'text-gray-400'}`} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (emailError) setEmailError('');
                      }}
                      onBlur={(e) => {
                        if (e.target.value && !validateEmail(e.target.value)) {
                          setEmailError('Please enter a valid email address');
                        }
                      }}
                      className={`pl-10 ${emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      required
                    />
                  </div>
                  {emailError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 font-medium"
                    >
                      ✗ {emailError}
                    </motion.p>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <Label htmlFor="password" className={passwordError ? 'text-red-500' : ''}>Password</Label>
                  <div className="relative">
                    <Lock className={`absolute left-3 top-3 w-5 h-5 ${passwordError ? 'text-red-500' : 'text-gray-400'}`} />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={passwordError ? '✗ Incorrect password' : '••••••••'}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        if (passwordError) setPasswordError(false);
                      }}
                      className={`pl-10 pr-10 ${passwordError ? 'border-red-500 text-red-500 placeholder:text-red-400 focus-visible:ring-red-500' : ''}`}
                      required
                    />
                    {passwordError ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute right-3 top-3 text-red-500 pointer-events-none"
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                  {passwordError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-red-500 font-medium"
                    >
                      ✗ Invalid email or password
                    </motion.p>
                  )}
                  {!isLogin && (
                    <div className="space-y-1 pt-1">
                      {[
                        { met: passwordRequirements.minLength, label: 'At least 8 characters' },
                        { met: passwordRequirements.hasUpperCase, label: 'One uppercase letter (A-Z)' },
                        { met: passwordRequirements.hasDigit, label: 'One digit (0–9)' },
                        { met: passwordRequirements.hasSpecial, label: 'One special character (!@#$…)' },
                      ].map(({ met, label }) => (
                        <p key={label} className={`flex items-center gap-1 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
                          <span className="font-bold">{met ? '✓' : '○'}</span>
                          {label}
                        </p>
                      ))}
                    </div>
                  )}
                </motion.div>

                {isLogin && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-right"
                  >
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-teal-700 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </motion.div>
                )}

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 text-lg py-6 disabled:opacity-70 shadow-md shadow-teal-900/15"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {isLogin ? 'Signing in...' : 'Creating account...'}
                      </span>
                    ) : (
                      <>
                        {isLogin ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="ml-2 w-5 h-5" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </form>

              <div className="space-y-4">
                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-sm text-gray-500">
                    or
                  </span>
                </div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGuestAccess}
                    className="w-full border-2 border-teal-900/20 text-gray-700 hover:bg-teal-50 py-6"
                  >
                    Continue as Guest
                  </Button>
                </motion.div>

                <div className="space-y-2">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-2"
                      onClick={async () => {
                        try {
                          await loginWithGoogle();
                        } catch (err: unknown) {
                          toast.error(err instanceof Error ? err.message : 'Google sign in failed');
                        }
                      }}
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Continue with Google
                    </Button>
                  </motion.div>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <p className="text-sm text-gray-600">
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => { setIsLogin(!isLogin); setPasswordError(false); setEmailError(''); }}
                    className="text-teal-700 hover:underline font-medium"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Features */}
        <motion.div
          variants={itemVariants}
          className="mt-8 grid grid-cols-3 gap-4"
        >
          {[
            { icon: Bot, text: 'AI Powered', gradient: 'from-teal-700 to-emerald-500' },
            { icon: Video, text: 'Video Calls', gradient: 'from-emerald-600 to-teal-400' },
            { icon: Target, text: '95% Accurate', gradient: 'from-orange-500 to-amber-400' }
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="bg-white/80 backdrop-blur-sm rounded-lg p-4 text-center shadow-lg"
              >
                <div className="mb-2 flex justify-center">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <p className="text-xs font-medium text-gray-700">{feature.text}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForgotPassword(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              {!resetSent ? (
                <>
                  <h2 className="text-xl font-bold mb-1">Reset Password</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Enter your email and we'll send you a reset link
                  </p>
                  <div className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      onClick={async () => {
                        try {
                          await resetPassword(resetEmail);
                          setResetSent(true);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to send reset email');
                        }
                      }}
                      className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90"
                    >
                      Send Reset Link
                    </Button>
                    <button
                      onClick={() => setShowForgotPassword(false)}
                      className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Check Your Email!</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    We sent a reset link to <strong>{resetEmail}</strong>
                  </p>
                  <Button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetSent(false);
                      setResetEmail('');
                    }}
                    className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90"
                  >
                    Done
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
