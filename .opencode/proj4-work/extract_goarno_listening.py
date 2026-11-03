#!/usr/bin/env python3
"""Extrai questões das páginas GoArno 'Essential Questions' (listening) para JSON
no schema aceito por src/lib/pte/catalog.ts. Saída: .opencode/proj4-work/candidates/<type>.json"""
import json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup

PAGES = Path("/tmp/proj4/pages")
OUT = Path("/dev-server/.opencode/proj4-work/candidates")
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = "goarno.io"

def collapse(s: str) -> str:
    return re.sub(r"[ \t]+", " ", s)

def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def article_text(name: str) -> str:
    soup = BeautifulSoup((PAGES / f"{name}.html").read_text(encoding="utf-8"), "html.parser")
    art = soup.find("article") or soup
    return art.get_text("\n")

def split_questions(t: str) -> list[str]:
    parts = re.split(r"(?m)^\s*Question \d+\s*$", t)
    return parts[1:] if len(parts) > 1 else []

def extract_options(chunk: str) -> tuple[list[str], int]:
    """Retorna (opções, índice onde começam as opções) a partir de linhas a) b) c)..."""
    lines = [l.strip() for l in chunk.split("\n")]
    opts, start = [], None
    cur = None
    for i, l in enumerate(lines):
        m = re.match(r"^([a-e])\)\s*(.*)$", l)
        if m:
            if start is None:
                start = i
            if cur is not None:
                opts.append(clean(cur))
            cur = m.group(2)
        elif cur is not None:
            # continuação da opção atual até marcador forte
            if re.match(r"^(Answer|Answers|Incorrect words|Model Summary|Question|Listen to)", l) or not l:
                opts.append(clean(cur)); cur = None
            else:
                cur += " " + l
    if cur is not None:
        opts.append(clean(cur))
    return opts, start

def segment(chunk: str, start_marker: str, end_markers: list[str]) -> str:
    i = chunk.find(start_marker)
    if i < 0:
        return ""
    j = len(chunk)
    for em in end_markers:
        k = chunk.find(em, i + len(start_marker))
        if k >= 0:
            j = min(j, k)
    return chunk[i + len(start_marker):j]

def parse_choice(name: str, task: str, multi: bool, prompt: str) -> list[dict]:
    t = article_text(name)
    out = []
    for n, chunk in enumerate(split_questions(t), 1):
        transcript = clean(segment(chunk, "Transcript:", ["a)", "Answer:", "Answers:"]))
        if not transcript:
            continue
        opts, _ = extract_options(chunk)
        am = re.search(r"Answer[s]?:\s*\n((?:\s*[a-e][,\s]*)+)", chunk)
        if not am:
            continue
        letters = re.findall(r"[a-e]", am.group(1))
        idx = sorted({ord(c) - ord("a") for c in letters})
        if not opts or not idx or (not multi and len(idx) != 1):
            continue
        out.append({
            "id": f"goarno-{task}-{n:02d}",
            "taskType": task,
            "prompt": prompt,
            "text": transcript,
            "transcript": transcript,
            "audio_text": transcript,
            "topic": "",
            "source": SOURCE,
            "options": opts,
            "answer": idx,
            "explanation": "",
            "trap": "",
        })
    return out

def parse_hiw(name: str) -> list[dict]:
    t = article_text(name)
    out = []
    for n, chunk in enumerate(split_questions(t), 1):
        transcript = clean(segment(chunk, "Transcript:", ["Incorrect words:"]))
        if not transcript:
            continue
        seg = collapse(segment(chunk, "Incorrect words:", ["Question", "Listen to"]))
        pairs = re.findall(r"([A-Za-z][\w'-]*)\s*→\s*([A-Za-z][\w'-]*)", seg)
        bare = [re.sub(r"[^\w'-]", "", w) for w, _ in pairs]
        if not transcript or not bare:
            continue
        toks = transcript.split(" ")
        baretok = [re.sub(r"[^\w'-]", "", t) for t in toks]
        idxs = []
        for i, bt in enumerate(baretok):
            if bt in bare and i not in idxs:
                idxs.append(i)
        if not idxs:
            continue
        out.append({
            "id": f"goarno-hiw-{n:02d}",
            "taskType": "lst_hiw",
            "prompt": "Ouça o áudio e clique nas palavras DIFERENTES do que você ouviu.",
            "text": transcript,
            "transcript": transcript,
            "audio_text": transcript,
            "topic": "",
            "source": SOURCE,
            "errors": idxs,
            "explanation": "; ".join(f"{w} → {c}" for w, c in pairs),
            "trap": "",
        })
    return out

def parse_lst_fib(name: str) -> list[dict]:
    t = article_text(name)
    out = []
    for n, chunk in enumerate(split_questions(t), 1):
        blanked = clean(segment(chunk, "Transcript with blanks:", ["Answers:"]))
        if not blanked:
            continue
        seg = collapse(segment(chunk, "Answers:", ["Question", "Listen to"]))
        answers = re.findall(r"Blank \d+:\s*([A-Za-z][\w'-]*)", seg)
        # texto com lacunas "_" e transcrição com "_ resposta"
        text_blanked = re.sub(r"_{3,}\(\d+\)", " _ ", blanked)
        if not answers or text_blanked.count(" _ ") != len(answers):
            continue
        parts = re.split(r"_{3,}\(\d+\)", blanked)
        transcript = parts[0]
        for a, rest in zip(answers, parts[1:]):
            transcript += " _ " + a + rest
        transcript = clean(transcript)
        out.append({
            "id": f"goarno-lfib-{n:02d}",
            "taskType": "lst_fib",
            "prompt": "You will hear a recording. Type the missing words in the gaps.",
            "text": text_blanked,
            "transcript": transcript,
            "audio_text": transcript,
            "topic": "",
            "source": SOURCE,
            "answer": answers,
            "explanation": "",
            "trap": "",
        })
    return out

def parse_sst(name: str, task: str, prompt: str, grading: str) -> list[dict]:
    t = article_text(name)
    out = []
    for n, chunk in enumerate(split_questions(t), 1):
        transcript = clean(segment(chunk, "Transcript:", ["Model Summary:"]))
        sample = clean(segment(chunk, "Model Summary:", ["Question", "Listen to"]))
        if not transcript or not sample:
            continue
        out.append({
            "id": f"goarno-{task}-{n:02d}",
            "taskType": task,
            "prompt": prompt,
            "text": transcript,
            "transcript": transcript,
            "audio_text": transcript,
            "topic": "",
            "source": SOURCE,
            "grading_notes": grading,
            "sample": sample,
        })
    return out

jobs = []
jobs += [("lst_hcs", parse_choice("highlight-correct-summary", "lst_hcs", False,
    "You will hear a recording. Click the paragraph that best summarizes it."))]
jobs += [("lst_mcq", parse_choice("multiple-choice-single-answer-listening", "lst_mcq", False,
    "Listen to the recording and answer the multiple-choice question."))]
jobs += [("lst_mcq_multi", parse_choice("multiple-choice-multiple-answers-listening", "lst_mcq_multi", True,
    "Listen to the recording and select all the correct responses."))]
jobs += [("lst_smw", parse_choice("select-missing-word", "lst_smw", False,
    "You will hear a recording with the last word or short phrase missing. Select the best completion."))]
jobs += [("lst_hiw", parse_hiw("highlight-incorrect-words"))]
jobs += [("lst_fib", parse_lst_fib("fill-in-the-blanks-listening"))]
jobs += [("summarize_spoken_text", parse_sst("summarize-spoken-text", "sst",
    "Listen to the lecture and write a summary of 50-70 words.",
    "50-70 words: content, form, grammar, vocabulary, spelling."))]
jobs += [("lst_summary", parse_sst("summarize-spoken-text", "sum",
    "50-70 words, ~10 minutes. Capture main claim + key tension. Use a complex structure.",
    "50-70 words: content, form, grammar, vocabulary, spelling."))]

report = {}
for name, items in jobs:
    (OUT / f"{name}.json").write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    report[name] = len(items)
    print(name, len(items))
print(json.dumps(report))
