from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum

class ProcessingStatus(str, enum.Enum):
    UPLOADED = "UPLOADED"
    METADATA_PENDING = "METADATA_PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ExamType(str, enum.Enum):
    CIE_1 = "CIE 1"
    CIE_2 = "CIE 2"
    IMPROVEMENT_CIE = "Improvement CIE"
    SEE = "SEE"

class SemesterType(str, enum.Enum):
    ODD = "ODD"
    EVEN = "EVEN"

class QuestionPaper(Base):
    __tablename__ = "question_papers"
    
    paper_id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String(10), ForeignKey("courses.course_code"), nullable=False)
    academic_year = Column(Integer, nullable=False)  # 1, 2, 3, 4
    semester_type = Column(Enum(SemesterType), nullable=False)
    exam_type = Column(Enum(ExamType), nullable=False)
    exam_date = Column(DateTime, nullable=True)
    pdf_path = Column(String(500), nullable=True)  # Permanent storage path
    temp_pdf_path = Column(String(500), nullable=True)  # Temporary upload path
    answer_key_path = Column(String(500), nullable=True)  # Optional answer key file path
    content_type = Column(String(20), nullable=False, default="question_paper")  # "question_paper" | "answer_scheme"
    uploaded_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    processing_status = Column(Enum(ProcessingStatus), default=ProcessingStatus.UPLOADED)
    processing_progress = Column(Float, default=0.0)  # 0-100%
    processing_error_message = Column(String(1000), nullable=True)  # Last error when status is FAILED
    ocr_confidence = Column(Float, nullable=True)
    total_questions_extracted = Column(Integer, default=0)
    questions_in_review = Column(Integer, default=0)
    file_size = Column(Integer, nullable=True)  # in bytes
    page_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    course = relationship("Course", back_populates="papers")
    uploader = relationship("User", back_populates="uploaded_papers")
    questions = relationship("Question", back_populates="paper")
