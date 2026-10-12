from datetime import datetime, timedelta
from uuid import uuid4
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .database import Base, SessionLocal, engine, get_db
from . import models
from .schemas import CheckoutIn, CouponCheckIn, ReviewIn, ReviewUpdate, NotificationOut

Base.metadata.create_all(bind=engine)
app = FastAPI(title="SmartEvent API — Modules 12–17", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

def notify(db: Session, user_id: int, title: str, message: str, kind: str):
    db.add(models.Notification(user_id=user_id, title=title, message=message, notification_type=kind))

def seed():
    db = SessionLocal()
    try:
        if not db.query(models.User).filter_by(id=1).first():
            db.add(models.User(id=1, name="Demo User", email="demo@example.com"))
        if db.query(models.Event).count() == 0:
            db.add_all([
                models.Event(name="Chennai Music Fest", category="Music", location="Chennai",
                    event_date=datetime.utcnow()+timedelta(days=14), price=799, popularity=98,
                    description="An evening of live music and local artists."),
                models.Event(name="Tech Innovators Meetup", category="Technology", location="Chennai",
                    event_date=datetime.utcnow()+timedelta(days=21), price=499, popularity=88,
                    description="Talks, networking, and product demos."),
                models.Event(name="Stand-up Comedy Night", category="Comedy", location="Coimbatore",
                    event_date=datetime.utcnow()+timedelta(days=30), price=399, popularity=82,
                    description="A fun night of stand-up comedy.")
            ])
        if not db.query(models.Coupon).filter_by(coupon_code="WELCOME10").first():
            db.add(models.Coupon(coupon_code="WELCOME10", discount_type="PERCENTAGE",
                discount_value=10, minimum_booking_amount=300,
                expiry_date=datetime.utcnow()+timedelta(days=365), usage_limit=500, is_active=True))
        db.commit()
    finally:
        db.close()
seed()

@app.get("/")
def root():
    return {"message": "SmartEvent API is running", "docs": "/docs"}

@app.get("/events")
def list_events(
    search: Optional[str] = None,
    category: Optional[str] = None,
    location: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_by: str = Query(default="date", pattern="^(date|popularity|price)$"),
    db: Session = Depends(get_db)
):
    q = db.query(models.Event).filter(models.Event.is_active.is_(True))
    if search:
        q = q.filter(or_(models.Event.name.ilike(f"%{search}%"), models.Event.description.ilike(f"%{search}%")))
    if category:
        q = q.filter(models.Event.category.ilike(f"%{category}%"))
    if location:
        q = q.filter(models.Event.location.ilike(f"%{location}%"))
    if start_date:
        q = q.filter(models.Event.event_date >= start_date)
    if end_date:
        q = q.filter(models.Event.event_date <= end_date)
    sort_col = {"date": models.Event.event_date, "popularity": models.Event.popularity, "price": models.Event.price}[sort_by]
    q = q.order_by(sort_col.desc() if sort_by == "popularity" else sort_col.asc())
    return [{"id": e.id, "name": e.name, "category": e.category, "location": e.location,
             "event_date": e.event_date, "price": e.price, "popularity": e.popularity,
             "description": e.description} for e in q.all()]

@app.post("/coupons/validate")
def validate_coupon(payload: CouponCheckIn, db: Session = Depends(get_db)):
    coupon = db.query(models.Coupon).filter(func.upper(models.Coupon.coupon_code) == payload.coupon_code.upper()).first()
    if not coupon or not coupon.is_active:
        raise HTTPException(400, "Coupon is invalid or inactive")
    if coupon.expiry_date < datetime.utcnow():
        raise HTTPException(400, "Coupon has expired")
    if coupon.usage_count >= coupon.usage_limit:
        raise HTTPException(400, "Coupon usage limit reached")
    if payload.amount < coupon.minimum_booking_amount:
        raise HTTPException(400, f"Minimum booking amount is ₹{coupon.minimum_booking_amount:.2f}")
    discount = payload.amount * coupon.discount_value / 100 if coupon.discount_type == "PERCENTAGE" else coupon.discount_value
    discount = min(discount, payload.amount)
    return {"coupon_code": coupon.coupon_code, "discount_type": coupon.discount_type,
            "discount_value": coupon.discount_value, "discount_amount": round(discount, 2),
            "final_amount": round(payload.amount-discount, 2)}

@app.post("/checkout")
def checkout(payload: CheckoutIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(id=payload.user_id).first()
    event = db.query(models.Event).filter_by(id=payload.event_id, is_active=True).first()
    if not user:
        raise HTTPException(404, "User not found")
    if not event:
        raise HTTPException(404, "Event not found or inactive")
    total = round(event.price * payload.quantity, 2)
    coupon = None
    discount = 0.0
    if payload.coupon_code:
        coupon = db.query(models.Coupon).filter(func.upper(models.Coupon.coupon_code) == payload.coupon_code.upper()).first()
        if not coupon or not coupon.is_active:
            raise HTTPException(400, "Coupon is invalid or inactive")
        if coupon.expiry_date < datetime.utcnow() or coupon.usage_count >= coupon.usage_limit:
            raise HTTPException(400, "Coupon expired or usage limit reached")
        if total < coupon.minimum_booking_amount:
            raise HTTPException(400, f"Minimum booking amount is ₹{coupon.minimum_booking_amount:.2f}")
        discount = total * coupon.discount_value / 100 if coupon.discount_type == "PERCENTAGE" else coupon.discount_value
        discount = min(round(discount, 2), total)
    final = round(total - discount, 2)
    booking = models.Booking(user_id=user.id, event_id=event.id, quantity=payload.quantity,
        status="PENDING", coupon_id=coupon.id if coupon else None, discount_amount=discount, final_amount=final)
    db.add(booking)
    db.flush()
    transaction_id = f"SIM-{uuid4().hex[:12].upper()}"
    status = "FAILED" if payload.simulate_failure else "SUCCESS"
    payment = models.Payment(booking_id=booking.id, payment_method=payload.payment_method,
        payment_status=status, transaction_id=transaction_id, amount=final)
    db.add(payment)
    if status == "SUCCESS":
        booking.status = "CONFIRMED"
        event.popularity += 1
        if coupon:
            coupon.usage_count += 1
        notify(db, user.id, "Booking confirmed", f"Your booking #{booking.id} for {event.name} is confirmed.", "BOOKING")
        notify(db, user.id, "Payment successful", f"Payment of ₹{final:.2f} succeeded. Reference: {transaction_id}", "PAYMENT")
    else:
        booking.status = "PAYMENT_FAILED"
        notify(db, user.id, "Payment failed", f"Payment for booking #{booking.id} failed. Please try again.", "PAYMENT")
    db.commit()
    db.refresh(booking)
    db.refresh(payment)
    return {"booking_id": booking.id, "event": event.name, "quantity": booking.quantity,
        "booking_status": booking.status, "payment_id": payment.id, "payment_status": payment.payment_status,
        "payment_method": payment.payment_method, "transaction_id": payment.transaction_id,
        "total_amount": total, "discount_amount": discount, "final_amount": final,
        "message": "Payment successful" if status == "SUCCESS" else "Payment failed (simulated)"}

@app.get("/payments/{payment_id}")
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Payment).filter_by(id=payment_id).first()
    if not p: raise HTTPException(404, "Payment not found")
    return {"id": p.id, "booking_id": p.booking_id, "payment_method": p.payment_method,
            "payment_status": p.payment_status, "transaction_id": p.transaction_id,
            "amount": p.amount, "created_at": p.created_at}

@app.post("/reviews", status_code=201)
def create_review(payload: ReviewIn, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter_by(user_id=payload.user_id, event_id=payload.event_id, status="CONFIRMED").first()
    if not booking:
        raise HTTPException(403, "Only users with a confirmed booking can review this event")
    existing = db.query(models.Review).filter_by(user_id=payload.user_id, event_id=payload.event_id).first()
    if existing: raise HTTPException(409, "You have already reviewed this event")
    review = models.Review(user_id=payload.user_id, event_id=payload.event_id, rating=payload.rating, review_text=payload.review_text)
    db.add(review)
    notify(db, payload.user_id, "Review submitted", "Thank you for reviewing your event.", "SYSTEM")
    db.commit()
    db.refresh(review)
    return {"id": review.id, "user_id": review.user_id, "event_id": review.event_id, "rating": review.rating,
            "review_text": review.review_text, "created_at": review.created_at}

@app.get("/events/{event_id}/reviews")
def list_reviews(event_id: int, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter_by(id=event_id).first()
    if not event: raise HTTPException(404, "Event not found")
    reviews = db.query(models.Review).filter_by(event_id=event_id).order_by(models.Review.created_at.desc()).all()
    avg = db.query(func.avg(models.Review.rating)).filter_by(event_id=event_id).scalar()
    return {"event_id": event_id, "average_rating": round(float(avg or 0), 2), "count": len(reviews),
        "reviews": [{"id": r.id, "user_id": r.user_id, "rating": r.rating, "review_text": r.review_text, "created_at": r.created_at} for r in reviews]}

@app.patch("/reviews/{review_id}")
def update_review(review_id: int, payload: ReviewUpdate, user_id: int = Query(default=1), db: Session = Depends(get_db)):
    review = db.query(models.Review).filter_by(id=review_id).first()
    if not review: raise HTTPException(404, "Review not found")
    if review.user_id != user_id: raise HTTPException(403, "You can edit only your own review")
    if payload.rating is not None: review.rating = payload.rating
    if payload.review_text is not None: review.review_text = payload.review_text
    db.commit()
    return {"message": "Review updated", "id": review.id}

@app.delete("/reviews/{review_id}")
def delete_review(review_id: int, user_id: int = Query(default=1), db: Session = Depends(get_db)):
    review = db.query(models.Review).filter_by(id=review_id).first()
    if not review: raise HTTPException(404, "Review not found")
    if review.user_id != user_id: raise HTTPException(403, "You can delete only your own review")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}

@app.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    return db.query(models.Notification).filter_by(user_id=user_id).order_by(models.Notification.created_at.desc()).limit(100).all()

@app.patch("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, user_id: int = Query(default=1), db: Session = Depends(get_db)):
    n = db.query(models.Notification).filter_by(id=notification_id, user_id=user_id).first()
    if not n: raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "Notification marked as read"}

@app.patch("/notifications/read-all")
def mark_all_read(user_id: int = Query(default=1), db: Session = Depends(get_db)):
    db.query(models.Notification).filter_by(user_id=user_id, is_read=False).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}

@app.get("/bookings/{booking_id}")
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    b = db.query(models.Booking).filter_by(id=booking_id).first()
    if not b: raise HTTPException(404, "Booking not found")
    e = db.query(models.Event).filter_by(id=b.event_id).first()
    p = db.query(models.Payment).filter_by(booking_id=b.id).order_by(models.Payment.id.desc()).first()
    return {"id": b.id, "event": e.name if e else "Unknown event", "event_id": b.event_id,
        "quantity": b.quantity, "status": b.status, "discount_amount": b.discount_amount,
        "final_amount": b.final_amount, "payment_status": p.payment_status if p else "PENDING"}
