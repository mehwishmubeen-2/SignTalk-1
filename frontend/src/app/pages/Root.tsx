import { Outlet, Link, useLocation } from 'react-router';
import { motion } from 'motion/react';
import {
  User,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { ScrollToTop } from '../components/ScrollToTop';

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const navigation = [
    { name: 'Home', path: '/' },
    { name: 'AI Chatbot', path: '/dictionary' },
    { name: 'Sign to Text', path: '/sign-to-text' },
    { name: 'Voice to Text', path: '/voice-to-text' },
    { name: 'Video Call', path: '/video-call' },
    { name: 'Dashboard', path: '/dashboard' },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fffaf0_0%,#f2fbf8_48%,#fff3ed_100%)] text-slate-900">
      <ScrollToTop />
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 border-b border-teal-900/10 bg-white/85 shadow-[0_12px_35px_rgba(15,23,42,0.07)] backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div
              onClick={() => setShowAuthModal(true)}
              className="flex items-center space-x-3 group cursor-pointer"
            >
              <motion.div
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg shadow-lg shadow-teal-900/15"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <img
                  src="/logo-signtalk.jpeg"
                  alt="SignTalk logo"
                  className="h-full w-full object-cover"
                />
              </motion.div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 rounded-full border border-teal-900/10 bg-white/65 p-1 shadow-inner shadow-teal-900/5">
              {navigation.slice(0, 6).map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-teal-700 text-white shadow-sm shadow-teal-900/20'
                          : 'text-slate-700 hover:bg-orange-50 hover:text-teal-800'
                      }`}
                    >
                      <span>{item.name}</span>
                    </motion.div>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center gap-2">
                {user ? (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button variant="outline" size="sm" className="border-0 bg-gradient-to-r from-teal-700 to-emerald-600 text-white shadow-sm shadow-teal-900/20 hover:from-teal-800 hover:to-emerald-700">
                            {user.email?.split('@')[0] ?? 'Profile'}
                          </Button>
                        </motion.div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                            <User className="w-4 h-4" />
                            View Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-red-600 focus:text-red-600 cursor-pointer">
                          <LogOut className="w-4 h-4" />
                          Log Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <>
                    <Link to="/auth">
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="outline" size="sm" className="border-teal-900/20 bg-white/70 text-teal-800 hover:bg-teal-50">
                          Sign In
                        </Button>
                      </motion.div>
                    </Link>
                    <Link to="/auth?mode=signup">
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="outline" size="sm" className="border-0 bg-gradient-to-r from-teal-700 to-orange-500 text-white shadow-sm shadow-teal-900/20 hover:from-teal-800 hover:to-orange-600">
                          Sign Up
                        </Button>
                      </motion.div>
                    </Link>
                  </>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg p-2 text-teal-900 hover:bg-teal-50 md:hidden"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-teal-900/10 py-4 md:hidden"
            >
              <nav className="flex flex-col space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`rounded-lg px-3 py-2 font-semibold transition-colors ${
                        isActive
                          ? 'bg-teal-700 text-white'
                          : 'text-slate-700 hover:bg-orange-50 hover:text-teal-800'
                      }`}
                    >
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
                {user ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-orange-50 hover:text-teal-800"
                    >
                      <span>{user.email?.split('@')[0] ?? 'Profile'}</span>
                    </Link>
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                      className="w-full rounded-lg px-3 py-2 text-left font-semibold text-slate-700 hover:bg-orange-50 hover:text-teal-800"
                    >
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg px-3 py-2 font-semibold text-slate-700 hover:bg-orange-50 hover:text-teal-800"
                    >
                      <span>Sign In</span>
                    </Link>
                    <Link
                      to="/auth?mode=signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className="rounded-lg bg-gradient-to-r from-teal-700 to-orange-500 px-3 py-2 font-semibold text-white"
                    >
                      <span>Sign Up</span>
                    </Link>
                  </>
                )}
              </nav>
            </motion.div>
          )}
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-teal-900/10 bg-white/75 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-slate-600">
            <p>© 2026 SignTalk. Empowering communication through sign language.</p>
          </div>
        </div>
      </footer>

      {/* App Introduction Modal */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="mx-auto mb-4"
            >
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg shadow-lg shadow-teal-900/20">
                <img
                  src="/logo-signtalk.jpeg"
                  alt="SignTalk logo"
                  className="h-full w-full object-contain"
                />
              </div>
            </motion.div>
            <DialogTitle className="bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-center text-3xl font-bold text-transparent">
              Welcome to SignTalk
            </DialogTitle>
            <DialogDescription className="pt-4 text-center text-base leading-relaxed text-slate-700">
              SignTalk is an AI-powered platform bridging the communication gap between hearing and deaf communities. With over 70 million deaf people worldwide relying on sign language, we're making it accessible to everyone through cutting-edge technology. Our mission is to foster social inclusion, empower independence, and create a world where communication knows no barriers. Join us in building a more inclusive society where sign language is recognized, celebrated, and accessible to all.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}