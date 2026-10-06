from fastapi import APIRouter, HTTPException, Response, Depends, status
from app.schemas import RegisterRequest, LoginRequest, UserResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.db import db

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, response: Response):
    existing = await db.user.find_unique(where={"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    user = await db.user.create(data={
        "fullName": data.fullName,
        "email": data.email,
        "passwordHash": hash_password(data.password),
    })

    token = create_access_token(user.id)
    response.set_cookie("token", token, httponly=True, samesite="lax", max_age=COOKIE_MAX_AGE)

    return UserResponse(id=user.id, fullName=user.fullName, email=user.email)


@router.post("/login", response_model=UserResponse)
async def login(data: LoginRequest, response: Response):
    user = await db.user.find_unique(where={"email": data.email})
    if not user or not verify_password(data.password, user.passwordHash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id)
    response.set_cookie("token", token, httponly=True, samesite="lax", max_age=COOKIE_MAX_AGE)

    return UserResponse(id=user.id, fullName=user.fullName, email=user.email)


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return UserResponse(id=current_user.id, fullName=current_user.fullName, email=current_user.email)