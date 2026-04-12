import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Clock, Users, BarChart3 } from 'lucide-react';

export default function Hero() {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: 'easeOut' },
    },
  };

  const floatingVariants = {
    float: {
      y: [0, -20, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const stats = [
    { icon: Zap, label: 'Lightning Fast', value: '< 100ms' },
    { icon: Clock, label: 'Real-time', value: 'Live Updates' },
    { icon: Users, label: 'Team Sync', value: 'Instant' },
    { icon: BarChart3, label: 'Analytics', value: 'Real-time' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background Orbs */}
      <motion.div
        className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-amber-500 opacity-20 blur-3xl"
        animate={{ y: [0, 30, 0], x: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-500 opacity-20 blur-3xl"
        animate={{ y: [0, -30, 0], x: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* Grid Background */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml?utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23f8fafc%22 width=%2250%25%22 height=%2250%25%22/><rect fill=%22%23e2e8f0%22 x=%2250%25%22 width=%2250%25%22 height=%2250%25%22/><rect fill=%22%23e2e8f0%22 y=%2250%25%22 width=%2250%25%22 height=%2250%25%22/><rect fill=%22%23cbd5e1%22 x=%2250%25%22 y=%2250%25%22 width=%2250%25%22 height=%2250%25%22/></svg>')] opacity-[0.03] mix-blend-multiply" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <motion.div
          className="text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-semibold text-amber-300">
                Trusted by 100+ Restaurants
              </span>
            </div>
          </motion.div>

          {/* Main Title */}
          <motion.h1 variants={itemVariants} className="mb-6 text-5xl md:text-6xl lg:text-7xl font-bold">
            <span className="bg-gradient-to-r from-white via-amber-200 to-amber-100 bg-clip-text text-transparent">
              RestroMax
            </span>
            <span className="block text-3xl md:text-4xl lg:text-5xl mt-2 text-slate-300">
              Smart Restaurant Management Simplified
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="mx-auto mb-8 max-w-2xl text-lg md:text-xl text-slate-400"
          >
            Manage orders, staff, billing, and kitchen operations in real-time with blazing-fast performance. Trusted by leading restaurants.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <motion.button
              onClick={() => navigate('/register')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 font-semibold text-slate-900 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-shadow"
            >
              Get Started
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-500 px-8 py-4 font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              View Demo
              <ArrowRight className="h-5 w-5" />
            </motion.button>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  variants={floatingVariants}
                  animate="float"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  className="group rounded-lg border border-slate-700 bg-slate-800/40 backdrop-blur p-4 hover:border-amber-500/50 hover:bg-slate-800/60 transition-all"
                >
                  <Icon className="h-6 w-6 text-amber-400 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-semibold text-amber-300">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* Feature Showcase Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="mt-20 grid md:grid-cols-3 gap-6"
        >
          {[
            {
              title: 'Real-time Orders',
              description: 'Instant order tracking from kitchen to table',
              icon: Zap,
            },
            {
              title: 'Staff Management',
              description: 'Organize staff, track activity, manage shifts',
              icon: Users,
            },
            {
              title: 'Live Analytics',
              description: 'Real-time insights into sales and operations',
              icon: BarChart3,
            },
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                whileHover={{ y: -5 }}
                className="rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 hover:border-amber-500/50 transition-colors"
              >
                <Icon className="h-8 w-8 text-amber-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400">{feature.description}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="flex h-8 w-5 items-center justify-center rounded-full border border-slate-600">
          <div className="h-2 w-1 rounded-full bg-amber-400" />
        </div>
      </motion.div>
    </div>
  );
}
