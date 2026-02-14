import React from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const UnderConstructionPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-800">
      <div className="container px-4 mx-auto">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white dark:bg-slate-900/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg p-10 text-center">
            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 dark:bg-primary/20 mx-auto mb-6">
              <Wrench className="w-12 h-12 text-primary" />
            </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Site Under Construction</h1>
          <p className="text-muted-foreground mb-6">We're making some improvements — thanks for your patience!</p>

          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex flex-col items-center text-sm text-muted-foreground">
              <Clock className="w-5 h-5 mb-2 text-muted-foreground" />
              <span>ETA</span>
              <span className="text-foreground font-semibold">Early 2026</span>
            </div>

            <div className="h-8 w-px bg-border/40" />

            <div className="flex flex-col items-center text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">What to expect</span>
              <span>Improved UX, faster pages, new features</span>
            </div>
          </div>
{/* 
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/" className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-primary text-white hover:opacity-95 shadow-sm">
              Go to Home
            </Link>
            <a href="mailto:hello@ausdav.org" className="inline-flex items-center justify-center px-5 py-3 rounded-md border border-border/50 text-sm text-foreground hover:bg-muted">Contact Us</a>
          </div> */}

          <div className="mt-8 text-xs text-muted-foreground">Check back soon — follow our social links for updates.</div>
        </div>
      </motion.div>
      </div>
    </div>
  );
};

export default UnderConstructionPage;
