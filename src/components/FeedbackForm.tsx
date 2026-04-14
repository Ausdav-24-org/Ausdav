import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

type FeedbackInsert = {
  message: string;
  type: string | null;
  is_read: boolean;
};

const db = supabase;

export default function FeedbackForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!message.trim()) {
      toast({
        title: "Missing message",
        description: "Please enter your feedback",
      });
      return;
    }
    setSubmitting(true);
    try {
      // First try calling the rate-limited edge function
      const fnResp = await fetch("/functions/v1/submit-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (fnResp.ok) {
        toast({
          title: "Thank you",
          description: "Your feedback has been submitted",
        });
        setMessage("");
        onSuccess?.();
        return;
      }

      // If function not available or rate-limited, fall back to direct insert
      if (fnResp.status === 429) {
        toast({
          title: "Rate limited",
          description: "Too many submissions, please try later",
        });
        return;
      }

      // Fallback: direct insert using Supabase client
      const { error } = await db
        .from("feedback")
        .insert([{ message, type: null, is_read: false }]);
      if (error) throw error;
      toast({
        title: "Thank you",
        description: "Your feedback has been submitted",
      });
      setMessage("");
      onSuccess?.();
    } catch (err) {
      console.error("Error submitting feedback:", err);
      toast({
        title: "Submission failed",
        description: "Could not send feedback",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto bg-card/50 border-border">
      <CardHeader>
        <CardTitle>Send Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className="w-full rounded-md p-3 bg-input border border-border"
          placeholder="Share your feedback or report an issue..."
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
