import os
import re
import io
from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Emu
import fitz
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display
from pdf2docx import Converter
from docx2pdf import convert as docx_to_pdf_convert

RTL_LANGUAGES = {"arabic", "hebrew", "persian", "farsi", "urdu"}
ARABIC_FONT_PATH = r"C:\Windows\Fonts\arial.ttf"
pdfmetrics.registerFont(TTFont("ArialUnicode", ARABIC_FONT_PATH))


def contains_arabic(text: str) -> bool:
    return bool(re.search(r'[\u0600-\u06FF]', text))


# ---------- Extraction ----------

def extract_docx_paragraphs(file_path: str) -> list[str]:
    doc = Document(file_path)
    return [p.text for p in doc.paragraphs if p.text.strip() != ""]


def extract_pdf_paragraphs(file_path: str) -> list[str]:
    doc = fitz.open(file_path)
    paragraphs = []
    for page in doc:
        text = page.get_text()
        blocks = [b.strip() for b in text.split("\n\n") if b.strip() != ""]
        paragraphs.extend(blocks)
    doc.close()
    return paragraphs


def extract_document_text(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".docx":
        paragraphs = extract_docx_paragraphs(file_path)
    elif ext == ".pdf":
        paragraphs = extract_pdf_paragraphs(file_path)
    else:
        raise ValueError("Unsupported file type. Only .docx and .pdf are supported.")
    return "\n\n".join(paragraphs)


# ---------- RTL helpers ----------

def set_run_rtl(run):
    rPr = run._r.get_or_add_rPr()
    rPr.append(OxmlElement('w:rtl'))


def set_paragraph_rtl(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    pPr.insert(0, OxmlElement('w:bidi'))
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in paragraph.runs:
        set_run_rtl(run)


def set_document_rtl(doc):
    for section in doc.sections:
        section._sectPr.append(OxmlElement('w:bidi'))


# ---------- Format/image copying ----------

def copy_paragraph_format(src_para, dest_para):
    dest_para.style = src_para.style
    dest_para.alignment = src_para.alignment
    dest_para.paragraph_format.left_indent = src_para.paragraph_format.left_indent
    dest_para.paragraph_format.right_indent = src_para.paragraph_format.right_indent
    dest_para.paragraph_format.first_line_indent = src_para.paragraph_format.first_line_indent
    dest_para.paragraph_format.space_before = src_para.paragraph_format.space_before
    dest_para.paragraph_format.space_after = src_para.paragraph_format.space_after
    dest_para.paragraph_format.line_spacing = src_para.paragraph_format.line_spacing


def copy_run_format(src_run, dest_run):
    try:
        dest_run.bold = src_run.bold
        dest_run.italic = src_run.italic
        dest_run.underline = src_run.underline
        if src_run.font.name:
            dest_run.font.name = src_run.font.name
        if src_run.font.size:
            dest_run.font.size = src_run.font.size
        if src_run.font.color and src_run.font.color.rgb:
            dest_run.font.color.rgb = src_run.font.color.rgb
    except Exception:
        pass


def copy_run_images(run, new_para, placed_ids: set) -> bool:
    drawing_elems = run._r.findall(qn('w:drawing'))
    copied = False

    for drawing in drawing_elems:
        blip = drawing.find('.//' + qn('a:blip'))
        if blip is None:
            continue
        rId = blip.get(qn('r:embed'))
        if not rId:
            continue

        try:
            image_part = run.part.related_parts[rId]
            image_bytes = image_part.blob
        except KeyError:
            continue

        extent = drawing.find('.//' + qn('wp:extent'))
        width = Emu(int(extent.get('cx'))) if extent is not None else None

        new_run = new_para.add_run()
        if width:
            new_run.add_picture(io.BytesIO(image_bytes), width=width)
        else:
            new_run.add_picture(io.BytesIO(image_bytes))
        copied = True
        placed_ids.add(rId)

    return copied

# ---------- DOCX rebuild preserving structure ----------

from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph as DocxParagraph
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P


def iter_block_items(parent):
    """Yields paragraphs and tables in the TRUE order they appear in the document,
    diving into table cells recursively."""
    if isinstance(parent, _Cell):
        parent_elm = parent._tc
    elif hasattr(parent, "element"):
        parent_elm = parent.element.body
    else:
        parent_elm = parent

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield DocxParagraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def rebuild_docx_preserving_structure(source_path: str, translated_text: str, output_path: str, target_lang: str = "", instruction: str = ""):
    source_doc = Document(source_path)
    dest_doc = Document()

    is_rtl = target_lang.strip().lower() in RTL_LANGUAGES or contains_arabic(translated_text)
    if is_rtl:
        set_document_rtl(dest_doc)

    translated_blocks = [p.strip() for p in translated_text.split("\n\n") if p.strip()]
    block_index = [0]  # list so the nested function can mutate it
    placed_ids: set = set()

    def process_paragraph(para, target_doc_or_cell):
        nonlocal block_index
        para_text = para.text.strip()
        has_images = any(run._r.findall(qn('w:drawing')) for run in para.runs)

        if not para_text and not has_images:
            target_doc_or_cell.add_paragraph()
            return

        new_para = target_doc_or_cell.add_paragraph()
        copy_paragraph_format(para, new_para)
        if is_rtl:
            set_paragraph_rtl(new_para)

        if para_text:
            translated_para = translated_blocks[block_index[0]] if block_index[0] < len(translated_blocks) else para_text
            block_index[0] += 1
        else:
            translated_para = ""

        text_runs = [r for r in para.runs if r.text.strip() and not r._r.findall(qn('w:drawing'))]

        for run in para.runs:
            copy_run_images(run, new_para, placed_ids)

        if text_runs and translated_para:
            words = translated_para.split()
            total_len = sum(len(r.text) for r in text_runs) or 1
            start = 0
            for i, run in enumerate(text_runs):
                is_last = i == len(text_runs) - 1
                share = len(run.text) / total_len
                count = len(words) - start if is_last else round(len(words) * share)
                count = max(count, 0)
                chunk = " ".join(words[start:start + count])
                start += count
                if chunk:
                    new_run = new_para.add_run(chunk + (" " if not is_last else ""))
                    copy_run_format(run, new_run)
                    if is_rtl:
                        set_run_rtl(new_run)
        elif translated_para and not text_runs:
            new_run = new_para.add_run(translated_para)
            if is_rtl:
                set_run_rtl(new_run)

    def process_table(table, target_doc):
        new_table = target_doc.add_table(rows=len(table.rows), cols=len(table.columns))
        for r, src_row in enumerate(table.rows):
            for c, src_cell in enumerate(src_row.cells):
                dest_cell = new_table.rows[r].cells[c]
                # Clear the default empty paragraph python-docx creates in new cells
                dest_cell.paragraphs[0].text = ""
                for block in iter_block_items(src_cell):
                    if isinstance(block, DocxParagraph):
                        process_paragraph(block, dest_cell)
                    elif isinstance(block, Table):
                        process_table(block, dest_cell)  # nested tables, recursively

    # Walk the document in TRUE top-to-bottom order
    for block in iter_block_items(source_doc):
        if isinstance(block, DocxParagraph):
            process_paragraph(block, dest_doc)
        elif isinstance(block, Table):
            process_table(block, dest_doc)

    # Safety net: catch anything genuinely missed (shouldn't happen now, but cheap insurance)
    append_unplaced_images(source_doc, dest_doc, placed_ids)

    dest_doc.save(output_path)

def generate_docx(paragraphs: list[str], output_path: str, target_lang: str = "", source_path: str = "", instruction: str = ""):
    if source_path and os.path.exists(source_path):
        rebuild_docx_preserving_structure(source_path, "\n\n".join(paragraphs), output_path, target_lang=target_lang, instruction=instruction)
        return

    doc = Document()
    combined_text = " ".join(paragraphs)
    is_rtl = target_lang.strip().lower() in RTL_LANGUAGES or contains_arabic(combined_text)
    if is_rtl:
        set_document_rtl(doc)
    for para_text in paragraphs:
        p = doc.add_paragraph(para_text)
        if is_rtl:
            set_paragraph_rtl(p)
    doc.save(output_path)


def prepare_text_for_pdf(text: str, is_rtl: bool) -> str:
    if not is_rtl:
        return text
    return get_display(arabic_reshaper.reshape(text))


def generate_pdf(paragraphs: list[str], output_path: str, target_lang: str = ""):
    combined_text = " ".join(paragraphs)
    is_rtl = target_lang.strip().lower() in RTL_LANGUAGES or contains_arabic(combined_text)
    font_name = "ArialUnicode" if is_rtl else "Helvetica"

    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4
    margin = 2 * cm
    max_width = width - 2 * margin
    y = height - margin
    font_size = 11
    line_height = 14
    c.setFont(font_name, font_size)

    for para in paragraphs:
        display_text = prepare_text_for_pdf(para, is_rtl)
        lines = simpleSplit(display_text, font_name, font_size, max_width)
        for line in lines:
            if y < margin:
                c.showPage()
                c.setFont(font_name, font_size)
                y = height - margin
            if is_rtl:
                c.drawRightString(width - margin, y, line)
            else:
                c.drawString(margin, y, line)
            y -= line_height
        y -= line_height
    c.save()


# ---------- PDF <-> DOCX round trip ----------

def convert_pdf_to_docx(pdf_path: str, docx_path: str):
    cv = Converter(pdf_path)
    cv.convert(docx_path)
    cv.close()

import subprocess
LIBREOFFICE_PATH = r"C:\Program Files\LibreOffice\program\soffice.exe"
def convert_docx_to_pdf(docx_path: str, pdf_path: str):
    output_dir = os.path.dirname(pdf_path) or "."
    subprocess.run(
        [LIBREOFFICE_PATH, "--headless", "--convert-to", "pdf", "--outdir", output_dir, docx_path],
        check=True,
        timeout=60,
    )

    generated_name = os.path.splitext(os.path.basename(docx_path))[0] + ".pdf"
    generated_path = os.path.join(output_dir, generated_name)
    if generated_path != pdf_path and os.path.exists(generated_path):
        os.replace(generated_path, pdf_path)


def translate_pdf_via_docx(pdf_path: str, translated_text: str, output_pdf_path: str, target_lang: str = "", instruction: str = "", pre_converted_docx_path: str = ""):
    temp_docx_source = pre_converted_docx_path or pdf_path.replace(".pdf", "_converted.docx")
    temp_docx_translated = pdf_path.replace(".pdf", "_translated.docx")

    if not pre_converted_docx_path:
        convert_pdf_to_docx(pdf_path, temp_docx_source)

    rebuild_docx_preserving_structure(
        source_path=temp_docx_source,
        translated_text=translated_text,
        output_path=temp_docx_translated,
        target_lang=target_lang,
        instruction=instruction,
    )
    convert_docx_to_pdf(temp_docx_translated, output_pdf_path)
    return output_pdf_path


def find_all_runs_recursive(container):
    """Yields every run in the document, including runs inside table cells
    (and nested tables inside cells), not just top-level paragraphs."""
    for para in container.paragraphs:
        for run in para.runs:
            yield run
    if hasattr(container, "tables"):
        for table in container.tables:
            for row in table.rows:
                for cell in row.cells:
                    yield from find_all_runs_recursive(cell)


def append_unplaced_images(source_doc, dest_doc, already_placed_ids: set):
    """Finds any images anywhere in source_doc (including inside tables) that
    weren't already copied by the main loop, and appends them at the end."""
    for run in find_all_runs_recursive(source_doc):
        drawing_elems = run._r.findall(qn('w:drawing'))
        for drawing in drawing_elems:
            blip = drawing.find('.//' + qn('a:blip'))
            if blip is None:
                continue
            rId = blip.get(qn('r:embed'))
            if not rId or rId in already_placed_ids:
                continue

            try:
                image_part = run.part.related_parts[rId]
                image_bytes = image_part.blob
            except KeyError:
                continue

            extent = drawing.find('.//' + qn('wp:extent'))
            width = Emu(int(extent.get('cx'))) if extent is not None else None

            new_para = dest_doc.add_paragraph()
            new_run = new_para.add_run()
            if width:
                new_run.add_picture(io.BytesIO(image_bytes), width=width)
            else:
                new_run.add_picture(io.BytesIO(image_bytes))

            already_placed_ids.add(rId)


def extract_ordered_paragraphs(container) -> list[str]:
    """Walks paragraphs in TRUE document order (including inside tables/nested tables),
    collecting non-empty paragraph text. Must exactly mirror how rebuild consumes blocks."""
    texts = []
    for block in iter_block_items(container):
        if isinstance(block, DocxParagraph):
            t = block.text.strip()
            if t:
                texts.append(t)
        elif isinstance(block, Table):
            for row in block.rows:
                for cell in row.cells:
                    texts.extend(extract_ordered_paragraphs(cell))
    return texts


def extract_document_text_and_rebuild_source(file_path: str) -> tuple[str, str]:
    """Returns (text_to_translate, docx_path_to_use_for_rebuild).
    For .docx: extracts directly. For .pdf: converts to DOCX first via pdf2docx,
    then extracts from THAT converted file — guaranteeing extraction and rebuild
    always see identical paragraph structure."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".docx":
        doc = Document(file_path)
        paragraphs = extract_ordered_paragraphs(doc)
        return "\n\n".join(paragraphs), file_path

    elif ext == ".pdf":
        converted_path = file_path.replace(".pdf", "_converted.docx")
        convert_pdf_to_docx(file_path, converted_path)
        doc = Document(converted_path)
        paragraphs = extract_ordered_paragraphs(doc)
        return "\n\n".join(paragraphs), converted_path

    else:
        raise ValueError("Unsupported file type. Only .docx and .pdf are supported.")