import React from 'react';

const DEFAULT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="turbo-reaction-picker">
      {DEFAULT_REACTIONS.map((r) => (
        <button key={r} onClick={() => onPick(r)} className="turbo-reaction-option">
          {r}
        </button>
      ))}
    </div>
  );
}
