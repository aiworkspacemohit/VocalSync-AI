import json
import re
import logging
from typing import List, Union, Dict, Any, Optional
from google import genai
from google.genai.errors import APIError

from app.config import settings
from app.schemas.meeting import MeetingDebrief, SpeakerIntentItem, ActionItem

logger = logging.getLogger(__name__)


class NLPSummarizer:
    """
    NLP Meeting Intelligence Analyzer using Google Gemini with dynamic endpoint fallback.
    Extracts high-level objectives, per-speaker intent motives, key decisions,
    and structured action items.
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {e}")

        self.models_to_try = [
            "models/gemini-2.5-flash-lite",
            "models/gemini-flash-latest",
            "models/gemini-2.5-flash"
        ]

    def _format_transcript(self, transcript: Union[List[Dict[str, Any]], str]) -> str:
        if isinstance(transcript, str):
            return transcript.strip()

        lines = []
        for item in transcript:
            speaker = item.get("speaker", "Unknown Guest")
            text = item.get("text", "").strip()
            confidence = item.get("confidence")
            conf_str = f" ({confidence}%)" if confidence is not None else ""
            timestamp = item.get("timestamp", "")
            time_str = f"[{timestamp}] " if timestamp else ""
            if text:
                lines.append(f"{time_str}[{speaker}{conf_str}]: {text}")
        return "\n".join(lines)

    def summarize(
        self,
        transcript: Union[List[Dict[str, Any]], str],
        meeting_title: str = "Executive Biometric Intelligence Brief"
    ) -> MeetingDebrief:
        formatted_transcript = self._format_transcript(transcript)
        
        if not formatted_transcript:
            return MeetingDebrief(
                meeting_title=meeting_title,
                objective="No spoken dialog detected in the session.",
                executive_summary="The recorded session contained no audible speech.",
                speaker_intents=[],
                key_decisions=[],
                action_items=[],
                raw_markdown="# Executive Debrief\n\n*No spoken content was detected during this session.*"
            )

        if not self.client:
            logger.warning("Gemini API client not configured. Falling back to local heuristic extraction.")
            return self._heuristic_fallback(formatted_transcript, meeting_title)

        prompt = f"""
You are an expert Chief Executive Staff & Corporate NLP Analyst specializing in high-stakes multi-speaker executive meetings.
Your objective is to thoroughly analyze the provided multi-speaker transcript and return an authoritative, structured JSON briefing for leadership and onboarding.

TRANSCRIPT:
{formatted_transcript}

Please extract and return a valid JSON object matching EXACTLY this schema:
{{
  "meeting_title": "{meeting_title}",
  "objective": "A concise, high-level summary of the core purpose and agenda of this discussion.",
  "executive_summary": "A comprehensive executive paragraph summarizing the overall outcomes, current trajectory, and strategic consensus.",
  "speaker_intents": [
    {{
      "speaker": "Name of participant (e.g. Mohit Singh, Vishesh, Unknown Guest)",
      "role_or_identity": "Inferred role, title, or contextual identity",
      "key_contributions": "Summary of points, concerns, and technical/business matters raised",
      "underlying_intent": "Inferred motive and communicative goal (e.g., verifying system readiness, clarifying milestone blockers, seeking commitment, validating identity)"
    }}
  ],
  "key_decisions": [
    "Concrete agreement, resolution, policy, or operational outcome 1",
    "Concrete agreement, resolution, policy, or operational outcome 2"
  ],
  "action_items": [
    {{
      "task": "Explicit description of work to be performed",
      "owner": "Specific named person or team assigned",
      "deadline": "Target deadline if mentioned or TBD"
    }}
  ]
}}

CRITICAL REQUIREMENTS:
- Output MUST be valid JSON only. Do not wrap in markdown or backticks if possible, or use standard ```json ... ``` blocks.
- Ensure every detected speaker in the transcript has a detailed entry in 'speaker_intents'.
- Extract all decisions and explicit next steps.
"""

        raw_response_text = ""
        last_error = None

        for model_name in self.models_to_try:
            try:
                logger.info(f"[*] Calling Gemini endpoint: {model_name}...")
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    raw_response_text = response.text.strip()
                    logger.info(f"[+] Successfully generated executive brief using {model_name}")
                    break
            except APIError as e:
                logger.warning(f"[!] {model_name} returned APIError ({e.code}). Attempting fallback...")
                last_error = e
            except Exception as e:
                logger.warning(f"[!] Error on {model_name}: {e}. Attempting fallback...")
                last_error = e

        if not raw_response_text:
            logger.error(f"All Gemini models failed. Last error: {last_error}")
            return self._heuristic_fallback(formatted_transcript, meeting_title)

        # Parse JSON from response
        try:
            # Strip markdown json blocks if present
            cleaned_json = raw_response_text
            if "```json" in cleaned_json:
                cleaned_json = cleaned_json.split("```json")[1].split("```")[0].strip()
            elif "```" in cleaned_json:
                cleaned_json = cleaned_json.split("```")[1].split("```")[0].strip()

            parsed = json.loads(cleaned_json)
            
            speaker_intents = [
                SpeakerIntentItem(**item) for item in parsed.get("speaker_intents", [])
            ]
            action_items = [
                ActionItem(**item) for item in parsed.get("action_items", [])
            ]

            markdown_report = self._build_markdown_report(
                title=parsed.get("meeting_title", meeting_title),
                objective=parsed.get("objective", ""),
                summary=parsed.get("executive_summary", ""),
                intents=speaker_intents,
                decisions=parsed.get("key_decisions", []),
                actions=action_items
            )

            return MeetingDebrief(
                meeting_title=parsed.get("meeting_title", meeting_title),
                objective=parsed.get("objective", ""),
                executive_summary=parsed.get("executive_summary", ""),
                speaker_intents=speaker_intents,
                key_decisions=parsed.get("key_decisions", []),
                action_items=action_items,
                raw_markdown=markdown_report
            )
        except Exception as parse_err:
            logger.error(f"Failed to parse Gemini JSON output: {parse_err}. Raw text:\n{raw_response_text}")
            # Fallback markdown wrapping
            return MeetingDebrief(
                meeting_title=meeting_title,
                objective="Executive meeting intelligence discussion.",
                executive_summary=raw_response_text[:300] + "...",
                speaker_intents=[],
                key_decisions=["See complete report transcript."],
                action_items=[],
                raw_markdown=raw_response_text
            )

    def _build_markdown_report(
        self,
        title: str,
        objective: str,
        summary: str,
        intents: List[SpeakerIntentItem],
        decisions: List[str],
        actions: List[ActionItem]
    ) -> str:
        md = [
            f"# {title}",
            "",
            "## 1. Meeting Objective & Agenda",
            objective,
            "",
            "## 2. Executive Summary",
            summary,
            "",
            "## 3. Per-Speaker Contribution & Intent Analysis",
            "| Speaker | Inferred Role | Key Points Raised | Underlying Intent / Motive |",
            "| :--- | :--- | :--- | :--- |"
        ]
        for item in intents:
            md.append(f"| **{item.speaker}** | {item.role_or_identity} | {item.key_contributions} | {item.underlying_intent} |")

        md.extend([
            "",
            "## 4. Key Decisions & Agreements",
        ])
        for dec in decisions:
            md.append(f"- [x] {dec}")

        md.extend([
            "",
            "## 5. Action Items & Next Steps",
            "| Task Description | Owner | Target Deadline |",
            "| :--- | :--- | :--- |"
        ])
        for act in actions:
            md.append(f"| {act.task} | **{act.owner}** | `{act.deadline}` |")

        return "\n".join(md)

    def _heuristic_fallback(self, transcript_text: str, meeting_title: str) -> MeetingDebrief:
        lines = [line.strip() for line in transcript_text.splitlines() if line.strip()]
        speakers_detected = set()
        for line in lines:
            match = re.search(r"\[(.*?)(?:\s\(\d+%\))?\]:", line)
            if match:
                speakers_detected.add(match.group(1).strip())

        intents = [
            SpeakerIntentItem(
                speaker=spk,
                role_or_identity="Participant",
                key_contributions=f"Active contributor in {len([l for l in lines if spk in l])} conversational turns.",
                underlying_intent="Collaborative coordination and project alignment."
            )
            for spk in sorted(speakers_detected)
        ]

        summary = f"Session recorded with {len(lines)} spoken segments across {len(speakers_detected)} identified speaker(s): {', '.join(speakers_detected)}."
        return MeetingDebrief(
            meeting_title=meeting_title,
            objective="Multi-speaker synchronization and operational briefing.",
            executive_summary=summary,
            speaker_intents=intents,
            key_decisions=["Identified speakers synced on meeting topics."],
            action_items=[ActionItem(task="Review session transcript and finalize next steps", owner="Team", deadline="Next Sync")],
            raw_markdown=f"# {meeting_title}\n\n{summary}"
        )


# Singleton instance
nlp_summarizer = NLPSummarizer()
