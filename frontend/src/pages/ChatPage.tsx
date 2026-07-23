import { useEffect, useRef } from 'react';
import { createChat } from '@n8n/chat';
import '@n8n/chat/dist/chat.css';

const CHAT_WEBHOOK_URL = import.meta.env.VITE_CHAT_WEBHOOK_URL;

export default function ChatPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    if (!CHAT_WEBHOOK_URL) {
      containerRef.current.innerHTML =
        '<p style="color:#f87171;padding:24px;font-size:14px;">' +
        'VITE_CHAT_WEBHOOK_URL is not set. Copy .env.example to .env and paste in the Chat Trigger webhook URL from the n8n query workflow.' +
        '</p>';
      return;
    }

    createChat({
      webhookUrl: CHAT_WEBHOOK_URL,
      mode: 'fullscreen',
      target: '#n8n-chat',
      showWelcomeScreen: false,
      initialMessages: [
        'Hi! Ask me anything covered by the internal knowledge base — I will cite my sources, or tell you when I do not know.',
      ],
      i18n: {
        en: {
          title: 'Mimo',
          subtitle: '',
          footer: '',
          getStarted: 'New conversation',
          inputPlaceholder: 'Ask a question...',
          closeButtonTooltip: 'Close',
        },
      },
    });
  }, []);

  return (
    <div className="chat-page">
      <div id="n8n-chat" ref={containerRef} />
    </div>
  );
}
