import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  TrendingUp,
  Clock,
  Target,
  BookmarkPlus,
  MessageSquare,
  Video,
  Mic,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Button } from '../components/ui/button';
import { Link } from 'react-router';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  getDashboard,
  listFavorites,
  removeFavorite,
  type DashboardResponse,
} from '../../lib/activityApi';

// Maps the backend's generic activity event types to icon + color for the
// Recent Activity feed (the backend only knows about the data, not UI).
const ACTIVITY_ICONS: Record<string, { icon: typeof BookmarkPlus; color: string }> = {
  sign_practiced: { icon: BookmarkPlus, color: 'bg-teal-100 text-teal-700' },
  ai_query: { icon: MessageSquare, color: 'bg-amber-100 text-amber-700' },
  video_call: { icon: Video, color: 'bg-emerald-100 text-emerald-700' },
  voice_to_text: { icon: Mic, color: 'bg-orange-100 text-orange-700' },
};

const FEATURE_ICONS: Record<string, typeof MessageSquare> = {
  'AI Dictionary': MessageSquare,
  'Video Calls': Video,
  'Sign to Text': Target,
  'Voice to Text': Mic,
};

export function Dashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDashboard(), listFavorites()])
      .then(([dashboardData, favoritesData]) => {
        if (cancelled) return;
        setDashboard(dashboardData);
        setFavorites(favoritesData.favorites);
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const handleRemoveFavorite = (word: string) => {
    setFavorites(prev => prev.filter(w => w !== word));
    removeFavorite(word).catch(() => setFavorites(prev => [...prev, word]));
  };

  const stats = dashboard ? [
    {
      label: 'Signs Learned',
      value: String(dashboard.stats.signs_learned.value),
      unit: 'signs',
      icon: Target,
      color: 'text-teal-700',
      bgColor: 'bg-gradient-to-br from-teal-600 to-emerald-400',
      trend: dashboard.stats.signs_learned.trend,
    },
    {
      label: 'Video Calls',
      value: String(dashboard.stats.video_calls.value),
      unit: 'calls',
      icon: Video,
      color: 'text-orange-700',
      bgColor: 'bg-gradient-to-br from-orange-500 to-amber-400',
      trend: dashboard.stats.video_calls.trend,
    },
    {
      label: 'AI Queries',
      value: String(dashboard.stats.ai_queries.value),
      unit: 'questions',
      icon: MessageSquare,
      color: 'text-emerald-700',
      bgColor: 'bg-gradient-to-br from-emerald-600 to-teal-400',
      trend: dashboard.stats.ai_queries.trend,
    },
    {
      label: 'Total Time',
      value: String(dashboard.stats.total_time_hours.value),
      unit: 'hours',
      icon: Clock,
      color: 'text-rose-700',
      bgColor: 'bg-gradient-to-br from-rose-500 to-orange-400',
      trend: dashboard.stats.total_time_hours.trend,
    },
  ] : [];

  const weeklyProgress = dashboard?.weekly_activity ?? [];
  const featureUsage = dashboard?.feature_usage ?? [];
  const recentActivity = dashboard?.recent_activity ?? [];

  const totalMinutes = weeklyProgress.reduce((sum, d) => sum + d.minutes, 0);
  const avgPerDay = weeklyProgress.length ? Math.round(totalMinutes / weeklyProgress.length) : 0;

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
    <div className="relative">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
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
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 space-y-6 px-4 sm:px-0"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-sm sm:text-base text-slate-600">Welcome back! Here's your learning progress</p>
        {error && (
          <p className="text-sm text-rose-600">
            Couldn't load your activity ({error}). Showing empty stats — sign in and try again.
          </p>
        )}
        {isLoading && <p className="text-sm text-slate-400">Loading your stats...</p>}
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05, y: -5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <motion.div
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                      className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </motion.div>
                    <Badge variant="outline" className="text-xs">
                      {stat.trend}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                    <p className="text-3xl font-bold">
                      {stat.value}
                      <span className="text-lg text-gray-600 ml-1">{stat.unit}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Weekly Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Bar Chart */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="h-64"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weeklyProgress}
                      margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                        label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#6b7280' } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        cursor={{ fill: 'rgba(96, 165, 250, 0.1)' }}
                        formatter={(value: number) => [`${value} minutes`, 'Time']}
                      />
                      <Bar dataKey="minutes" radius={[8, 8, 0, 0]}>
                        {weeklyProgress.map((entry, index) => (
                          <Cell key={`bar-cell-${entry.id}-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Summary */}
                <div className="pt-4 border-t grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-teal-700 to-emerald-500 bg-clip-text text-transparent">{totalMinutes}</p>
                    <p className="text-sm text-gray-600">Total Minutes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">{avgPerDay}</p>
                    <p className="text-sm text-gray-600">Avg per Day</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feature Usage */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Feature Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {featureUsage.map((item, index) => {
                const Icon = FEATURE_ICONS[item.name] ?? Target;
                return (
                  <motion.div
                    key={item.name}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="text-gray-600">{item.usage}%</span>
                    </div>
                    <Progress value={item.usage} className="h-2" />
                  </motion.div>
                );
              })}

              <Link to="/dictionary">
                <Button className="w-full mt-4 bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90">
                  Explore Features
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Favorites */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5" />
                Favorite Signs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {favorites.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">
                    No favorites yet — tap the bookmark icon on a sign in the AI Dictionary to save it here.
                  </p>
                )}
                {favorites.map((word, index) => (
                  <motion.div
                    key={word}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-white to-teal-50/60 rounded-lg hover:from-teal-50 hover:to-orange-50 transition-all border border-teal-900/10"
                  >
                    <p className="font-medium capitalize">{word}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-rose-600"
                      onClick={() => handleRemoveFavorite(word)}
                    >
                      Remove
                    </Button>
                  </motion.div>
                ))}
                <Link to="/dictionary">
                  <Button variant="outline" className="w-full">
                    View All Signs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 && (
                  <p className="text-sm text-gray-500 py-2">No activity yet — start practicing to see it here.</p>
                )}
                {recentActivity.map((activity, index) => {
                  const { icon: Icon, color } = ACTIVITY_ICONS[activity.type] ?? { icon: LayoutDashboard, color: 'bg-gray-100 text-gray-700' };
                  return (
                    <motion.div
                      key={index}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{activity.action}</span>
                          {' '}
                          <span className="text-gray-600">{activity.item}</span>
                        </p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      </motion.div>
    </div>
  );
}