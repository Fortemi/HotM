import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteMetadata } from '../NoteMetadata';

describe('NoteMetadata', () => {
  it('renders flat tags and SKOS concepts separately', () => {
    render(
      <NoteMetadata
        tags={['user-tag']}
        conceptTags={[
          {
            concept_id: 'c-1',
            pref_label: 'Database Engineering',
            notation: 'engineering/database',
            confidence: 0.92,
            relevance_score: 0.85,
            is_primary: true,
          },
        ]}
      />
    );

    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('user-tag')).toBeInTheDocument();

    expect(screen.getByText('SKOS Concepts')).toBeInTheDocument();
    expect(screen.getByText('Database Engineering')).toBeInTheDocument();
    expect(screen.getByText('engineering/database')).toBeInTheDocument();
    expect(screen.getByText('confidence 92%')).toBeInTheDocument();
    expect(screen.getByText('relevance 85%')).toBeInTheDocument();
  });
});
