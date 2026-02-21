// Type declarations for Google's <model-viewer> web component
// @see https://modelviewer.dev

import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement> & {
    src?: string;
    alt?: string;
    poster?: string;
    loading?: 'auto' | 'lazy' | 'eager';
    reveal?: 'auto' | 'manual';
    'camera-controls'?: boolean | '';
    'auto-rotate'?: boolean | '';
    'auto-rotate-delay'?: number | string;
    'rotation-per-second'?: string;
    'shadow-intensity'?: number | string;
    'shadow-softness'?: number | string;
    'tone-mapping'?: 'neutral' | 'commerce' | 'aces';
    exposure?: number | string;
    'environment-image'?: string;
    'camera-orbit'?: string;
    'camera-target'?: string;
    'field-of-view'?: string;
    'min-camera-orbit'?: string;
    'max-camera-orbit'?: string;
    'min-field-of-view'?: string;
    'max-field-of-view'?: string;
    'animation-name'?: string;
    autoplay?: boolean | '';
    ar?: boolean | '';
    'ar-modes'?: string;
  },
  HTMLElement
>;

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}
