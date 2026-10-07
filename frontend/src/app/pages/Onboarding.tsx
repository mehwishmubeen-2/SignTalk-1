import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, Hand, MessageSquare, Video, Mic, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';

const onboardingSteps = [
  {
    id: 1,
    title: 'Welcome to SignTalk',
    description: 'Your complete platform for learning and communicating with sign language',
    icon: Hand,
    gradient: 'from-teal-700 to-emerald-500',
    emoji: '👋'
  },
  {
    id: 2,
    title: 'AI-Powered Dictionary',
    description: 'Ask our chatbot for any sign and get instant video demonstrations with detailed descriptions',
    icon: MessageSquare,
    gradient: 'from-emerald-600 to-teal-400',
    emoji: ''
  },
  {
    id: 3,
    title: 'Real-Time Translation',
    description: 'signs to text, and voice to text with our advanced AI technology',
    icon: Mic,
    gradient: 'from-orange-500 to-amber-400',
    emoji: ''
  },
  {
    id: 4,
    title: 'Video Calls with Live Conversion',
    description: 'Connect with others via video call with real-time voice-to-text and sign-to-text conversion',
    icon: Video,
    gradient: 'from-orange-500 to-red-500',
    emoji: '📹'
  },
  {
    id: 5,
    title: 'Ready to Get Started?',
    description: 'Join thousands of learners and break communication barriers today',
    icon: BookOpen,
    gradient: 'from-teal-700 to-orange-500',
    emoji: ''
  }
];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate('/auth');
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    navigate('/auth');
  };

  const step = onboardingSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#fffaf0_0%,#f2fbf8_48%,#fff3ed_100%)] relative overflow-hidden">
      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-teal-400/20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-14 h-14 bg-gradient-to-br from-teal-700 via-emerald-500 to-orange-400 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-900/15"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <span className="text-3xl">👋</span>
            </motion.div>
            <span className="text-3xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">
              SignTalk
            </span>
          </div>
        </motion.div>

        {/* Main Card */}
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-12"
            >
              {/* Step Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="mb-8 text-center"
              >
                <motion.div
                  className={`inline-flex w-24 h-24 rounded-full bg-gradient-to-br ${step.gradient} items-center justify-center shadow-lg mb-4`}
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <span className="text-5xl">{step.emoji}</span>
                </motion.div>
              </motion.div>

              {/* Content */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center space-y-4 mb-8"
              >
                <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent">
                  {step.title}
                </h2>
                <p className="text-lg text-gray-600 max-w-xl mx-auto">
                  {step.description}
                </p>
              </motion.div>

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mb-8">
                {onboardingSteps.map((_, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentStep 
                        ? 'w-8 bg-gradient-to-r from-teal-700 to-orange-500'
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  />
                ))}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={currentStep === 0 ? handleSkip : handlePrev}
                  className="flex-1 md:flex-none"
                >
                  {currentStep === 0 ? (
                    'Skip'
                  ) : (
                    <>
                      <ChevronLeft className="w-4 h-4 mr-2" />
                      Back
                    </>
                  )}
                </Button>

                <motion.div 
                  className="flex-1"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={handleNext}
                    className="w-full bg-gradient-to-r from-teal-700 via-emerald-600 to-orange-500 hover:opacity-90 text-white shadow-lg shadow-teal-900/15"
                    size="lg"
                  >
                    {isLastStep ? (
                      <>
                        Get Started
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip Button (mobile) */}
        {!isLastStep && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={handleSkip}
            className="mt-6 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Skip introduction →
          </motion.button>
        )}
      </div>
    </div>
  );
}