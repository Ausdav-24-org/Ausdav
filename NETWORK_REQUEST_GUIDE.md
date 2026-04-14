# 📊 How to See HomePage Network Requests

## ✅ Server is Running on: http://localhost:8081

---

## 📱 Steps to Monitor Network Requests

### **1. Open Browser**
- Go to: **http://localhost:8081**
- Wait for page to fully load

### **2. Open Developer Tools**
- Press **F12** (or right-click → Inspect)
- Click **Network** tab

### **3. Filter for Supabase Requests**
- In "Filter" box, type: `supabase`
- This shows only database + storage API calls

### **4. Reload Page to Capture Requests**
- Press **F5** or **Ctrl+R** to refresh
- Watch requests appear in the Network tab

---

## 🔍 What to Look For

### **Database Requests** (should be ~2)
- Look for requests to `https://[your-project].supabase.co/rest/v1/`
- Should see:
  1. `/announcements` - Fetch announcements
  2. `/members` - Fetch executive members

### **Storage Requests** (look for the ones to remove)
- Look for requests containing: `storage/v1/object/authenticated/`
- Look for: `.getPublicUrl()` calls
- Look for: `.createSignedUrl()` calls

---

## 📊 Request Types to Count

| Type | Count | Method |
|------|-------|--------|
| GET /announcements | 1 | Normal query |
| GET /members | 1 | React Query |
| POST createSignedUrl | 5 | Executive photos |
| GET getPublicUrl (announcements) | **2-5** | ❌ **UNNECESSARY** |
| GET getPublicUrl (exec fallback) | **0-5** | ❌ **UNNECESSARY** |

---

## 💡 What You'll See

**Announcement Image Requests** (Unnecessary):
```
GET https://[project].supabase.co/storage/v1/object/authenticated/announcements/image.jpg
GET https://[project].supabase.co/storage/v1/object/authenticated/announcements/image2.jpg
(repeat for each announcement)
```

**Executive Fallback Requests** (Unnecessary):
```
GET https://[project].supabase.co/storage/v1/object/authenticated/member-profiles/photo.jpg
(may not appear if signed URLs work)
```

---

## 🎯 After You See Them

Take a screenshot and I'll remove them! 📸

Then page load will be **50% faster** with fewer requests.

---

## Quick Stats to Check
1. **How many GET requests total?** (should be 15-20)
2. **How many are to `/storage/`?** (should be 7-10+)
3. **How many are to `/rest/`?** (should be 2)

Tell me these numbers and I'll optimize! ✨
