# Video Demo Production Guide

## 🎬 Video Tools - Best to Worst

### ✅ Recommended: Screen Studio (£89 one-time)
- **Best for product demos** - auto zooms, smooth cursor, beautiful UI
- Makes screen recordings look professional instantly
- Exports perfect for web (small file size)
- **Worth every penny** for landing pages
- Website: https://screen.studio

### ⚠️ Mac Screen Record (QuickTime/Screenshot)
- FREE but looks amateur
- No cursor highlight, no zoom effects
- File sizes are HUGE
- Need to edit separately in iMovie/Final Cut

### 🎯 Free Alternative: Loom
- Good middle ground (free tier available)
- Adds cursor highlights and clicks
- Web-based, easy to embed
- Slightly less polished than Screen Studio
- Website: https://loom.com

---

## 📹 Perfect Demo Sequence (60-90 seconds)

### **START WITH DATA** (show existing data, not empty state!)

### **0-5 sec: Hook**
- Show dashboard with 3-4 receipts already loaded
- Pan to analytics showing £247.50 in expenses
- Text overlay: "Track expenses in seconds, not hours"

### **5-20 sec: Receipt Upload (2 methods)**
- Click "Upload Receipt" → drag/drop a coffee receipt
- Show AI instantly extracting: "Costa Coffee, £3.80, Food & Subsistence"
- Quick cut to: Forward email receipt from phone
- Show it appear in dashboard 2 seconds later

### **20-35 sec: The Magic - HMRC Categories**
- Click on a receipt → show details modal
- Highlight: Auto-categorized as "Food & Subsistence (HMRC)"
- Quick edit: Change category dropdown (show other HMRC options)
- Click duplicate warning badge: "Potential duplicate detected"

### **35-50 sec: Mileage Tracking**
- Click "Add Mileage"
- Select template: "Home → Client Site (12 miles)"
- Show calculated amount: £6.75 (45p rate)
- Add to records

### **50-65 sec: Analytics & Export**
- Navigate to Analytics
- Show pie chart: breakdown by category
- Pan down to monthly trend chart
- Click "Export Tax Year Summary" → CSV downloads

### **65-75 sec: Call to Action**
- Zoom out to show full dashboard
- Text: "Start tracking free - 50 receipts/month"
- Show URL: expenseflow.co.uk

---

## 🎨 Pro Production Tips

### Setup

#### 1. Create Demo Account with Realistic Data
- **8-10 receipts** across different categories:
  - Coffee shop (£3-5)
  - Parking (£8-12)
  - Office supplies (£15-25)
  - Train fare (£35-50)
  - Lunch with client (£40-60)
  - Software subscription (£10-30)
  - Fuel (£45-60)
  - Professional books (£20-35)

- **2-3 mileage claims:**
  - Home → Client Office (12 miles)
  - Office → Warehouse (25 miles)
  - Client Site A → Client Site B (8 miles)

- **Date range:** Last 30 days
- **Total expenses:** £200-400 (relatable amount for freelancers)

#### 2. Test Receipts to Upload During Recording
- Use real-looking receipts (download samples or use your own)
- Coffee receipt (triggers fast processing)
- One duplicate receipt (to show duplicate detection feature)

#### 3. Browser Setup
- **Use Chrome incognito** (clean, no extensions)
- **Zoom to 125% or 150%** (makes UI elements bigger on video)
- **Close all other tabs**
- **Full screen browser** (Cmd+Shift+F)
- **Hide bookmarks bar**
- **Set browser window to 1920x1080**

### Recording

#### 1. Screen Studio Settings
- **Resolution:** 1920x1080
- **Auto-zoom on clicks:** Enabled
- **Smooth cursor:** Medium speed
- **Cursor style:** System default
- **Export:** H.264, Medium quality (web optimized)
- **Frame rate:** 30fps

#### 2. If Using Mac Screen Record
- Record at 1920x1080
- Use **CleanShot X** (free alternative) for better cursor highlighting
- Edit in iMovie:
  - Add text overlays at key moments
  - Speed up boring parts (page loads, form fills)
  - Trim dead space at start/end

#### 3. Phone Recording (for Email Forward Demo)
- **Use actual phone screen recording:**
  - Settings → Control Center → Screen Recording
- Show:
  1. Open email app
  2. Forward receipt email to unique@expenseflow.co.uk
  3. Tap send
- Switch to desktop showing it appear in dashboard (feels magical)
- Consider recording phone with overhead camera for more polished look

### Post-Production

#### Essential Edits
- **Speed up** slow parts (2x speed for page loads, form submissions)
- **Add text overlays** for key moments:
  - "AI extracts instantly"
  - "HMRC compliant categories"
  - "Duplicate detection"
  - "Export tax-ready reports"
- **Trim aggressively** - keep it under 90 seconds

#### Optional Enhancements
- **Background music** (subtle, upbeat):
  - Epidemic Sound (paid)
  - YouTube Audio Library (free)
  - Keep volume LOW (background only)
- **Voiceover:** Optional (text overlays often work better)
- **Transitions:** Simple fades between sections
- **Branding:** Add logo watermark in corner

---

## 📦 How to Add to Landing Page

### Option 1: Self-hosted (Best for Page Speed)

```tsx
<section className="container mx-auto px-4 py-20 bg-muted/30">
  <div className="text-center mb-8">
    <h2 className="text-3xl font-bold">See It In Action</h2>
    <p className="text-muted-foreground">Watch how easy expense tracking can be</p>
  </div>
  <div className="max-w-4xl mx-auto">
    <video 
      autoPlay 
      muted 
      loop 
      playsInline 
      className="rounded-lg shadow-2xl w-full"
      poster="/video-thumbnail.jpg"
    >
      <source src="/demo-video.mp4" type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  </div>
</section>
```

**File optimization:**
- Export at 1080p, H.264, Medium quality
- Target file size: Under 10MB
- Use HandBrake if file is too large

### Option 2: YouTube (Better for SEO)

```tsx
<section className="container mx-auto px-4 py-20 bg-muted/30">
  <div className="text-center mb-8">
    <h2 className="text-3xl font-bold">See It In Action</h2>
    <p className="text-muted-foreground">Watch how easy expense tracking can be</p>
  </div>
  <div className="max-w-4xl mx-auto aspect-video">
    <iframe 
      width="100%" 
      height="100%" 
      src="https://www.youtube.com/embed/YOUR_VIDEO_ID?rel=0" 
      frameBorder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowFullScreen
      className="rounded-lg shadow-2xl"
    />
  </div>
</section>
```

**Benefits:**
- Upload to YouTube (unlisted or public)
- Helps with "video SEO"
- Can share on social media
- Free hosting, no bandwidth costs

### Where to Place Video

**Right after hero section** - catches attention while users are engaged:

1. Hero Section (with CTA)
2. **→ Video Demo Section ← INSERT HERE**
3. Problem/Solution Section
4. Features Section
5. How It Works
6. Pricing
7. FAQ

---

## 📊 My Specific Recommendation

### Production Workflow

1. **Try Screen Studio first** - 14-day trial available
   - If budget allows, buy it (£89 one-time, worth it)
   - If not, use Loom free tier

2. **Record 90-second demo** following sequence above
   - Do 2-3 takes to get comfortable
   - Pick the best one

3. **Show WITH data** - looks more impressive than empty state
   - Pre-populate 8-10 receipts
   - Have analytics showing

4. **Keep it silent with text overlays**
   - People watch muted on mobile
   - Easier to edit/update later

5. **Self-host on landing page**
   - Faster load times
   - Better control

6. **Also post on YouTube/Twitter**
   - Extra marketing reach
   - SEO benefits

### Timeline

- **Setup demo data:** 30 minutes
- **Recording:** 1 hour (including retakes)
- **Editing:** 1 hour
- **Total:** 2-3 hours

### Testing

Before publishing:
- Test autoplay works on mobile
- Check file size (should be under 10MB)
- Verify it looks good at different screen sizes
- Test on slow connection (3G throttle in Chrome DevTools)

---

## 🎯 Expected Impact

Adding a demo video typically:
- **20-30% increase in conversions**
- **40-50% longer time on page**
- **Reduces support questions** (users understand product better)
- **Better qualified signups** (users know what they're getting)

---

## 💡 Pro Tips

1. **Don't narrate obvious actions** - let the visual flow speak
2. **Show the outcome, not just features** - "£247 tracked" not "click here"
3. **Use real data** - fake data looks fake
4. **Keep cursor movements smooth** - don't dart around
5. **One action at a time** - don't overwhelm viewers
6. **End with clear CTA** - what should they do next?

---

## 📱 Alternative: GIF Demo

If video feels too much, create an animated GIF:
- Show just receipt upload flow (15 seconds)
- Tools: Gifox (Mac), ScreenToGif (Windows)
- Lighter weight than video
- Auto-plays in all browsers
- Good for "above the fold" quick demo

---

## Next Steps

- [ ] Download Screen Studio (or Loom)
- [ ] Create demo account with realistic data
- [ ] Gather test receipts
- [ ] Record 2-3 takes
- [ ] Edit best version
- [ ] Optimize file size
- [ ] Add to landing page
- [ ] Test on mobile/desktop
- [ ] Upload to YouTube (optional)
- [ ] Share on social media

**Good luck! A great demo video can be a game-changer for conversions.** 🚀
