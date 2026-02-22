import { useSyncExternalStore } from 'react';
import { uploadStore, type UploadStoreState } from '@/services/uploadStore';

export function useUploadStore(): UploadStoreState {
  return useSyncExternalStore(
    uploadStore.subscribe,
    uploadStore.getSnapshot,
    uploadStore.getServerSnapshot,
  );
}
