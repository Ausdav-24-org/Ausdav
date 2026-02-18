# System Architecture - Quiz Attempt Details Feature

## Component Architecture

```
AdminQuizPage (Main Page)
│
├── Card Grid (School Results)
│   ├── Result Card 1 (Clickable)
│   ├── Result Card 2 (Clickable)
│   └── Result Card 3 (Clickable)
│       │
│       └── onClick handler
│           ├── setSelectedQuizResult(result)
│           └── setShowDetailsModal(true)
│
└── QuizAttemptDetailsModal (Conditional Render)
    ├── Modal Header
    │   ├── School Name
    │   └── Close Button (X)
    │
    ├── Stats Bar
    │   ├── Total Questions
    │   ├── Correct Answers (Green)
    │   ├── Wrong Answers (Red)
    │   └── Not Answered (Yellow)
    │
    ├── Questions List (Scrollable)
    │   ├── Question 1
    │   │   ├── Question Text
    │   │   ├── Question Image (optional)
    │   │   ├── Options A, B, C, D
    │   │   │   └── Correct Answer (Green)
    │   │   │   └── Student Answer (Red/Green)
    │   │   └── Status (✓/✗/?)
    │   ├── Question 2
    │   └── ...Question N
    │
    └── Modal Footer
        └── Close Button
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AdminQuizPage                             │
│                                                              │
│  State:                                                      │
│  - schoolResults[] (from school_quiz_results table)          │
│  - selectedQuizResult (when card clicked)                    │
│  - showDetailsModal (true/false)                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ (click card)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              QuizAttemptDetailsModal                         │
│                                                              │
│  Props:                                                      │
│  - schoolName (string)                                       │
│  - quizNo (number: 1 or 2)                                   │
│  - isOpen (boolean)                                          │
│  - onClose (callback)                                        │
│                                                              │
│  Internal State:                                             │
│  - questions[] (fetched from quiz_mcq)                       │
│  - answers{} (fetched from school_quiz_answers)              │
│  - loading (boolean)                                         │
└─────────────────────────────────────────────────────────────┘
        │                                           │
        │ (useEffect on isOpen)                    │
        │                                           │
        ├──→ Fetch Questions                        │
        │    FROM: quiz_mcq table                   │
        │    WHERE: quiz_no = props.quizNo          │
        │    ORDER BY: id ASC                       │
        │                                           │
        └──→ Fetch Answers                          │
             FROM: school_quiz_answers table        │
             WHERE: school_name = props.schoolName  │
             AND: quiz_no = props.quizNo            │
             ORDER BY: created_at DESC              │
             LIMIT: 1 (latest attempt)              │
                    │
                    ↓
        ┌──────────────────────────┐
        │   Compare & Display      │
        │                          │
        │ For each question:       │
        │ - Get correct_answer     │
        │ - Get student_answer     │
        │ - Determine status       │
        │ - Apply color coding     │
        └──────────────────────────┘
```

## Database Schema Diagram

```
┌─────────────────────────────┐
│     school_quiz_results     │
├─────────────────────────────┤
│ id (PK)                     │
│ school_name (FK → answers)  │
│ quiz_no (FK → answers) ←────┼────→ NEW COLUMN
│ total_questions             │
│ correct_answers             │
│ wrong_answers               │
│ not_answered                │
│ final_score                 │
│ language                    │
│ completed_at                │
│ created_at                  │
└─────────────────────────────┘
         │
         │ (school_name & quiz_no)
         ↓
┌─────────────────────────────────────────────────────┐
│         school_quiz_answers (NEW)                   │
├─────────────────────────────────────────────────────┤
│ id (PK)                                             │
│ school_name                                         │
│ quiz_no (1 or 2)                                    │
│ language (ta or en)                                 │
│ q1 → q20 (answers: 'a', 'b', 'c', 'd', or null)    │
│ completed_at                                        │
│ created_at                                          │
└─────────────────────────────────────────────────────┘
         │
         │ (quiz_no)
         ↓
┌──────────────────────────────┐
│      quiz_mcq                │
├──────────────────────────────┤
│ id (PK)                      │
│ question_text                │
│ option_a                     │
│ option_b                     │
│ option_c                     │
│ option_d                     │
│ correct_answer ('a'/'b'/'c'/'d')
│ image_path (optional)        │
│ quiz_no (1 or 2)             │
│ language (ta or en)          │
│ created_at                   │
└──────────────────────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────────┐
│   AdminQuizPage Component State          │
└─────────────────────────────────────────┘
    │
    ├─ questions: QuizQuestion[] = []
    │
    ├─ schoolResults: SchoolQuizResult[] = []
    │
    ├─ selectedQuizResult: SchoolQuizResult | null
    │   └─ Updated when: Card is clicked
    │      Contains: Full result object with quiz_no
    │
    ├─ showDetailsModal: boolean = false
    │   └─ Updated when: 
    │      - Card clicked (set to true)
    │      - Close button clicked (set to false)
    │
    └─ ... (other quiz management states)


┌──────────────────────────────────────────┐
│ QuizAttemptDetailsModal Component State   │
└──────────────────────────────────────────┘
    │
    ├─ loading: boolean = false
    │   └─ Set during data fetch
    │
    ├─ questions: QuizQuestion[] = []
    │   └─ Fetched from quiz_mcq
    │      Matched by: quiz_no
    │
    ├─ answers: { [key: string]: string | null }
    │   └─ Keys: "q1", "q2", "q3", ... "q20"
    │   └─ Values: "a", "b", "c", "d", or null
    │   └─ Fetched from: school_quiz_answers (latest record)
    │
    └─ (Props received from parent)
       ├─ schoolName: string
       ├─ quizNo: number
       ├─ isOpen: boolean
       └─ onClose: () => void
```

## User Interaction Flow

```
START
  │
  ├─ User navigates to Admin → Quiz Management
  │   └─ fetchSchoolResults() is called
  │      └─ Loads all results from school_quiz_results
  │
  ├─ Results displayed as cards in grid
  │   └─ Each card shows:
  │      - School name
  │      - Final score
  │      - Stats (correct/wrong/notAnswered)
  │
  ├─ User hovers over card
  │   └─ CSS hover effects:
  │      - scale-up (transform)
  │      - shadow increase
  │      - cursor becomes pointer
  │
  ├─ User clicks on card
  │   │
  │   ├─ onClick handler:
  │   │   1. setSelectedQuizResult(result)
  │   │   2. setShowDetailsModal(true)
  │   │
  │   └─ QuizAttemptDetailsModal mounts with:
  │       - schoolName = result.school_name
  │       - quizNo = result.quiz_no
  │       - isOpen = true
  │
  ├─ Modal opens with animation
  │   └─ useEffect is triggered
  │      │
  │      ├─ Fetch questions from quiz_mcq
  │      │   WHERE quiz_no = selectedQuizNo
  │      │
  │      └─ Fetch answers from school_quiz_answers
  │          WHERE school_name = selectedSchool
  │          AND quiz_no = selectedQuizNo
  │
  ├─ Modal displays data:
  │   │
  │   ├─ Stats bar shows:
  │   │   - total: questions.length
  │   │   - correct: count where answer === correct_answer
  │   │   - wrong: count where answer !== correct_answer && answer != null
  │   │   - notAnswered: count where answer === null
  │   │
  │   └─ Question list shows for each question:
  │       - Question text & image
  │       - All 4 options
  │       - Color coding:
  │         GREEN:  correct answer
  │         RED:    student's wrong answer (if selected)
  │         YELLOW: not answered
  │
  ├─ User scrolls through questions
  │   └─ Smooth scroll, no page jumps
  │
  ├─ User clicks Close button or X
  │   │
  │   ├─ onClose() callback:
  │   │   1. setShowDetailsModal(false)
  │   │   2. setSelectedQuizResult(null)
  │   │
  │   └─ Modal unmounts with animation
  │
  └─ Back to results view
     └─ User can click another card or continue managing quizzes
```

## Color & Status Mapping

```
┌─────────────────────────────────────────────────────┐
│            Answer Status Determination              │
└─────────────────────────────────────────────────────┘

For each question:
  student_answer = answers["q" + (index + 1)]
  correct_answer = question.correct_answer

  IF student_answer == null:
    status = "not-answered"
    color = YELLOW
    icon = ❓ HelpCircle
    label = "Not Answered"
  
  ELSE IF student_answer == correct_answer:
    status = "correct"
    color = GREEN
    icon = ✓ CheckCircle
    label = "Correct"
  
  ELSE:
    status = "wrong"
    color = RED
    icon = ✗ XCircle
    label = "Wrong"

Result Background Colors:
  correct    → Green (#10b981) with light background
  wrong      → Red (#ef4444) with light background
  not-answered → Yellow (#f59e0b) with light background
  default    → Muted gray (#9ca3af)
```

## RLS (Row Level Security) Policy

```
┌──────────────────────────────────────────┐
│  school_quiz_answers RLS Policies        │
└──────────────────────────────────────────┘

READ Policy: "Only admins can view school quiz answers"
  ├─ ROLE: authenticated
  ├─ CHECK: 
  │   EXISTS (
  │     SELECT 1 FROM members
  │     WHERE members.auth_user_id = auth.uid()
  │     AND members.role IN ('admin', 'super_admin')
  │   )
  └─ Result: Only admins can fetch answers

INSERT Policy: "Allow insert school quiz answers"
  ├─ ROLE: public (or anon)
  ├─ WITH CHECK: true
  └─ Result: Anyone can submit answers (during quiz)
```

## Performance Optimization

```
Query Optimization:
├─ quiz_mcq
│   └─ INDEX: (quiz_no) for fast filtering
│
├─ school_quiz_answers
│   ├─ INDEX: (school_name) for fast lookup
│   ├─ INDEX: (quiz_no) for filtering
│   └─ INDEX: (completed_at DESC) for latest first
│
└─ school_quiz_results
    ├─ INDEX: (school_name) already exists
    ├─ INDEX: (quiz_no) newly added
    └─ INDEX: (completed_at DESC) already exists

Caching Strategy:
├─ Questions cached in local state
│   (fetched once per modal open)
│
└─ Answers fetched fresh
    (important to show latest attempt)
```

---

## Summary

The feature follows a clean architecture:

1. **UI Layer:** Clickable cards → Modal dialog
2. **Data Layer:** Supabase tables with proper RLS
3. **Logic Layer:** React hooks for data fetching and comparison
4. **Style Layer:** Tailwind + shadcn/ui for consistent design

All components are properly typed with TypeScript for safety and maintainability.
