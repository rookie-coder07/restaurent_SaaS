import { memo, useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Friendly Greeting Bitmoji Animation
 * Only displayed for QR code customers
 * Auto-hides after 5 seconds, reappears on hover
 */
function GreetingBitmoji() {
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [isHovered]);

  if (!isVisible && !isHovered) {
    return (
      <button
        type="button"
        onClick={() => setIsVisible(true)}
        onMouseEnter={() => {
          setIsVisible(true);
          setIsHovered(true);
        }}
        onMouseLeave={() => setIsHovered(false)}
        className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 animate-bounce"
        title="Show greeting"
        aria-label="Show greeting"
      >
        <span className="text-2xl">👋</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-40 transition-all duration-300 ease-out animate-fadeInScale"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Container */}
      <div className="relative rounded-3xl bg-gradient-to-br from-white to-purple-50 shadow-2xl overflow-hidden border border-purple-200/50 backdrop-blur-sm max-w-xs">
        {/* Animated gradient background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-purple-300 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-pink-300 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Content */}
        <div className="relative p-5">
          {/* Bitmoji/Avatar */}
          <div className="flex items-center justify-between mb-3">
            {/* Avatar with animation */}
            <div className="inline-flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-200 to-orange-300 flex items-center justify-center text-4xl shadow-lg animate-bounce" style={{ animationDelay: '0.2s' }}>
                😊
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsVisible(false)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200/50 text-slate-600 hover:bg-slate-300 transition-colors hover:scale-110"
              aria-label="Close greeting"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-900">Hi there! 👋</p>
            <p className="text-xs text-slate-700 leading-relaxed">
              Welcome to our restaurant! Don't miss out on our <span className="font-semibold text-purple-600">Chef's Signature Dish</span> — it's absolutely delicious!
            </p>
          </div>

          {/* Optional CTA Pill */}
          <div className="mt-3 pt-3 border-t border-purple-100">
            <p className="text-xs text-slate-500 text-center">
              <span className="font-semibold text-purple-600">Scroll up</span> to discover our premium picks
            </p>
          </div>

          {/* Animated indicator dots */}
          <div className="mt-3 flex justify-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            <div className="h-1.5 w-1.5 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>

        {/* Pointer tail */}
        <div className="absolute bottom-0 right-6 -mb-2 h-4 w-4 bg-white rotate-45 origin-top-left border-r border-b border-purple-200/50" />
      </div>

      {/* Add custom animations */}
      <style jsx>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .animate-fadeInScale {
          animation: fadeInScale 0.4s ease-out forwards;
        }

        @keyframes bounce-custom {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        .animate-bounce {
          animation: bounce-custom 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default memo(GreetingBitmoji);
