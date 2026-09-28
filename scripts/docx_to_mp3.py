#!/usr/bin/env python3
import sys, asyncio, re
from docx import Document

def extract_text(path):
    doc = Document(path)
    lines = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            lines.append(text)
    return '\n'.join(lines)

async def tts(text, out_path, voice='ru-RU-SvetlanaNeural'):
    import edge_tts
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(out_path)

if __name__ == '__main__':
    docx_path = sys.argv[1]
    out_path = sys.argv[2]
    text = extract_text(docx_path)
    # edge-tts has ~5000 char limit per request — split into chunks
    chunks = []
    current = []
    size = 0
    for line in text.split('\n'):
        if size + len(line) > 4800:
            chunks.append('\n'.join(current))
            current = [line]
            size = len(line)
        else:
            current.append(line)
            size += len(line)
    if current:
        chunks.append('\n'.join(current))

    import tempfile, os
    tmp_files = []
    for i, chunk in enumerate(chunks):
        tmp = f'/tmp/chunk_{i:03d}.mp3'
        print(f'Chunk {i+1}/{len(chunks)} ({len(chunk)} chars)...')
        asyncio.run(tts(chunk, tmp))
        tmp_files.append(tmp)

    # concatenate with cat (works for mp3)
    os.system(f"cat {' '.join(tmp_files)} > '{out_path}'")
    for f in tmp_files:
        os.remove(f)
    print(f'Done → {out_path}')
