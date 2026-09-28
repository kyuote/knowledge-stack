#!/usr/bin/env python3
from docx import Document
import sys

doc = Document(sys.argv[1])
for para in doc.paragraphs:
    if para.style.name.startswith('Heading'):
        level = para.style.name.replace('Heading ', '')
        indent = '  ' * (int(level) - 1) if level.isdigit() else ''
        print(f"{indent}[H{level}] {para.text}")
