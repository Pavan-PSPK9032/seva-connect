import { ChatSurface } from '../components/Chatbot';

export default function ChatbotPage() {
  return (
    <div className="container-x py-14">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Seva AI</p>
          <h1 className="mt-2 section-title">Ask our volunteer assistant</h1>
          <p className="section-sub mx-auto">
            Seva AI reads the live event and NGO listings on this platform, so it only ever suggests
            opportunities that actually exist right now.
          </p>
        </div>

        <div className="card mt-8 h-[34rem] overflow-hidden">
          <ChatSurface showStatus />
        </div>
      </div>
    </div>
  );
}
