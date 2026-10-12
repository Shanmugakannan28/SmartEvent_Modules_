from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class CheckoutIn(BaseModel):
    user_id: int = Field(default=1, ge=1)
    event_id: int = Field(ge=1)
    quantity: int = Field(default=1, ge=1, le=20)
    payment_method: str = Field(default="UPI", pattern="^(UPI|CARD|CASH)$")
    coupon_code: str | None = None
    simulate_failure: bool = False

class CouponCheckIn(BaseModel):
    coupon_code: str = Field(min_length=2, max_length=50)
    amount: float = Field(gt=0)

class ReviewIn(BaseModel):
    user_id: int = Field(default=1, ge=1)
    event_id: int = Field(ge=1)
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(default="", max_length=2000)

class ReviewUpdate(BaseModel):
    rating: int | None = Field(default=None, ge=1, le=5)
    review_text: str | None = Field(default=None, max_length=2000)

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime
