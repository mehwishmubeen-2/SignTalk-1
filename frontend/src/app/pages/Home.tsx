// frontend/src/app/pages/Home.tsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  BookOpen,
  Mic,
  Camera,
  Video,
  ArrowRight,
  Star,
  Users,
  TrendingUp,
  Bot,
  Zap,
  Hand,
  MessageCircle,
  CheckCircle2,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { getPublicReviews, getMyReviews, addReview, updateReview, deleteReview, type PublicReview, type MyReview } from '../../lib/reviewsApi';

export function Home() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newText, setNewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(0);
  const [editText, setEditText] = useState('');

  const loadReviews = useCallback(() => {
    getPublicReviews(6).then(setReviews).catch(() => {});
  }, []);

  const loadMyReviews = useCallback(() => {
    if (!user) { setMyReviews([]); return; }
    getMyReviews().then(setMyReviews).catch(() => {});
  }, [user]);

  useEffect(() => { loadReviews(); }, [loadReviews]);
  useEffect(() => { loadMyReviews(); }, [loadMyReviews]);

  const handleAddReview = async () => {
    if (newRating < 1) { toast.error('Pick a star rating first'); return; }
    if (!newText.trim()) { toast.error('Write a few words about your experience'); return; }
    setIsSubmittingReview(true);
    try {
      await addReview({ rating: newRating, text: newText.trim() });
      toast.success('Thanks for your review!');
      setNewRating(0);
      setNewText('');
      loadReviews();
      loadMyReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const startEditing = (review: MyReview) => {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditText(review.text);
  };

  const cancelEditing = () => setEditingId(null);

  const handleUpdateReview = async (id: number) => {
    if (editRating < 1 || !editText.trim()) { toast.error('Add a rating and some text'); return; }
    try {
      await updateReview(id, { rating: editRating, text: editText.trim() });
      toast.success('Review updated!');
      setEditingId(null);
      loadReviews();
      loadMyReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update review');
    }
  };

  const handleDeleteReview = async (id: number) => {
    try {
      await deleteReview(id);
      toast.success('Review deleted');
      loadReviews();
      loadMyReviews();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete review');
    }
  };

  const features = [
    {
      icon: Bot,
      title: 'AI Chatbot',
      description: 'Ask our AI chatbot for any sign and get instant video demonstrations',
      path: '/dictionary',
      gradient: 'from-teal-600 to-emerald-400'
    },
    {
      icon: Camera,
      title: 'Sign to Text',
      description: 'Translate sign language to text using AI recognition',
      path: '/sign-to-text',
      gradient: 'from-emerald-600 to-teal-400'
    },
    {
      icon: Mic,
      title: 'Voice to Text',
      description: 'Convert speech to text',
      path: '/voice-to-text',
      gradient: 'from-orange-500 to-amber-400'
    },
    {
      icon: Video,
      title: 'Video Call Translation',
      description: 'Live video calls with real-time voice and sign translation',
      path: '/video-call',
      gradient: 'from-rose-500 to-orange-400',
    }
  ];

  const stats = [
    { icon: Users, label: 'Active Learners', value: '50K+', gradient: 'from-teal-600 to-emerald-400' },
    { icon: BookOpen, label: 'Sign Videos', value: '10K+', gradient: 'from-orange-500 to-amber-400' },
    { icon: TrendingUp, label: 'Accuracy Rate', value: '95%', gradient: 'from-emerald-600 to-teal-400' }
  ];

  const benefits = [
    { icon: CheckCircle2, text: 'AI-powered Sign to text conversion' },
    { icon: CheckCircle2, text: 'Interactive chatbot assistant' },
    { icon: CheckCircle2, text: 'AI-powered Voice to text conversion' },
    { icon: CheckCircle2, text: 'Real-time video translation' },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative flex items-center min-h-[520px] py-10 md:py-16 mt-0 rounded-2xl overflow-hidden">
        {/* Background video */}
        <video
          src="/videos/video1.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/60 via-transparent to-transparent" />

        {/* Ambient blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-0 left-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"
            animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"
            animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 sm:px-10 md:px-14">
          <motion.div variants={itemVariants} className="space-y-6 max-w-2xl">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="inline-block"
            >
              <Badge className="bg-gradient-to-r from-teal-700 to-emerald-500 text-white border-0 text-xs sm:text-sm px-3 py-1">
                Welcome to the Future of Communication
              </Badge>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl md:text-5xl font-bold leading-tight"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <span className="text-slate-900">Break Barriers With AI-Powered </span>
              <span className="bg-gradient-to-r from-orange-500 to-amber-400 bg-clip-text text-transparent">
                Sign Language
              </span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base sm:text-lg text-slate-700 max-w-lg leading-relaxed"
            >
              Master sign language through real-time translation, AI conversations and video calls.
            </motion.p>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center gap-2 text-slate-800"
                  >
                    <Icon className="w-4 h-4 text-teal-700 flex-shrink-0" />
                    <span className="text-sm font-medium">{benefit.text}</span>
                  </motion.div>
                );
              })}
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap gap-3 pt-2"
            >
              <Link to="/dictionary">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Button className="bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 text-white shadow-lg shadow-teal-900/15 px-6 py-5">
                    <Zap className="mr-2 w-4 h-4" />
                    Start Learning Now
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
              <Link to="/video-call">
                <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }}>
                  <Button variant="outline" className="px-6 py-5 border-2 border-teal-900/30 bg-white/70 backdrop-blur-sm hover:bg-teal-50">
                    <Video className="mr-2 w-4 h-4" />
                    Video Call
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Section ─────────────────────────────────────────────────── */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 sm:px-0">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div key={index} whileHover={{ scale: 1.05, y: -10 }} transition={{ type: "spring", stiffness: 300 }}>
              <Card className="text-center shadow-2xl hover:shadow-3xl transition-all border-2 border-gray-100">
                <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: index * 0.3 }}
                    className={`w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}
                  >
                    <Icon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </motion.div>
                  <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-teal-700 to-emerald-500 bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 font-medium">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.section>

      {/* ── Features Grid ─────────────────────────────────────────────────── */}
      <motion.section variants={itemVariants} className="space-y-6 sm:space-y-8 px-4 sm:px-0">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-700 to-orange-500 bg-clip-text text-transparent px-4">
            Powerful AI Features
          </h2>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
            Everything you need to master sign language and communicate effortlessly
          </p>
        </div>

        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const cardContent = (
              <Card className="h-full hover:shadow-xl transition-all cursor-pointer group border-2 border-transparent hover:border-teal-300 bg-gradient-to-br from-white to-teal-50/30">
                <CardContent className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold">{feature.title}</h3>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                  <div className="flex items-center text-teal-700 group-hover:translate-x-2 transition-transform font-medium text-sm">
                    <span>Explore feature</span>
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            );

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ scale: 1.03, y: -10 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link to={feature.path}>{cardContent}</Link>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.section>

      {/* ── Video Showcase ────────────────────────────────────────────────── */}
      <motion.section
        variants={itemVariants}
        className="relative rounded-2xl overflow-hidden h-[250px] sm:h-[300px] md:h-[350px] shadow-xl mx-4 sm:mx-0"
      >
        <video
          src="/videos/video1.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-teal-900/95 via-emerald-900/90 to-orange-900/85 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center text-white space-y-3 sm:space-y-4 px-4 max-w-3xl"
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Hand className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-2" />
            </motion.div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Breaking Communication Barriers</h2>
            <p className="text-sm sm:text-base md:text-lg opacity-90 leading-relaxed">
              Join a global community dedicated to making sign language accessible to everyone through the power of AI
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Link to="/video-call">
                  <Button
                    className="bg-white text-teal-700 hover:bg-teal-50 px-4 sm:px-6 py-4 sm:py-5 text-sm sm:text-base"
                  >
                    <Video className="mr-2 w-4 h-4" />
                    <span className="hidden sm:inline">Start Video Call</span>
                    <span className="sm:hidden">Video Call</span>
                  </Button>
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <motion.section variants={itemVariants} className="space-y-8 px-4 sm:px-0">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            Trusted by Thousands
          </h2>
          <p className="text-base sm:text-lg text-slate-600 font-medium">See what our community is saying</p>
        </div>

        {reviews.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.slice(0, showAllReviews ? reviews.length : 3).map((review, index) => {
                const isOwnReview = myReviews.some(r => r.text === review.text && r.rating === review.rating);
                const myReview = myReviews.find(r => r.text === review.text && r.rating === review.rating);
                
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 * index }}
                    whileHover={{ scale: 1.02, y: -8 }}
                    className="group relative"
                  >
                    <Card className="shadow-md hover:shadow-2xl transition-all h-full border-0 bg-white">
                      <CardContent className="pt-8 space-y-5 pb-8 px-8">
                        <div className="flex gap-1.5">
                          {[...Array(review.rating)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <p className="text-slate-700 leading-relaxed text-base font-normal">"{review.text}"</p>
                        <div className="pt-2 border-t border-slate-100">
                          <p className="font-semibold text-slate-900 text-sm tracking-wide">{review.name}</p>
                          {review.role && <p className="text-xs text-slate-500 font-medium mt-1">{review.role}</p>}
                        </div>
                      </CardContent>
                      
                      {isOwnReview && myReview && (
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <motion.button
                            type="button"
                            onClick={() => startEditing(myReview)}
                            className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            title="Edit review"
                          >
                            <Edit2 className="w-4 h-4" />
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={() => handleDeleteReview(myReview.id)}
                            className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            title="Delete review"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {reviews.length > 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center pt-4"
              >
                <Button
                  onClick={() => setShowAllReviews(!showAllReviews)}
                  className="bg-gradient-to-r from-teal-700 to-emerald-600 hover:opacity-90 text-white shadow-lg rounded-lg px-8 py-2.5 font-semibold text-base transition-all hover:scale-105"
                >
                  {showAllReviews ? '← Show Less' : `View More (${reviews.length - 3} more) →`}
                </Button>
              </motion.div>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">Be the first to share your experience!</p>
        )}

        {/* ── Write a review ──────────────────────────────────────────────── */}
        <Card className="max-w-2xl mx-auto shadow-xl border-0 rounded-2xl bg-gradient-to-br from-slate-50 to-white">
          <CardContent className="pt-8 space-y-6">
            {user ? (
              <>
                <div className="text-center space-y-2">
                  <p className="font-bold text-lg text-slate-900 tracking-tight">Share Your Experience</p>
                  <p className="text-sm text-slate-600">Help others learn with your feedback</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setNewRating(star)}>
                      <Star
                        className={`w-8 h-8 transition-all cursor-pointer ${star <= newRating ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300 hover:text-amber-300'}`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  placeholder="Tell others what you think about SignTalk..."
                  maxLength={500}
                  rows={3}
                  className="rounded-lg border-slate-200 text-slate-700 placeholder:text-slate-400"
                />
                <Button
                  onClick={handleAddReview}
                  disabled={isSubmittingReview}
                  className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 text-white font-semibold text-base rounded-lg py-3 shadow-lg transition-all"
                >
                  {isSubmittingReview ? 'Saving...' : '✓ Submit Review'}
                </Button>
              </>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-slate-700 font-medium">Sign in to share your experience with the community</p>
                <Link to="/auth">
                  <Button variant="outline" className="border-2 border-teal-700 text-teal-700 font-semibold hover:bg-teal-50 rounded-lg">Sign In</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Edit Review Modal ──────────────────────────────────────────── */}
        {user && editingId !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="border-2 border-blue-200 shadow-2xl rounded-2xl bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="pt-8 space-y-6">
                <div className="text-center space-y-2">
                  <p className="font-bold text-lg text-slate-900 tracking-tight">Edit Your Review</p>
                  <p className="text-sm text-slate-600">Update your feedback</p>
                </div>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setEditRating(star)}>
                      <Star
                        className={`w-8 h-8 transition-all cursor-pointer ${star <= editRating ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300 hover:text-amber-300'}`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="rounded-lg border-slate-200 text-slate-700 placeholder:text-slate-400"
                />
                <div className="flex gap-3 pt-4">
                  <Button
                    size="sm"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5"
                    onClick={() => handleUpdateReview(editingId)}
                  >
                    ✓ Save Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 rounded-lg"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.section>

      {/* ── CTA Section ───────────────────────────────────────────────────── */}
      <motion.section
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        className="bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 rounded-2xl p-6 sm:p-8 md:p-10 text-center text-white shadow-xl shadow-teal-900/20 relative overflow-hidden mx-4 sm:mx-0"
      >
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%` }}
              animate={{ y: [0, -30, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
            >
              <Hand className="w-8 h-8" />
            </motion.div>
          ))}
        </div>
        <div className="relative z-10 space-y-3 sm:space-y-4">
          <motion.div animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <Star className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2" />
          </motion.div>
          <h2 className="text-2xl sm:text-3xl font-bold px-4">Ready to Start Your Journey?</h2>
          <p className="text-sm sm:text-base md:text-lg opacity-90 max-w-2xl mx-auto px-4">
            Join 50,000+ learners using AI to master sign language and connect with the world
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link to="/dictionary" className="w-full sm:w-auto">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="outline" className="w-full sm:w-auto bg-white text-teal-700 hover:bg-teal-50 border-0 px-4 sm:px-6 py-4 sm:py-5 text-sm sm:text-base">
                  <MessageCircle className="mr-2 w-4 h-4" />
                  Talk to AI Assistant
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto">
              <Link to="/video-call">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto bg-white/10 backdrop-blur-sm border-2 border-white text-white hover:bg-white/20 px-4 sm:px-6 py-4 sm:py-5 text-sm sm:text-base"
                >
                  <Video className="mr-2 w-4 h-4" />
                  Try Video Call
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}