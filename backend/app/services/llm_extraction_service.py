"""
LLM-Based Question Extraction Service
Uses OpenAI API to extract questions, marks, and Bloom's taxonomy from question papers.
Supports direct PDF input via Responses API (no Poppler/image conversion needed).
"""
import base64
import json
import os
import re
from typing import List, Dict, Optional
from app.core.config import settings

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


class LLMExtractionService:
    """Service to extract questions using OpenAI LLM"""
    
    def __init__(self):
        if not OPENAI_AVAILABLE:
            raise ImportError("openai package is required. Install with: pip install openai")
        
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set in environment variables")
        
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
    
    def extract_questions_with_llm(self, file_content: Dict, is_answer_scheme: bool = False) -> List[Dict]:
        """
        Extract questions from file content using LLM
        
        Args:
            file_content: Result from FileConversionService.prepare_for_llm()
            is_answer_scheme: If True, document contains questions with answers; extract answer_text per question.
        
        Returns:
            List of question dictionaries (with optional answer_text when is_answer_scheme).
        """
        content_blocks = file_content.get("content") or []
        if not content_blocks:
            # No document content (e.g. PDF conversion failed / empty) - do not call LLM or it may hallucinate
            return []

        prompt = self._prepare_extraction_prompt(is_answer_scheme=is_answer_scheme)
        # Put document FIRST so the model clearly sees the source, then extraction instructions
        user_content = content_blocks + [{"type": "text", "text": prompt}]

        messages = [
            {
                "role": "system",
                "content": (
                    "You extract questions ONLY from the document provided. "
                    "Do not invent, generate, or add any question that is not present in that document. "
                    "If the document is blank, unreadable, or has no questions, respond with {\"questions\": []}."
                ),
            },
            {
                "role": "user",
                "content": user_content,
            },
        ]
        
        try:
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1  # Low temperature for consistent extraction
            )
            
            # Parse response
            response_text = response.choices[0].message.content
            questions = self._parse_llm_response(response_text, is_answer_scheme=is_answer_scheme)
            
            # Handle subparts - ensure they're separate records
            processed_questions = self._handle_subparts(questions)
            
            return processed_questions
            
        except Exception as e:
            raise Exception(f"LLM extraction failed: {e}")
    
    def extract_questions_from_pdf(self, pdf_path: str, is_answer_scheme: bool = False) -> List[Dict]:
        """
        Extract questions by sending the PDF directly to GPT-4o via the Responses API.
        No Poppler or image conversion required; works for both text and image-based PDFs.
        When is_answer_scheme is True, also extracts answer_text per question.
        """
        if not os.path.isfile(pdf_path):
            raise Exception(f"PDF file not found: {pdf_path}")
        prompt = self._prepare_extraction_prompt(is_answer_scheme=is_answer_scheme)
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")
        file_data = f"data:application/pdf;base64,{pdf_b64}"
        filename = os.path.basename(pdf_path) or "paper.pdf"
        instructions = "You are an expert at extracting questions from academic question papers. Extract all questions including subparts as separate entries."
        try:
            response = self.client.responses.create(
                model=self.model,
                instructions=instructions,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_file", "filename": filename, "file_data": file_data},
                            {"type": "input_text", "text": prompt},
                        ],
                    }
                ],
                text={"format": {"type": "json_object"}},
                temperature=0.1,
            )
            response_text = getattr(response, "output_text", None) or self._get_output_text_from_response(response)
            if not response_text:
                raise Exception("No output text in Responses API response")
            questions = self._parse_llm_response(response_text, is_answer_scheme=is_answer_scheme)
            return self._handle_subparts(questions)
        except Exception as e:
            raise Exception(f"LLM extraction from PDF failed: {e}")
    
    def _get_output_text_from_response(self, response) -> Optional[str]:
        """Extract output text from Responses API response object."""
        for item in getattr(response, "output", []) or []:
            if getattr(item, "content", None):
                for part in item.content:
                    if getattr(part, "type", None) == "output_text" and getattr(part, "text", None):
                        return part.text
        return None
    
    def _prepare_extraction_prompt(self, is_answer_scheme: bool = False) -> str:
        """Prepare prompt for question extraction. When is_answer_scheme, also ask for answer_text per question."""
        if is_answer_scheme:
            return """From the document provided above, extract ONLY the questions (and answers when present) that actually appear in that document.

The document may be in question-paper-only format or answer-scheme format (e.g. Q1 A1, Q2 A2, or question 1 followed by answer 1, etc.). Extract each question and, when an answer is given for that question in the document, put it in answer_text.

CRITICAL: Include ONLY what is explicitly in the document. Do NOT invent or add any content. If you cannot see the document clearly or it has no questions, return exactly: {"questions": []}

For each question in the document, output in this JSON format:

{
  "questions": [
    {
      "question_number": "1",
      "question_text": "Exact question text as it appears in the document",
      "answer_text": "Exact answer for this question as it appears in the document, or null if the document has no answer for this question",
      "marks": 10,
      "bloom_taxonomy_level": 3,
      "bloom_category": "Applying",
      "has_diagram": false
    }
  ]
}

Rules:
1. Extract ALL questions that appear in the document, including subparts as separate entries.
2. question_text and answer_text must be the actual text from the document.
3. For answer-scheme format (Q1 A1, Q2 A2, etc.), match each answer to its question and set answer_text accordingly. If there is no answer for a question, set answer_text to null.
4. Extract marks from the question when visible (e.g. [10 marks]). If not found, set marks to null.
5. Bloom's level: 1=Remembering, 2=Understanding, 3=Applying, 4=Analyzing, 5=Evaluating, 6=Creating. Set has_diagram to true only if that question has diagrams/figures/tables.
6. If the document is empty or has no exam questions, return {"questions": []}.

Return ONLY valid JSON, no markdown or extra text."""
        return """From the question paper document provided above, extract ONLY the questions that actually appear in that document.

CRITICAL: Include ONLY questions that are explicitly written in the document. Do NOT invent, generate, or add any question. Do NOT use sample or example questions. If you cannot see the document clearly or it has no questions, return exactly: {"questions": []}

For each question that appears in the document, output in this JSON format:

{
  "questions": [
    {
      "question_number": "1",
      "question_text": "Exact or near-exact question text as it appears in the document",
      "marks": 10,
      "bloom_taxonomy_level": 3,
      "bloom_category": "Applying",
      "has_diagram": false
    }
  ]
}

Rules:
1. Extract ALL questions that appear in the document, including subparts (2.a, 2.b, 3(i), 3(ii), etc.) as separate entries.
2. question_text must be the actual text from the document (you may summarize diagrams/tables in words if needed).
3. Extract marks from the question (e.g. [10 marks], (10M), 10 marks).
4. Bloom's level: 1=Remembering, 2=Understanding, 3=Applying, 4=Analyzing, 5=Evaluating, 6=Creating.
5. Set has_diagram to true only if that question in the document contains diagrams, figures, or tables.
6. If marks are not found, set marks to null.
7. If the document is empty, unreadable, or contains no exam questions, return {"questions": []}.

Return ONLY valid JSON, no markdown or extra text."""
    
    def _parse_llm_response(self, response_text: str, is_answer_scheme: bool = False) -> List[Dict]:
        """Parse LLM JSON response. When is_answer_scheme, include answer_text in validated questions."""
        try:
            # Clean response text (remove markdown code blocks if present)
            response_text = response_text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            # Parse JSON
            data = json.loads(response_text)
            
            # Extract questions array
            if isinstance(data, dict) and "questions" in data:
                questions = data["questions"]
            elif isinstance(data, list):
                questions = data
            else:
                raise ValueError("Invalid response format")
            
            # Validate and clean each question
            validated_questions = []
            for q in questions:
                validated = self._validate_question(q, is_answer_scheme=is_answer_scheme)
                if validated:
                    validated_questions.append(validated)
            
            return validated_questions
            
        except json.JSONDecodeError as e:
            raise Exception(f"Failed to parse LLM response as JSON: {e}")
        except Exception as e:
            raise Exception(f"Error processing LLM response: {e}")
    
    def _validate_question(self, question: Dict, is_answer_scheme: bool = False) -> Optional[Dict]:
        """Validate and clean question data. Optionally include answer_text when is_answer_scheme."""
        # Required fields
        if "question_number" not in question or "question_text" not in question:
            return None
        
        # Clean and validate
        validated = {
            "question_number": str(question["question_number"]).strip(),
            "question_text": str(question["question_text"]).strip(),
            "marks": self._parse_marks(question.get("marks")),
            "bloom_taxonomy_level": self._parse_bloom_level(question.get("bloom_taxonomy_level")),
            "bloom_category": self._parse_bloom_category(question.get("bloom_category"), question.get("bloom_taxonomy_level")),
            "has_diagram": bool(question.get("has_diagram", False))
        }
        if is_answer_scheme and question.get("answer_text") is not None:
            validated["answer_text"] = str(question["answer_text"]).strip() or None
        else:
            validated["answer_text"] = None
        
        # Ensure question_text is not empty
        if not validated["question_text"]:
            return None
        
        return validated
    
    def _parse_marks(self, marks) -> Optional[int]:
        """Parse marks value"""
        if marks is None:
            return None
        
        try:
            marks_int = int(marks)
            return marks_int if marks_int > 0 else None
        except (ValueError, TypeError):
            return None
    
    def _parse_bloom_level(self, level) -> Optional[int]:
        """Parse Bloom's taxonomy level"""
        if level is None:
            return None
        
        try:
            level_int = int(level)
            if 1 <= level_int <= 6:
                return level_int
        except (ValueError, TypeError):
            pass
        
        return None
    
    def _parse_bloom_category(self, category: Optional[str], level: Optional[int]) -> Optional[str]:
        """Parse Bloom's category"""
        if category:
            # Map common variations
            category_lower = category.lower()
            bloom_map = {
                "remembering": "Remembering",
                "remember": "Remembering",
                "understanding": "Understanding",
                "understand": "Understanding",
                "applying": "Applying",
                "apply": "Applying",
                "analyzing": "Analyzing",
                "analyze": "Analyzing",
                "evaluating": "Evaluating",
                "evaluate": "Evaluating",
                "creating": "Creating",
                "create": "Creating"
            }
            if category_lower in bloom_map:
                return bloom_map[category_lower]
        
        # Fallback to level-based mapping
        if level:
            level_to_category = {
                1: "Remembering",
                2: "Understanding",
                3: "Applying",
                4: "Analyzing",
                5: "Evaluating",
                6: "Creating"
            }
            return level_to_category.get(level)
        
        return None
    
    def _handle_subparts(self, questions: List[Dict]) -> List[Dict]:
        """
        Ensure subparts are handled as separate question records
        Subparts like 2.a, 2.b should already be separate entries from LLM
        This method just ensures proper formatting
        """
        processed = []
        
        for question in questions:
            # Check if this is a subpart (contains . or ( or letters after numbers)
            question_num = question["question_number"]
            
            # Ensure subparts are marked
            if re.search(r'[a-z]|\(|\)', question_num.lower()):
                question["has_subparts"] = True
                # Try to extract parent question number
                parent_match = re.match(r'^(\d+)', question_num)
                if parent_match:
                    question["parent_question_number"] = parent_match.group(1)
            else:
                question["has_subparts"] = False
            
            processed.append(question)
        
        return processed

