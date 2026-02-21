import { useSyncExternalStore } from 'react';
import { jobEventStore, type JobStoreState } from '@/services/jobEventStore';

export function useJobStore(): JobStoreState {
  return useSyncExternalStore(
    jobEventStore.subscribe,
    jobEventStore.getSnapshot,
    jobEventStore.getServerSnapshot,
  );
}
