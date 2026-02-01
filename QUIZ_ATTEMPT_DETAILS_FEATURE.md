# Quiz Attempt Details Feature - Implementation Summary

## Overview
Implemented a feature that allows admins to view detailed quiz attempt information by clicking on school quiz result cards. The feature shows which questions each student answered correctly, incorrectly, or didn't answer at all.

## Changes Made

### 1. **Database Migration Files**

#### `20260201000000_create_school_quiz_answers.sql`
- Created `school_quiz_answers` table to store individual question answers per school
- Stores answers as columns `q1` through `q20` (supporting up to 20 questions)
- Each cell contains the student's answer: 'a', 'b', 'c', 'd', or `null` (not answered)
- Includes RLS policies for admin access only
- Added indexes for performance optimization

#### `20260201000100_add_quiz_no_to_school_quiz_results.sql`
- Added `quiz_no` column to existing `school_quiz_results` table
- Allows tracking which quiz (1 or 2) each attempt was for

### 2. **New Component: QuizAttemptDetailsModal**
**File:** `src/components/QuizAttemptDetailsModal.tsx`

Features:
- Modal dialog showing detailed breakdown of quiz attempt
- Displays statistics at the top: Total, Correct, Wrong, Not Answered counts
- Shows each question with:
  - Question text and image (if available)
  - All 4 options with visual indicators
  - Student's selected answer (highlighted in red if wrong)
  - Correct answer (highlighted in green)
  - Status badge (Correct/Wrong/Not Answered)
- Color-coded sections for visual clarity
- Fetches questions from `quiz_mcq` table
- Fetches student answers from `school_quiz_answers` table
- Responsive and animated UI using Framer Motion

### 3. **Updated AdminQuizPage**
**File:** `src/pages/admin/AdminQuizPage.tsx`

Changes:
- Added import for `QuizAttemptDetailsModal` component
- Added state management:
  - `selectedQuizResult`: Stores the currently selected quiz result
  - `showDetailsModal`: Controls modal visibility
- Made quiz result cards clickable:
  - Added `cursor-pointer` and hover effects (`scale-105`, shadow increase)
  - Added "Click to view details →" text at bottom of cards
  - Cards now trigger modal on click
- Updated `SchoolQuizResult` type to include optional `quiz_no` field
- Modal integrated at component end with proper state handling

## How It Works

1. **View Results:** Admin visits the Quiz Management page and sees all school quiz results displayed as cards
2. **Click Card:** Admin clicks on any school's result card
3. **View Details:** Modal opens showing:
   - All questions from that quiz
   - What each student answered
   - Which answers were correct/wrong/unanswered
4. **Close:** Admin can close the modal to return to results view

## Data Flow

```
AdminQuizPage (display results)
  ↓ (click card)
  ↓
QuizAttemptDetailsModal (selected school)
  ↓
  ├→ Fetches quiz questions from: quiz_mcq table
  │    (filtered by quiz_no)
  │
  └→ Fetches student answers from: school_quiz_answers table
       (filtered by school_name and quiz_no)
  
  ↓
  Modal displays comparison of answers vs correct answers
```

## Database Schema

### school_quiz_answers
```sql
id: bigserial (primary key)
school_name: text
quiz_no: integer (1 or 2)
language: text (ta/en)
q1-q20: text (answer: a/b/c/d or null)
completed_at: timestamptz
created_at: timestamptz
```

### school_quiz_results (updated)
```sql
...existing fields...
quiz_no: integer (1 or 2) -- ADDED
```

## Security

- RLS (Row Level Security) policies ensure only authenticated admins can view answers
- Public can insert answers (for quiz submissions)
- Admin-only read access

## UI/UX Features

- **Visual Feedback:**
  - Green highlight for correct answers
  - Red highlight for wrong answers/selections
  - Yellow highlight for unanswered questions
  
- **Interactive Elements:**
  - Clickable result cards with hover effects
  - Smooth animations and transitions
  - Modal overlay with backdrop
  
- **Responsive Design:**
  - Works on mobile, tablet, and desktop
  - Scrollable modal for long content
  - Grid layout adapts to screen size

## Files Modified/Created

### Created:
- `src/components/QuizAttemptDetailsModal.tsx` (new component)
- `supabase/migrations/20260201000000_create_school_quiz_answers.sql`
- `supabase/migrations/20260201000100_add_quiz_no_to_school_quiz_results.sql`

### Modified:
- `src/pages/admin/AdminQuizPage.tsx` (added modal integration and click handlers)

## Integration Notes

The feature integrates seamlessly with existing code:
- Uses existing Supabase client and authentication
- Follows existing component patterns (Cards, Buttons, etc.)
- Uses existing theme and styling system (Tailwind + shadcn/ui)
- Compatible with existing quiz storage structure in `school_quiz_answers`

## Future Enhancements

Possible additions:
- Export attempt details to PDF
- Filter results by date range
- Search by school name
- Bulk export of all quiz data
- Analytics dashboard showing performance trends
