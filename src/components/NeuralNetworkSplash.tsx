import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
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
  const nodesRef = useRef<Node[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check if splash was already shown this session
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPrefersReducedMotion(reducedMotion);

    if (stayVisible) {
      onComplete();
      return;
    }

    const hasSeenSplash = sessionStorage.getItem('ausdav-splash-shown');
    if (hasSeenSplash) {
      setIsVisible(false);
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem('ausdav-splash-shown', 'true');
      setTimeout(onComplete, 500);
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete, stayVisible]);

  // Initialize nodes
  const initNodes = useCallback((width: number, height: number) => {
    const nodeCount = Math.min(40, Math.floor((width * height) / 20000));
    const nodes: Node[] = [];
    
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1,
      });
    }
    
    nodesRef.current = nodes;
  }, []);

  // Draw neural network
  const draw = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, isStatic: boolean) => {
    ctx.clearRect(0, 0, width, height);
    
    const nodes = nodesRef.current;
    const connectionDistance = 150;

    // Draw connections
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < connectionDistance) {
          const opacity = (1 - distance / connectionDistance) * 0.3;
          ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes with glow
    nodes.forEach((node) => {
      // Outer glow
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 4);
      gradient.addColorStop(0, 'rgba(14, 165, 233, 0.4)');
      gradient.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius * 4, 0, Math.PI * 2);
      ctx.fill();

      // Core node
      ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Update positions if not static
    if (!isStatic) {
      nodes.forEach((node) => {
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Keep within bounds
        node.x = Math.max(0, Math.min(width, node.x));
        node.y = Math.max(0, Math.min(height, node.y));
      });
    }
  }, []);

  // Animation loop
  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initNodes(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener('resize', resize);

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
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isVisible, prefersReducedMotion, draw, initNodes]);

  const handleSkip = () => {
    setIsVisible(false);
    sessionStorage.setItem('ausdav-splash-shown', 'true');
    onComplete();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          style={{ background: 'hsl(222 47% 6%)' }}
        >
          {/* Neural Network Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Content Overlay */}
          <div className="relative z-10 text-center">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="mb-6"
            >
              <div className="w-28 h-28 mx-auto mb-6 relative">
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
                
                {/* Logo circle */}
                <div 
                  className="relative w-full h-full rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, hsl(217 91% 60%) 0%, hsl(199 89% 48%) 100%)',
                    boxShadow: '0 0 40px hsl(217 91% 60% / 0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
                  }}
                >
                  <span className="text-4xl font-serif font-bold text-white drop-shadow-lg">A</span>
                </div>
              </div>

              {/* Organization Name */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3 tracking-wide"
              >
                AUSDAV
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-sm md:text-base text-muted-foreground max-w-md mx-auto px-4"
              >
                All University Students' Development Association Vavuniya
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="text-xs text-primary mt-4 font-medium tracking-widest uppercase"
              >
                Empowering Students, Transforming Futures
              </motion.p>
            </motion.div>

            {/* Loading dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="flex justify-center gap-2 mt-8"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{
                    y: prefersReducedMotion ? 0 : [0, -8, 0],
                    opacity: prefersReducedMotion ? 1 : [0.4, 1, 0.4],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
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
