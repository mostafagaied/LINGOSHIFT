from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles


load_dotenv()

from app.db import connect_db, disconnect_db
from app.routers import auth, projects, documents,translation

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(lifespan=lifespan)
app.mount("/files", StaticFiles(directory="uploads"), name="files")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # your React (Vite) frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(translation.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}