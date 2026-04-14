import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setIsVisible(false);
      onComplete();
      return;
    }

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 2, 100));
    }, 40);

    const timer = setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem("ausdav-splash-shown", "true");
      setTimeout(onComplete, 500);
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  // Skip button handler
  const handleSkip = () => {
    setIsVisible(false);
    sessionStorage.setItem("ausdav-splash-shown", "true");
    onComplete();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        >
          {/* Background Particles */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-secondary/20 rounded-full"
              initial={{
                x:
                  Math.random() *
                  (typeof window !== "undefined" ? window.innerWidth : 1920),
                y:
                  Math.random() *
                  (typeof window !== "undefined" ? window.innerHeight : 1080),
                opacity: 0.2,
              }}
              animate={{
                x:
                  Math.random() *
                  (typeof window !== "undefined" ? window.innerWidth : 1920),
                y:
                  Math.random() *
                  (typeof window !== "undefined" ? window.innerHeight : 1080),
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: Math.random() * 15 + 10,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}

          {/* Cyan Bubbles from Corners */}
          {(() => {
            const centerX =
              typeof window !== "undefined" ? window.innerWidth / 2 : 960;
            const centerY =
              typeof window !== "undefined" ? window.innerHeight / 2 : 540;
            const bubbles = [
              { initial: { left: -50, top: -50 } },
              { initial: { left: window.innerWidth + 50, top: -50 } },
              { initial: { left: -50, top: window.innerHeight + 50 } },
              {
                initial: {
                  left: window.innerWidth + 50,
                  top: window.innerHeight + 50,
                },
              },
            ];
            return bubbles.map((bubble, i) => (
              <motion.div
                key={i}
                className="absolute w-6 h-6 bg-cyan-400 rounded-full z-10"
                style={{ left: bubble.initial.left, top: bubble.initial.top }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, left: centerX, top: centerY }}
                transition={{ duration: 1, ease: "easeOut", delay: i * 0.1 }}
              />
            ));
          })()}

          <div className="text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-6"
            >
              {/* Logo */}
              <div className="w-32 h-32 mx-auto mb-6 relative">
                <motion.div
                  className="absolute inset-0 rounded-full bg-secondary/20"
                  animate={{
                    rotate: 360,
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
                <div className="absolute inset-0 rounded-full bg-secondary/10 animate-pulse" />
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center neon-glow shadow-2xl">
                  <motion.span
                    className="text-4xl font-serif font-bold text-primary"
                    animate={{
                      textShadow: [
                        "0 0 10px rgba(59, 130, 246, 0.5)",
                        "0 0 20px rgba(59, 130, 246, 0.8)",
                        "0 0 10px rgba(59, 130, 246, 0.5)",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    A
                  </motion.span>
                </div>
              </div>

              {/* Text Content with Stagger */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.2,
                      delayChildren: 1.5,
                    },
                  },
                }}
              >
                <motion.h1
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0 },
                    visible: { opacity: 1, y: 0, scale: 1 },
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-2xl md:text-3xl font-serif font-bold text-primary-foreground mb-2"
                >
                  AUSDAV
                </motion.h1>

                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-sm md:text-base text-primary-foreground/80 max-w-md mx-auto px-4"
                >
                  All University Students' Development Association Vavuniya
                </motion.p>

                <motion.p
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-xs text-secondary mt-4 font-medium tracking-wider uppercase"
                >
                  Empowering Students, Transforming Futures
                </motion.p>
              </motion.div>
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.4 }}
              className="flex justify-center gap-2 mt-6"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: `linear-gradient(45deg, hsl(${
                      200 + i * 40
                    }, 70%, 60%), hsl(${220 + i * 40}, 80%, 70%))`,
                    boxShadow: `0 0 10px hsl(${200 + i * 40}, 70%, 60%)`,
                  }}
                  animate={{
                    y: [0, -12, 0],
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </motion.div>

            {/* Progress Bar */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 1.2, duration: 0.4 }}
              className="mt-8 w-64 h-1 bg-secondary/20 rounded-full overflow-hidden mx-auto"
            >
              <motion.div
                className="h-full bg-gradient-to-r from-secondary to-secondary/80 rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ ease: "easeInOut" }}
              />
            </motion.div>
          </div>

          {/* Skip button for accessibility */}
          <button
            onClick={handleSkip}
            className="absolute bottom-8 right-8 text-primary-foreground/60 hover:text-primary-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-secondary rounded px-3 py-1"
            aria-label="Skip splash screen"
          >
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
