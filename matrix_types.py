"""Typed aggregate records shared by local matrix builders.

These records describe constructed, validated values, not arbitrary input JSON.
"""

from typing import TypedDict


class Components(TypedDict):
    failures: int
    driveDays: int
    complete: bool


class Metrics(TypedDict):
    afr: float | None
    afrDelta: float | None
    count: int | None
    populationDelta: int | None
    new: int | None
    retired: int | None
    failed: int | None


class Observations(TypedDict):
    count: int | None
    new: int | None
    retired: int | None
    failed: int | None


class Baseline(TypedDict):
    kind: str
    priorQuarter: str | None
    elapsedQuarters: int | None
    afr: float | None
    count: int


class Cell(TypedDict):
    quarter: str
    relativeQuarter: int
    state: str
    eligibility: str
    coverage: str
    metrics: Metrics
    observations: Observations
    quarterComponents: Components | None
    cumulativeComponents: Components | None
    quarterAfr: float | None
    deltaBaseline: Baseline | None
    retirementInference: str
    rateUnavailableReason: str | None


class Model(TypedDict):
    modelId: str
    modelNumber: str
    vendor: str
    rawModelAliases: list[str]
    admissionReason: str
    anchorQuarter: str
    finalEligibleQuarter: str
    asOfStatus: str
    historyStart: str
    preEligibilityComponents: Components
    cells: list[Cell]


class Inventory(TypedDict):
    modelId: str
    modelNumber: str
    vendor: str
    mediaClass: str
    classificationEvidence: str
    seedMatch: bool
    maxQuarterCount: int
    firstQualifyingQuarter: str | None


class RegistryEntry(TypedDict):
    vendor: str
    modelNumber: str
    mediaClass: str
    evidence: str
    aliases: list[str]


class RegistryDefinition(TypedDict):
    version: str
    models: list[RegistryEntry]


class DatacenterMeasures(TypedDict):
    datacenter: str
    driveCount: int | None
    capacityTb: float | None
