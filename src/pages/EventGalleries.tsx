import React from 'react';
import PublicGallery from '@/components/PublicGallery';

// Example: Display gallery for a specific event
export default function EventGalleryPage() {
  const eventId = 1; // Replace with actual event ID
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 md:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Event Galleries
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Explore photos from our university events and activities. Click on any image to view it in full screen.
          </p>
        </div>

        {/* Pentathlon 3.0 Gallery */}
        <div className="mb-16">
          <PublicGallery
            eventId={eventId}
            year={2024}
            title="PENTATHLON 3.0 - Selection Round Album"
            className="mb-4"
          />
        </div>

        {/* Other galleries can be added here */}
        {/* Example:
        <div className="mb-16">
          <PublicGallery
            eventId={2}
            year={2024}
            title="Annual Sports Day 2024"
            className="mb-4"
          />
        </div>
        */}
      </div>
    </main>
  );
}
