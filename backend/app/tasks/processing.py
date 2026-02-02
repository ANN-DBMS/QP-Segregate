from celery import current_task
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
from app.models.question_paper import QuestionPaper, ProcessingStatus
from app.models.question import Question, ReviewQueue, BloomLevel, BloomCategory, DifficultyLevel, ReviewStatus
from app.models.course import CourseUnit
from app.services.ocr_service import OCRService
from app.services.classification_service import ClassificationService
from app.services.file_conversion_service import FileConversionService
from app.services.llm_extraction_service import LLMExtractionService
from app.services.llm_classification_service import LLMClassificationService
from app.services.embedding_service import EmbeddingService
from app.core.local_cloud_storage import local_cloud_storage
from app.tasks.celery import celery
import os
import json
from datetime import datetime
from typing import List, Dict, Optional
import pymongo
from pymongo import MongoClient

# Database connections
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# MongoDB connection (optional)
mongo_client = None
mongo_db = None
if settings.MONGODB_URL and settings.MONGODB_URL.strip():
    try:
        mongo_client = MongoClient(settings.MONGODB_URL)
        mongo_db = mongo_client.qpaper_ai
    except Exception as e:
        print(f"⚠️  MongoDB connection failed: {e}. Continuing without MongoDB.")

# Initialize services (lazy initialization for classification service)
ocr_service = OCRService()
classification_service = None  # Will be initialized on first use

# Initialize LLM services
file_conversion_service = FileConversionService()
llm_extraction_service = None
llm_classification_service = None

def get_classification_service():
    """Lazy initialization of classification service"""
    global classification_service
    if classification_service is None:
        classification_service = ClassificationService()
    return classification_service

def get_llm_extraction_service():
    """Lazy initialization of LLM extraction service"""
    global llm_extraction_service
    if llm_extraction_service is None:
        llm_extraction_service = LLMExtractionService()
    return llm_extraction_service

def get_llm_classification_service():
    """Lazy initialization of LLM classification service"""
    global llm_classification_service
    if llm_classification_service is None:
        llm_classification_service = LLMClassificationService()
    return llm_classification_service

@celery.task(bind=True)
def process_question_paper(self, paper_id: int):
    """Main task to process a question paper"""
    db = SessionLocal()
    
    try:
        # Get paper details
        paper = db.query(QuestionPaper).filter(QuestionPaper.paper_id == paper_id).first()
        if not paper:
            raise Exception(f"Question paper {paper_id} not found")
        
        # Update status to processing
        paper.processing_status = ProcessingStatus.PROCESSING
        paper.processing_progress = 0
        db.commit()
        
        # Step 1 & 2: For PDF, send directly to GPT-4o; for DOCX, convert then extract
        self.update_state(state='PROGRESS', meta={'step': 'File Conversion', 'progress': 10})
        self.update_state(state='PROGRESS', meta={'step': 'LLM Extraction', 'progress': 30})
        questions = extract_questions_from_paper(paper)
        
        # Step 3: LLM Classification (units and topic tags)
        self.update_state(state='PROGRESS', meta={'step': 'LLM Classification', 'progress': 50})
        classified_questions = classify_questions_with_llm(questions, paper.course_code, db)
        
        # Step 4: Duplicate Detection (simplified - paper-level duplicates already checked at upload)
        self.update_state(state='PROGRESS', meta={'step': 'Deduplication', 'progress': 70})
        # Simple duplicate detection - just marks questions as canonical
        # Paper-level duplicate checking (same course, exam type, date) is done in submit_metadata
        deduplicated_questions = detect_duplicates(classified_questions, paper.course_code)
        
        # Step 5: Save to Database
        self.update_state(state='PROGRESS', meta={'step': 'Saving', 'progress': 90})
        save_questions(deduplicated_questions, paper, db)
        
        # Update paper status
        paper.processing_status = ProcessingStatus.COMPLETED
        paper.processing_progress = 100
        paper.total_questions_extracted = len(deduplicated_questions)
        db.commit()
        
        return {
            'status': 'completed',
            'paper_id': paper_id,
            'questions_extracted': len(deduplicated_questions)
        }
        
    except Exception as e:
        # Update paper status to failed
        paper.processing_status = ProcessingStatus.FAILED
        db.commit()
        
        # Log error to MongoDB
        mongo_db.processing_errors.insert_one({
            'paper_id': paper_id,
            'error': str(e),
            'timestamp': datetime.utcnow(),
            'task_id': self.request.id
        })
        
        raise e
    finally:
        db.close()

def convert_file_for_llm(paper: QuestionPaper) -> Dict:
    """Convert PDF/DOCX file to text and images for LLM processing (used for non-PDF or fallback)."""
    file_path = paper.pdf_path
    if not file_path or not os.path.exists(file_path):
        raise Exception(f"File not found: {file_path}")
    conversion_result = file_conversion_service.convert_file(file_path)
    return file_conversion_service.prepare_for_llm(conversion_result)

def extract_questions_with_llm(file_content: Dict, is_answer_scheme: bool = False) -> List[Dict]:
    """Extract questions using LLM from prepared file content (text + images)."""
    extraction_service = get_llm_extraction_service()
    return extraction_service.extract_questions_with_llm(file_content, is_answer_scheme=is_answer_scheme)

def extract_questions_from_paper(paper: QuestionPaper, file_content: Optional[Dict] = None) -> List[Dict]:
    """
    Extract questions from paper. For PDFs, tries direct PDF to GPT-4o (Responses API) if available;
    otherwise falls back to converted text/images and Chat Completions. For DOCX, uses conversion + Chat Completions.
    When paper.content_type is "answer_scheme", also extracts answer_text per question.
    """
    is_answer_scheme = getattr(paper, "content_type", "question_paper") == "answer_scheme"
    extraction_service = get_llm_extraction_service()
    file_path = (paper.pdf_path or "").strip()
    if file_path.lower().endswith(".pdf") and os.path.exists(file_path):
        try:
            return extraction_service.extract_questions_from_pdf(file_path, is_answer_scheme=is_answer_scheme)
        except Exception:
            # Responses API not available (e.g. 'OpenAI' object has no attribute 'responses')
            # or other PDF direct-call failure; fall back to convert PDF then Chat Completions.
            if file_content is None:
                file_content = convert_file_for_llm(paper)
            return extract_questions_with_llm(file_content, is_answer_scheme=is_answer_scheme)
    if file_content is None:
        file_content = convert_file_for_llm(paper)
    return extract_questions_with_llm(file_content, is_answer_scheme=is_answer_scheme)

def classify_questions_with_llm(questions: List[Dict], course_code: str, db) -> List[Dict]:
    """Classify questions to units and generate topic tags using LLM"""
    classification_service = get_llm_classification_service()
    classified_questions = classification_service.classify_questions_with_llm(
        questions, course_code, db
    )
    return classified_questions

def process_ocr(paper: QuestionPaper) -> Dict:
    """Process PDF or DOCX with OCR using local cloud storage"""
    # Create output directory for page images
    output_dir = os.path.join(settings.PAGE_IMAGES_DIR, f"paper_{paper.paper_id}")
    os.makedirs(output_dir, exist_ok=True)
    
    # Check file type
    file_path = paper.pdf_path
    file_ext = os.path.splitext(file_path)[1].lower() if file_path else ''
    
    # Extract text from PDF or DOCX
    if file_ext in ['.docx', '.doc']:
        ocr_results = ocr_service.extract_text_from_docx(file_path)
    else:
        ocr_results = ocr_service.extract_text_from_pdf(file_path, output_dir)
    
    # Upload processed images to local cloud storage
    for i, page in enumerate(ocr_results['pages']):
        if page.get('image_path'):
            cloud_key = f"papers/{paper.paper_id}/page_images/page_{i+1}.png"
            cloud_url = local_cloud_storage.upload_file(page['image_path'], cloud_key)
            page['cloud_image_url'] = cloud_url
            # Keep local path for now, will be cleaned up later
            page['local_image_path'] = page['image_path']
    
    # Store raw OCR data in MongoDB
    mongo_db.raw_ocr_data.insert_one({
        'paper_id': paper.paper_id,
        'course_code': paper.course_code,
        'ocr_results': ocr_results,
        'timestamp': datetime.utcnow()
    })
    
    return ocr_results

def parse_questions(ocr_results: Dict) -> List[Dict]:
    """Parse questions from OCR text"""
    all_questions = []
    
    for page in ocr_results['pages']:
        if page['confidence'] > 40:  # Only process pages with decent OCR confidence
            questions = ocr_service.extract_questions_from_text(page['text'])
            
            for question in questions:
                question['page_number'] = page['page_number']
                question['ocr_confidence'] = page['confidence']
                all_questions.append(question)
    
    return all_questions

def classify_questions(questions: List[Dict], course_code: str) -> List[Dict]:
    """Classify questions for unit, Bloom level, and difficulty"""
    # Load syllabus data from MongoDB
    syllabus = mongo_db.syllabus_documents.find_one({'course_code': course_code})
    
    classified_questions = []
    
    cls_service = get_classification_service()
    for question in questions:
        # Unit classification
        unit_id, unit_confidence = cls_service.classify_unit(
            question['question_text'], course_code, syllabus
        )
        question['unit_id'] = unit_id
        question['unit_confidence'] = unit_confidence
        
        # Bloom taxonomy classification
        bloom_level, bloom_category, bloom_confidence = cls_service.classify_bloom_taxonomy(
            question['question_text']
        )
        question['bloom_level'] = bloom_level
        question['bloom_category'] = bloom_category
        question['bloom_confidence'] = bloom_confidence
        
        # Difficulty estimation
        difficulty = cls_service.estimate_difficulty(question)
        question['difficulty_level'] = difficulty
        
        # Extract features
        features = cls_service.extract_question_features(question['question_text'])
        question.update(features)
        
        # Generate embedding
        embedding = cls_service.generate_embedding(question['question_text'])
        question['embedding'] = embedding.tolist()
        
        classified_questions.append(question)
    
    return classified_questions

def detect_duplicates(questions: List[Dict], course_code: str) -> List[Dict]:
    """
    Simple duplicate detection: Just mark all questions as canonical.
    Paper-level duplicate checking (same course, exam type, date) is already done
    at upload time in submit_metadata endpoint.
    """
    # Mark all questions as canonical (new questions)
    # No need for complex embedding-based similarity checking
    for question in questions:
        question['is_canonical'] = True
        question['parent_question_id'] = None
        question['similarity_score'] = None
    
    return questions

def save_questions(questions: List[Dict], paper: QuestionPaper, db):
    """Save questions to database"""
    import logging
    logger = logging.getLogger(__name__)
    
    if not questions:
        logger.warning(f"No questions to save for paper {paper.paper_id}")
        return
    
    logger.info(f"Saving {len(questions)} questions for paper {paper.paper_id}")
    review_count = 0
    saved_count = 0
    
    try:
        for idx, question_data in enumerate(questions):
            # Parse topic tags (should be a list, store as JSON string)
            topic_tags_json = None
            if question_data.get('topic_tags'):
                topic_tags_json = json.dumps(question_data['topic_tags'])
            
            try:
                # Validate required fields
                if 'question_number' not in question_data:
                    logger.error(f"Question {idx} missing 'question_number': {question_data}")
                    continue
                if 'question_text' not in question_data:
                    logger.error(f"Question {idx} missing 'question_text': {question_data}")
                    continue
                
                # Create question object
                embedding = None
                try:
                    embedding = EmbeddingService.embed_text(question_data.get('question_text'))
                except Exception as e:
                    logger.warning(f"Failed to generate embedding for question {idx}: {e}")

                # Auto-link variants within the same course+unit using embeddings (scoped, best-effort)
                is_canonical = question_data.get('is_canonical', True)
                parent_question_id = question_data.get('parent_question_id')
                similarity_score = question_data.get('similarity_score')

                try:
                    unit_id = question_data.get('unit_id')
                    if embedding and unit_id:
                        candidate = db.query(Question).filter(
                            Question.course_code == paper.course_code,
                            Question.unit_id == unit_id,
                            Question.question_embedding.isnot(None),
                            Question.paper_id != paper.paper_id,
                        ).order_by(
                            Question.question_embedding.cosine_distance(embedding)
                        ).first()

                        if candidate is not None:
                            # Because we normalize embeddings, cosine_distance ~= (1 - cosine_similarity)
                            dist = db.query(
                                Question.question_embedding.cosine_distance(embedding)
                            ).filter(Question.question_id == candidate.question_id).scalar()
                            if dist is not None:
                                sim = 1.0 - float(dist)
                                if sim >= settings.SIMILARITY_THRESHOLD:
                                    canonical_id = candidate.parent_question_id or candidate.question_id
                                    is_canonical = False
                                    parent_question_id = canonical_id
                                    similarity_score = sim
                except Exception as e:
                    logger.warning(f"Variant auto-link failed for question {idx}: {e}")

                question = Question(
                    paper_id=paper.paper_id,
                    course_code=paper.course_code,
                    unit_id=question_data.get('unit_id'),
                    question_number=str(question_data['question_number']),  # Ensure it's a string
                    question_text=str(question_data['question_text']),  # Ensure it's a string
                    marks=question_data.get('marks'),
                    bloom_level=BloomLevel(question_data['bloom_taxonomy_level']) if question_data.get('bloom_taxonomy_level') else None,
                    bloom_category=BloomCategory(question_data['bloom_category']) if question_data.get('bloom_category') else None,
                    bloom_confidence=None,  # LLM doesn't provide confidence for Bloom
                    difficulty_level=None,  # Can be added later if needed
                    classification_confidence=question_data.get('classification_confidence', 0),
                    is_canonical=is_canonical,
                    parent_question_id=parent_question_id,
                    similarity_score=similarity_score,
                    has_subparts=question_data.get('has_subparts', False),
                    has_mathematical_notation=question_data.get('has_mathematical_notation', False),
                    page_number=question_data.get('page_number'),
                    topic_tags=topic_tags_json,
                    question_embedding=embedding,
                    answer_text=question_data.get('answer_text'),  # Populated when paper is answer_scheme
                    is_reviewed=False,  # All questions start as unreviewed
                    review_status=ReviewStatus.PENDING
                )
                
                db.add(question)
                db.flush()  # Get the question_id
                saved_count += 1
                logger.debug(f"Saved question {idx+1}/{len(questions)}: {question_data.get('question_number')}")
        
                # Add ALL non-reviewed questions to review queue
                # This ensures all questions appear in the review queue
                classification_confidence = question_data.get('classification_confidence', 0)
                unit_id = question_data.get('unit_id')
                
                # Determine issue type and priority
                if unit_id is None:
                    issue_type = 'AMBIGUOUS_UNIT'
                    priority = 1
                elif classification_confidence < 0.7:
                    issue_type = 'LOW_CONFIDENCE'
                    priority = 2
                else:
                    issue_type = 'NEEDS_REVIEW'
                    priority = 3
                
                review_queue = ReviewQueue(
                    question_id=question.question_id,
                    issue_type=issue_type,
                    suggested_correction=json.dumps({
                        'unit_id': question_data.get('unit_id'),
                        'unit_name': question_data.get('unit_name'),
                        'bloom_level': question_data.get('bloom_taxonomy_level'),
                        'bloom_category': question_data.get('bloom_category'),
                        'marks': question_data.get('marks'),
                        'topic_tags': question_data.get('topic_tags', [])
                    }),
                    priority=priority,
                    status='PENDING'
                )
                
                db.add(review_queue)
                review_count += 1
                
                # Store embedding in vector database (optional, for duplicate detection)
                # Can generate embedding later if needed for similarity search
                if mongo_db:
                    try:
                        # Store question metadata in MongoDB for future reference
                        mongo_db.question_metadata.insert_one({
                            'question_id': question.question_id,
                            'course_code': paper.course_code,
                            'unit_id': question_data.get('unit_id'),
                            'topic_tags': question_data.get('topic_tags', []),
                            'marks': question_data.get('marks'),
                            'bloom_level': question_data.get('bloom_taxonomy_level')
                        })
                    except Exception as e:
                        logger.warning(f"Failed to store question metadata in MongoDB: {e}")
                        
            except Exception as e:
                logger.error(f"Failed to save question {idx}: {e}", exc_info=True)
                continue
        
        # Update paper with review count
        paper.questions_in_review = review_count
        db.commit()
        logger.info(f"Successfully saved {saved_count}/{len(questions)} questions for paper {paper.paper_id}")
        
    except Exception as e:
        logger.error(f"Error saving questions: {e}", exc_info=True)
        db.rollback()
        raise

@celery.task
def cleanup_temp_uploads():
    """Clean up expired temporary uploads"""
    import time
    
    temp_dir = settings.TEMP_UPLOAD_DIR
    current_time = time.time()
    expire_time = settings.TEMP_UPLOAD_EXPIRE_HOURS * 3600
    
    if os.path.exists(temp_dir):
        for filename in os.listdir(temp_dir):
            file_path = os.path.join(temp_dir, filename)
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getmtime(file_path)
                if file_age > expire_time:
                    os.remove(file_path)
                    print(f"Removed expired temp file: {filename}")
    
    return {"cleaned_files": "temp_uploads_cleaned"}
