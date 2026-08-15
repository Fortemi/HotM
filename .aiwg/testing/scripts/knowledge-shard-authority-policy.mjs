const EXACT_FULL_V1_TUPLE = {
  schemaVersion: '2.0.0',
  profile: 'full-v1',
};

const UNADVERTISED_TUPLES = [
  { schemaVersion: '2.0.0', profile: 'core-v1' },
  { schemaVersion: '2.0.0', profile: 'record-v1' },
];

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateKnowledgeShardAuthorityPolicy(
  receipt,
  contract,
  advertisement,
) {
  const failures = [];
  const fullV1 = receipt.fullV1;

  if (contract.contractRevision !== '21'
    || contract.contractRevision !== fullV1.authority.contract.revision) {
    failures.push('unsupported Knowledge Shard contract revision');
  }
  if (contract.status !== 'receipt-bound-opt-in') {
    failures.push('Knowledge Shard authority is not receipt-bound opt-in');
  }
  if (!sameJson(contract.selection?.advertisedOptIn, [EXACT_FULL_V1_TUPLE])) {
    failures.push('Knowledge Shard advertised opt-in tuple is missing or unexpected');
  }
  if (!sameJson(contract.selection?.unadvertised, UNADVERTISED_TUPLES)) {
    failures.push('Knowledge Shard unadvertised tuple inventory is unexpected');
  }
  if (contract.profiles?.['full-v1']?.advertised !== true
    || contract.profiles?.['record-v1']?.advertised !== false) {
    failures.push('Knowledge Shard profile advertisement state is unexpected');
  }
  if (!sameJson(fullV1.tuple, EXACT_FULL_V1_TUPLE)) {
    failures.push('HotM supports only the exact advertised 2.0.0/full-v1 tuple');
  }
  if (advertisement.status !== 'receipt-bound-opt-in-advertised'
    || advertisement.authority?.contractRevision !== '21'
    || advertisement.authority?.contractSha256 !== fullV1.authority.contract.sha256
    || advertisement.authority?.schemaBundleSha256
      !== fullV1.authority.contract.schemaBundleSha256
    || !sameJson(advertisement.selection?.advertisedOptIn, [EXACT_FULL_V1_TUPLE])) {
    failures.push('Knowledge Shard advertisement receipt does not bind the authority');
  }
  if (advertisement.evidence?.runtimeReceipt?.sha256 !== fullV1.runtimeReceipt.sha256
    || advertisement.evidence?.fullV1InteropReceipt?.sha256
      !== fullV1.pairedReceipt.sha256) {
    failures.push('Knowledge Shard advertisement evidence does not bind the pinned receipts');
  }
  if (advertisement.claims?.exact2_0_0FullV1NamedCells !== true
    || advertisement.claims?.suiteWide !== false
    || advertisement.claims?.completeBackup !== false
    || advertisement.claims?.parity !== false) {
    failures.push('Knowledge Shard advertisement claim boundary is unexpected');
  }

  return failures;
}
