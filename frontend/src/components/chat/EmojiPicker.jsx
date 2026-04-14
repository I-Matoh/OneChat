import { useState } from 'react';
import { cn } from '@/lib/utils';

const EMOJI_CATEGORIES = {
  'Common': ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏', '✅', '🙌'],
  'Faces': ['😀', '😎', '🤔', '😅', '🥳', '😍', '🤩', '😬', '🙄', '😤'],
  'Objects': ['💡', '⚡', '🚀', '💎', '🎯', '📌', '🔑', '💰', '📊', '🛠️'],
  'Symbols': ['⭐', '💯', '✨', '🔥', '💪', '👀', '🙏', '🤝', '💬', '📢'],
};

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('Common');

  return (
    <div className="absolute bottom-full mb-1 z-50 bg-card border border-border rounded-xl shadow-xl p-2 w-56"
      onMouseLeave={onClose}
    >
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 border-b border-border pb-1.5">
        {Object.keys(EMOJI_CATEGORIES).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'text-xs px-2 py-1 rounded-md transition-colors font-medium',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {cat}
          </button>
        ))}
      </div>
      {/* Emojis */}
      <div className="grid grid-cols-5 gap-1">
        {EMOJI_CATEGORIES[activeCategory].map(emoji => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-xl p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}