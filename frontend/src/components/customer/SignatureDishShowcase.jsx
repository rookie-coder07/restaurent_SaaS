import { memo, useState } from 'react';
import { ChefHat, Sparkles, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/**
 * Premium 4D Signature Dish Showcase
 * Only displayed for QR code customers
 * Features 3D hover effects and parallax tilt
 */
function SignatureDishShowcase({ item, onOrderClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);

  // Premium fallback dish if none provided
  const dishData = item || {
    name: 'Chef\'s Signature Biryani',
    tagline: 'Aromatic & Flavorful',
    price: 450,
    imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" style="background:linear-gradient(135deg,%23f59e0b,%23d97706)"><text x="50%25" y="50%25" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">Chef\'s Signature</text></svg>',
    description: 'A culinary masterpiece crafted with premium spices and fresh ingredients',
  };

  const handleMouseMove = (e) => {
    if (!isHovered) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const x = (e.clientX - rect.left - centerX) / centerX;
    const y = (e.clientY - rect.top - centerY) / centerY;

    setTiltX(-y * 8);
    setTiltY(x * 8);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTiltX(0);
    setTiltY(0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <section className="mb-8 px-0">
      {/* Premium Badge */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-amber-300">Chef Recommends</span>
          <Sparkles className="h-4 w-4 text-amber-400" />
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
      </div>

      {/* Showcase Card with 3D Effect */}
      <div
        className="group relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900/30 p-1 shadow-2xl transition-shadow duration-500 hover:shadow-[0_0_60px_rgba(245,158,11,0.3)]"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Animated gradient background */}
        <div className="absolute -inset-full top-0 h-full w-full animate-pulse bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-orange-500/0" />

        <div
          className="relative overflow-hidden rounded-[2.25rem] bg-slate-950 transition-transform duration-300"
          style={{
            transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${isHovered ? 1.02 : 1})`,
          }}
        >
          {/* Main Content Grid */}
          <div className="grid gap-0 md:grid-cols-2">
            {/* Image Section */}
            <div className="relative min-h-80 overflow-hidden bg-gradient-to-br from-amber-200 via-orange-100 to-red-100 md:min-h-96">
              {/* Decorative elements */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute left-1/4 top-1/4 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
                <div className="absolute right-1/4 bottom-1/4 h-40 w-40 rounded-full bg-red-400/20 blur-3xl" />
              </div>

              {/* Image with parallax */}
              <img
                src={dishData.imageUrl}
                alt={dishData.name}
                className={`relative h-full w-full object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`}
              />

              {/* Premium Badge on Image */}
              <div className="absolute top-4 right-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-950">Premium</p>
              </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-col justify-between p-6 md:p-8">
              <div>
                {/* Category Badge */}
                <div className="inline-flex items-center gap-2 rounded-lg bg-orange-500/15 px-3 py-1 mb-4">
                  <ChefHat className="h-4 w-4 text-orange-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-orange-300">Chef's Selection</span>
                </div>

                {/* Dish Name */}
                <h3 className="text-3xl font-bold text-white leading-tight md:text-4xl">
                  {dishData.name}
                </h3>

                {/* Tagline */}
                <p className="mt-3 text-lg font-medium text-amber-300">{dishData.tagline}</p>

                {/* Description */}
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {dishData.description}
                </p>

                {/* Features */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                    <p className="text-xs text-slate-400">Preparation</p>
                    <p className="mt-1 text-sm font-bold text-amber-300">15 mins</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                    <p className="text-xs text-slate-400">Servings</p>
                    <p className="mt-1 text-sm font-bold text-amber-300">1-2</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3 text-center">
                    <p className="text-xs text-slate-400">Rating</p>
                    <p className="mt-1 text-sm font-bold text-amber-300">★★★★★</p>
                  </div>
                </div>
              </div>

              {/* CTA Section */}
              <div className="mt-8 space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-400">Starting at</p>
                    <p className="text-3xl font-bold text-amber-300">{formatCurrency(dishData.price)}</p>
                  </div>
                </div>

                <button
                  onClick={onOrderClick}
                  className="group/btn w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 text-lg font-bold text-slate-950 shadow-lg transition-all duration-300 hover:shadow-[0_10px_30px_rgba(251,146,60,0.4)] hover:scale-[1.02] active:scale-98"
                >
                  <span className="inline-flex items-center justify-between w-full">
                    Order Now
                    <ArrowRight className="h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                  </span>
                </button>

                <p className="text-center text-xs text-slate-400">
                  Add to cart and customize to your preference
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(SignatureDishShowcase);
