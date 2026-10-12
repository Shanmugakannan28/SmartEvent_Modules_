import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Search, MapPin, Ticket, Sparkles, CheckCircle2, XCircle, Star, SlidersHorizontal, ArrowRight, CreditCard, Clock3 } from 'lucide-react';

const API = 'http://127.0.0.1:8000';
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n||0));
const dateText = s => new Date(s).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});

export default function App(){
  const [events,setEvents] = useState([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('');
  const [location,setLocation] = useState('');
  const [sortBy,setSortBy] = useState('date');
  const [selected,setSelected] = useState(null);
  const [qty,setQty] = useState(1);
  const [coupon,setCoupon] = useState('');
  const [paymentMethod,setPaymentMethod] = useState('UPI');
  const [fail,setFail] = useState(false);
  const [result,setResult] = useState(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notifications,setNotifications] = useState([]);
  const [showNotifications,setShowNotifications] = useState(false);
  const [reviews,setReviews] = useState({});
  const [reviewRating,setReviewRating] = useState(5);
  const [reviewText,setReviewText] = useState('');
  const [reviewMessage,setReviewMessage] = useState('');

  async function loadEvents(){
    try {
      const params = new URLSearchParams();
      if(search) params.set('search',search);
      if(category) params.set('category',category);
      if(location) params.set('location',location);
      params.set('sort_by',sortBy);
      const r = await fetch(`${API}/events?${params}`);
      setEvents(await r.json());
    } catch { setError('Cannot connect to API. Start the FastAPI server on port 8000.'); }
  }
  async function loadNotifications(){
    try { const r=await fetch(`${API}/notifications?user_id=1`); if(r.ok) setNotifications(await r.json()); } catch {}
  }
  useEffect(()=>{loadEvents()},[search,category,location,sortBy]);
  useEffect(()=>{loadNotifications()},[]);
  const unread = notifications.filter(n=>!n.is_read).length;

  async function checkout(e){
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try {
      const r=await fetch(`${API}/checkout`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({user_id:1,event_id:selected.id,quantity:Number(qty),payment_method:paymentMethod,coupon_code:coupon.trim()||null,simulate_failure:fail})});
      const data=await r.json();
      if(!r.ok) throw new Error(data.detail||'Checkout failed');
      setResult(data); await loadNotifications();
    } catch(err){setError(err.message||'Something went wrong');}
    finally{setBusy(false);}
  }
  async function loadReviews(eventId){
    try { const r=await fetch(`${API}/events/${eventId}/reviews`); if(r.ok) { const data=await r.json(); setReviews(v=>({...v,[eventId]:data})); } } catch {}
  }
  async function submitReview(eventId){
    setReviewMessage('');
    try { const r=await fetch(`${API}/reviews`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:1,event_id:eventId,rating:Number(reviewRating),review_text:reviewText})}); const data=await r.json(); if(!r.ok) throw new Error(data.detail||'Could not submit review'); setReviewMessage('Thanks! Your review was submitted.'); setReviewText(''); await loadReviews(eventId); } catch(err){setReviewMessage(err.message||'Could not submit review');}
  }
  async function markRead(id){
    try { await fetch(`${API}/notifications/${id}/read?user_id=1`,{method:'PATCH'}); await loadNotifications(); } catch {}
  }

  return <div className="app-shell">
    <nav className="navbar">
      <button className="brand" onClick={()=>{setSelected(null);setResult(null)}}><span className="brand-mark"><Ticket size={20}/></span> Smart<span>Event</span></button>
      <div className="nav-links"><a href="#discover">Discover</a><a href="#how">How it works</a><button className="icon-btn" aria-label="Notifications" onClick={()=>setShowNotifications(!showNotifications)}><Bell size={20}/>{unread>0&&<i>{unread}</i>}</button></div>
      {showNotifications&&<div className="notification-panel"><div className="panel-head"><b>Notifications</b><button onClick={async()=>{await fetch(`${API}/notifications/read-all?user_id=1`,{method:'PATCH'});loadNotifications()}}>Mark all read</button></div>
        {notifications.length===0?<p className="muted">You're all caught up.</p>:notifications.map(n=><button className={`notification ${n.is_read?'read':''}`} key={n.id} onClick={()=>markRead(n.id)}><b>{n.title}</b><span>{n.message}</span><small>{dateText(n.created_at)}</small></button>)}</div>}
    </nav>

    <header className="hero" id="discover">
      <div className="hero-glow"></div><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> MAKE EVERY MOMENT COUNT</div>
        <h1>Find your next<br/><em>great experience.</em></h1>
        <p>Discover live music, fresh ideas, and unforgettable nights. Your next story starts here.</p>
        <a className="primary-btn" href="#events">Explore events <ArrowRight size={17}/></a>
        <div className="hero-stats"><div><b>Curated</b><span>local experiences</span></div><div><b>Simple</b><span>secure checkout demo</span></div><div><b>Made for you</b><span>memorable moments</span></div></div>
      </div>
      <div className="hero-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="floating-ticket"><Ticket size={35}/><span>YOUR NEXT<br/>ADVENTURE</span><b>✦</b></div><div className="hero-chip chip-top"><span>✦</span> Curated events</div><div className="hero-chip chip-bottom"><span>↗</span> Memories await</div></div>
    </header>

    <main className="main-content" id="events">
      <div className="section-heading"><div><div className="eyebrow">THE GOOD STUFF</div><h2>Explore events</h2><p>Find something worth looking forward to.</p></div><div className="result-count">{events.length} experiences</div></div>
      <div className="filters"><label className="search-field"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events..."/></label>
        <label className="filter-field"><SlidersHorizontal size={16}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option><option>Music</option><option>Technology</option><option>Comedy</option><option>General</option></select></label>
        <label className="filter-field"><MapPin size={16}/><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location"/></label>
        <label className="filter-field"><select value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="date">Soonest date</option><option value="popularity">Most popular</option><option value="price">Price: low to high</option></select></label>
      </div>
      {error&&!selected&&<div className="error-banner">{error}</div>}
      <div className="event-grid">{events.map((event,i)=><article className="event-card" key={event.id} style={{'--delay':`${i*70}ms`}}>
        <div className={`event-art art-${i%3}`}><div className="art-orb"></div><span className="event-category">{event.category}</span><span className="art-number">0{i+1}</span><div className="art-graphic">{i%3===0?'♫':i%3===1?'✳':'☻'}</div></div>
        <div className="event-details"><div className="event-meta"><span><CalendarDays size={14}/>{dateText(event.event_date)}</span><span><MapPin size={14}/>{event.location}</span></div><h3>{event.name}</h3><p>{event.description}</p><div className="card-footer"><div><small>Tickets from</small><strong>{money(event.price)}</strong></div><button className="book-btn" onClick={()=>{setSelected(event);setResult(null);setError('');setQty(1);setCoupon('')}}>Book tickets <ArrowRight size={15}/></button></div>
        <button className="review-link" onClick={()=>loadReviews(event.id)}><Star size={14}/> {reviews[event.id]?`${reviews[event.id].average_rating} / 5 · ${reviews[event.id].count} reviews`:'View ratings & reviews'}</button>
        {reviews[event.id]&&reviews[event.id].reviews.map(r=><div className="review-mini" key={r.id}><span>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span> {r.review_text}</div>)}
        {reviews[event.id]&&<div className="review-form"><b>Leave a review</b><div className="review-form-row"><select aria-label="Rating" value={reviewRating} onChange={e=>setReviewRating(e.target.value)}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{'★'.repeat(n)} ({n}/5)</option>)}</select><input aria-label="Review text" value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="Share your experience" maxLength={2000}/><button onClick={()=>submitReview(event.id)}>Submit</button></div>{reviewMessage&&<small>{reviewMessage}</small>}<small>Only confirmed bookings can submit a review.</small></div>}
        </div></article>)}</div>
      {events.length===0&&<div className="empty"><Search size={28}/><h3>No events found</h3><p>Try changing your search or filters.</p></div>}
    </main>

    <section className="how-section" id="how"><div className="eyebrow">NO FUSS, JUST FUN</div><h2>Your plans, in three easy steps.</h2><div className="steps"><div><span>01</span><h3>Discover</h3><p>Browse hand-picked experiences that match your mood.</p></div><div><span>02</span><h3>Book</h3><p>Choose your tickets and apply a promo code at checkout.</p></div><div><span>03</span><h3>Enjoy</h3><p>Get confirmation and keep your booking details close.</p></div></div></section>
    <footer><button className="brand" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}><span className="brand-mark"><Ticket size={18}/></span> Smart<span>Event</span></button><span>Find your moment. Make it memorable.</span><small>Demo application · Simulated payments only</small></footer>

    {selected&&<div className="modal-backdrop" onClick={()=>{if(!busy)setSelected(null)}}><div className="checkout-modal" onClick={e=>e.stopPropagation()}>
      <button className="close-btn" onClick={()=>{setSelected(null);setResult(null)}}>×</button>
      {!result?<><div className="eyebrow"><CreditCard size={15}/> SECURE CHECKOUT DEMO</div><h2>Book your tickets</h2><p className="modal-subtitle">Almost there. Review your order below.</p>
        <div className="checkout-event"><div className="mini-art">♫</div><div><b>{selected.name}</b><span><CalendarDays size={14}/>{dateText(selected.event_date)} · {selected.location}</span></div></div>
        <form onSubmit={checkout}><label className="form-label">Number of tickets</label><div className="quantity-control"><button type="button" onClick={()=>setQty(Math.max(1,Number(qty)-1))}>−</button><strong>{qty}</strong><button type="button" onClick={()=>setQty(Math.min(20,Number(qty)+1))}>+</button></div>
          <label className="form-label">Coupon code</label><div className="coupon-row"><input value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="Try WELCOME10"/><span>10% OFF*</span></div>
          <label className="form-label">Payment method</label><div className="payment-options">{['UPI','CARD','CASH'].map(m=><button type="button" key={m} className={paymentMethod===m?'selected':''} onClick={()=>setPaymentMethod(m)}>{m==='UPI'?'◉':m==='CARD'?'▣':'₹'} {m}</button>)}</div>
          <div className="order-total"><div><span>Subtotal</span><b>{money(selected.price*qty)}</b></div><div><span>Discount (if valid)</span><b className="discount">Calculated at checkout</b></div><div className="grand-total"><span>Total before discount</span><strong>{money(selected.price*qty)}</strong></div></div>
          <label className="failure-toggle"><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/> Simulate a failed payment (for testing)</label>
          {error&&<div className="error-banner">{error}</div>}<button className="pay-btn" disabled={busy}>{busy?'Processing...':`Pay ${money(selected.price*qty)} (demo)`}<ArrowRight size={17}/></button>
          <p className="secure-note">🔒 Demo only — no real payment or card data is collected.</p>
        </form>
      </>:<div className="payment-result">
        {result.payment_status==='SUCCESS'?<CheckCircle2 className="result-icon success" size={56}/>:<XCircle className="result-icon failed" size={56}/>}
        <div className="eyebrow">{result.payment_status==='SUCCESS'?'PAYMENT CONFIRMED':'PAYMENT NOT COMPLETED'}</div><h2>{result.payment_status==='SUCCESS'?'You’re all set!':'Let’s try that again.'}</h2><p>{result.message}</p>
        <div className="receipt"><div><span>Booking ID</span><b>#{result.booking_id}</b></div><div><span>Event</span><b>{result.event}</b></div><div><span>Tickets</span><b>{result.quantity}</b></div><div><span>Subtotal</span><b>{money(result.total_amount)}</b></div><div><span>Discount</span><b className="discount">−{money(result.discount_amount)}</b></div><div><span>Amount paid / due</span><b>{money(result.final_amount)}</b></div><div><span>Status</span><b className={result.payment_status==='SUCCESS'?'status-success':'status-failed'}>{result.payment_status}</b></div><div><span>Transaction reference</span><b className="transaction">{result.transaction_id}</b></div></div>
        <button className="pay-btn" onClick={()=>{setSelected(null);setResult(null);loadEvents()}}>Back to events <ArrowRight size={17}/></button>
        <p className="secure-note">Save your booking ID for reference.</p>
      </div>}
    </div></div>}
  </div>
}
