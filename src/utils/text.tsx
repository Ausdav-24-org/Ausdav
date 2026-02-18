import React from "react";

export const renderCyanTail = (text: string): React.ReactNode => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return <span className="text-cyan-400">{trimmed}</span>;
  }
  const tail = parts.pop() as string;
  const head = parts.join(" ");
  return (
    <>
      {head} <span className="text-cyan-400">{tail}</span>
    </>
  );
};



