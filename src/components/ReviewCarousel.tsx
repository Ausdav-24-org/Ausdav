import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Review {
  en: string;
  ta: string;
  author: string;
  image: string;
}

interface ReviewCarouselProps {
  reviews: Review[];
  language: string;
}

const ReviewCarousel: React.FC<ReviewCarouselProps> = ({
  reviews,
  language,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? reviews.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === reviews.length - 1 ? 0 : prevIndex + 1
    );
  };

  const currentReview = reviews[currentIndex];

  return (
    <div className="relative flex items-center justify-center gap-8">
      {/* Previous Button */}
      <button
        onClick={goToPrevious}
        className="absolute left-0 md:relative z-10 bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full transition-all duration-300 flex items-center justify-center"
        aria-label="Previous review"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Review Container */}
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-br from-slate-700 to-slate-600 rounded-2xl p-8 md:p-12 flex flex-col md:flex-row gap-8 items-stretch max-w-4xl w-full shadow-2xl"
      >
        {/* Image/Avatar */}
        <div className="flex-shrink-0 flex items-center justify-center">
          <div className="w-40 h-40 md:w-52 md:h-52 rounded-2xl bg-slate-800 flex items-center justify-center text-7xl md:text-9xl shadow-lg">
            {currentReview.image}
          </div>
        </div>

        {/* Review Content */}
        <div className="flex flex-col justify-center flex-1">
          <div className="text-cyan-400 text-5xl md:text-6xl mb-4 leading-none">
            "
          </div>
          <p className="text-white text-lg md:text-xl leading-relaxed mb-6">
            {language === "en" ? currentReview.en : currentReview.ta}
          </p>
          <div>
            <h4 className="text-white font-bold text-lg md:text-xl">
              {currentReview.author}
            </h4>
          </div>
        </div>
      </motion.div>

      {/* Next Button */}
      <button
        onClick={goToNext}
        className="absolute right-0 md:relative z-10 bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full transition-all duration-300 flex items-center justify-center"
        aria-label="Next review"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-16 flex gap-2">
        {reviews.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              idx === currentIndex ? "bg-cyan-400 w-8" : "bg-slate-600"
            }`}
            aria-label={`Go to review ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ReviewCarousel;
