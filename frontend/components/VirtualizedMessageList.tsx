import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MessageItem, { MessageType } from './MessageItem';

export default function VirtualizedMessageList({
  messages,
  currentUser,
}: {
  messages: MessageType[];
  currentUser: string | null;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84,
    overscan: 6,
  });

  return (
    <div ref={parentRef} className="turbo-message-list">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index];
          return (
            <div
              key={message.id}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageItem message={message} isOwn={message.author === currentUser} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
