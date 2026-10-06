from fastapi import APIRouter, HTTPException, Depends
from app.core.deps import get_current_user
from app.db import db

router = APIRouter(prefix="/api/documents", tags=["documents"])

@router.get("/")
async def list_documents(current_user=Depends(get_current_user)):
    documents = await db.document.find_many(
        where={"userId": current_user.id},
        order={"createdAt": "desc"},
    )
    return documents

@router.get("/{document_id}")
async def get_document(document_id: str, current_user=Depends(get_current_user)):
    doc = await db.document.find_unique(where={"id": document_id})
    if not doc or doc.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user=Depends(get_current_user)):
    doc = await db.document.find_unique(where={"id": document_id})
    if not doc or doc.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.document.delete(where={"id": document_id})
    return {"message": "Document deleted"}