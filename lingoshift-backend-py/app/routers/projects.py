from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from app.core.deps import get_current_user
from app.db import db

router = APIRouter(prefix="/api/projects", tags=["projects"])

class ProjectCreateRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v) > 60:
            raise ValueError("Project name must be 60 characters or fewer")
        return v

@router.get("/")
async def list_projects(current_user=Depends(get_current_user)):
    projects = await db.project.find_many(
        where={"userId": current_user.id},
        include={"documents": True},
        order={"updatedAt": "desc"},
    )
    return [
        {
            "id": p.id,
            "name": p.name,
            "documentCount": len(p.documents),
            "updatedAt": p.updatedAt,
        }
        for p in projects
    ]

@router.post("/")
async def create_project(data: ProjectCreateRequest, current_user=Depends(get_current_user)):
    existing = await db.project.find_first(where={"userId": current_user.id, "name": data.name})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a project with this name")

    project = await db.project.create(data={"name": data.name, "userId": current_user.id})
    return project

@router.get("/{project_id}")
async def get_project(project_id: str, current_user=Depends(get_current_user)):
    project = await db.project.find_unique(
        where={"id": project_id},
        include={"documents": True},
    )
    if not project or project.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str, current_user=Depends(get_current_user)):
    project = await db.project.find_unique(where={"id": project_id})
    if not project or project.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.project.delete(where={"id": project_id})
    return {"message": "Project deleted"}


class AddDocumentToProjectRequest(BaseModel):
    document_id: str

@router.post("/{project_id}/documents")
async def add_document_to_project(
    project_id: str,
    data: AddDocumentToProjectRequest,
    current_user=Depends(get_current_user),
):
    project = await db.project.find_unique(where={"id": project_id})
    if not project or project.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    document = await db.document.find_unique(where={"id": data.document_id})
    if not document or document.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    updated = await db.document.update(
        where={"id": data.document_id},
        data={"projectId": project_id},
    )
    return updated


class RenameProjectRequest(BaseModel):
    name: str

@router.patch("/{project_id}")
async def rename_project(
    project_id: str,
    data: RenameProjectRequest,
    current_user=Depends(get_current_user),
):
    project = await db.project.find_unique(where={"id": project_id})
    if not project or project.userId != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    updated = await db.project.update(
        where={"id": project_id},
        data={"name": data.name},
    )
    return updated


@router.delete("/{project_id}/documents/{document_id}")
async def remove_document_from_project(
    project_id: str,
    document_id: str,
    current_user=Depends(get_current_user),
):
    document = await db.document.find_unique(where={"id": document_id})
    if not document or document.userId != current_user.id or document.projectId != project_id:
        raise HTTPException(status_code=404, detail="Document not found in this project")

    await db.document.update(
        where={"id": document_id},
        data={"projectId": None},
    )
    return {"message": "Removed from project"}