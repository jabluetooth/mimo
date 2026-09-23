import { motion } from 'framer-motion';

// A typographic wordmark whose mark is a citation: every answer Mimo gives
// carries one, so the brand does too. The marker settles in once on load.
export default function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={'inline-flex items-baseline font-mono text-sm font-medium tracking-tight ' + className}>
      mimo
      <motion.sup
        aria-hidden="true"
        className="ml-px text-[0.72em] text-accent"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        [1]
      </motion.sup>
    </span>
  );
}
