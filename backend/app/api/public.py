from fastapi import APIRouter, HTTPException, Query, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.question import Question
from app.models.question_paper import QuestionPaper
from app.models.course import Course, CourseEquivalence
from app.services.embedding_service import EmbeddingService
from pydantic import BaseModel

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    filters: Optional[dict] = {}
    page: int = 1
    limit: int = 20

class QuestionResponse(BaseModel):
    question_id: int
    question_text: str
    marks: Optional[int]
    bloom_level: Optional[int]
    course_code: str
    unit_name: Optional[str]
    exam_type: str
    academic_year: int
    semester_type: str
    exam_date: Optional[str]
    variant_count: int = 0
    
    class Config:
        from_attributes = True

@router.post("/search")
async def search_questions(
    request: SearchRequest,
    db: Session = Depends(get_db)
):
    """Public search endpoint - no authentication required"""
    # Build query with filters
    query = db.query(Question).join(QuestionPaper).filter(Question.is_canonical == True)
    
    # Apply filters
    if request.filters.get("course_codes"):
        # Include equivalent courses
        course_codes = request.filters["course_codes"]
        equivalent_courses = []
        for course_code in course_codes:
            # Get equivalent courses
            equivalences = db.query(CourseEquivalence).filter(
                (CourseEquivalence.primary_course_code == course_code) |
                (CourseEquivalence.equivalent_course_code == course_code)
            ).all()
            for eq in equivalences:
                if eq.primary_course_code == course_code:
                    equivalent_courses.append(eq.equivalent_course_code)
                else:
                    equivalent_courses.append(eq.primary_course_code)
        
        all_courses = course_codes + equivalent_courses
        query = query.filter(Question.course_code.in_(all_courses))
    
    if request.filters.get("unit_ids"):
        query = query.filter(Question.unit_id.in_(request.filters["unit_ids"]))
    
    if request.filters.get("marks_min"):
        query = query.filter(Question.marks >= request.filters["marks_min"])
    
    if request.filters.get("marks_max"):
        query = query.filter(Question.marks <= request.filters["marks_max"])
    
    if request.filters.get("bloom_levels"):
        query = query.filter(Question.bloom_level.in_(request.filters["bloom_levels"]))
    
    if request.filters.get("exam_types"):
        query = query.filter(QuestionPaper.exam_type.in_(request.filters["exam_types"]))
    
    if request.filters.get("year_from"):
        query = query.filter(QuestionPaper.academic_year >= request.filters["year_from"])
    
    if request.filters.get("year_to"):
        query = query.filter(QuestionPaper.academic_year <= request.filters["year_to"])
    
    # Semantic search with keyword fallback
    if request.query and request.query.strip():
        qvec = None
        try:
            qvec = EmbeddingService.embed_text(request.query)
        except Exception:
            qvec = None

        if qvec:
            query = query.filter(Question.question_embedding.isnot(None)).order_by(
                Question.question_embedding.cosine_distance(qvec)
            )
        else:
            query = query.filter(Question.question_text.ilike(f"%{request.query}%"))
    else:
        query = query.order_by(Question.created_at.desc())
    
    # Pagination
    offset = (request.page - 1) * request.limit
    questions = query.offset(offset).limit(request.limit).all()
    
    # Convert to response format
    results = []
    for q in questions:
        # Count variants
        variant_count = db.query(Question).filter(
            Question.parent_question_id == q.question_id
        ).count()
        
        results.append(QuestionResponse(
            question_id=q.question_id,
            question_text=q.question_text,
            marks=q.marks,
            bloom_level=q.bloom_level.value if q.bloom_level else None,
            course_code=q.course_code,
            unit_name=q.unit.unit_name if q.unit else None,
            exam_type=q.paper.exam_type.value,
            academic_year=q.paper.academic_year,
            semester_type=q.paper.semester_type.value,
            exam_date=q.paper.exam_date.isoformat() if q.paper.exam_date else None,
            variant_count=variant_count
        ))
    
    return {
        "questions": results,
        "total": query.count(),
        "page": request.page,
        "limit": request.limit
    }

