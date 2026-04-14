# Testing Guide - Quiz Attempt Details Feature

## Prerequisites
- Admin access to the system
- At least one school with completed quiz results
- Database migrations applied

## Testing Checklist

### ✅ Initial Setup
- [ ] Verify build completes without errors: `npm run build`
- [ ] All database migrations are applied
- [ ] `school_quiz_answers` table exists
- [ ] `quiz_no` column added to `school_quiz_results` table

### ✅ UI/UX Testing

#### 1. Cards Display Correctly
- [ ] Navigate to Admin → Quiz Management
- [ ] Scroll to "School Quiz Results" section
- [ ] Verify cards are displayed in grid layout
- [ ] Check medal emojis (🥇🥈🥉) appear on top 3 schools
- [ ] Verify score, correct, wrong, not answered counts are visible

#### 2. Card Interactivity
- [ ] Hover over a card - should see scale-up and shadow effect
- [ ] "Click to view details →" text appears at bottom of card
- [ ] Click a card - modal should open smoothly with animation

#### 3. Modal Display
- [ ] Modal opens with school name as title
- [ ] Header shows "Quiz X - Detailed Answers"
- [ ] Stats bar shows: Total, Correct (green), Wrong (red), Not Answered (yellow)
- [ ] Close button (X) in top-right corner works
- [ ] Close button at bottom works
- [ ] Background backdrop dims behind modal
- [ ] Clicking backdrop closes modal

### ✅ Modal Content Testing

#### 1. Questions Display
- [ ] All questions from the quiz are listed
- [ ] Question text is visible
- [ ] Question numbers are correct (Q1, Q2, etc.)
- [ ] Question images load correctly (if any)

#### 2. Options Display
For each question:
- [ ] All 4 options (A, B, C, D) are shown
- [ ] Option text is visible
- [ ] Options are in correct order

#### 3. Answer Comparison
- [ ] Correct answer is highlighted in GREEN
- [ ] Student's wrong answer is highlighted in RED
- [ ] Not answered questions show YELLOW "Not Answered" status
- [ ] Status labels appear (✓ Correct, ✗ Wrong, ? Not Answered)

#### 4. Styling & Colors
- [ ] Correct answers: Green background + checkmark
- [ ] Wrong answers: Red background + X mark + option letter highlighted
- [ ] Not answered: Yellow background + question mark
- [ ] Card borders and backgrounds are visually distinct

### ✅ Data Accuracy Testing

#### 1. Questions Match Quiz
- [ ] Questions shown match the actual quiz questions
- [ ] Correct answers match quiz setup
- [ ] Order of questions is correct

#### 2. Student Answers Match Data
- [ ] Student answers displayed match what's in `school_quiz_answers` table
- [ ] Null values show as "Not Answered"
- [ ] Invalid answers are handled gracefully

#### 3. Statistics Accuracy
- [ ] Correct count = number of correct answers
- [ ] Wrong count = number of incorrect answers
- [ ] Not answered count = number of null/missing answers
- [ ] Total = correct + wrong + not answered

### ✅ Responsive Design Testing

#### Desktop (1920px+)
- [ ] Modal displays properly
- [ ] Content is readable
- [ ] All controls are accessible

#### Tablet (768px - 1024px)
- [ ] Modal scales appropriately
- [ ] No horizontal scrolling needed
- [ ] Touch interactions work

#### Mobile (< 768px)
- [ ] Modal takes up ~90% of screen
- [ ] Content is scrollable
- [ ] Close buttons are easy to tap
- [ ] Options wrap properly

### ✅ Animation & Performance Testing

#### Animations
- [ ] Modal fade-in animation is smooth
- [ ] Card hover scale animation is smooth
- [ ] Question list items animate in sequence
- [ ] No jittering or stuttering

#### Performance
- [ ] Modal opens within 1-2 seconds
- [ ] No console errors
- [ ] No lag when scrolling through questions
- [ ] Smooth scroll behavior

### ✅ Edge Cases Testing

#### 1. Empty/Missing Data
- [ ] If no answers stored: "No questions available" message appears
- [ ] If quiz has no questions: modal handles gracefully
- [ ] If school has no answers: displays "Not Answered" for all

#### 2. Image Handling
- [ ] Questions with images: images load and display
- [ ] Questions without images: no broken image icon
- [ ] Large images: scaled to fit modal width

#### 3. Different Quiz Numbers
- [ ] Quiz 1: modal shows correct quiz_no
- [ ] Quiz 2: modal shows correct quiz_no
- [ ] Mixed results: each shows appropriate quiz

#### 4. Special Characters
- [ ] Tamil text displays correctly
- [ ] English text displays correctly
- [ ] Special characters in question text: no corruption
- [ ] Emojis in content: display properly

### ✅ Error Handling Testing

#### Loading States
- [ ] "Loading..." message appears while fetching data
- [ ] Loading disappears when data arrives
- [ ] No loading state persists indefinitely

#### Error Cases
- [ ] Network error: appropriate error toast shown
- [ ] Failed fetch: error message doesn't crash modal
- [ ] No data: "No questions available" displays
- [ ] Console shows helpful error messages

### ✅ Security Testing

#### RLS Policies
- [ ] Admin can view answer details
- [ ] Non-admin cannot access modal data (if direct query attempted)
- [ ] Only correct school's answers shown

#### Data Protection
- [ ] No sensitive data exposed in console logs
- [ ] No credentials in network requests
- [ ] No data leakage in error messages

### ✅ Accessibility Testing

#### Keyboard Navigation
- [ ] Tab key navigates through modal elements
- [ ] Escape key closes modal
- [ ] Enter key works on buttons

#### Screen Readers
- [ ] Heading structure is semantic
- [ ] Button labels are descriptive
- [ ] Status colors are not the only way to convey information

### ✅ Browser Compatibility Testing

Test on:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers

## Test Data Preparation

If no test data exists, you can:

1. **Submit test quiz:**
   ```bash
   # Go to Quiz page and submit with test school name
   # Make sure to answer some questions correctly, some wrong, leave some blank
   ```

2. **Verify data created:**
   ```sql
   -- Check school_quiz_results
   SELECT * FROM school_quiz_results 
   WHERE school_name = 'Test School' 
   ORDER BY created_at DESC LIMIT 1;
   
   -- Check school_quiz_answers
   SELECT * FROM school_quiz_answers 
   WHERE school_name = 'Test School' 
   ORDER BY created_at DESC LIMIT 1;
   ```

## Known Limitations

- Modal shows latest attempt per school
- Supports up to 20 questions (q1-q20 columns)
- No pagination for question list
- No export functionality (can be added later)

## Pass/Fail Criteria

✅ **PASS** if:
- All questions display with correct answers
- Student answers match database records
- Modal opens/closes smoothly
- No console errors
- Responsive on all screen sizes
- Colors accurately represent answer status

❌ **FAIL** if:
- Questions missing or incorrect
- Wrong answers displayed
- Modal won't open/close
- Console errors present
- Layout broken on any device
- Wrong color coding

## Reporting Issues

If you find any issues:

1. **Note the issue:** Take a screenshot
2. **Reproduce it:** Document steps to replicate
3. **Check console:** Look for error messages (F12 → Console)
4. **Check database:** Verify data exists
5. **Report with:**
   - Description of issue
   - Steps to reproduce
   - Screenshot
   - Console errors (if any)
   - Browser/device used

---

## Quick Test Script

```typescript
// If you want to quickly test, paste this in browser console:
console.log('Quiz Attempt Details Feature Test');
console.log('Check for:');
console.log('✓ Clicking card opens modal');
console.log('✓ Modal shows questions');
console.log('✓ Green highlights correct answers');
console.log('✓ Red highlights wrong answers');
console.log('✓ Yellow shows not answered');
console.log('✓ Modal closes when clicking close button');
console.log('✓ No errors in console');
```

---

## Support

If the feature isn't working:

1. ✅ Verify migrations are applied: `supabase status`
2. ✅ Check quiz data exists: Open browser DevTools → Network tab
3. ✅ Check console for errors: F12 → Console
4. ✅ Verify admin permissions are set correctly
5. ✅ Clear browser cache: Ctrl+Shift+Delete
