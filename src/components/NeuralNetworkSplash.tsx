import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BG1 from "../assets/Home/BG1.jpg";
import logo from "../assets/logo/AUSDAV_llogo.png";

interface Bubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hasReachedCenter: boolean;
}

interface NeuralNetworkSplashProps {
  onComplete?: () => void;
  stayVisible?: boolean;
}

const NeuralNetworkSplash: React.FC<NeuralNetworkSplashProps> = ({
  onComplete = () => {},
  stayVisible = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const bubblesRef = useRef<Bubble[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [showText, setShowText] = useState(true);
  const [showNeuralNetwork, setShowNeuralNetwork] = useState(true);

  // Check if splash was already shown this session
  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setPrefersReducedMotion(reducedMotion);

    if (stayVisible) {
      onComplete();
      return;
    }

    const hasSeenSplash = sessionStorage.getItem("ausdav-splash-shown");
    if (hasSeenSplash) {
      setIsVisible(false);
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem("ausdav-splash-shown", "true");
      setTimeout(onComplete, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete, stayVisible]);

  // Initialize bubbles randomly
  const initBubbles = useCallback((width: number, height: number) => {
    const totalBubbles = 60;
    const bubbles: Bubble[] = [];
    for (let i = 0; i < totalBubbles; i++) {
      bubbles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        radius: Math.random() * 3 + 2,
        hasReachedCenter: false,
      });
    }
    bubblesRef.current = bubbles;
  }, []);

  // Draw bubbles and neural network
  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      isStatic: boolean
    ) => {
      ctx.clearRect(0, 0, width, height);

      const bubbles = bubblesRef.current;
      const centerX = width / 2;
      const centerY = height / 2;

      if (!showNeuralNetwork) {
        // Draw bubbles moving to center
        bubbles.forEach((bubble) => {
          // Outer glow
          const gradient = ctx.createRadialGradient(
            bubble.x,
            bubble.y,
            0,
            bubble.x,
            bubble.y,
            bubble.radius * 4
          );
          gradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
          gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.radius * 4, 0, Math.PI * 2);
          ctx.fill();

          // Core bubble
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Update positions if not static
        if (!isStatic) {
          let allReachedCenter = true;
          bubbles.forEach((bubble) => {
            if (!bubble.hasReachedCenter) {
              bubble.x += bubble.vx;
              bubble.y += bubble.vy;

              // Check if reached center
              const dx = bubble.x - centerX;
              const dy = bubble.y - centerY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance < 30) {
                bubble.hasReachedCenter = true;
              } else {
                allReachedCenter = false;
              }
            }
          });

          // If all bubbles reached center, show text
          if (allReachedCenter && !showText) {
            setShowText(true);
            // After text animation, show neural network
            setTimeout(() => setShowNeuralNetwork(true), 1000);
          }
        }
      } else {
        // Draw neural network
        const connectionDistance = 150;

        // Draw connections
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 0.5;

        for (let i = 0; i < bubbles.length; i++) {
          for (let j = i + 1; j < bubbles.length; j++) {
            const dx = bubbles[i].x - bubbles[j].x;
            const dy = bubbles[i].y - bubbles[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
              const opacity = (1 - distance / connectionDistance) * 0.3;
              ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
              ctx.beginPath();
              ctx.moveTo(bubbles[i].x, bubbles[i].y);
              ctx.lineTo(bubbles[j].x, bubbles[j].y);
              ctx.stroke();
            }
          }
        }

        // Draw nodes with glow
        bubbles.forEach((bubble) => {
          // Outer glow
          const gradient = ctx.createRadialGradient(
            bubble.x,
            bubble.y,
            0,
            bubble.x,
            bubble.y,
            bubble.radius * 4
          );
          gradient.addColorStop(0, "rgba(14, 165, 233, 0.4)");
          gradient.addColorStop(1, "rgba(14, 165, 233, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.radius * 4, 0, Math.PI * 2);
          ctx.fill();

          // Core node
          ctx.fillStyle = "rgba(59, 130, 246, 0.9)";
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
          ctx.fill();
        });

        // Update positions for neural network movement
        if (!isStatic) {
          bubbles.forEach((bubble) => {
            bubble.x += bubble.vx;
            bubble.y += bubble.vy;

            // Bounce off edges
            if (bubble.x < 0 || bubble.x > width) bubble.vx *= -1;
            if (bubble.y < 0 || bubble.y > height) bubble.vy *= -1;

            // Keep within bounds
            bubble.x = Math.max(0, Math.min(width, bubble.x));
            bubble.y = Math.max(0, Math.min(height, bubble.y));
          });
        }
      }
    },
    [showText, showNeuralNetwork]
  );

  // Animation loop
  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initBubbles(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    if (prefersReducedMotion) {
      // Static draw for reduced motion
      draw(ctx, canvas.width, canvas.height, true);
    } else {
      // Animated loop
      const animate = () => {
        draw(ctx, canvas.width, canvas.height, false);
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, prefersReducedMotion, draw, initBubbles]);

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
          animate={{
            backgroundColor: [
              "hsl(222 47% 4%)",
              "hsl(228 48% 5%)",
              "hsl(222 47% 4%)",
            ],
          }}
          exit={{ opacity: 0 }}
          transition={{
            backgroundColor: {
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            },
            opacity: { duration: 0.5, ease: "easeInOut" },
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          style={{
            backgroundImage: `url(${BG1})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "brightness(0.9)",
          }}
        >
          {/* Neural Network Canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* Content Overlay */}
          <div className="relative z-100 text-center text-white px-4">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                showText ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
              }
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-6"
            >
              {/* Organization Name */}
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-5xl sm:text-7xl md:text-9xl font-bold mb-3 tracking-wide text-white"
              >
                <span className="text-foreground">
                  <motion.span
                    initial={{ x: -200, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    A
                  </motion.span>
                  <motion.span
                    initial={{ y: -200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  >
                    U
                  </motion.span>
                  <motion.span
                    initial={{ x: 200, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                  >
                    S
                  </motion.span>
                </span>
                <span className="text-cyan-400" style={{ textShadow: '0 0 30px #00FFFF, 0 0 50px #00FFFF', filter: 'brightness(1.3)' }}>
                  <motion.span
                    initial={{ y: 200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                  >
                    D
                  </motion.span>
                  <motion.span
                    initial={{ x: -200, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                  >
                    A
                  </motion.span>
                  <motion.span
                    initial={{ y: -200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                  >
                    V
                  </motion.span>
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-xs sm:text-sm md:text-base text-slate-100 max-w-md mx-auto px-2"
              >
                All University Students' Development Association Vavuniya
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="text-[10px] sm:text-xs text-cyan-300 mt-3 sm:mt-4 font-medium tracking-wider sm:tracking-widest uppercase"
              >
                Empowering Students, Transforming Futures
              </motion.p>
            </motion.div>

            {/* Running duck */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="flex justify-center mt-4 sm:mt-8"
            >
              <motion.img
                src={logo}
                alt="AUSDAV Logo"
                className="h-12 sm:h-16 w-auto"
                animate={{
                  x: prefersReducedMotion ? 0 : [-80, 80, -80],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          </div>

          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute bottom-8 right-8 text-muted-foreground hover:text-foreground text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded px-3 py-1.5 bg-secondary/50 hover:bg-secondary"
            aria-label="Skip splash screen"
          >
            Skip
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NeuralNetworkSplash;
