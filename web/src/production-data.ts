// Contract types and structural rules mirror contracts/production-v2.schema.json.
export type Reference = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

export type Evidence = {
  id: string;
  sha256: string;
  url: string;
};

export type Coverage = {
  quarter: string;
  status: 'complete' | 'partial' | 'missing' | 'unpublished';
  expectedDays: number;
  observedDays: number;
  firstObservedDate: string | null;
  lastObservedDate: string | null;
  knownObservationRows: number | null;
  reason: string;
  datacenterFieldAvailable: boolean;
  evidence: Evidence[];
};

export type ModelQuarter = {
  quarter: string;
  quarterCount: number | null;
  knownIdentityLowerBound: number | null;
  knownFailures: number;
  knownDriveDays: number;
  thresholdProof: null | 'complete_exact_count' | 'partial_identity_lower_bound';
  evidence: Evidence[];
};

export type InventoryModel = {
  modelId: string;
  vendor: string;
  modelNumber: string;
  rawAliases: string[];
  mediaClass: 'hdd' | 'ssd' | 'unclassified';
  classificationEvidence: Evidence[];
  seedMatch: boolean;
  capacityTB: number | null;
  history: ModelQuarter[];
  firstObservedInDeclaredHistory: string | null;
  firstProvenThresholdInDeclaredHistory: string | null;
  firstCompleteQualifyingInDeclaredHistory: string | null;
  reportingAnchorQuarter: string | null;
  earlierQualificationNotExcluded: boolean;
  anchorSearchComplete: boolean;
  recordedHistoryComplete: boolean;
  lifetimeExposureComplete: false;
};

export type Versions = {
  normalization: string;
  classification: string;
  selection: string;
  cohort: string;
  rate: string;
  capacity: string;
};

export type SourceDomain = {
  historyStartQuarter: string;
  firstPublishedDate: string;
  throughDate: string;
  evidence: Evidence[];
};

export type Provenance = {
  label: string;
  credit: string;
  url: string;
};

export type PositiveSeed = {
  version: string;
  modelIds: string[];
  evidence: Evidence[];
  asOfQuarter: string;
  patternsSha256: string;
};

export type Selection = {
  minimumCapacityTB?: number;
  excludedModelIds?: string[];
  contextModelIds: string[];
  analysisModelIds: string[];
  purchaseDefaultModelIds: string[];
  historicalReferenceModelIds: string[];
  positiveSeed: PositiveSeed;
};

export type Context = {
  snapshotId: string;
  asOfQuarter: string;
  cutoffDate: string;
  generatedAt: string;
  kind: 'sample' | 'backblaze';
  generatorRevision: string;
  sourceManifestSha256: string;
  versions: Versions;
  sourceDomain: SourceDomain;
  provenance: Provenance;
  selection: Selection;
  coverage: Coverage[];
  inventory: InventoryModel[];
};

export type QuarterReference = {
  quarter: string;
  status: 'complete' | 'partial' | 'missing' | 'unpublished';
  payload: Reference | null;
};

export type Metrics = {
  observedRecordedAfr: number | null;
  observedRecordedAfrDelta: number | null;
  count: number | null;
  populationDelta: number | null;
  new: number | null;
  retired: number | null;
  failed: number | null;
};

export type ProductionCell = {
  quarter: string;
  relativeQuarter: number;
  status:
    | 'eligible'
    | 'below_threshold'
    | 'source_incomplete'
    | 'missing'
    | 'unpublished'
    | 'snapshot_end';
  metrics: Metrics;
  quarterAfr: number | null;
  completeHistoryAfr: number | null;
  cumulativeKnownFailures: number | null;
  cumulativeKnownDriveDays: number | null;
  baselineQuarter: string | null;
  baselineQuarterDistance: number | null;
  deltaReason: 'initialized' | 'prior_eligible' | 'unavailable';
  retiredReason:
    'inferred' | 'gap_obstructed' | 'cutoff_failed_proxy' | 'right_censored' | 'unavailable';
  sourceHistoryComplete: boolean;
};

export type MatrixModel = {
  modelId: string;
  reportingAnchorQuarter: string;
  sourceHistoryComplete: boolean;
  lifetimeExposureComplete: false;
  cells: ProductionCell[];
};

export type Aggregate = {
  count: number | null;
  new: number | null;
  capacityTB: number | null;
};

export type SupportingModel = {
  modelId: string;
  count: number | null;
  new: number | null;
  capacityTB: number | null;
};

export type Manufacturer = {
  vendor: string;
  count: number | null;
  new: number | null;
  capacityTB: number | null;
  populationShare: number | null;
  newShare: number | null;
  capacityShare: number | null;
};

export type Scope = {
  models: SupportingModel[];
  totals: Aggregate;
  manufacturers: Manufacturer[];
  capacityDeltaTB: number | null;
  capacityDeltaReason:
    | 'previous_complete'
    | 'first_quarter'
    | 'previous_unavailable'
    | 'current_incomplete'
    | 'invalid_capacity';
};

export type Scopes = {
  selected_hdd: Scope;
  all_supplied: Scope;
};

export type Location = {
  name: string;
  count: number | null;
  capacityTB: number | null;
};

export type Datacenters = {
  fieldAvailable: boolean;
  knownLocationPopulationShare: number | null;
  locations: Location[];
};

export type SnapshotDescriptor = {
  artifactType: 'snapshot_descriptor';
  contractVersion: '2.0.0';
  context: Context;
  contextSha256: string;
  matrix: Reference;
  quarters: QuarterReference[];
};

export type ProductionMatrix = {
  artifactType: 'matrix';
  contractVersion: '2.0.0';
  contextSha256: string;
  snapshotId: string;
  asOfQuarter: string;
  rateBasis:
    | 'observed-recorded-exposure-v2'
    | 'observed-quarter-distinct-failed-identities-recorded-exposure-v2.1';
  rateLabel: 'Observed-history AFR' | 'Observed-history AFR (quarterly unique failures)';
  relativeQuarterCount: number;
  guideAfterRelativeYear: number;
  models: MatrixModel[];
};

export type SupportingQuarter = {
  artifactType: 'supporting_quarter';
  contractVersion: '2.0.0';
  contextSha256: string;
  snapshotId: string;
  asOfQuarter: string;
  quarter: string;
  status: 'complete' | 'partial';
  capacityBasis: 'observed-identity-capacity-mode-v2';
  scopes: Scopes;
  datacenters: Datacenters;
};

export type SnapshotEntry = {
  snapshotId: string;
  asOfQuarter: string;
  sourceManifestSha256: string;
  descriptor: Reference;
};

export type ProductionIndex = {
  artifactType: 'generation_index';
  contractVersion: '2.0.0';
  latestSnapshotId: string;
  snapshots: SnapshotEntry[];
};

const definitions: Record<string, Rule> = {
  reference: {
    type: 'object',
    additionalProperties: false,
    required: ['path', 'sha256', 'sizeBytes'],
    properties: {
      path: {
        type: 'string',
        pattern: '^(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+[.-][a-f0-9]{64}\\.json$',
      },
      sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      sizeBytes: { type: 'integer', minimum: 1, maximum: 9007199254740991 },
    },
  },
  evidence: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'sha256', 'url'],
    properties: {
      id: { type: 'string', minLength: 1 },
      sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      url: { type: 'string', pattern: '^https://[^/@?#:]+(?:/[^?#]*)?$' },
    },
  },
  coverage: {
    type: 'object',
    additionalProperties: false,
    required: [
      'quarter',
      'status',
      'expectedDays',
      'observedDays',
      'firstObservedDate',
      'lastObservedDate',
      'knownObservationRows',
      'reason',
      'datacenterFieldAvailable',
      'evidence',
    ],
    properties: {
      quarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      status: { enum: ['complete', 'partial', 'missing', 'unpublished'] },
      expectedDays: { type: 'integer', minimum: 90, maximum: 92 },
      observedDays: { type: 'integer', minimum: 0, maximum: 92 },
      firstObservedDate: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
      lastObservedDate: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
      knownObservationRows: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      reason: { type: 'string', minLength: 1 },
      datacenterFieldAvailable: { type: 'boolean' },
      evidence: { type: 'array', items: { $ref: '#/$defs/evidence' }, minItems: 1 },
    },
  },
  modelQuarter: {
    type: 'object',
    additionalProperties: false,
    required: [
      'quarter',
      'quarterCount',
      'knownIdentityLowerBound',
      'knownFailures',
      'knownDriveDays',
      'thresholdProof',
      'evidence',
    ],
    properties: {
      quarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      quarterCount: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      knownIdentityLowerBound: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      knownFailures: { type: 'integer', minimum: 0, maximum: 9007199254740991 },
      knownDriveDays: { type: 'integer', minimum: 0, maximum: 9007199254740991 },
      thresholdProof: { enum: [null, 'complete_exact_count', 'partial_identity_lower_bound'] },
      evidence: { type: 'array', items: { $ref: '#/$defs/evidence' }, minItems: 1 },
    },
  },
  inventoryModel: {
    type: 'object',
    additionalProperties: false,
    required: [
      'modelId',
      'vendor',
      'modelNumber',
      'rawAliases',
      'mediaClass',
      'classificationEvidence',
      'seedMatch',
      'capacityTB',
      'history',
      'firstObservedInDeclaredHistory',
      'firstProvenThresholdInDeclaredHistory',
      'firstCompleteQualifyingInDeclaredHistory',
      'reportingAnchorQuarter',
      'earlierQualificationNotExcluded',
      'anchorSearchComplete',
      'recordedHistoryComplete',
      'lifetimeExposureComplete',
    ],
    properties: {
      modelId: { type: 'string', minLength: 1 },
      vendor: { type: 'string', minLength: 1 },
      modelNumber: { type: 'string', minLength: 1 },
      rawAliases: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        minItems: 1,
        uniqueItems: true,
      },
      mediaClass: { enum: ['hdd', 'ssd', 'unclassified'] },
      classificationEvidence: { type: 'array', items: { $ref: '#/$defs/evidence' }, minItems: 1 },
      seedMatch: { type: 'boolean' },
      capacityTB: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'null' }] },
      history: { type: 'array', items: { $ref: '#/$defs/modelQuarter' }, minItems: 1 },
      firstObservedInDeclaredHistory: {
        anyOf: [{ type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' }, { type: 'null' }],
      },
      firstProvenThresholdInDeclaredHistory: {
        anyOf: [{ type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' }, { type: 'null' }],
      },
      firstCompleteQualifyingInDeclaredHistory: {
        anyOf: [{ type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' }, { type: 'null' }],
      },
      reportingAnchorQuarter: {
        anyOf: [{ type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' }, { type: 'null' }],
      },
      earlierQualificationNotExcluded: { type: 'boolean' },
      anchorSearchComplete: { type: 'boolean' },
      recordedHistoryComplete: { type: 'boolean' },
      lifetimeExposureComplete: { const: false },
    },
  },
  versions: {
    type: 'object',
    additionalProperties: false,
    required: ['normalization', 'classification', 'selection', 'cohort', 'rate', 'capacity'],
    properties: {
      normalization: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      classification: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      selection: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      cohort: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      rate: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      capacity: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
    },
  },
  sourceDomain: {
    type: 'object',
    additionalProperties: false,
    required: ['historyStartQuarter', 'firstPublishedDate', 'throughDate', 'evidence'],
    properties: {
      historyStartQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      firstPublishedDate: { type: 'string', format: 'date' },
      throughDate: { type: 'string', format: 'date' },
      evidence: { type: 'array', items: { $ref: '#/$defs/evidence' }, minItems: 1 },
    },
  },
  provenance: {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'credit', 'url'],
    properties: {
      label: { type: 'string', minLength: 1 },
      credit: { type: 'string', minLength: 1 },
      url: { type: 'string', pattern: '^https://[^/@?#:]+(?:/[^?#]*)?$' },
    },
  },
  positiveSeed: {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'modelIds', 'evidence', 'asOfQuarter', 'patternsSha256'],
    properties: {
      version: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
      modelIds: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
      evidence: { type: 'array', items: { $ref: '#/$defs/evidence' }, minItems: 1 },
      asOfQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      patternsSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    },
  },
  selection: {
    type: 'object',
    additionalProperties: false,
    required: [
      'contextModelIds',
      'analysisModelIds',
      'purchaseDefaultModelIds',
      'historicalReferenceModelIds',
      'positiveSeed',
    ],
    properties: {
      minimumCapacityTB: { type: 'number', exclusiveMinimum: 0 },
      excludedModelIds: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      contextModelIds: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      analysisModelIds: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      purchaseDefaultModelIds: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      historicalReferenceModelIds: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      positiveSeed: { $ref: '#/$defs/positiveSeed' },
    },
  },
  context: {
    type: 'object',
    additionalProperties: false,
    required: [
      'snapshotId',
      'asOfQuarter',
      'cutoffDate',
      'generatedAt',
      'kind',
      'generatorRevision',
      'sourceManifestSha256',
      'versions',
      'sourceDomain',
      'provenance',
      'selection',
      'coverage',
      'inventory',
    ],
    properties: {
      snapshotId: { type: 'string', minLength: 1 },
      asOfQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      cutoffDate: { type: 'string', format: 'date' },
      generatedAt: { type: 'string', format: 'date-time' },
      kind: { enum: ['sample', 'backblaze'] },
      generatorRevision: { type: 'string', minLength: 1 },
      sourceManifestSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      versions: { $ref: '#/$defs/versions' },
      sourceDomain: { $ref: '#/$defs/sourceDomain' },
      provenance: { $ref: '#/$defs/provenance' },
      selection: { $ref: '#/$defs/selection' },
      coverage: { type: 'array', items: { $ref: '#/$defs/coverage' }, minItems: 1 },
      inventory: { type: 'array', items: { $ref: '#/$defs/inventoryModel' }, minItems: 1 },
    },
  },
  quarterReference: {
    type: 'object',
    additionalProperties: false,
    required: ['quarter', 'status', 'payload'],
    properties: {
      quarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      status: { enum: ['complete', 'partial', 'missing', 'unpublished'] },
      payload: { anyOf: [{ $ref: '#/$defs/reference' }, { type: 'null' }] },
    },
  },
  metrics: {
    type: 'object',
    additionalProperties: false,
    required: [
      'observedRecordedAfr',
      'observedRecordedAfrDelta',
      'count',
      'populationDelta',
      'new',
      'retired',
      'failed',
    ],
    properties: {
      observedRecordedAfr: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      observedRecordedAfrDelta: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      count: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      populationDelta: {
        anyOf: [
          { type: 'integer', minimum: -9007199254740991, maximum: 9007199254740991 },
          { type: 'null' },
        ],
      },
      new: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      retired: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      failed: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
    },
  },
  matrixCell: {
    type: 'object',
    additionalProperties: false,
    required: [
      'quarter',
      'relativeQuarter',
      'status',
      'metrics',
      'quarterAfr',
      'completeHistoryAfr',
      'cumulativeKnownFailures',
      'cumulativeKnownDriveDays',
      'baselineQuarter',
      'baselineQuarterDistance',
      'deltaReason',
      'retiredReason',
      'sourceHistoryComplete',
    ],
    properties: {
      quarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      relativeQuarter: { type: 'integer', minimum: 1, maximum: 9007199254740991 },
      status: {
        enum: [
          'eligible',
          'below_threshold',
          'source_incomplete',
          'missing',
          'unpublished',
          'snapshot_end',
        ],
      },
      metrics: { $ref: '#/$defs/metrics' },
      quarterAfr: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      completeHistoryAfr: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      cumulativeKnownFailures: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      cumulativeKnownDriveDays: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      baselineQuarter: {
        anyOf: [{ type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' }, { type: 'null' }],
      },
      baselineQuarterDistance: {
        anyOf: [{ type: 'integer', minimum: 1, maximum: 9007199254740991 }, { type: 'null' }],
      },
      deltaReason: { enum: ['initialized', 'prior_eligible', 'unavailable'] },
      retiredReason: {
        enum: [
          'inferred',
          'gap_obstructed',
          'cutoff_failed_proxy',
          'right_censored',
          'unavailable',
        ],
      },
      sourceHistoryComplete: { type: 'boolean' },
    },
  },
  matrixModel: {
    type: 'object',
    additionalProperties: false,
    required: [
      'modelId',
      'reportingAnchorQuarter',
      'sourceHistoryComplete',
      'lifetimeExposureComplete',
      'cells',
    ],
    properties: {
      modelId: { type: 'string', minLength: 1 },
      reportingAnchorQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      sourceHistoryComplete: { type: 'boolean' },
      lifetimeExposureComplete: { const: false },
      cells: { type: 'array', items: { $ref: '#/$defs/matrixCell' }, minItems: 1 },
    },
  },
  aggregate: {
    type: 'object',
    additionalProperties: false,
    required: ['count', 'new', 'capacityTB'],
    properties: {
      count: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      new: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      capacityTB: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
    },
  },
  supportingModel: {
    type: 'object',
    additionalProperties: false,
    required: ['modelId', 'count', 'new', 'capacityTB'],
    properties: {
      modelId: { type: 'string', minLength: 1 },
      count: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      new: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      capacityTB: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
    },
  },
  manufacturer: {
    type: 'object',
    additionalProperties: false,
    required: [
      'vendor',
      'count',
      'new',
      'capacityTB',
      'populationShare',
      'newShare',
      'capacityShare',
    ],
    properties: {
      vendor: { type: 'string', minLength: 1 },
      count: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      new: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      capacityTB: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
      populationShare: { anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
      newShare: { anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
      capacityShare: { anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }] },
    },
  },
  scope: {
    type: 'object',
    additionalProperties: false,
    required: ['models', 'totals', 'manufacturers', 'capacityDeltaTB', 'capacityDeltaReason'],
    properties: {
      models: { type: 'array', items: { $ref: '#/$defs/supportingModel' } },
      totals: { $ref: '#/$defs/aggregate' },
      manufacturers: { type: 'array', items: { $ref: '#/$defs/manufacturer' } },
      capacityDeltaTB: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      capacityDeltaReason: {
        enum: [
          'previous_complete',
          'first_quarter',
          'previous_unavailable',
          'current_incomplete',
          'invalid_capacity',
        ],
      },
    },
  },
  scopes: {
    type: 'object',
    additionalProperties: false,
    required: ['selected_hdd', 'all_supplied'],
    properties: {
      selected_hdd: { $ref: '#/$defs/scope' },
      all_supplied: { $ref: '#/$defs/scope' },
    },
  },
  location: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'count', 'capacityTB'],
    properties: {
      name: { type: 'string', minLength: 1 },
      count: {
        anyOf: [{ type: 'integer', minimum: 0, maximum: 9007199254740991 }, { type: 'null' }],
      },
      capacityTB: { anyOf: [{ type: 'number', minimum: 0 }, { type: 'null' }] },
    },
  },
  datacenters: {
    type: 'object',
    additionalProperties: false,
    required: ['fieldAvailable', 'knownLocationPopulationShare', 'locations'],
    properties: {
      fieldAvailable: { type: 'boolean' },
      knownLocationPopulationShare: {
        anyOf: [{ type: 'number', minimum: 0, maximum: 1 }, { type: 'null' }],
      },
      locations: { type: 'array', items: { $ref: '#/$defs/location' }, minItems: 1 },
    },
  },
  snapshot_descriptor: {
    type: 'object',
    additionalProperties: false,
    required: ['artifactType', 'contractVersion', 'context', 'contextSha256', 'matrix', 'quarters'],
    properties: {
      artifactType: { const: 'snapshot_descriptor' },
      contractVersion: { const: '2.0.0' },
      context: { $ref: '#/$defs/context' },
      contextSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      matrix: { $ref: '#/$defs/reference' },
      quarters: { type: 'array', items: { $ref: '#/$defs/quarterReference' }, minItems: 1 },
    },
  },
  matrix: {
    type: 'object',
    additionalProperties: false,
    required: [
      'artifactType',
      'contractVersion',
      'contextSha256',
      'snapshotId',
      'asOfQuarter',
      'rateBasis',
      'rateLabel',
      'relativeQuarterCount',
      'guideAfterRelativeYear',
      'models',
    ],
    properties: {
      artifactType: { const: 'matrix' },
      contractVersion: { const: '2.0.0' },
      contextSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      snapshotId: { type: 'string', minLength: 1 },
      asOfQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      rateBasis: {
        enum: [
          'observed-recorded-exposure-v2',
          'observed-quarter-distinct-failed-identities-recorded-exposure-v2.1',
        ],
      },
      rateLabel: {
        enum: ['Observed-history AFR', 'Observed-history AFR (quarterly unique failures)'],
      },
      relativeQuarterCount: { type: 'integer', minimum: 24 },
      guideAfterRelativeYear: { type: 'integer', minimum: 1, maximum: 6 },
      models: { type: 'array', items: { $ref: '#/$defs/matrixModel' } },
    },
  },
  supporting_quarter: {
    type: 'object',
    additionalProperties: false,
    required: [
      'artifactType',
      'contractVersion',
      'contextSha256',
      'snapshotId',
      'asOfQuarter',
      'quarter',
      'status',
      'capacityBasis',
      'scopes',
      'datacenters',
    ],
    properties: {
      artifactType: { const: 'supporting_quarter' },
      contractVersion: { const: '2.0.0' },
      contextSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      snapshotId: { type: 'string', minLength: 1 },
      asOfQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      quarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      status: { enum: ['complete', 'partial'] },
      capacityBasis: { const: 'observed-identity-capacity-mode-v2' },
      scopes: { $ref: '#/$defs/scopes' },
      datacenters: { $ref: '#/$defs/datacenters' },
    },
  },
  snapshotEntry: {
    type: 'object',
    additionalProperties: false,
    required: ['snapshotId', 'asOfQuarter', 'sourceManifestSha256', 'descriptor'],
    properties: {
      snapshotId: { type: 'string', minLength: 1 },
      asOfQuarter: { type: 'string', pattern: '^[0-9]{4}-Q[1-4]$' },
      sourceManifestSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      descriptor: { $ref: '#/$defs/reference' },
    },
  },
  generation_index: {
    type: 'object',
    additionalProperties: false,
    required: ['artifactType', 'contractVersion', 'latestSnapshotId', 'snapshots'],
    properties: {
      artifactType: { const: 'generation_index' },
      contractVersion: { const: '2.0.0' },
      latestSnapshotId: { type: 'string', minLength: 1 },
      snapshots: { type: 'array', items: { $ref: '#/$defs/snapshotEntry' }, minItems: 1 },
    },
  },
};

type Rule = {
  $ref?: string;
  const?: unknown;
  enum?: unknown[];
  anyOf?: Rule[];
  type?: string;
  properties?: Record<string, Rule>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Rule;
  minItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
};

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invalid production v2 data: ${message}`);
  }
}

/** JSON.parse alone silently discards duplicate object keys. */
export function parseStrictJson(bytes: Uint8Array): unknown {
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  let at = 0;
  const space = () => {
    while (/[\x20\t\r\n]/.test(source[at] ?? '') && at < source.length) {
      at++;
    }
  };
  function string(): string {
    const start = at++;
    while (at < source.length) {
      const c = source[at++];
      if (c === '\\') {
        at++;
      } else if (c === '"') {
        return JSON.parse(source.slice(start, at)) as string;
      }
    }
    throw new Error('Invalid production v2 JSON string');
  }
  function value(depth: number): unknown {
    requireValue(depth < 100, 'JSON nesting limit');
    space();
    if (source[at] === '"') {
      return string();
    }
    if (source[at] === '{') {
      at++;
      space();
      const result: Record<string, unknown> = {};
      const keys = new Set<string>();
      if (source[at] === '}') {
        at++;
        return result;
      }
      while (at < source.length) {
        requireValue(source[at] === '"', 'object key');
        const key = string();
        requireValue(!keys.has(key), 'duplicate JSON key');
        keys.add(key);
        space();
        requireValue(source[at++] === ':', 'object colon');
        Object.defineProperty(result, key, { value: value(depth + 1), enumerable: true });
        space();
        const delimiter = source[at++];
        if (delimiter === '}') {
          return result;
        }
        requireValue(delimiter === ',', 'object delimiter');
        space();
      }
    }
    if (source[at] === '[') {
      at++;
      space();
      const result: unknown[] = [];
      if (source[at] === ']') {
        at++;
        return result;
      }
      while (at < source.length) {
        result.push(value(depth + 1));
        space();
        const delimiter = source[at++];
        if (delimiter === ']') {
          return result;
        }
        requireValue(delimiter === ',', 'array delimiter');
      }
    }
    for (const [token, literal] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (source.startsWith(token, at)) {
        at += token.length;
        return literal;
      }
    }
    const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(source.slice(at))?.[0];
    requireValue(token, 'JSON value');
    at += token.length;
    const number = Number(token);
    requireValue(Number.isFinite(number), 'nonfinite JSON number');
    return number;
  }
  const result = value(0);
  space();
  requireValue(at === source.length, 'trailing JSON input');
  return result;
}

function validate(value: unknown, rule: Rule): boolean {
  if (rule.$ref) {
    const target = definitions[rule.$ref.split('/').at(-1) ?? ''];
    return target !== undefined && validate(value, target);
  }
  if ('const' in rule) {
    return value === rule.const;
  }
  if (rule.enum) {
    return rule.enum.includes(value);
  }
  if (rule.anyOf) {
    return rule.anyOf.some((branch) => validate(value, branch));
  }
  switch (rule.type) {
    case undefined:
      return false;
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      if (
        typeof value !== 'string' ||
        value.length < (rule.minLength ?? 0) ||
        (rule.pattern && !new RegExp(rule.pattern).test(value))
      ) {
        return false;
      }
      if (rule.format === 'date') {
        return (
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          Number.isFinite(Date.parse(value)) &&
          new Date(value).toISOString().slice(0, 10) === value
        );
      }
      if (rule.format === 'date-time') {
        return (
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
          Number.isFinite(Date.parse(value))
        );
      }
      return true;
    case 'integer':
    case 'number':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        (rule.type !== 'integer' || Number.isSafeInteger(value)) &&
        (rule.minimum === undefined || value >= rule.minimum) &&
        (rule.maximum === undefined || value <= rule.maximum) &&
        (rule.exclusiveMinimum === undefined || value > rule.exclusiveMinimum)
      );
    case 'array':
      return (
        Array.isArray(value) &&
        value.length >= (rule.minItems ?? 0) &&
        (!rule.uniqueItems ||
          new Set(value.map((item: unknown) => JSON.stringify(item))).size === value.length) &&
        value.every((item: unknown) => rule.items !== undefined && validate(item, rule.items))
      );
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return false;
      }
      const record = value as Record<string, unknown>;
      return (
        (rule.required ?? []).every((key) => Object.hasOwn(record, key)) &&
        Object.entries(record).every(([key, item]) => {
          const property = rule.properties?.[key];
          return property !== undefined && validate(item, property);
        })
      );
    }
    default:
      return false;
  }
}
function artifact<T>(bytes: Uint8Array, type: string): T {
  const value = parseStrictJson(bytes);
  const rule = definitions[type];
  requireValue(rule && validate(value, rule), `unsupported version or invalid ${type} structure`);
  validatePublicUrls(value);
  return value as T;
}

// Match the producer validator's public-host boundary without DNS resolution.
// IPv6 literals are excluded by the contract URL pattern before this check.
function publicEvidenceUrl(value: string): boolean {
  const host = /^https:\/\/([^/]+)(?:\/.*)?$/.exec(value)?.[1]?.toLowerCase().replace(/\.+$/, '');
  if (!host) {
    return false;
  }
  const labels = host.split('.');
  if (
    labels.length === 4 &&
    labels.every((label) => /^(?:0|[1-9]\d{0,2})$/.test(label) && Number(label) <= 255)
  ) {
    const [a = 0, b = 0, c = 0, d = 0] = labels.map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 240 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 0 && ((c === 0 && d !== 9 && d !== 10) || c === 2)) || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  return (
    labels.length >= 2 &&
    host.length <= 253 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    /^[a-z]/.test(labels.at(-1) ?? '') &&
    ![
      '.localhost',
      '.local',
      '.internal',
      '.localdomain',
      '.lan',
      '.home',
      '.corp',
      '.home.arpa',
      '.onion',
      '.invalid',
      '.test',
    ].some((suffix) => host.endsWith(suffix))
  );
}
function validatePublicUrls(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown) => validatePublicUrls(item));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'url') {
        requireValue(
          typeof item === 'string' && publicEvidenceUrl(item),
          'private evidence/provenance URL',
        );
      }
      validatePublicUrls(item);
    }
  }
}
export function quarterOrdinal(quarter: string): number {
  return Number(quarter.slice(0, 4)) * 4 + Number(quarter.at(-1)) - 1;
}
function unique(values: string[], label: string): void {
  requireValue(new Set(values).size === values.length, `duplicate ${label}`);
}
function sameMembers(actual: string[], expected: string[], label: string): void {
  unique(actual, label);
  requireValue(
    actual.length === expected.length && actual.every((id) => expected.includes(id)),
    label,
  );
}
function same(actual: number | null, expected: number | null, label: string, exact = false): void {
  requireValue(
    actual === expected ||
      (!exact &&
        actual !== null &&
        expected !== null &&
        Math.abs(actual - expected) <= 1e-11 * Math.max(1, Math.abs(expected))),
    label,
  );
}
function sum(values: (number | null)[]): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}
function rate(failures: number, days: number): number | null {
  return days ? (failures / days) * 36500 : null;
}
export async function verifyReference(bytes: Uint8Array, reference: Reference): Promise<void> {
  requireValue(validate(reference, definitions['reference'] ?? {}), 'unsafe reference');
  requireValue(reference.path.endsWith(`${reference.sha256}.json`), 'reference path/hash mismatch');
  requireValue(bytes.byteLength === reference.sizeBytes, 'byte size mismatch');
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  requireValue(hash === reference.sha256, 'byte hash mismatch');
}
export function parseProductionIndex(bytes: Uint8Array): ProductionIndex {
  const index = artifact<ProductionIndex>(bytes, 'generation_index');
  unique(
    index.snapshots.map((entry) => entry.snapshotId),
    'snapshot ID',
  );
  requireValue(
    index.snapshots.some((entry) => entry.snapshotId === index.latestSnapshotId),
    'latest snapshot absent',
  );
  for (const entry of index.snapshots) {
    requireValue(
      entry.descriptor.path.endsWith(`${entry.descriptor.sha256}.json`),
      'descriptor path/hash mismatch',
    );
  }
  return index;
}
export function parseSnapshotDescriptor(
  bytes: Uint8Array,
  entry: SnapshotEntry,
): SnapshotDescriptor {
  const descriptor = artifact<SnapshotDescriptor>(bytes, 'snapshot_descriptor');
  const context = descriptor.context;
  requireValue(
    context.snapshotId === entry.snapshotId &&
      context.asOfQuarter === entry.asOfQuarter &&
      context.sourceManifestSha256 === entry.sourceManifestSha256,
    'index/descriptor identity mismatch',
  );
  // These are the versioned semantics this reader implements, not merely valid semver strings.
  // The producer retains the v1 normalizer/classification lineage while emitting
  // the v2 analysis contract; fictional contract examples carry v2 lineage.
  requireValue(
    ['1.0.0', '2.0.0'].includes(context.versions.normalization) &&
      ['1.0.0', '2.0.0'].includes(context.versions.classification) &&
      ['2.0.0', '2.1.0'].includes(context.versions.rate) &&
      ['2.0.0', '2.1.0'].includes(context.versions.selection) &&
      context.versions.cohort === context.versions.selection &&
      context.versions.capacity === '2.0.0',
    'unsupported semantic version',
  );
  const coverage = context.coverage;
  const start = quarterOrdinal(context.sourceDomain.historyStartQuarter);
  const end = quarterOrdinal(context.asOfQuarter);
  requireValue(
    coverage.length === end - start + 1 && descriptor.quarters.length === coverage.length,
    'quarter coverage extent',
  );
  requireValue(
    context.sourceDomain.firstPublishedDate <= context.sourceDomain.throughDate &&
      context.sourceDomain.throughDate <= context.cutoffDate &&
      context.cutoffDate.slice(0, 4) === context.asOfQuarter.slice(0, 4) &&
      Math.ceil(Number(context.cutoffDate.slice(5, 7)) / 3) === Number(context.asOfQuarter.at(-1)),
    'cutoff/source domain mismatch',
  );
  coverage.forEach((row, i) => {
    requireValue(quarterOrdinal(row.quarter) === start + i, 'coverage order');
    const year = Number(row.quarter.slice(0, 4));
    const month = (Number(row.quarter.at(-1)) - 1) * 3;
    const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(year, month + 3, 0)).toISOString().slice(0, 10);
    const calendarDays = (Date.parse(last) - Date.parse(first)) / 86400000 + 1;
    requireValue(row.expectedDays === calendarDays, 'calendar day count');
    requireValue(
      (row.status === 'unpublished') === last < context.sourceDomain.firstPublishedDate,
      'unpublished source domain',
    );
    if (row.status === 'complete' || row.status === 'partial') {
      requireValue(
        row.knownObservationRows !== null &&
          row.firstObservedDate !== null &&
          row.lastObservedDate !== null,
        'available source observations',
      );
      requireValue(
        first <= row.firstObservedDate &&
          row.firstObservedDate <= row.lastObservedDate &&
          row.lastObservedDate <= last &&
          row.lastObservedDate <= context.sourceDomain.throughDate &&
          row.firstObservedDate >= context.sourceDomain.firstPublishedDate,
        'observed source dates',
      );
      requireValue(
        row.observedDays <=
          (Date.parse(row.lastObservedDate) - Date.parse(row.firstObservedDate)) / 86400000 + 1,
        'observed date budget',
      );
    } else {
      requireValue(
        row.knownObservationRows === null &&
          row.firstObservedDate === null &&
          row.lastObservedDate === null,
        'unavailable source observations',
      );
    }
    requireValue(
      quarterOrdinal(row.quarter) >= quarterOrdinal('2023-Q3') || !row.datacenterFieldAvailable,
      'unreported datacenter field',
    );
    const reference = descriptor.quarters[i];
    requireValue(
      reference &&
        reference.quarter === row.quarter &&
        reference.status === row.status &&
        (reference.payload !== null) === ['complete', 'partial'].includes(row.status),
      'quarter reference coverage/null mismatch',
    );
    requireValue(
      row.observedDays <= row.expectedDays &&
        (row.status === 'complete'
          ? row.observedDays === row.expectedDays
          : row.status === 'partial'
            ? row.observedDays > 0 && row.observedDays < row.expectedDays
            : row.observedDays === 0),
      'coverage day counts',
    );
    if (reference.payload) {
      requireValue(
        reference.payload.path.endsWith(`${reference.payload.sha256}.json`),
        'quarter path/hash mismatch',
      );
    }
  });
  requireValue(
    descriptor.matrix.path.endsWith(`${descriptor.matrix.sha256}.json`),
    'matrix path/hash mismatch',
  );
  unique(
    context.inventory.map((model) => model.modelId),
    'inventory model',
  );
  unique(
    context.inventory.map((model) => JSON.stringify([model.vendor, model.modelNumber])),
    'canonical model',
  );
  unique(
    context.inventory.flatMap((model) =>
      model.rawAliases.map((alias) => JSON.stringify([model.vendor, alias])),
    ),
    'model alias',
  );
  const selection = context.selection;
  const qualified: string[] = [];
  const expectedContext: string[] = [];
  for (const model of context.inventory) {
    requireValue(model.history.length === coverage.length, 'model ledger extent');
    model.history.forEach((row, i) => {
      const source = coverage[i];
      requireValue(source && row.quarter === source.quarter, 'ledger order');
      if (source.status === 'complete' || source.status === 'partial') {
        requireValue(
          row.knownIdentityLowerBound !== null &&
            source.knownObservationRows !== null &&
            row.knownIdentityLowerBound <= row.knownDriveDays &&
            row.knownDriveDays <= row.knownIdentityLowerBound * source.observedDays &&
            row.knownDriveDays <= source.knownObservationRows,
          'identity/exposure budget',
        );
      }
      if (source.status === 'complete') {
        requireValue(
          row.quarterCount !== null && row.knownIdentityLowerBound === row.quarterCount,
          'complete ledger count',
        );
      } else {
        requireValue(row.quarterCount === null, 'incomplete ledger full count');
      }
      if (source.status === 'missing' || source.status === 'unpublished') {
        requireValue(
          row.knownDriveDays === 0 &&
            row.knownFailures === 0 &&
            row.knownIdentityLowerBound === null,
          'unavailable ledger observations',
        );
      }
      const proof =
        (row.knownIdentityLowerBound ?? 0) >= 2000
          ? source.status === 'complete'
            ? 'complete_exact_count'
            : 'partial_identity_lower_bound'
          : null;
      requireValue(row.thresholdProof === proof, 'threshold proof');
      requireValue(row.knownFailures <= row.knownDriveDays, 'failure exposure budget');
      if (context.versions.rate === '2.1.0') {
        requireValue(
          row.knownFailures <= (row.knownIdentityLowerBound ?? 0),
          'distinct failure/identity budget',
        );
      }
    });
    const firstProof = model.history.find((row) => row.thresholdProof !== null)?.quarter ?? null;
    const firstComplete =
      model.history.find((row) => (row.quarterCount ?? 0) >= 2000)?.quarter ?? null;
    const firstObserved = model.history.find((row) => row.knownDriveDays > 0)?.quarter ?? null;
    const uncertain = coverage.some(
      (row) =>
        (firstProof === null || quarterOrdinal(row.quarter) < quarterOrdinal(firstProof)) &&
        row.status !== 'complete',
    );
    requireValue(
      model.earlierQualificationNotExcluded === uncertain &&
        model.anchorSearchComplete === !uncertain,
      'anchor search uncertainty',
    );
    requireValue(
      model.reportingAnchorQuarter === firstProof &&
        model.firstProvenThresholdInDeclaredHistory === firstProof &&
        model.firstCompleteQualifyingInDeclaredHistory === firstComplete &&
        model.firstObservedInDeclaredHistory === firstObserved,
      'model anchor/history derivation',
    );
    requireValue(
      model.recordedHistoryComplete === coverage.every((row) => row.status === 'complete'),
      'model history completeness',
    );
    requireValue(
      model.seedMatch === selection.positiveSeed.modelIds.includes(model.modelId),
      'seed membership',
    );
    const capacityEligible =
      context.versions.selection !== '2.1.0' ||
      (model.capacityTB !== null && model.capacityTB >= (selection.minimumCapacityTB ?? Infinity));
    if (
      model.mediaClass === 'hdd' &&
      capacityEligible &&
      firstProof &&
      !selection.excludedModelIds?.includes(model.modelId)
    ) {
      qualified.push(model.modelId);
    }
    if (
      model.mediaClass === 'hdd' &&
      capacityEligible &&
      !selection.excludedModelIds?.includes(model.modelId) &&
      (context.versions.selection === '2.1.0' || model.seedMatch || firstProof)
    ) {
      expectedContext.push(model.modelId);
    }
  }
  coverage.forEach((row, i) => {
    if (row.knownObservationRows !== null) {
      same(
        sum(context.inventory.map((model) => model.history[i]?.knownDriveDays ?? null)),
        row.knownObservationRows,
        'inventory/source exposure sum',
        true,
      );
    }
  });
  requireValue(
    'minimumCapacityTB' in selection === (context.versions.selection === '2.1.0') &&
      (selection.minimumCapacityTB === undefined ||
        (Number.isFinite(selection.minimumCapacityTB) && selection.minimumCapacityTB > 0)),
    'positive finite minimum capacity required for selection 2.1.0',
  );
  requireValue(
    'excludedModelIds' in selection === (context.versions.selection === '2.1.0') &&
      (selection.excludedModelIds ?? []).every((id) =>
        context.inventory.some((model) => model.modelId === id),
      ),
    'exclusions must be explicit unique observed model IDs for selection 2.1.0',
  );
  sameMembers(selection.contextModelIds, expectedContext, 'context membership');
  if (context.versions.selection === '2.1.0') {
    sameMembers(selection.analysisModelIds, qualified, 'historical analysis membership');
  }
  requireValue(
    selection.analysisModelIds.length > 0 || context.versions.rate === '2.1.0',
    'empty analysis requires calculation version 2.1.0',
  );
  requireValue(
    selection.analysisModelIds.every(
      (id) => qualified.includes(id) && selection.contextModelIds.includes(id),
    ),
    'analysis threshold membership',
  );
  requireValue(
    [...selection.purchaseDefaultModelIds, ...selection.historicalReferenceModelIds].every((id) =>
      selection.analysisModelIds.includes(id),
    ) &&
      !selection.purchaseDefaultModelIds.some((id) =>
        selection.historicalReferenceModelIds.includes(id),
      ),
    'default/reference membership',
  );
  requireValue(
    selection.positiveSeed.modelIds.every((id) =>
      context.inventory.some((model) => model.modelId === id),
    ),
    'unknown seed model',
  );
  return descriptor;
}
function binding(
  payload: ProductionMatrix | SupportingQuarter,
  descriptor: SnapshotDescriptor,
): void {
  requireValue(
    payload.contextSha256 === descriptor.contextSha256 &&
      payload.snapshotId === descriptor.context.snapshotId &&
      payload.asOfQuarter === descriptor.context.asOfQuarter,
    'mixed generation binding',
  );
}
export function parseProductionMatrix(
  bytes: Uint8Array,
  descriptor: SnapshotDescriptor,
): ProductionMatrix {
  const matrix = artifact<ProductionMatrix>(bytes, 'matrix');
  binding(matrix, descriptor);
  const context = descriptor.context;
  const uniqueFailures = context.versions.rate === '2.1.0';
  requireValue(
    matrix.rateBasis ===
      (uniqueFailures
        ? 'observed-quarter-distinct-failed-identities-recorded-exposure-v2.1'
        : 'observed-recorded-exposure-v2') &&
      matrix.rateLabel ===
        (uniqueFailures
          ? 'Observed-history AFR (quarterly unique failures)'
          : 'Observed-history AFR'),
    'rate basis/label differs from calculation version',
  );
  sameMembers(
    matrix.models.map((model) => model.modelId),
    context.selection.analysisModelIds,
    'matrix analysis membership',
  );
  const length = Math.max(
    24,
    ...matrix.models.map(
      (block) =>
        quarterOrdinal(context.asOfQuarter) - quarterOrdinal(block.reportingAnchorQuarter) + 1,
    ),
  );
  requireValue(matrix.relativeQuarterCount === length, 'matrix padding extent');
  for (const block of matrix.models) {
    const model = context.inventory.find((item) => item.modelId === block.modelId);
    requireValue(
      model &&
        block.reportingAnchorQuarter === model.reportingAnchorQuarter &&
        block.sourceHistoryComplete === model.recordedHistoryComplete &&
        block.cells.length === length,
      'matrix block binding',
    );
    let prior: ProductionCell | undefined;
    block.cells.forEach((cell, i) => {
      requireValue(
        quarterOrdinal(cell.quarter) === quarterOrdinal(block.reportingAnchorQuarter) + i &&
          cell.relativeQuarter === i + 1,
        'relative calendar position',
      );
      const source = context.coverage.find((row) => row.quarter === cell.quarter);
      const row = model.history.find((item) => item.quarter === cell.quarter);
      const expected = !source
        ? 'snapshot_end'
        : source.status === 'complete'
          ? (row?.quarterCount ?? 0) >= 2000
            ? 'eligible'
            : 'below_threshold'
          : source.status === 'partial'
            ? 'source_incomplete'
            : source.status;
      requireValue(cell.status === expected, 'matrix cell coverage/status');
      const history = model.history.filter(
        (item) => quarterOrdinal(item.quarter) <= quarterOrdinal(cell.quarter),
      );
      if (expected === 'snapshot_end') {
        requireValue(
          quarterOrdinal(cell.quarter) > quarterOrdinal(context.asOfQuarter) &&
            cell.cumulativeKnownFailures === null &&
            cell.cumulativeKnownDriveDays === null &&
            !cell.sourceHistoryComplete,
          'padding observations',
        );
      } else {
        requireValue(row, 'matrix ledger row');
        same(
          cell.cumulativeKnownFailures,
          sum(history.map((item) => item.knownFailures)),
          'cumulative failures',
          true,
        );
        same(
          cell.cumulativeKnownDriveDays,
          sum(history.map((item) => item.knownDriveDays)),
          'cumulative drive days',
          true,
        );
        requireValue(
          cell.sourceHistoryComplete ===
            context.coverage
              .filter((item) => quarterOrdinal(item.quarter) <= quarterOrdinal(cell.quarter))
              .every((item) => item.status === 'complete'),
          'cell history completeness',
        );
      }
      if (expected !== 'eligible') {
        requireValue(
          Object.values(cell.metrics).every((value) => value === null) &&
            cell.quarterAfr === null &&
            cell.completeHistoryAfr === null &&
            cell.baselineQuarter === null &&
            cell.baselineQuarterDistance === null &&
            cell.deltaReason === 'unavailable' &&
            cell.retiredReason === 'unavailable',
          'unavailable metrics/baseline must be null',
        );
        return;
      }
      requireValue(
        row && cell.cumulativeKnownFailures !== null && cell.cumulativeKnownDriveDays !== null,
        'eligible components',
      );
      const observedRate = rate(cell.cumulativeKnownFailures, cell.cumulativeKnownDriveDays);
      same(cell.metrics.observedRecordedAfr, observedRate, 'observed rate');
      same(cell.quarterAfr, rate(row.knownFailures, row.knownDriveDays), 'quarter rate');
      same(
        cell.completeHistoryAfr,
        cell.sourceHistoryComplete ? observedRate : null,
        'complete history rate',
      );
      same(cell.metrics.count, row.quarterCount, 'matrix count', true);
      same(cell.metrics.failed, row.knownFailures, 'matrix failure count', true);
      if (!prior) {
        requireValue(
          cell.baselineQuarter === null &&
            cell.baselineQuarterDistance === null &&
            cell.deltaReason === 'initialized',
          'first eligible baseline',
        );
        const subtractZero = context.versions.rate === '2.1.0';
        same(
          cell.metrics.populationDelta,
          subtractZero ? cell.metrics.count : 0,
          'initial population delta',
          true,
        );
        same(
          cell.metrics.observedRecordedAfrDelta,
          subtractZero ? cell.metrics.observedRecordedAfr : 0,
          'initial rate delta',
        );
      } else {
        requireValue(
          cell.baselineQuarter === prior.quarter &&
            cell.baselineQuarterDistance ===
              quarterOrdinal(cell.quarter) - quarterOrdinal(prior.quarter) &&
            cell.deltaReason === 'prior_eligible',
          'prior eligible baseline',
        );
        same(
          cell.metrics.populationDelta,
          (cell.metrics.count ?? 0) - (prior.metrics.count ?? 0),
          'population delta',
          true,
        );
        same(
          cell.metrics.observedRecordedAfrDelta,
          observedRate !== null && prior.metrics.observedRecordedAfr !== null
            ? observedRate - prior.metrics.observedRecordedAfr
            : null,
          'rate delta',
        );
      }
      requireValue(
        cell.metrics.new === null || cell.metrics.new <= (cell.metrics.count ?? 0),
        'new population budget',
      );
      if (cell.quarter === context.asOfQuarter) {
        requireValue(
          uniqueFailures
            ? cell.retiredReason === 'right_censored' && cell.metrics.retired === null
            : cell.retiredReason === 'cutoff_failed_proxy' &&
                cell.metrics.retired === cell.metrics.failed,
          uniqueFailures ? 'terminal retirement right-censoring' : 'cutoff retirement proxy',
        );
      } else if (
        context.coverage.some(
          (item) =>
            quarterOrdinal(item.quarter) >= quarterOrdinal(cell.quarter) &&
            item.status !== 'complete',
        )
      ) {
        requireValue(
          cell.metrics.retired === null && cell.retiredReason === 'gap_obstructed',
          'gap retirement',
        );
      } else {
        requireValue(
          cell.retiredReason === 'inferred' &&
            cell.metrics.retired !== null &&
            cell.metrics.retired <= (cell.metrics.count ?? 0),
          'retirement budget',
        );
      }
      prior = cell;
    });
  }
  return matrix;
}
export function parseSupportingQuarter(
  bytes: Uint8Array,
  descriptor: SnapshotDescriptor,
  quarter: string,
): SupportingQuarter {
  const payload = artifact<SupportingQuarter>(bytes, 'supporting_quarter');
  binding(payload, descriptor);
  const context = descriptor.context;
  const source = context.coverage.find((row) => row.quarter === quarter);
  requireValue(
    source && payload.quarter === quarter && payload.status === source.status,
    'supporting quarter coverage',
  );
  const complete = payload.status === 'complete';
  for (const name of ['selected_hdd', 'all_supplied'] as const) {
    const scope = payload.scopes[name];
    const ids =
      name === 'selected_hdd'
        ? context.selection.contextModelIds
        : context.inventory.map((model) => model.modelId);
    sameMembers(
      scope.models.map((row) => row.modelId),
      ids,
      'supporting scope membership',
    );
    for (const row of scope.models) {
      const model = context.inventory.find((item) => item.modelId === row.modelId);
      const ledger = model?.history.find((item) => item.quarter === quarter);
      requireValue(model && ledger, 'supporting model ledger');
      if (!complete) {
        requireValue(
          row.count === null && row.new === null && row.capacityTB === null,
          'partial supporting totals',
        );
      } else {
        requireValue(
          row.count === ledger.quarterCount &&
            row.count !== null &&
            row.new !== null &&
            row.new <= row.count,
          'supporting model count/new',
        );
        if (model.firstObservedInDeclaredHistory === quarter) {
          requireValue(row.new === row.count, 'first recorded population new');
        }
        same(
          row.capacityTB,
          row.count === 0 ? 0 : model.capacityTB === null ? null : row.count * model.capacityTB,
          'model nominal capacity',
        );
      }
    }
    const vendors = [
      ...new Set(
        context.inventory
          .filter((model) => ids.includes(model.modelId))
          .map((model) => model.vendor),
      ),
    ];
    sameMembers(
      scope.manufacturers.map((row) => row.vendor),
      vendors,
      'manufacturer membership',
    );
    for (const [key, share] of [
      ['count', 'populationShare'],
      ['new', 'newShare'],
      ['capacityTB', 'capacityShare'],
    ] as const) {
      same(
        scope.totals[key],
        complete ? sum(scope.models.map((row) => row[key])) : null,
        'scope totals',
        key !== 'capacityTB',
      );
      for (const manufacturer of scope.manufacturers) {
        const rows = scope.models.filter((row) =>
          context.inventory.some(
            (model) => model.modelId === row.modelId && model.vendor === manufacturer.vendor,
          ),
        );
        same(
          manufacturer[key],
          sum(rows.map((row) => row[key])),
          'manufacturer totals',
          key !== 'capacityTB',
        );
        same(
          manufacturer[share],
          scope.totals[key] && manufacturer[key] !== null
            ? manufacturer[key] / scope.totals[key]
            : null,
          'whole scope share',
        );
      }
    }
    const previous = context.coverage.find(
      (row) => quarterOrdinal(row.quarter) === quarterOrdinal(quarter) - 1,
    );
    if (!complete) {
      requireValue(
        scope.capacityDeltaTB === null && scope.capacityDeltaReason === 'current_incomplete',
        'partial capacity delta',
      );
    } else if (scope.totals.capacityTB === null) {
      requireValue(
        scope.capacityDeltaTB === null && scope.capacityDeltaReason === 'invalid_capacity',
        'invalid capacity delta',
      );
    } else if (!previous) {
      requireValue(
        scope.capacityDeltaTB === null && scope.capacityDeltaReason === 'first_quarter',
        'first capacity delta',
      );
    } else if (previous.status !== 'complete') {
      requireValue(
        scope.capacityDeltaTB === null && scope.capacityDeltaReason === 'previous_unavailable',
        'gap capacity delta',
      );
    } else {
      const priorCapacity = sum(
        context.inventory
          .filter((model) => ids.includes(model.modelId))
          .map((model) => {
            const count =
              model.history.find((row) => row.quarter === previous.quarter)?.quarterCount ?? null;
            return count === 0
              ? 0
              : count === null || model.capacityTB === null
                ? null
                : count * model.capacityTB;
          }),
      );
      requireValue(
        scope.capacityDeltaReason ===
          (priorCapacity === null ? 'previous_unavailable' : 'previous_complete'),
        'capacity delta reason',
      );
      same(
        scope.capacityDeltaTB,
        priorCapacity === null ? null : scope.totals.capacityTB - priorCapacity,
        'adjacent capacity delta',
      );
    }
  }
  for (const row of payload.scopes.selected_hdd.models) {
    const all = payload.scopes.all_supplied.models.find((item) => item.modelId === row.modelId);
    requireValue(
      all && row.count === all.count && row.new === all.new && row.capacityTB === all.capacityTB,
      'selected/all supplied disagreement',
    );
  }
  const locations = payload.datacenters;
  requireValue(
    locations.fieldAvailable === source.datacenterFieldAvailable,
    'location field availability',
  );
  unique(
    locations.locations.map((row) => row.name),
    'location',
  );
  const unknown = locations.locations.find((row) => row.name === 'Unknown');
  requireValue(unknown, 'Unknown location absent');
  const total = payload.scopes.all_supplied.totals;
  for (const key of ['count', 'capacityTB'] as const) {
    same(
      sum(locations.locations.map((row) => row[key])),
      total[key],
      'location totals',
      key === 'count',
    );
  }
  if (!complete) {
    requireValue(
      locations.locations.every((row) => row.count === null && row.capacityTB === null),
      'partial location totals',
    );
  } else {
    requireValue(
      locations.locations.every(
        (row) =>
          row.count !== null &&
          (row.count === 0 ? row.capacityTB === 0 : row.capacityTB === null || row.capacityTB > 0),
      ),
      'location capacity budget',
    );
    if (!locations.fieldAvailable) {
      requireValue(
        unknown.count === total.count && unknown.capacityTB === total.capacityTB,
        'unreported location allocation',
      );
    }
  }
  same(
    locations.knownLocationPopulationShare,
    complete && total.count && unknown.count !== null
      ? (total.count - unknown.count) / total.count
      : null,
    'known location whole scope share',
  );
  return payload;
}

/** Reconcile lazily loaded payloads when both sides have been requested. */
export function validateMatrixQuarter(matrix: ProductionMatrix, payload: SupportingQuarter): void {
  requireValue(
    matrix.contextSha256 === payload.contextSha256 &&
      matrix.snapshotId === payload.snapshotId &&
      matrix.asOfQuarter === payload.asOfQuarter,
    'mixed generation matrix/quarter',
  );
  for (const model of matrix.models) {
    const cell = model.cells.find((item) => item.quarter === payload.quarter);
    if (cell?.status === 'eligible') {
      const row = payload.scopes.selected_hdd.models.find((item) => item.modelId === model.modelId);
      requireValue(row && cell.metrics.new === row.new, 'matrix/supporting New disagreement');
    }
  }
}
