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
    slow: { type: 120, delete: 80, pause: 300, mistake: 200 },
    normal: { type: 80, delete: 50, pause: 200, mistake: 150 },
    fast: { type: 40, delete: 30, pause: 100, mistake: 100 }
  };
  
  const config = speedConfig[speed];
  
  // Generate typing events with realistic human-like behavior
  const generateTypingEvents = (from: string, to: string): TypingEvent[] => {
    const events: TypingEvent[] = [];
    
    // If texts are the same, no animation needed
    if (from === to) return events;
    
    // Find common prefix to avoid unnecessary deletion/retyping
    let commonPrefixLength = 0;
    const minLength = Math.min(from.length, to.length);
    for (let i = 0; i < minLength; i++) {
      if (from[i] === to[i]) {
        commonPrefixLength = i + 1;
      } else {
        break;
      }
    }
    
    // Delete characters that need to be removed (from the end of common prefix)
    for (let i = from.length; i > commonPrefixLength; i--) {
      events.push({
        type: 'delete',
        duration: config.delete + Math.random() * 20 - 10 // Add slight randomness
      });
    }
    
    // Small pause before typing new content
    if (events.length > 0) {
      events.push({ type: 'pause', duration: config.pause });
    }
    
    // Type new characters
    const newChars = to.slice(commonPrefixLength);
    for (let i = 0; i < newChars.length; i++) {
      const char = newChars[i];
      
      // Occasionally make a "mistake" for realism (5% chance)
      if (Math.random() < 0.05 && i < newChars.length - 1) {
        // Type a wrong character
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        events.push({
          type: 'type',
          char: wrongChar,
          duration: config.type + Math.random() * 30 - 15
        });
        
        // Brief pause (noticing the mistake)
        events.push({ type: 'pause', duration: config.mistake });
        
        // Delete the wrong character
        events.push({
          type: 'delete',
          duration: config.delete
        });
        
        // Brief pause before correcting
        events.push({ type: 'pause', duration: config.mistake / 2 });
      }
      
      // Type the correct character
      events.push({
        type: 'type',
        char: char,
        duration: config.type + Math.random() * 40 - 20 // Natural variation
      });
      
      // Slight pause after punctuation for realism
      if (['.', '!', '?', ',', ';', ':'].includes(char)) {
        events.push({ type: 'pause', duration: config.pause / 2 });
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