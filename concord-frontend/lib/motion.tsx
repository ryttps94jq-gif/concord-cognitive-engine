'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ReactNode } from 'react';

// Reusable animation variants
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } }
};

export const pulseGlow: Variants = {
  idle: { boxShadow: '0 0 0 0 rgba(0, 255, 255, 0)' },
  pulse: {
    boxShadow: [
      '0 0 0 0 rgba(0, 255, 255, 0.4)',
      '0 0 20px 10px rgba(0, 255, 255, 0)',
    ],
    transition: { duration: 1, repeat: Infinity }
  }
};

// Page transition wrapper
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeIn}
    >
      {children}
    </motion.div>
  );
}

// Staggered list wrapper
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered list item
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// Animated card with hover effects
export function AnimatedCard({
  children,
  className,
  onClick
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

// Presence wrapper for conditional rendering
export function Presence({
  children,
  show,
  mode = 'wait'
}: {
  children: ReactNode;
  show: boolean;
  mode?: 'wait' | 'sync' | 'popLayout';
}) {
  return (
    <AnimatePresence mode={mode}>
      {show && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={fadeIn}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Number counter animation
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

// Breathing glow effect for active items
export function BreathingGlow({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <motion.div
      animate={active ? {
        boxShadow: [
          '0 0 5px rgba(0, 255, 255, 0.3)',
          '0 0 20px rgba(0, 255, 255, 0.6)',
          '0 0 5px rgba(0, 255, 255, 0.3)',
        ]
      } : {}}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

// Slide-in panel (for sidebars, drawers)
export function SlidePanel({
  children,
  open,
  side = 'right',
  className
}: {
  children: ReactNode;
  open: boolean;
  side?: 'left' | 'right';
  className?: string;
}) {
  const xValue = side === 'right' ? '100%' : '-100%';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: xValue, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: xValue, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Collapse animation
export function Collapse({ children, open }: { children: ReactNode; open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Floating action button with entrance animation
export function FloatingButton({
  children,
  onClick,
  className
}: {
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
}

// Shake animation for errors
export function Shake({ children, trigger }: { children: ReactNode; trigger: boolean }) {
  return (
    <motion.div
      animate={trigger ? {
        x: [-10, 10, -10, 10, 0],
        transition: { duration: 0.4 }
      } : {}}
    >
      {children}
    </motion.div>
  );
}

// Success checkmark animation
export function SuccessCheck({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.svg
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          className="w-6 h-6 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </motion.svg>
      )}
    </AnimatePresence>
  );
}

export { motion, AnimatePresence };
