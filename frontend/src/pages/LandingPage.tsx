import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="landing">
      <section className="hero-row">
        <div className="hero-content">
          <p className="hero-eyebrow">RAG internal knowledge assistant</p>
          <h1>Ask your internal docs a question. Get an answer with receipts.</h1>
          <p className="hero-lede">
            Mimo is a portfolio project demonstrating a retrieval-augmented generation
            assistant: it answers questions from a private knowledge base and cites where
            each answer came from, or says so plainly when it doesn't know.
          </p>
          <div className="cta-row">
            <Link to="/chat" className="primary-button cta-button">
              Start a chat
            </Link>
            <Link to="/upload" className="secondary-button cta-button">
              Upload a document
            </Link>
          </div>
        </div>

        <div className="hero-media">
          <div className="video-placeholder" role="img" aria-label="Demo video placeholder — a walkthrough of Mimo will be embedded here">
            <span className="play-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="video-placeholder-label">Demo video coming soon</span>
          </div>
        </div>
      </section>
    </div>
  );
}
