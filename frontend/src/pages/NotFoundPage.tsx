import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="px-[5vw] py-[clamp(4rem,10vw,10rem)]">
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">[ 404 ]</p>
      <h1 className="mt-6 text-[clamp(2.5rem,8vw,7rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
        Not found in the knowledge base.
      </h1>
      <p className="mt-6 max-w-[44ch] leading-relaxed text-muted">This page doesn&apos;t exist. Mimo would rather say so than guess.</p>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 font-mono text-sm uppercase tracking-[0.06em]">
        <Link to="/" className="underline decoration-border underline-offset-8 hover:decoration-accent">Home</Link>
        <Link to="/chat" className="underline decoration-border underline-offset-8 hover:decoration-accent">Chat</Link>
        <Link to="/how-it-works" className="underline decoration-border underline-offset-8 hover:decoration-accent">How it works</Link>
      </div>
    </section>
  );
}
