from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from app.core.database import get_db
from app.models.user import User
from app.models.question import Question, StudentBookmark, AnswerAsset
from app.models.question_paper import QuestionPaper
from app.models.course import Course, CourseEquivalence, CourseOffering
from app.models.question_paper import QuestionPaper, ExamType
from app.api.auth import get_current_user
from app.services.embedding_service import EmbeddingService
from pydantic import BaseModel

router = APIRouter()

class SearchRequest(BaseModel):
    query: Optional[str] = ""
    filters: Optional[dict] = {}
    page: int = 1
    limit: int = 20

class SearchFilters(BaseModel):
    course_codes: Optional[List[str]] = None
    unit_ids: Optional[List[int]] = None
    marks_min: Optional[int] = None
    marks_max: Optional[int] = None
    bloom_levels: Optional[List[int]] = None
    exam_types: Optional[List[str]] = None
    year_from: Optional[int] = None
    year_to: Optional[int] = None
    topic_tags: Optional[List[str]] = None
    review_status: Optional[str] = None  # "reviewed", "non-reviewed", or None for all

class QuestionResponse(BaseModel):
    question_id: int
    question_text: str
    marks: Optional[int]
    bloom_level: Optional[int]
    bloom_category: Optional[str]
    difficulty_level: Optional[str]
    course_code: str
    unit_name: Optional[str]
    exam_type: str
    academic_year: int
    semester_type: str
    exam_date: Optional[str]
    paper_id: Optional[int] = None
    variant_count: int = 0
    topic_tags: Optional[List[str]] = None
    is_reviewed: bool = False
    review_status: Optional[str] = None
    image_path: Optional[str] = None
    answer_text: Optional[str] = None
    answer_assets: Optional[List[dict]] = None
    
    class Config:
        from_attributes = True

class RandomQuestionsRequest(BaseModel):
    course_code: str
    unit_ids: Optional[List[int]] = None
    count: int = 10
    bloom_levels: Optional[List[int]] = None

@router.get("/my-courses")
async def get_my_courses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student's selected courses"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    # Get student's selected courses
    from app.models.question import StudentCourseSelection
    selections = db.query(StudentCourseSelection).filter(
        StudentCourseSelection.student_id == current_user.user_id
    ).all()
    
    # Get course details for selected courses
    course_codes = [s.course_code for s in selections]
    if course_codes:
        courses = db.query(Course).filter(Course.course_code.in_(course_codes)).all()
        return courses
    else:
        # If no selections, return empty list
        return []

@router.post("/search")
async def search_questions(
    request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search questions with semantic search"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    try:
        # Build query with filters
        # Show all questions - students should see all uploaded questions
        from sqlalchemy.orm import joinedload
        query = db.query(Question).options(
            joinedload(Question.unit),
            joinedload(Question.paper),
            joinedload(Question.answer_assets),
        )
        
        # Apply filters
        filters = request.filters if request.filters else {}
        if filters.get("course_codes"):
            # Include equivalent courses
            course_codes = filters["course_codes"]
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
        
        if filters.get("unit_ids"):
            query = query.filter(Question.unit_id.in_(filters["unit_ids"]))
        
        if filters.get("marks_min"):
            query = query.filter(Question.marks >= filters["marks_min"])
        
        if filters.get("marks_max"):
            query = query.filter(Question.marks <= filters["marks_max"])
        
        if filters.get("bloom_levels"):
            query = query.filter(Question.bloom_level.in_(filters["bloom_levels"]))
        
        # Track if we've joined QuestionPaper
        has_joined_paper = False
        
        if filters.get("exam_types"):
            query = query.join(QuestionPaper, Question.paper_id == QuestionPaper.paper_id).filter(QuestionPaper.exam_type.in_(filters["exam_types"]))
            has_joined_paper = True
        
        if filters.get("year_from"):
            if not has_joined_paper:
                query = query.join(QuestionPaper, Question.paper_id == QuestionPaper.paper_id)
                has_joined_paper = True
            query = query.filter(QuestionPaper.academic_year >= filters["year_from"])
        
        if filters.get("year_to"):
            if not has_joined_paper:
                query = query.join(QuestionPaper, Question.paper_id == QuestionPaper.paper_id)
                has_joined_paper = True
            query = query.filter(QuestionPaper.academic_year <= filters["year_to"])
        
        # Filter by topic tags
        if filters.get("topic_tags"):
            import json
            topic_tags = filters["topic_tags"]
            # Filter questions where topic_tags JSON contains any of the requested tags
            matching_questions = []
            all_questions = query.all()
            for q in all_questions:
                if q.topic_tags:
                    try:
                        q_tags = json.loads(q.topic_tags) if isinstance(q.topic_tags, str) else q.topic_tags
                        if any(tag in q_tags for tag in topic_tags):
                            matching_questions.append(q.question_id)
                    except:
                        pass
            if matching_questions:
                query = query.filter(Question.question_id.in_(matching_questions))
            else:
                # No matches, return empty
                return {"questions": [], "total": 0, "page": request.page, "limit": request.limit}
        
        # Filter by review status
        if filters.get("review_status"):
            review_status = filters["review_status"]
            if review_status == "reviewed":
                query = query.filter(Question.is_reviewed == True)
            elif review_status == "non-reviewed":
                query = query.filter(Question.is_reviewed == False)
        
        # Semantic search (optional). Allow empty query to show all questions (browsing mode).
        query_str = request.query if request.query else ""
        if query_str and query_str.strip():
            qvec = None
            try:
                qvec = EmbeddingService.embed_text(query_str)
            except Exception:
                qvec = None

            if qvec:
                # Order by cosine distance (smaller is closer / more similar)
                query = query.filter(Question.question_embedding.isnot(None)).order_by(
                    Question.question_embedding.cosine_distance(qvec)
                )
            else:
                # Fallback to case-insensitive keyword search
                query = query.filter(Question.question_text.ilike(f"%{query_str.strip()}%"))
        else:
            # Default browsing order (newest first)
            query = query.order_by(Question.created_at.desc())
        
        # Get total count before pagination
        total = query.count()
        
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
            
            # Parse topic tags
            topic_tags = None
            if q.topic_tags:
                try:
                    import json
                    topic_tags = json.loads(q.topic_tags) if isinstance(q.topic_tags, str) else q.topic_tags
                except:
                    topic_tags = None
            
            # Safely access paper attributes - load if not already loaded
            paper = None
            if hasattr(q, 'paper') and q.paper:
                paper = q.paper
            elif q.paper_id:
                # Lazy load paper if not already loaded
                paper = db.query(QuestionPaper).filter(QuestionPaper.paper_id == q.paper_id).first()
            
            results.append(QuestionResponse(
                question_id=q.question_id,
                question_text=q.question_text,
                marks=q.marks,
                bloom_level=q.bloom_level.value if q.bloom_level else None,
                bloom_category=q.bloom_category.value if q.bloom_category else None,
                difficulty_level=q.difficulty_level.value if q.difficulty_level else None,
                course_code=q.course_code,
                unit_name=q.unit.unit_name if q.unit else None,
                exam_type=paper.exam_type.value if paper and paper.exam_type else None,
                academic_year=paper.academic_year if paper else None,
                semester_type=paper.semester_type.value if paper and paper.semester_type else None,
                exam_date=paper.exam_date.isoformat() if paper and paper.exam_date else None,
                paper_id=q.paper_id,
                variant_count=variant_count,
                topic_tags=topic_tags,
                is_reviewed=q.is_reviewed,
                review_status=q.review_status.value if q.review_status else None,
                image_path=q.image_path,
                answer_text=q.answer_text,
                answer_assets=[
                    {
                        "answer_asset_id": a.answer_asset_id,
                        "file_path": a.file_path,
                        "caption": a.caption,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in (getattr(q, "answer_assets", None) or [])
                ] if (getattr(q, "answer_assets", None) is not None) else None,
            ))
        
        return {
            "questions": results,
            "total": total,
            "page": request.page,
            "limit": request.limit
        }
    except Exception as e:
        import traceback
        print(f"Error in search_questions: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.get("/question/{question_id}/variants")
async def get_question_variants(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get variant questions for a canonical question"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    # Get canonical question
    canonical = db.query(Question).filter(Question.question_id == question_id).first()
    if not canonical:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Get variants
    variants = db.query(Question).filter(Question.parent_question_id == question_id).all()
    
    return {
        "canonical": canonical,
        "variants": variants
    }

@router.post("/bookmark/{question_id}")
async def bookmark_question(
    question_id: int,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Bookmark a question"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    # Check if question exists
    question = db.query(Question).filter(Question.question_id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Check if already bookmarked
    existing = db.query(StudentBookmark).filter(
        StudentBookmark.student_id == current_user.user_id,
        StudentBookmark.question_id == question_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Question already bookmarked")
    
    # Create bookmark
    bookmark = StudentBookmark(
        student_id=current_user.user_id,
        question_id=question_id,
        notes=notes
    )
    
    db.add(bookmark)
    db.commit()
    
    return {"message": "Question bookmarked successfully"}

@router.get("/bookmarks")
async def get_bookmarks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get student's bookmarked questions"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    from sqlalchemy.orm import joinedload
    
    bookmarks = db.query(StudentBookmark).options(
        joinedload(StudentBookmark.question).joinedload(Question.unit),
        joinedload(StudentBookmark.question).joinedload(Question.paper)
    ).filter(
        StudentBookmark.student_id == current_user.user_id
    ).all()
    
    # Format response with question data
    import json
    results = []
    for bookmark in bookmarks:
        q = bookmark.question
        topic_tags = None
        if q.topic_tags:
            try:
                topic_tags = json.loads(q.topic_tags) if isinstance(q.topic_tags, str) else q.topic_tags
            except:
                topic_tags = None
        
        results.append({
            "bookmark_id": bookmark.bookmark_id,
            "question_id": q.question_id,
            "notes": bookmark.notes,
            "created_at": bookmark.bookmarked_at.isoformat() if bookmark.bookmarked_at else None,
            "question": {
                "question_id": q.question_id,
                "question_text": q.question_text,
                "marks": q.marks,
                "bloom_level": q.bloom_level.value if q.bloom_level else None,
                "bloom_category": q.bloom_category.value if q.bloom_category else None,
                "course_code": q.course_code,
                "unit_name": q.unit.unit_name if q.unit else None,
                "exam_type": q.paper.exam_type.value if q.paper else None,
                "academic_year": q.paper.academic_year if q.paper else None,
                "semester_type": q.paper.semester_type.value if q.paper else None,
                "topic_tags": topic_tags,
                "is_reviewed": q.is_reviewed,
                "review_status": q.review_status.value if q.review_status else None,
                "image_path": q.image_path,
                "paper_id": q.paper_id,
                "answer_text": q.answer_text,
                "answer_assets": [
                    {
                        "answer_asset_id": a.answer_asset_id,
                        "file_path": a.file_path,
                        "caption": a.caption,
                        "created_at": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in (getattr(q, "answer_assets", None) or [])
                ] if (getattr(q, "answer_assets", None) is not None) else None,
            }
        })
    
    return results

@router.post("/random-questions")
async def get_random_questions(
    request: RandomQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get random questions for practice"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    # Build query
    query = db.query(Question).join(QuestionPaper).filter(
        Question.is_canonical == True,
        Question.course_code == request.course_code
    )
    
    if request.unit_ids:
        query = query.filter(Question.unit_id.in_(request.unit_ids))
    
    if request.bloom_levels:
        query = query.filter(Question.bloom_level.in_(request.bloom_levels))
    
    # Get random questions
    questions = query.order_by(db.func.random()).limit(request.count).all()
    
    return questions

@router.post("/select-courses")
async def select_courses(
    course_codes: List[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Select/enroll in courses (store in database)"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    # Validate courses exist
    valid_courses = db.query(Course).filter(Course.course_code.in_(course_codes)).all()
    
    if len(valid_courses) != len(course_codes):
        invalid = set(course_codes) - {c.course_code for c in valid_courses}
        raise HTTPException(status_code=400, detail=f"Invalid course codes: {invalid}")
    
    # Delete existing selections for this student
    from app.models.question import StudentCourseSelection
    db.query(StudentCourseSelection).filter(
        StudentCourseSelection.student_id == current_user.user_id
    ).delete()
    
    # Create new selections
    for course_code in course_codes:
        selection = StudentCourseSelection(
            student_id=current_user.user_id,
            course_code=course_code
        )
        db.add(selection)
    
    db.commit()
    
    return {"message": "Courses selected successfully", "courses": course_codes}

@router.get("/papers")
async def get_question_papers(
    course_codes: Optional[List[str]] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get question papers for selected courses"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    query = db.query(QuestionPaper).filter(
        QuestionPaper.processing_status == "COMPLETED"
    )
    
    if course_codes:
        query = query.filter(QuestionPaper.course_code.in_(course_codes))
    
    papers = query.order_by(QuestionPaper.exam_date.desc()).all()
    
    return papers

def _resolve_pdf_path(pdf_path: str) -> str:
    """Resolve relative pdf_path to absolute path (backend root = parent of app/)."""
    if not pdf_path:
        return ""
    if os.path.isabs(pdf_path):
        return pdf_path
    # Backend root: .../backend (parent of app/)
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    resolved = os.path.normpath(os.path.join(backend_root, pdf_path))
    return resolved


@router.get("/papers/{paper_id}/download")
async def download_question_paper(
    paper_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download original question paper file"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    paper = db.query(QuestionPaper).filter(QuestionPaper.paper_id == paper_id).first()
    if not paper:
        raise HTTPException(status_code=404, detail="Question paper not found")
    
    if not paper.pdf_path:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = _resolve_pdf_path(paper.pdf_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        with open(file_path, "rb") as f:
            content = f.read()
    except OSError as e:
        raise HTTPException(status_code=500, detail="Could not read file")
    
    if not content or len(content) < 4:
        raise HTTPException(status_code=404, detail="File is empty or invalid")
    
    if content[:4] != b"%PDF":
        raise HTTPException(status_code=404, detail="File is not a valid PDF")
    
    from fastapi.responses import Response
    filename = os.path.basename(paper.pdf_path)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(content)),
        },
    )

@router.delete("/bookmark/{question_id}")
async def remove_bookmark(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a bookmark"""
    if current_user.role != "STUDENT":
        raise HTTPException(status_code=403, detail="Student access required")
    
    bookmark = db.query(StudentBookmark).filter(
        StudentBookmark.student_id == current_user.user_id,
        StudentBookmark.question_id == question_id
    ).first()
    
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    
    db.delete(bookmark)
    db.commit()
    
    return {"message": "Bookmark removed successfully"}
