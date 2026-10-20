FROM python:3.13-slim

# LibreOffice  -> Word/Excel/PowerPoint/HTML to PDF
# Ghostscript  -> PDF/A, deep repair
# Tesseract    -> OCR (add more language packs as needed, e.g. tesseract-ocr-urd, tesseract-ocr-ara)
# Fonts        -> correct rendering of most scripts in converted documents
RUN apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-writer libreoffice-calc libreoffice-impress libreoffice-draw \
        ghostscript \
        tesseract-ocr tesseract-ocr-eng tesseract-ocr-urd tesseract-ocr-ara tesseract-ocr-hin \
        fonts-dejavu fonts-liberation fonts-noto-core fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CONVERTOR_STORAGE_DIR=/data \
    TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd --create-home --uid 1000 convertor && mkdir -p /data && chown convertor /data
USER convertor

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers"]
