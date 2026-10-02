# -*- coding: utf-8 -*-
"""用户私有菜品库路由：自建配方，营养追溯至基础食材"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.nutrition import FoodPublic, FoodCompound
from app.models.user import User
from app.routers.diet import _compute_food_items

router = APIRouter(prefix="/api/v1/recipes", tags=["私有菜品库"])


class RecipeItem(BaseModel):
    food_id: str
    food_name: str = ""
    weight_g: float = 100.0


class RecipeCreate(BaseModel):
    name: str
    category: str = "家常菜"
    ingredients: list[RecipeItem] = Field(default_factory=list, description="食材配料")


@router.post("")
def create_recipe(payload: RecipeCreate,
                  current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """创建自定义菜品（营养由基础食材追溯计算）"""
    items = [i.model_dump() for i in payload.ingredients]
    enriched, total = _compute_food_items(db, items)

    compound = FoodCompound(
        dish_id=str(uuid.uuid4()),
        name=payload.name,
        category=payload.category,
        recipe_json={"ingredients": enriched, "source": "user"},
        is_public=False,
        owner_id=current_user.user_id,
        calories=total["calories"],
        protein=total["protein"],
        fat=total["fat"],
        carbs=total["carbs"],
    )
    db.add(compound)
    db.commit()
    db.refresh(compound)
    return {"code": 0, "data": _recipe_dict(compound)}


def _recipe_dict(r: FoodCompound) -> dict:
    return {
        "dish_id": r.dish_id, "name": r.name, "category": r.category,
        "recipe_json": r.recipe_json,
        "calories": float(r.calories or 0), "protein": float(r.protein or 0),
        "fat": float(r.fat or 0), "carbs": float(r.carbs or 0),
        "is_public": r.is_public,
    }


@router.get("/mine")
def my_recipes(current_user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    """查询我的私有菜品"""
    rows = db.query(FoodCompound).filter(
        FoodCompound.owner_id == current_user.user_id,
        FoodCompound.is_public == False,  # noqa: E712
    ).all()
    return {"code": 0, "data": [_recipe_dict(r) for r in rows]}


@router.delete("/{dish_id}")
def delete_recipe(dish_id: str, current_user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """删除私有菜品"""
    row = db.get(FoodCompound, dish_id)
    if not row or row.owner_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="菜品不存在")
    db.delete(row)
    db.commit()
    return {"code": 0, "message": "已删除"}
