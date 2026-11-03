#!/usr/bin/env python3
"""Projeto 4 - Fase 1/2: extracao das fontes aprovadas (writing/reading/speaking).

Fontes (verificadas HTTP 200, sem login, com gabarito):
- goarno.io: answer_short, mcq_single (reading), swt, retell_lecture
- pteacademy.in PDFs: answer_short (100), mcq_single (10), mcq_multi (10)
- stormedugo.com: read_aloud (50)
- edknot.com: read_fib (12), reorder_paragraphs (12)
- languageacademy.com.au + 79score.com: write_essay (apenas itens COM sample real)
"""
import json
import re
import subprocess
import sys
from pathlib import Path

from bs4 import BeautifulSoup

PAGES = Path("/tmp/proj4/pages")
OUT = Path(__file__).parent / "candidates"
OUT.mkdir(exist_ok=True)


def article_text(fname: str) -> str:
    soup = BeautifulSoup((PAGES / fname).read_text(encoding="utf-8"), "html.parser")
    art = soup.find("article") or soup
    return art.get_text("\n")


def full_text(fname: str) -> str:
    soup = BeautifulSoup((PAGES / fname).read_text(encoding="utf-8"), "html.parser")
    return soup.get_text("\n")


def topic_of(text: str) -> str:
    toks = [t for t in re.findall(r"[A-Za-z']+", text)][:3]
    return " ".join(toks).lower()


def clean(s: str) -> str:
    return re.sub(r"[ \t]+", " ", s.replace("\u00a0", " ")).strip()


# ---------------------------------------------------------------- goarno asq
def extract_goarno_asq():
    t = article_text("asq.html")
    chunks = re.split(r"Question (\d+)\n", t)[1:]
    out = []
    for i in range(0, len(chunks) - 1, 2):
        n, chunk = int(chunks[i]), chunks[i + 1]
        m = re.search(r"Question:\s*\n+(.+?)\n+Answer:\s*\n+(.+?)(?:\n\n|\nQuestion|\Z)", chunk, re.S)
        if not m:
            continue
        q, a = clean(m.group(1)), clean(m.group(2))
        if not q or not a:
            continue
        out.append({
            "id": f"goarno-asq-{n:02d}",
            "taskType": "answer_short",
            "prompt": "One word or short phrase. Don't elaborate.",
            "text": q,
            "transcript": "",
            "audio_text": "",
            "content": q,
            "answer": a,
            "source": "goarno.io",
            "word_count": len(q.split()),
            "grading_notes": "Scored on whether your answer matches an acceptable response. Quick response time matters — hesitation hurts almost as much as a wrong answer.",
            "topic": topic_of(q),
        })
    return out


# ------------------------------------------------------- goarno mcq single (reading)
def extract_goarno_rmcq_single():
    t = article_text("rmcq_single.html")
    chunks = re.split(r"Question (\d+)\n", t)[1:]
    out = []
    for i in range(0, len(chunks) - 1, 2):
        n, chunk = int(chunks[i]), chunks[i + 1]
        m = re.search(r"Answer:\s*\n?\s*([a-d])", chunk)
        if not m:
            continue
        ans_idx = ord(m.group(1)) - ord("a")
        opts_m = re.search(r"\n(a)\)", chunk)
        if not opts_m:
            continue
        body = chunk[: opts_m.start()]
        lines = [clean(x) for x in body.split("\n") if clean(x)]
        # pergunta = ultima linha que termina em "?" antes das opcoes
        q_idx = None
        for j in range(len(lines) - 1, -1, -1):
            if lines[j].endswith("?"):
                q_idx = j
                break
        if q_idx is None or q_idx == 0:
            continue
        passage = "\n".join(lines[: q_idx])
        question = lines[q_idx]
        opt_lines = [clean(x) for x in chunk[opts_m.start(): m.start()].split("\n") if clean(x)]
        options = [re.sub(r"^[a-e]\)\s*", "", x) for x in opt_lines if re.match(r"^[a-e]\)", x)]
        if len(options) < 3:
            continue
        out.append({
            "id": f"goarno-mcq_si-{n:02d}",
            "taskType": "mcq_single",
            "prompt": "Read the text and answer the multiple-choice question by selecting one correct response.",
            "text": passage + "\n\n" + question,
            "transcript": "",
            "audio_text": "",
            "content": passage + "\n\n" + question,
            "options": options,
            "answer": [ans_idx],
            "source": "goarno.io",
            "explanation": "",
            "trap": "",
            "topic": topic_of(passage),
        })
    return out


# ------------------------------------------------------------------ goarno swt
def extract_goarno_swt():
    t = article_text("swt.html")
    chunks = re.split(r"Example (\d+)\n", t)[1:]
    out = []
    for i in range(0, len(chunks) - 1, 2):
        n, chunk = int(chunks[i]), chunks[i + 1]
        m = re.search(r"\nAnswer\s*\n+(.+?)(?:\nExample |\nFAQ|\Z)", chunk, re.S)
        if not m:
            continue
        passage = "\n\n".join(clean(p) for p in chunk[: m.start()].split("\n\n") if clean(p) and not p.strip().startswith(("If you want", "read our")))
        if not passage or len(passage.split()) < 40:
            continue
        sample = clean(m.group(1))
        if not sample:
            continue
        out.append({
            "id": f"goarno-swt-{n:02d}",
            "taskType": "swt",
            "prompt": "ONE sentence, 5-75 words. Capture the main claim and the key supporting detail. Use a complex structure (although/while/despite).",
            "text": passage,
            "transcript": "",
            "audio_text": "",
            "content": passage,
            "sample": sample,
            "source": "goarno.io",
            "word_count": len(passage.split()),
            "grading_notes": "Scored on content, form (one sentence, 5-75 words), grammar and vocabulary.",
            "topic": topic_of(passage),
        })
    return out


# ------------------------------------------------------------- goarno retell
def extract_goarno_retell():
    t = article_text("retell.html")
    chunks = re.split(r"Question (\d+)\n", t)[1:]
    out = []
    for i in range(0, len(chunks) - 1, 2):
        n, chunk = int(chunks[i]), chunks[i + 1]
        m = re.search(r"Transcript:\s*\n+(.+?)\n+Sample Answer:", chunk, re.S)
        if not m:
            continue
        transcript = clean(m.group(1))
        if not transcript or len(transcript.split()) < 40:
            continue
        out.append({
            "id": f"goarno-retell-{n:02d}",
            "taskType": "retell_lecture",
            "prompt": "Listen to the lecture and retell it in your own words in 40 seconds.",
            "text": transcript,
            "transcript": transcript,
            "audio_text": transcript,
            "content": transcript,
            "source": "goarno.io",
            "word_count": len(transcript.split()),
            "grading_notes": "Scored on content, oral fluency and pronunciation. Cover the main points, speaker's attitude and conclusion.",
            "topic": topic_of(transcript),
        })
    return out


# --------------------------------------------------------- stormedugo read_aloud
def extract_stormedugo_ra():
    t = full_text("storm_ra.html")
    pat = re.compile(r"\n\s*(\d+)\. ([^\n]+)\n\s*\n?\s*(.+?)(?=\n\s*\d+\. |\nRead Aloud:|\n🧠|\Z)", re.S)
    out = []
    for n, title, passage in pat.findall(t):
        p = clean(passage)
        if len(p.split()) < 25 or len(p.split()) > 120 or "STORM EduGo" in p or "info@stormedugo" in p:
            continue
        out.append({
            "id": f"storm-ra-{int(n):02d}",
            "taskType": "read_aloud",
            "prompt": "Read the passage aloud. Aim for natural pace, clear pronunciation, and matching intonation to punctuation. Don't restart if you mispronounce.",
            "text": p,
            "transcript": p,
            "audio_text": p,
            "content": p,
            "source": "stormedugo.com",
            "word_count": len(p.split()),
            "grading_notes": "Scored on content, oral fluency and pronunciation. Keep a steady pace and respect punctuation pauses.",
            "topic": clean(title).lower(),
        })
    return out


# ------------------------------------------------------------- edknot read_fib
def extract_edknot_fib():
    raw = (PAGES / "edknot_fib.html").read_text(encoding="utf-8")
    ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', raw, re.S)
    import json as _json
    data = _json.loads(ld.group(1))
    passages: dict[str, str] = {}

    def walk(o):
        if isinstance(o, dict):
            if o.get("@type") == "Question" and o.get("text"):
                passages[o["name"]] = o["text"]
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(data)
    titles = [t for t in re.findall(r"<h[23][^>]*>([^<]{5,80})</h[23]>", raw)
              if t in passages]
    opt_pat = re.compile(r'<li><strong[^>]*>(\d+)</strong>\s*·(?:<!-- -->)*\s*(?:<!-- -->)*([^<]+)')
    ans_pat = re.compile(r'<span class="text-\[0\.72rem\][^>]*>(\d+)</span>([A-Za-z\-]+)')
    out = []
    for k, title in enumerate(titles):
        seg_start = raw.find(f">{title}<")
        seg_end = raw.find(f">{titles[k + 1]}<") if k + 1 < len(titles) else len(raw)
        seg = raw[seg_start:seg_end]
        options: dict[int, list[str]] = {}
        for m in opt_pat.finditer(seg):
            options[int(m.group(1))] = [clean(w) for w in m.group(2).split("/")]
        answers: dict[int, str] = {}
        for m in ans_pat.finditer(seg):
            answers[int(m.group(1))] = clean(m.group(2))
        passage = passages[title]
        blanks_list = []
        for n in sorted(answers):
            if n not in options:
                break
            blanks_list.append({"options": options[n], "answer": answers[n]})
        if len(blanks_list) < 3:
            continue
        text = re.sub(r"\[\[(\d+)\]\]", lambda m: f" _______({m.group(1)}) ", passage)
        text = re.sub(r"[ \t]+", " ", text).strip()
        out.append({
            "id": f"edknot-rfib-{k+1:02d}",
            "taskType": "read_fib",
            "prompt": "Escolha a palavra correta para cada lacuna.",
            "text": text,
            "transcript": "",
            "audio_text": "",
            "content": text,
            "blanks": blanks_list,
            "source": "edknot.com",
            "word_count": len(text.split()),
            "topic": topic_of(title),
        })
    return out


# ---------------------------------------------------------- edknot reorder
def norm_sentence(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def extract_edknot_reorder():
    raw = (PAGES / "edknot_reorder.html").read_text(encoding="utf-8")
    li_pat = re.compile(r'<span[^>]*>(\d+)</span><span>([^<]+)</span>')
    marks = [m.start() for m in re.finditer(r">Correct order<", raw)]
    out = []
    for k, co in enumerate(marks):
        prev_ol = raw.rfind("<ol", 0, co)
        next_ol = raw.find("<ol", co)
        next_end = raw.find("</ol>", next_ol) if next_ol >= 0 else co
        if prev_ol < 0 or next_ol < 0:
            continue
        items = [clean(x[1]) for x in li_pat.findall(raw[prev_ol:co])][:4]
        ordered = [clean(x[1]) for x in li_pat.findall(raw[next_ol:next_end])][:4]
        if len(items) < 4 or len(ordered) < 4:
            continue
        idx_of = {norm_sentence(s): i for i, s in enumerate(items)}
        order = []
        for s in ordered:
            i = idx_of.get(norm_sentence(s))
            if i is None:
                break
            order.append(i)
        if len(order) != 4 or set(order) != set(range(4)):
            continue
        text = "\n".join(items)
        out.append({
            "id": f"edknot-ro-{k+1:02d}",
            "taskType": "reorder_paragraphs",
            "prompt": "Reordene os trechos para formar um parágrafo coerente.",
            "text": text,
            "transcript": "",
            "audio_text": "",
            "content": text,
            "items": items,
            "correct_order": order,
            "source": "edknot.com",
            "word_count": len(text.split()),
            "topic": topic_of(items[order[0]]),
        })
    return out


# -------------------------------------------------- pteacademy asq PDF (100)
def extract_pteacademy_asq():
    txt = subprocess.run(["pdftotext", str(PAGES / "asq100.pdf"), "-"],
                         capture_output=True, text=True).stdout
    pat = re.compile(r"(\d+)\.\s+(.+?)\s+-\s+(.+?)(?=\s*\n\s*\d+\.\s|\Z)", re.S)
    out = []
    seen = set()
    for n, q, a in pat.findall(txt):
        q, a = clean(q), clean(a)
        if not q or not a or len(q) < 10:
            continue
        if q.lower() in seen:
            continue
        seen.add(q.lower())
        out.append({
            "id": f"ptea-asq-{int(n):03d}",
            "taskType": "answer_short",
            "prompt": "One word or short phrase. Don't elaborate.",
            "text": q,
            "transcript": "",
            "audio_text": "",
            "content": q,
            "answer": a,
            "source": "pteacademy.in",
            "word_count": len(q.split()),
            "grading_notes": "Scored on whether your answer matches an acceptable response. Quick response time matters — hesitation hurts almost as much as a wrong answer.",
            "topic": topic_of(q),
        })
    return out


def pdf_options(seg: str, letters: str):
    """Extrai opções (a)-(...) por posição, tolerando footers variáveis."""
    zone_start = seg.find(f"\n({letters[0]})")
    if zone_start < 0:
        return []
    stops = [seg.find("\nPreparing for"), seg.find("\nAre you struggling")]
    zone_end = min([p for p in stops if p > zone_start] + [len(seg)])
    zone = seg[zone_start:zone_end]
    pos = {m.group(1): m.start() for m in re.finditer(rf"\n\(([{''.join(letters)}])\)", zone)}
    ordered = sorted(pos.items(), key=lambda kv: kv[1])
    out = []
    for j, (letter, start) in enumerate(ordered):
        end = ordered[j + 1][1] if j + 1 < len(ordered) else len(zone)
        out.append(clean(zone[start + len(f"\n({letter})"):end]))
    return out


# --------------------------------------- pteacademy mcq single/multi PDFs (10+10)
def extract_pteacademy_mcqs():
    out_single, out_multi = [], []

    def split_items(txt: str, header_pat: str):
        parts = re.split(header_pat, txt)
        return parts

    # --- single
    txt = subprocess.run(["pdftotext", str(PAGES / "rmcq_single_pdf.pdf"), "-"],
                         capture_output=True, text=True).stdout
    segs = re.split(r"READING: Multiple-choice,\s*choose single answer\s*Read the text and answer the multiple-choice question by selecting the correct response\.\s*Only one response is correct\.", txt)
    ans_zone = txt[txt.find("ANSWERS"):]
    head, _, tail = ans_zone.partition("6.")
    keys = re.findall(r"^([A-D])\b", head, re.M)
    keys += re.findall(r"^\s*(?:\d+\.\s*)?([A-D])\b", tail, re.M)
    for i, seg in enumerate(segs[1:]):
        m = re.search(r"\n\(([a-d])\)", seg)
        if not m or i >= len(keys):
            continue
        ans_idx = ord(keys[i].lower()) - ord("a")
        options = pdf_options(seg, "abcd")
        if len(options) < 3:
            continue
        body = seg[: re.search(r"\n\(a\)", seg).start()]
        lines = [clean(x) for x in body.split("\n") if clean(x)]
        q_idx = next((j for j in range(len(lines) - 1, -1, -1) if lines[j].endswith("?")), None)
        if q_idx is None or q_idx == 0:
            continue
        passage = "\n".join(lines[:q_idx])
        question = lines[q_idx]
        out_single.append({
            "id": f"ptea-mcq_si-{i+1:02d}",
            "taskType": "mcq_single",
            "prompt": "Read the text and answer the multiple-choice question by selecting one correct response.",
            "text": passage + "\n\n" + question,
            "transcript": "",
            "audio_text": "",
            "content": passage + "\n\n" + question,
            "options": options,
            "answer": [ans_idx],
            "source": "pteacademy.in",
            "explanation": "",
            "trap": "",
            "topic": topic_of(passage),
        })

    # --- multi
    txt = subprocess.run(["pdftotext", str(PAGES / "rmcq_multi_pdf.pdf"), "-"],
                         capture_output=True, text=True).stdout
    segs = re.split(r"READING: Multiple-choice,\s*choose multiple answer\s*Read the text and answer the question by selecting all correct\s*responses\. More than one is correct\.", txt)
    ans_zone = txt[txt.find("ANSWERS"):]
    keys = re.findall(r"^\s*\d+\.\s*([A-E])\s*,\s*([A-E])", ans_zone, re.M)
    if len(keys) < 10:
        keys = re.findall(r"([A-E])\s*,\s*([A-E])", ans_zone)
    for i, seg in enumerate(segs[1:]):
        if i >= len(keys):
            break
        options = pdf_options(seg, "abcde")
        if len(options) < 4:
            continue
        ans_idx = [ord(keys[i][0].lower()) - ord("a"), ord(keys[i][1].lower()) - ord("a")]
        body = seg[: re.search(r"\n\(a\)", seg).start()]
        lines = [clean(x) for x in body.split("\n") if clean(x)]
        q_idx = next((j for j in range(len(lines) - 1, -1, -1) if lines[j].endswith("?")), None)
        if q_idx is None or q_idx == 0:
            continue
        passage = "\n".join(lines[:q_idx])
        question = lines[q_idx]
        out_multi.append({
            "id": f"ptea-mcq_mu-{i+1:02d}",
            "taskType": "mcq_multi",
            "prompt": "Read the text and answer the question by selecting all correct responses. More than one is correct.",
            "text": passage + "\n\n" + question,
            "transcript": "",
            "audio_text": "",
            "content": passage + "\n\n" + question,
            "options": options,
            "answer": ans_idx,
            "source": "pteacademy.in",
            "explanation": "",
            "trap": "",
            "topic": topic_of(passage),
        })
    return out_single, out_multi


# -------------------------------------------- write_essay (somente com sample real)
def extract_essays():
    out = []

    # 79score: 2 samples completos
    t = full_text("essays79.html")
    m1 = re.search(r"Sample Essay 1: Is technology making people less social\? \(228 words\)\n+(.+?)\n+Why it scores", t, re.S)
    if m1:
        sample = clean(m1.group(1).split("Answer:")[-1])
        out.append({
            "id": "79score-essay-01",
            "taskType": "write_essay",
            "prompt": "Is technology making people less social? Write an essay of 200-300 words giving your opinion with reasons and examples.",
            "text": "Is technology making people less social? Write an essay of 200-300 words giving your opinion with reasons and examples.",
            "transcript": "",
            "audio_text": "",
            "content": "Is technology making people less social? Write an essay of 200-300 words giving your opinion with reasons and examples.",
            "sample": sample,
            "essay_type": "Agree/Disagree",
            "vocabulary": [],
            "source": "79score.com",
            "word_count": len(sample.split()),
            "grading_notes": "Scored on content, development/structure, form (200-300 words), linguistic range, grammar, vocabulary and spelling.",
            "topic": "technology & society",
        })
    m2 = re.search(r"Sample Question 2: Should students be required to wear uniforms\?\n+Answer:\n+(.+?)\n+Why it scores", t, re.S)
    if m2:
        sample = clean(m2.group(1))
        out.append({
            "id": "79score-essay-02",
            "taskType": "write_essay",
            "prompt": "Should students be required to wear uniforms? Write an essay of 200-300 words giving your opinion with reasons and examples.",
            "text": "Should students be required to wear uniforms? Write an essay of 200-300 words giving your opinion with reasons and examples.",
            "transcript": "",
            "audio_text": "",
            "content": "Should students be required to wear uniforms? Write an essay of 200-300 words giving your opinion with reasons and examples.",
            "sample": sample,
            "essay_type": "Agree/Disagree",
            "vocabulary": [],
            "source": "79score.com",
            "word_count": len(sample.split()),
            "grading_notes": "Scored on content, development/structure, form (200-300 words), linguistic range, grammar, vocabulary and spelling.",
            "topic": "education",
        })

    # languageacademy: 3 samples completos
    t = full_text("essays_la.html")
    la = [
        ("la-essay-01",
         "Online learning vs traditional classroom – which is more effective? Discuss both views and give your own opinion.",
         "Discuss",
         "education"),
        ("la-essay-02",
         "Will AI do more good or harm to society? Discuss both views and give your own opinion.",
         "Discuss",
         "technology"),
        ("la-essay-03",
         "Should governments provide free healthcare? Write an essay of 200-300 words giving your opinion with reasons and examples.",
         "Agree/Disagree",
         "government & health"),
    ]
    for eid, prompt, etype, topic in la:
        key = prompt.split(" –")[0].split("?")[0][:30]
        sample = ""
        for pm in re.finditer(re.escape(key), t, re.I):
            p = pm.start()
            head = t[p:p + 250]
            if "Below is a complete sample essay" not in head and "\nTopic:" not in head:
                continue  # entrada do índice (TOC), não o bloco do ensaio
            bm = re.search(r"Topic: (.+?)\n(.+?)\n+Word count:", t[p:p + 9000], re.S)
            if bm:
                sample = clean(bm.group(2))
                break
        if not sample or len(sample.split()) < 150:
            continue
        out.append({
            "id": eid,
            "taskType": "write_essay",
            "prompt": prompt,
            "text": prompt,
            "transcript": "",
            "audio_text": "",
            "content": prompt,
            "sample": sample,
            "essay_type": etype,
            "vocabulary": [],
            "source": "languageacademy.com.au",
            "word_count": len(sample.split()),
            "grading_notes": "Scored on content, development/structure, form (200-300 words), linguistic range, grammar, vocabulary and spelling.",
            "topic": topic,
        })
    return out


def main():
    res = {
        "answer_short": extract_goarno_asq() + extract_pteacademy_asq(),
        "mcq_single": extract_goarno_rmcq_single() + extract_pteacademy_mcqs()[0],
        "mcq_multi": extract_pteacademy_mcqs()[1],
        "swt": extract_goarno_swt(),
        "retell_lecture": extract_goarno_retell(),
        "read_aloud": extract_stormedugo_ra(),
        "read_fib": extract_edknot_fib(),
        "reorder_paragraphs": extract_edknot_reorder(),
        "write_essay": extract_essays(),
    }
    for k, v in res.items():
        (OUT / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False, indent=1))
        print(k, len(v))
    # spot checks
    sys.stderr.write("ok\n")


if __name__ == "__main__":
    main()
