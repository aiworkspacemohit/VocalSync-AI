from typing import List, Optional, Union
from pydantic import BaseModel, Field


class TranscriptChunk(BaseModel):
    type: str = "TRANSCRIPT_CHUNK"
    speaker: str
    confidence: int = Field(..., ge=0, le=100, description="Confidence percentage")
    text: str
    timestamp: str
    is_continuity: bool = False


class SpeakerProfile(BaseModel):
    name: str
    filename: str
    dimension: int = 192


class SpeakerProfileList(BaseModel):
    count: int
    speakers: List[SpeakerProfile]


class EnrollmentResponse(BaseModel):
    success: bool
    speaker_name: str
    message: str
    samples_processed: int = 3
    profile_path: Optional[str] = None


class SpeakerIntentItem(BaseModel):
    speaker: str
    role_or_identity: str = "Participant"
    key_contributions: str
    underlying_intent: str


class ActionItem(BaseModel):
    task: str
    owner: str = "Unassigned"
    deadline: str = "TBD"


class MeetingDebrief(BaseModel):
    meeting_title: str = "Executive Biometric Meeting Intelligence Report"
    objective: str = ""
    executive_summary: str = ""
    speaker_intents: List[SpeakerIntentItem] = Field(default_factory=list)
    key_decisions: List[str] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    raw_markdown: Optional[str] = None


class SummarizeRequest(BaseModel):
    transcript: Union[List[dict], str]
    meeting_title: Optional[str] = "Executive Biometric Intelligence Brief"


class ExportDocxRequest(BaseModel):
    debrief: MeetingDebrief
    transcript_history: Optional[List[dict]] = None
