from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.db.supabase import supabase, supabase_admin

router = APIRouter()
class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None


@router.post("/signup")
def signup(body: AuthRequest):
    try:
        response = supabase.auth.sign_up({
            "email": body.email,
            "password": body.password,
        })
        if response.user is None:
            raise HTTPException(status_code=400, detail="Signup failed. Check your email for confirmation.")
        return {
            "message": "Signup successful. Please confirm your email.",
            "user_id": response.user.id,
            "email": response.user.email,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
def login(body: AuthRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        if response.user is None:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return {
            "access_token": response.session.access_token,
            "refresh_token": response.session.refresh_token,
            "user_id": response.user.id,
            "email": response.user.email,
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
def logout(access_token: str):
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset-password")
def reset_password(email: str):
    try:
        supabase.auth.reset_password_email(email)
        return {"message": "Password reset email sent."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/delete-account")
def delete_account(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

        user_id = user_response.user.id

        # Delete profile data first (admin client bypasses RLS)
        supabase_admin.table("profiles").delete().eq("id", user_id).execute()

        # Delete the auth user (requires service role key)
        supabase_admin.auth.admin.delete_user(user_id)

        return {"message": "Account deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

