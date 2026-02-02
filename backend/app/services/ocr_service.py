import pytesseract
import cv2
import numpy as np
from pdf2image import convert_from_path
from PIL import Image
import os
from typing import List, Dict, Tuple, Optional
import re

class OCRService:
    def __init__(self):
        # Configure Tesseract path if needed
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR results"""
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Deskew the image
        gray = self._deskew_image(gray)
        
        # Denoise
        denoised = cv2.medianBlur(gray, 3)
        
        # Contrast enhancement
        enhanced = cv2.convertScaleAbs(denoised, alpha=1.2, beta=10)
        
        # Threshold to binary
        _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        return binary
    
    def _deskew_image(self, image: np.ndarray) -> np.ndarray:
        """Deskew the image by detecting and correcting rotation"""
        # Find contours
        contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return image
        
        # Get the largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Get minimum area rectangle
        rect = cv2.minAreaRect(largest_contour)
        angle = rect[2]
        
        # Correct angle if it's more than 45 degrees
        if angle > 45:
            angle = angle - 90
        elif angle < -45:
            angle = angle + 90
        
        # Rotate image if angle is significant
        if abs(angle) > 0.5:
            (h, w) = image.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
            return rotated
        
        return image
    
    def extract_text_from_docx(self, docx_path: str) -> Dict:
        """Extract text from DOCX file directly"""
        try:
            from docx import Document
            
            doc = Document(docx_path)
            
            results = {
                "total_pages": 0,
                "pages": [],
                "overall_confidence": 100.0  # DOCX has perfect text extraction
            }
            
            # Extract all paragraphs
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text.strip())
            
            # Estimate pages (rough estimate: ~500 words per page)
            total_words = len(' '.join(full_text).split())
            estimated_pages = max(1, (total_words // 500) + 1)
            
            # Combine all text (for now, treat as single page for processing)
            combined_text = '\n'.join(full_text)
            
            page_result = {
                "page_number": 1,
                "text": combined_text,
                "confidence": 100.0,  # Perfect extraction from DOCX
                "word_count": total_words,
                "image_path": None
            }
            
            results["pages"].append(page_result)
            results["total_pages"] = estimated_pages
            
            return results
            
        except ImportError:
            raise Exception("python-docx library is required for DOCX processing")
        except Exception as e:
            raise Exception(f"DOCX processing failed: {str(e)}")
    
    def extract_text_from_pdf(self, pdf_path: str, output_dir: str = None) -> Dict:
        """Extract text from PDF using OCR"""
        try:
            # Convert PDF to images (POPPLER_PATH for Windows: set to Poppler bin folder)
            poppler_path = os.environ.get("POPPLER_PATH") or None
            pages = convert_from_path(pdf_path, dpi=300, poppler_path=poppler_path)
            
            results = {
                "total_pages": len(pages),
                "pages": [],
                "overall_confidence": 0.0
            }
            
            total_confidence = 0
            valid_pages = 0
            
            for i, page in enumerate(pages):
                # Convert PIL to OpenCV format
                page_cv = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2BGR)
                
                # Preprocess image
                processed = self.preprocess_image(page_cv)
                
                # Perform OCR
                ocr_data = pytesseract.image_to_data(processed, output_type=pytesseract.Output.DICT)
                
                # Extract text and confidence
                text = pytesseract.image_to_string(processed)
                confidences = [int(conf) for conf in ocr_data['conf'] if int(conf) > 0]
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0
                
                page_result = {
                    "page_number": i + 1,
                    "text": text.strip(),
                    "confidence": avg_confidence,
                    "word_count": len(text.split()),
                    "image_path": None
                }
                
                # Save processed image if output directory is provided
                if output_dir:
                    os.makedirs(output_dir, exist_ok=True)
                    image_path = os.path.join(output_dir, f"page_{i+1}.png")
                    cv2.imwrite(image_path, processed)
                    page_result["image_path"] = image_path
                
                results["pages"].append(page_result)
                
                if avg_confidence > 0:
                    total_confidence += avg_confidence
                    valid_pages += 1
            
            # Calculate overall confidence
            if valid_pages > 0:
                results["overall_confidence"] = total_confidence / valid_pages
            
            return results
            
        except Exception as e:
            raise Exception(f"OCR processing failed: {str(e)}")
    
    def extract_questions_from_text(self, text: str) -> List[Dict]:
        """Extract questions from OCR text using regex patterns"""
        questions = []
        
        # Question number patterns
        question_patterns = [
            r'(\d+)\s*[\.\)]\s*',  # 1. or 1)
            r'Q(\d+)\s*[\.\)]\s*',  # Q1. or Q1)
            r'(\d+)\s*[a-z]\)\s*',  # 1a), 1b), etc.
            r'(\d+)\s*\([ivx]+\)\s*',  # 1(i), 1(ii), etc.
        ]
        
        # Marks patterns
        marks_patterns = [
            r'\[(\d+)\s*(?:marks?|M|m)\]',     # [10 marks], [10M]
            r'\((\d+)\s*(?:marks?|M|m)\)',     # (10 marks), (10M)
            r'CO\d+-(\d+)M',                    # CO3-10M
            r'(\d+)\s*(?:marks?|M)',           # 10 marks, 10M
            r'\[(\d+)\]'                        # [10]
        ]
        
        lines = text.split('\n')
        current_question = None
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Check if line starts with question number
            question_match = None
            for pattern in question_patterns:
                match = re.match(pattern, line, re.IGNORECASE)
                if match:
                    question_match = match
                    break
            
            if question_match:
                # Save previous question if exists
                if current_question:
                    questions.append(current_question)
                
                # Start new question
                question_number = question_match.group(1)
                question_text = line[len(question_match.group(0)):].strip()
                
                # Extract marks from the line
                marks = self._extract_marks_from_text(line)
                
                current_question = {
                    "question_number": question_number,
                    "question_text": question_text,
                    "marks": marks,
                    "has_subparts": False,
                    "has_mathematical_notation": self._has_mathematical_notation(question_text),
                    "line_number": i + 1
                }
            else:
                # Continue current question
                if current_question:
                    current_question["question_text"] += " " + line
        
        # Add last question
        if current_question:
            questions.append(current_question)
        
        return questions
    
    def _extract_marks_from_text(self, text: str) -> int:
        """Extract marks from text using regex patterns"""
        marks_patterns = [
            r'\[(\d+)\s*(?:marks?|M|m)\]',     # [10 marks], [10M]
            r'\((\d+)\s*(?:marks?|M|m)\)',     # (10 marks), (10M)
            r'CO\d+-(\d+)M',                    # CO3-10M
            r'(\d+)\s*(?:marks?|M)',           # 10 marks, 10M
            r'\[(\d+)\]'                        # [10]
        ]
        
        for pattern in marks_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return None
    
    def _has_mathematical_notation(self, text: str) -> bool:
        """Check if text contains mathematical notation"""
        math_patterns = [
            r'[∑∏∫∂∇]',  # Mathematical symbols
            r'[αβγδεζηθικλμνξοπρστυφχψω]',  # Greek letters
            r'[²³⁴⁵⁶⁷⁸⁹⁰¹]',  # Superscripts
            r'[₀₁₂₃₄₅₆₇₈₉]',  # Subscripts
            r'[√∛∜]',  # Roots
            r'[∞±∓×÷]',  # Other math symbols
            r'[≤≥≠≈≡]',  # Comparison symbols
            r'[∈∉⊂⊃⊆⊇]',  # Set theory symbols
        ]
        
        for pattern in math_patterns:
            if re.search(pattern, text):
                return True
        
        return False
