import * as React from 'react';
import { api } from '@/api';
import { decodeCoreOperationFailure, type CoreOperationFailure } from '@/api/contract-codecs';
import { getPinnedOperationSupport } from '@/api/core-content-operations';

export type CoreAdmissionState =
  | 'checking'
  | 'compatible'
  | 'degraded'
  | 'incompatible'
  | 'unauthorized'
  | 'unknown';

export interface CoreOperationAdmission {
  state: CoreAdmissionState;
  message: string | null;
  retry: () => Promise<void>;
  allows: (operationId: string) => boolean;
  blockReason: (operationId: string) => string | null;
}

function admissionState(failure: CoreOperationFailure): CoreAdmissionState {
  if (failure.kind === 'incompatible') return 'incompatible';
  if (failure.kind === 'unauthorized' || failure.kind === 'forbidden') return 'unauthorized';
  if (failure.kind === 'degraded') return 'degraded';
  return 'unknown';
}

export function useCoreOperationAdmission(): CoreOperationAdmission {
  const [state, setState] = React.useState<CoreAdmissionState>('checking');
  const [message, setMessage] = React.useState<string | null>(null);

  const retry = React.useCallback(async () => {
    setState('checking');
    setMessage(null);
    api.compatibilityGate.reset();
    try {
      await api.compatibilityGate.preflight();
      setState('compatible');
    } catch (error) {
      const failure = decodeCoreOperationFailure(error);
      setState(admissionState(failure));
      setMessage(failure.message);
    }
  }, []);

  React.useEffect(() => {
    void retry();
  }, [retry]);

  const allows = React.useCallback((operationId: string) => (
    state === 'compatible' && getPinnedOperationSupport(operationId).supported
  ), [state]);

  const blockReason = React.useCallback((operationId: string): string | null => {
    const support = getPinnedOperationSupport(operationId);
    if (!support.supported) return 'This exact method/path/operation ID is not admitted by the pinned contract.';
    if (state === 'checking') return 'Compatibility is still being checked.';
    if (state === 'compatible') return null;
    if (state === 'unauthorized') return 'Authentication or authorization is required.';
    if (state === 'incompatible') return 'The server contract is incompatible with this HotM build.';
    if (state === 'degraded') return 'The server is unreachable or degraded.';
    return 'Capability state is unknown.';
  }, [state]);

  return { state, message, retry, allows, blockReason };
}
