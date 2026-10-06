import os
import uuid
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.ai.translation import (
    start_session,
    send_instruction,
    approve_file,
    register_session_file,
    get_last_message_text,

)
from app.ai.documents import extract_document_text
from app.db import db
from app.ai.documents import extract_document_text_and_rebuild_source


router = APIRouter(prefix="/api/translate", tags=["translation"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class TranslateResponse(BaseModel):
    thread_id: str
    translated_text: str
    has_file: bool = False
    


class InstructionRequest(BaseModel):
    thread_id: str
    instruction: str


class ApproveRequest(BaseModel):
    thread_id: str
    target_lang: str


class ApproveResponse(BaseModel):
    output_path: str
    document_id: str


@router.post("/start", response_model=TranslateResponse)
async def translate_start(
    target_lang: str = Form(...),
    instruction: str = Form(""),
    text: str = Form(None),
    file: UploadFile = File(None),
    current_user=Depends(get_current_user),
):
    thread_id = str(uuid.uuid4())
    has_file = False
    file_type = None
    file_name = None

    if file is not None:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        content, rebuild_source_path = extract_document_text_and_rebuild_source(file_path)
        file_type = os.path.splitext(file.filename)[1].lower().replace(".", "")
        file_name = os.path.splitext(file.filename)[0]

        register_session_file(thread_id, file_path, file_type, file_name, rebuild_source_path)
        has_file = True

    elif text is not None and text.strip():
        content = text.strip()

    else:
        return TranslateResponse(thread_id=thread_id, translated_text="Error: no text or file provided", has_file=has_file)

    result, _ = start_session(
        thread_id=thread_id,
        content=content,
        target_lang=target_lang,
        instruction=instruction,
        file_type=file_type,
        file_name=file_name,
    )

    translated_text = get_last_message_text(result)

    return TranslateResponse(thread_id=thread_id, translated_text=translated_text, has_file=has_file)


@router.post("/instruction", response_model=TranslateResponse)
async def translate_instruction(data: InstructionRequest, current_user=Depends(get_current_user)):
    result = send_instruction(data.thread_id, data.instruction)

    
    translated_text = get_last_message_text(result)
    from app.ai.translation import SESSION_FILES
    has_file = data.thread_id in SESSION_FILES
    return TranslateResponse(
        thread_id=data.thread_id,
        translated_text=translated_text,
        has_file=has_file,
        
    )


@router.post("/approve", response_model=ApproveResponse)
async def translate_approve(data: ApproveRequest, current_user=Depends(get_current_user)):
    result = approve_file(data.thread_id)
    output_path = get_last_message_text(result)

    from app.ai.translation import SESSION_FILES
    session = SESSION_FILES.get(data.thread_id, {})

    document = await db.document.create(data={
        "fileName": os.path.basename(session.get("input_file_path", "translation")),
        "fileType": session.get("file_type", "docx"),
        "sourceLanguage": "auto",
        "targetLanguage": data.target_lang,
        "originalPath": session.get("input_file_path", ""),
        "translatedPath": output_path,
        "userId": current_user.id,
    })

    return ApproveResponse(output_path=output_path, document_id=document.id)