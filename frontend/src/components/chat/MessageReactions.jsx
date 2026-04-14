import { useState } from 'react';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmojiPicker from './EmojiPicker';

export default function MessageReactions({ msg, currentUserEmail, conversationId }) {
  const [showPicker, setShowPicker] = useState(false);
  const queryClient = useQueryClient();

  const reactions = msg.reactions || [];

  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.user_email);
    return acc;
  }, {});

  const handleReact = async (emoji) => {
    const existing = reactions.find(r => r.emoji === emoji && r.user_email === currentUserEmail);
    let updated;
    if (existing) {
      updated = reactions.filter(r => !(r.emoji === emoji && r.user_email === currentUserEmail));
    } else {
      updated = [...reactions, { emoji, user_email: currentUserEmail }];
    }
    await api.messages.update(msg._id, { reactions: updated });
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
  };

  return (
    <div className="flex items-center flex-wrap gap-1 mt-1 relative">
      {/* Existing reaction pills */}
      {Object.entries(grouped).map(([emoji, users]) => {
        const reacted = users.includes(currentUserEmail);
        return (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            title={users.join(', ')}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all',
              reacted
                ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                : 'bg-muted border-border text-foreground hover:bg-accent'
            )}
          >
            <span>{emoji}</span>
            <span>{users.length}</span>
          </button>
        );
      })}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(p => !p)}
          className="flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
        {showPicker && (
          <EmojiPicker
            onSelect={handleReact}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}