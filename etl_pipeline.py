from collections.abc import Iterable
from typing import TypedDict


class PipelineState(TypedDict):
    stages: list[str] | None
    curr_stage_idx: int | None


_pipeline_state: PipelineState = {"stages": None, "curr_stage_idx": None}


def create_pipeline(stage_descriptions: Iterable[str]) -> None:
    if _pipeline_state["stages"] is not None:
        print("WARN: repeat call to create_pipeline")
    _pipeline_state["stages"] = list(stage_descriptions)
    _pipeline_state["curr_stage_idx"] = 1


def next_stage_banner() -> str:
    stages, index = _pipeline_state["stages"], _pipeline_state["curr_stage_idx"]
    if stages is None or index is None:
        raise RuntimeError("Create the ETL pipeline before advancing stages")
    stage_banner = f"\nETL pipeline stage {index:2} of {len(stages):2}: {stages[index - 1]}"
    _pipeline_state["curr_stage_idx"] = index + 1
    return stage_banner
