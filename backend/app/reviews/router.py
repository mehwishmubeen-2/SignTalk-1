"""
app/reviews/router.py
Real user-submitted reviews shown on the Home page testimonials section.
Users may submit any number of reviews.

Endpoints:
    GET    /reviews/public         — public, no auth: latest reviews for the Home page
    GET    /reviews/mine           — auth required: all of the current user's reviews
    POST   /reviews                — auth required: create a new review
    PUT    /reviews/{review_id}    — auth required: update one of the user's own reviews
    DELETE /reviews/{review_id}    — auth required: delete one of the user's own reviews
"""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.supabase import supabase, supabase_admin

router = APIRouter(prefix="/reviews", tags=["reviews"])


def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.replace("Bearer ", "")
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return user_response.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


def _display_name(user) -> str:
    profile = (
        supabase_admin.table("profiles").select("name").eq("id", user.id).limit(1).execute()
    )
    if profile.data and profile.data[0].get("name"):
        return profile.data[0]["name"]
    meta_name = (user.user_metadata or {}).get("full_name")
    if meta_name:
        return meta_name
    return (user.email or "SignTalk user").split("@")[0]


class ReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=500)
    role: Optional[str] = None


@router.get("/public")
def list_public_reviews(limit: int = Query(6, ge=1, le=20)):
    resp = (
        supabase_admin.table("reviews")
        .select("name, role, rating, text, created_at")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"reviews": resp.data or []}


@router.get("/mine")
def list_my_reviews(user=Depends(get_current_user)):
    resp = (
        supabase_admin.table("reviews")
        .select("id, rating, text, role, created_at")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"reviews": resp.data or []}


@router.post("")
def create_review(body: ReviewRequest, user=Depends(get_current_user)):
    resp = (
        supabase_admin.table("reviews")
        .insert({
            "user_id": user.id,
            "name": _display_name(user),
            "role": body.role,
            "rating": body.rating,
            "text": body.text.strip(),
        })
        .execute()
    )
    return {"ok": True, "review": resp.data[0] if resp.data else None}


@router.put("/{review_id}")
def update_review(review_id: int, body: ReviewRequest, user=Depends(get_current_user)):
    resp = (
        supabase_admin.table("reviews")
        .update({
            "rating": body.rating,
            "text": body.text.strip(),
            "role": body.role,
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
        .eq("id", review_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"ok": True}


@router.delete("/{review_id}")
def delete_review(review_id: int, user=Depends(get_current_user)):
    resp = (
        supabase_admin.table("reviews")
        .delete()
        .eq("id", review_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Review not found")
    return {"ok": True}
