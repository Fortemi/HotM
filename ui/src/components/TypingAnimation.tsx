import { useState, useEffect, useRef } from 'react';

interface TypingAnimationProps {
  oldText: string;
  newText: string;
  onComplete?: () => void;
  className?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

interface TypingEvent {
  type: 'delete' | 'type' | 'pause';
  char?: string;
  duration: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function seededHash(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function baseNoise(x: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + seed * 0.0001) * 43758.5453;
  return n - Math.floor(n);
}

// Perlin-like 1D value noise in [0, 1]
function perlinLike1d(x: number, seed: number): number {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const t = x - x0;
  const n0 = baseNoise(x0, seed);
  const n1 = baseNoise(x1, seed);
  return n0 + (n1 - n0) * smoothstep(t);
}

export function TypingAnimation({ 
  oldText, 
  newText, 
  onComplete, 
  className = '',
  speed = 'normal'
}: TypingAnimationProps) {
  const [currentText, setCurrentText] = useState(oldText);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const eventQueueRef = useRef<TypingEvent[]>([]);
  const currentIndexRef = useRef(0);
  
  // Speed configurations (milliseconds)
  const speedConfig = {
    slow: { type: 145, delete: 92, pause: 330, mistake: 240 },
    normal: { type: 95, delete: 58, pause: 230, mistake: 185 },
    fast: { type: 58, delete: 38, pause: 130, mistake: 120 }
  };
  
  const config = speedConfig[speed];
  
  // Generate typing events with realistic human-like behavior
  const generateTypingEvents = (from: string, to: string): TypingEvent[] => {
    const events: TypingEvent[] = [];
    
    // If texts are the same, no animation needed
    if (from === to) return events;

    const seed = seededHash(`${from}=>${to}`);
    let eventCursor = 0;
    const noiseAt = (step: number, freq = 0.55) => perlinLike1d(step * freq, seed);
    const jitter = (base: number, step: number, spread = 0.75) =>
      Math.round(base * (1 + (noiseAt(step) * 2 - 1) * spread));

    // Start with a short "thinking" pause.
    events.push({
      type: 'pause',
      duration: clamp(jitter(config.pause, eventCursor++, 0.7), 55, config.pause * 2.4),
    });

    // User-like full backspace of existing title.
    for (let i = from.length; i > 0; i -= 1) {
      const pauseChance = noiseAt(eventCursor, 0.35);
      if (pauseChance > 0.9) {
        events.push({
          type: 'pause',
          duration: clamp(jitter(config.pause * 0.75, eventCursor++, 0.8), 40, config.pause * 2.1),
        });
      }
      events.push({
        type: 'delete',
        duration: clamp(jitter(config.delete, eventCursor++, 0.9), 18, config.delete * 2.4),
      });
    }

    events.push({
      type: 'pause',
      duration: clamp(jitter(config.pause, eventCursor++, 0.75), 65, config.pause * 2.5),
    });

    // Type new title with variable cadence and occasional typo + correction.
    const newChars = to;
    const typoAlphabet = 'abcdefghijklmnopqrstuvwxyz';
    let typoInjected = false;
    for (let i = 0; i < newChars.length; i += 1) {
      const char = newChars[i];
      const typoSignal = noiseAt(eventCursor + i * 0.9, 0.42);
      const typoChance = 0.007; // <1% per position, and we cap to one mistake per title
      const shouldTypo =
        !typoInjected &&
        char.trim().length > 0 &&
        i < newChars.length - 1 &&
        typoSignal > 1 - typoChance;

      if (shouldTypo) {
        typoInjected = true;
        const wordStart = (() => {
          for (let j = i - 1; j >= 0; j -= 1) {
            if (newChars[j] === ' ') return j + 1;
          }
          return 0;
        })();
        const charsInCurrentWord = i - wordStart;
        const wholeWordCorrection = charsInCurrentWord > 2 && noiseAt(eventCursor + i * 1.7, 0.21) > 0.985;
        const typoLength = wholeWordCorrection
          ? clamp(charsInCurrentWord, 3, 10)
          : clamp(2 + Math.floor(noiseAt(eventCursor + i * 1.3, 0.31) * 4), 2, 6);

        for (let t = 0; t < typoLength; t += 1) {
          const idx = Math.floor(noiseAt(eventCursor + t + i * 1.3, 0.73) * typoAlphabet.length);
          const wrongChar = typoAlphabet[idx] || 'x';
          events.push({
            type: 'type',
            char: wrongChar,
            duration: clamp(jitter(config.type, eventCursor++, 0.95), 20, config.type * 2.6),
          });
        }

        events.push({
          type: 'pause',
          duration: clamp(jitter(config.mistake, eventCursor++, 0.9), 55, config.mistake * 2.4),
        });

        for (let t = 0; t < typoLength; t += 1) {
          events.push({
            type: 'delete',
            duration: clamp(jitter(config.delete, eventCursor++, 0.95), 18, config.delete * 2.6),
          });
        }

        events.push({
          type: 'pause',
          duration: clamp(jitter(config.mistake * 0.55, eventCursor++, 0.8), 35, config.mistake * 1.8),
        });
      }

      events.push({
        type: 'type',
        char,
        duration: clamp(jitter(config.type, eventCursor++, 0.95), 20, config.type * 2.7),
      });

      if (['.', '!', '?', ',', ';', ':'].includes(char)) {
        events.push({
          type: 'pause',
          duration: clamp(jitter(config.pause * 0.65, eventCursor++, 0.8), 40, config.pause * 1.9),
        });
      }
    }
    
    return events;
  };
  
  // Execute the next typing event
  const executeNextEvent = () => {
    if (currentIndexRef.current >= eventQueueRef.current.length) {
      setIsAnimating(false);
      onComplete?.();
      return;
    }
    
    const event = eventQueueRef.current[currentIndexRef.current];
    currentIndexRef.current++;
    
    switch (event.type) {
      case 'delete':
        setCurrentText(prev => prev.slice(0, -1));
        break;
      case 'type':
        if (event.char) {
          setCurrentText(prev => prev + event.char);
        }
        break;
      case 'pause':
        // Just wait, no text change
        break;
    }
    
    timeoutRef.current = setTimeout(executeNextEvent, event.duration);
  };
  
  // Start animation when texts change
  useEffect(() => {
    if (oldText === newText) return;
    
    // Clear any existing animation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Generate and start new animation
    eventQueueRef.current = generateTypingEvents(oldText, newText);
    currentIndexRef.current = 0;
    
    if (eventQueueRef.current.length > 0) {
      setIsAnimating(true);
      setCurrentText(oldText);
      executeNextEvent();
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [oldText, newText]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <span className={`${className} ${isAnimating ? 'font-mono' : ''}`}>
      {currentText}
      {isAnimating && (
        <span className="inline-block w-0.5 h-4 bg-current ml-1 animate-pulse" />
      )}
    </span>
  );
}

// Hook for managing multiple typing animations
export function useTypingAnimation(initialText: string) {
  const [currentText, setCurrentText] = useState(initialText);
  const [targetText, setTargetText] = useState(initialText);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const updateText = (newText: string) => {
    if (newText !== currentText && newText !== targetText) {
      setTargetText(newText);
    }
  };
  
  const handleComplete = () => {
    setCurrentText(targetText);
    setIsAnimating(false);
  };
  
  return {
    displayText: currentText,
    targetText,
    isAnimating,
    updateText,
    TypingComponent: ({ className }: { className?: string }) => (
      <TypingAnimation
        oldText={currentText}
        newText={targetText}
        onComplete={handleComplete}
        className={className}
      />
    )
  };
}
