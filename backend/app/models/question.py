from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
from pgvector.sqlalchemy import Vector

class BloomLevel(int, enum.Enum):
    REMEMBER = 1
    UNDERSTAND = 2
    APPLY = 3
    ANALYZE = 4
    EVALUATE = 5
    CREATE = 6

class BloomCategory(str, enum.Enum):
    REMEMBERING = "Remembering"
    UNDERSTANDING = "Understanding"
    APPLYING = "Applying"
    ANALYZING = "Analyzing"
    EVALUATING = "Evaluating"
    CREATING = "Creating"

class DifficultyLevel(str, enum.Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"

class ReviewStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    NEEDS_REVIEW = "NEEDS_REVIEW"

class Question(Base):
    __tablename__ = "questions"
    
    question_id = Column(Integer, primary_key=True, index=True)
    paper_id = Column(Integer, ForeignKey("question_papers.paper_id"), nullable=False)
    course_code = Column(String(10), ForeignKey("courses.course_code"), nullable=False)
    unit_id = Column(Integer, ForeignKey("course_units.unit_id"), nullable=True)
    question_number = Column(String(20), nullable=False)  # "1", "2a", "3(ii)", "Q5"
    question_text = Column(Text, nullable=False)
    marks = Column(Integer, nullable=True)
    bloom_level = Column(Enum(BloomLevel), nullable=True)
    bloom_category = Column(Enum(BloomCategory), nullable=True)
    bloom_confidence = Column(Float, nullable=True)
    difficulty_level = Column(Enum(DifficultyLevel), nullable=True)
    classification_confidence = Column(Float, nullable=True)
    is_canonical = Column(Boolean, default=True)
    parent_question_id = Column(Integer, ForeignKey("questions.question_id"), nullable=True)
    similarity_score = Column(Float, nullable=True)
    has_subparts = Column(Boolean, default=False)
    has_mathematical_notation = Column(Boolean, default=False)
    image_path = Column(String(500), nullable=True)  # Cropped question image
    answer_text = Column(Text, nullable=True)  # Optional answer text (editable by admin)
    page_number = Column(Integer, nullable=True)
    topic_tags = Column(Text, nullable=True)  # JSON string array of topic tags
    question_embedding = Column(Vector(384), nullable=True)  # sentence-transformers embedding
    is_reviewed = Column(Boolean, default=False)
    review_status = Column(Enum(ReviewStatus), default=ReviewStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    paper = relationship("QuestionPaper", back_populates="questions")
    course = relationship("Course", back_populates="questions")
    unit = relationship("CourseUnit", back_populates="questions")
    parent_question = relationship("Question", remote_side=[question_id])
    variants = relationship("Question", back_populates="parent_question")
    bookmarks = relationship("StudentBookmark", back_populates="question")
    review_entries = relationship("ReviewQueue", back_populates="question")
    answer_assets = relationship("AnswerAsset", back_populates="question", cascade="all, delete-orphan")


class AnswerAsset(Base):
    """
    Stores answer images/assets for a question.
    Supports multiple images per answer.
    """
    __tablename__ = "answer_assets"

    answer_asset_id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.question_id"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    caption = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    question = relationship("Question", back_populates="answer_assets")

class ReviewQueue(Base):
    __tablename__ = "review_queue"
    
    review_id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.question_id"), nullable=False)
    issue_type = Column(String(50), nullable=False)  # LOW_CONFIDENCE, AMBIGUOUS_UNIT, OCR_ERROR
    suggested_correction = Column(Text, nullable=True)  # JSON string
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, CORRECTED
    priority = Column(Integer, default=2)  # 1-3 (1=high, 3=low)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    question = relationship("Question", back_populates="review_entries")

class StudentBookmark(Base):
    __tablename__ = "student_bookmarks"
    
    bookmark_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.question_id"), nullable=False)
    notes = Column(Text, nullable=True)
    bookmarked_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    student = relationship("User", back_populates="bookmarks")
    question = relationship("Question", back_populates="bookmarks")

class StudentCourseSelection(Base):
    __tablename__ = "student_course_selections"
    
    selection_id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    course_code = Column(String(10), ForeignKey("courses.course_code"), nullable=False)
    selected_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    student = relationship("User", back_populates="course_selections")
    course = relationship("Course")
