#!/usr/bin/env python3
"""
Converts a docx to one mp3 lecture with timecodes JSON per H2 section.
Usage: python3 docx_to_lecture.py <input.docx> <output.mp3> <output.json>
"""
import sys, asyncio, os, json
from docx import Document
from mutagen.mp3 import MP3

VOICE = 'ru-RU-SvetlanaNeural'
CHUNK_SIZE = 4500  # chars per edge-tts request

def extract_sections(docx_path):
    """Group paragraphs by H2 headings, skip H1 and TOC-like content."""
    doc = Document(docx_path)
    sections = []
    current_title = None
    current_paras = []

    for para in doc.paragraphs:
        style = para.style.name
        text = para.text.strip()
        if not text:
            continue

        if style == 'Heading 1':
            continue  # skip H1 title

        if style == 'Heading 2':
            if current_title is not None:
                sections.append({'title': current_title, 'text': '\n'.join(current_paras)})
            current_title = text
            current_paras = [text + '.']  # say the section title
        elif current_title is not None:
            # Include H3/H4 headings as spoken text
            if style.startswith('Heading'):
                current_paras.append(text + '.')
            else:
                current_paras.append(text)

    if current_title and current_paras:
        sections.append({'title': current_title, 'text': '\n'.join(current_paras)})

    return sections

def split_chunks(text, size=CHUNK_SIZE):
    """Split text into chunks by sentences to avoid cutting words."""
    chunks = []
    while len(text) > size:
        cut = text.rfind('.', 0, size)
        if cut == -1:
            cut = text.rfind(' ', 0, size)
        if cut == -1:
            cut = size
        chunks.append(text[:cut+1].strip())
        text = text[cut+1:].strip()
    if text:
        chunks.append(text)
    return chunks

async def tts_chunk(text, path):
    import edge_tts
    comm = edge_tts.Communicate(text, VOICE)
    await comm.save(path)

def section_to_mp3(section_text, out_path):
    chunks = split_chunks(section_text)
    tmp_files = []
    for i, chunk in enumerate(chunks):
        tmp = f'/tmp/lec_chunk_{i:04d}.mp3'
        asyncio.run(tts_chunk(chunk, tmp))
        tmp_files.append(tmp)
    os.system(f"cat {' '.join(tmp_files)} > '{out_path}'")
    for f in tmp_files:
        os.remove(f)

def mp3_duration(path):
    return MP3(path).info.length

if __name__ == '__main__':
    docx_path = sys.argv[1]
    out_mp3   = sys.argv[2]
    out_json  = sys.argv[3]

    sections = extract_sections(docx_path)
    print(f'Found {len(sections)} sections:')
    for s in sections:
        print(f'  • {s["title"]} ({len(s["text"])} chars)')

    timecodes = []
    tmp_section_files = []
    current_time = 0.0

    for i, sec in enumerate(sections):
        tmp_path = f'/tmp/lec_section_{i:03d}.mp3'
        print(f'\n[{i+1}/{len(sections)}] Generating: {sec["title"]}...')
        section_to_mp3(sec['text'], tmp_path)
        dur = mp3_duration(tmp_path)
        timecodes.append({
            'title': sec['title'],
            'start': round(current_time, 2),
            'duration': round(dur, 2)
        })
        current_time += dur
        tmp_section_files.append(tmp_path)
        print(f'  → {dur:.1f}s (total so far: {current_time:.1f}s)')

    print(f'\nConcatenating {len(tmp_section_files)} sections → {out_mp3}')
    os.system(f"cat {' '.join(tmp_section_files)} > '{out_mp3}'")
    for f in tmp_section_files:
        os.remove(f)

    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(timecodes, f, ensure_ascii=False, indent=2)

    print(f'\n✓ Audio: {out_mp3}')
    print(f'✓ Timecodes: {out_json}')
    print(f'✓ Total duration: {current_time/60:.1f} min')
    print('\nTimecodes:')
    for tc in timecodes:
        m, s = divmod(int(tc['start']), 60)
        print(f'  {m:02d}:{s:02d}  {tc["title"]}')
