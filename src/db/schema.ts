import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Users & auth                                                        */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    studentId: text("student_id"),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
    role: text("role").notNull().default("student"), // super_admin | admin | teacher | student | parent
    classId: integer("class_id"),
    sectionId: integer("section_id"),
    tradeId: integer("trade_id"),
    roll: text("roll"),
    avatar: text("avatar"),
    xp: integer("xp").notNull().default(0),
    level: text("level").notNull().default("beginner"),
    locale: text("locale").notNull().default("bn"),
    motionLevel: text("motion_level").notNull().default("medium"),
    /** Per-user preferences: notification toggles, teacher quiz defaults. */
    prefs: jsonb("prefs").notNull().default({}),
    active: boolean("active").notNull().default(true),
    // pending | approved | rejected — self sign-ups wait for admin approval
    status: text("status").notNull().default("approved"),
    approvedBy: integer("approved_by"),
    approvedAt: timestamp("approved_at"),
    rejectionNote: text("rejection_note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_role_idx").on(t.role),
    index("users_class_idx").on(t.classId),
    index("users_status_idx").on(t.status),
  ],
);

export const parentLinks = pgTable(
  "parent_links",
  {
    parentId: integer("parent_id").notNull(),
    studentId: integer("student_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.parentId, t.studentId] })],
);

export const sessionsTable = pgTable(
  "auth_sessions",
  {
    token: text("token").primaryKey(),
    userId: integer("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Academic structure                                                  */
/* ------------------------------------------------------------------ */

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  level: integer("level").notNull().default(6),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sections = pgTable(
  "sections",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id").notNull(),
    name: text("name").notNull(),
  },
  (t) => [index("sections_class_idx").on(t.classId)],
);

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  code: text("code"),
});

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
    classId: integer("class_id"),
    tradeId: integer("trade_id"),
    color: text("color").notNull().default("#2563eb"),
  },
  (t) => [index("subjects_class_idx").on(t.classId)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("chapters_subject_idx").on(t.subjectId)],
);

export const topics = pgTable(
  "topics",
  {
    id: serial("id").primaryKey(),
    chapterId: integer("chapter_id").notNull(),
    name: text("name").notNull(),
    nameBn: text("name_bn"),
  },
  (t) => [index("topics_chapter_idx").on(t.chapterId)],
);

/* ------------------------------------------------------------------ */
/* Question bank                                                       */
/* ------------------------------------------------------------------ */

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    text: text("text").notNull(),
    type: text("type").notNull().default("mcq"),
    options: jsonb("options").notNull().default([]),
    correct: jsonb("correct").notNull().default([]),
    explanation: text("explanation"),
    hint: text("hint"),
    objective: text("objective"),
    difficulty: text("difficulty").notNull().default("medium"),
    marks: real("marks").notNull().default(1),
    // Default 30s per question; teachers can raise or lower it per question.
    timer: integer("timer").notNull().default(30),
    language: text("language").notNull().default("bn"),
    media: jsonb("media"),
    classId: integer("class_id"),
    tradeId: integer("trade_id"),
    subjectId: integer("subject_id"),
    chapterId: integer("chapter_id"),
    topicId: integer("topic_id"),
    createdBy: integer("created_by"),
    source: text("source").notNull().default("manual"), // manual | ai | document
    status: text("status").notNull().default("published"), // draft | review | published
    usedCount: integer("used_count").notNull().default(0),
    qualityFlags: jsonb("quality_flags").default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("questions_subject_idx").on(t.subjectId),
    index("questions_class_idx").on(t.classId),
    index("questions_difficulty_idx").on(t.difficulty),
    index("questions_source_idx").on(t.source),
    index("questions_status_idx").on(t.status),
    index("questions_creator_idx").on(t.createdBy),
  ],
);

/* ------------------------------------------------------------------ */
/* Quizzes                                                             */
/* ------------------------------------------------------------------ */

export const quizzes = pgTable(
  "quizzes",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    mode: text("mode").notNull().default("live"), // live | exam | practice
    classId: integer("class_id"),
    tradeId: integer("trade_id"),
    templateId: integer("template_id"),
    settings: jsonb("settings").notNull().default({}),
    status: text("status").notNull().default("draft"), // draft | published | archived
    createdBy: integer("created_by"),
    scheduledAt: timestamp("scheduled_at"),
    durationMinutes: integer("duration_minutes").default(30),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("quizzes_creator_idx").on(t.createdBy),
    index("quizzes_mode_idx").on(t.mode),
    index("quizzes_status_idx").on(t.status),
  ],
);

export const quizSections = pgTable(
  "quiz_sections",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id").notNull(),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    settings: jsonb("settings").notNull().default({}),
  },
  (t) => [index("quiz_sections_quiz_idx").on(t.quizId)],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id").notNull(),
    questionId: integer("question_id").notNull(),
    sectionId: integer("section_id"),
    orderIndex: integer("order_index").notNull().default(0),
    marks: real("marks"),
    timer: integer("timer"),
  },
  (t) => [
    index("quiz_questions_quiz_idx").on(t.quizId),
    index("quiz_questions_order_idx").on(t.quizId, t.orderIndex),
  ],
);

export const quizTemplates = pgTable(
  "quiz_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull().default("academic"),
    config: jsonb("config").notNull().default({}),
    visibility: text("visibility").notNull().default("school"), // private | school | shared
    ownerId: integer("owner_id"),
    rating: real("rating").notNull().default(4.5),
    uses: integer("uses").notNull().default(0),
    official: boolean("official").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("templates_category_idx").on(t.category)],
);

export const templateFavorites = pgTable(
  "template_favorites",
  {
    userId: integer("user_id").notNull(),
    templateId: integer("template_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.templateId] })],
);

export const quizPresets = pgTable("quiz_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  settings: jsonb("settings").notNull().default({}),
  ownerId: integer("owner_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Live sessions                                                       */
/* ------------------------------------------------------------------ */

export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id").notNull(),
    pin: text("pin").notNull(),
    hostId: integer("host_id"),
    state: text("state").notNull().default("lobby"),
    currentIndex: integer("current_index").notNull().default(0),
    questionStartedAt: timestamp("question_started_at"),
    questionEndsAt: timestamp("question_ends_at"),
    pausedAt: timestamp("paused_at"),
    lobbyLocked: boolean("lobby_locked").notNull().default(false),
    showLeaderboard: boolean("show_leaderboard").notNull().default(true),
    teamMode: boolean("team_mode").notNull().default(false),
    settings: jsonb("settings").notNull().default({}),
    tournamentId: integer("tournament_id"),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
  },
  (t) => [
    uniqueIndex("sessions_pin_idx").on(t.pin),
    index("sessions_quiz_idx").on(t.quizId),
    index("sessions_state_idx").on(t.state),
  ],
);

export const sessionTeams = pgTable(
  "session_teams",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#2563eb"),
    icon: text("icon").notNull().default("🚀"),
    score: real("score").notNull().default(0),
  },
  (t) => [index("session_teams_session_idx").on(t.sessionId)],
);

export const sessionPlayers = pgTable(
  "session_players",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    userId: integer("user_id"),
    nickname: text("nickname").notNull(),
    studentRef: text("student_ref"),
    teamId: integer("team_id"),
    score: real("score").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    answeredCount: integer("answered_count").notNull().default(0),
    powerUps: jsonb("power_ups").notNull().default({}),
    connected: boolean("connected").notNull().default(true),
    removed: boolean("removed").notNull().default(false),
    lastSeen: timestamp("last_seen").notNull().defaultNow(),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [
    index("players_session_idx").on(t.sessionId),
    index("players_score_idx").on(t.sessionId, t.score),
  ],
);

export const playerAnswers = pgTable(
  "player_answers",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    playerId: integer("player_id").notNull(),
    questionId: integer("question_id").notNull(),
    questionIndex: integer("question_index").notNull().default(0),
    answer: jsonb("answer"),
    correct: boolean("correct").notNull().default(false),
    points: real("points").notNull().default(0),
    responseMs: integer("response_ms").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("player_answer_unique").on(t.playerId, t.questionIndex),
    index("player_answers_session_idx").on(t.sessionId, t.questionIndex),
  ],
);

export const sessionReactions = pgTable(
  "session_reactions",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    playerId: integer("player_id"),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("reactions_session_idx").on(t.sessionId)],
);

export const quizResults = pgTable(
  "quiz_results",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id"),
    quizId: integer("quiz_id").notNull(),
    userId: integer("user_id"),
    playerName: text("player_name").notNull(),
    score: real("score").notNull().default(0),
    accuracy: real("accuracy").notNull().default(0),
    rank: integer("rank").notNull().default(0),
    totalQuestions: integer("total_questions").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    subjectBreakdown: jsonb("subject_breakdown").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("results_quiz_idx").on(t.quizId),
    index("results_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* Exams & practice                                                    */
/* ------------------------------------------------------------------ */

export const examAttempts = pgTable(
  "exam_attempts",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id").notNull(),
    userId: integer("user_id").notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    submittedAt: timestamp("submitted_at"),
    endsAt: timestamp("ends_at"),
    score: real("score").notNull().default(0),
    maxScore: real("max_score").notNull().default(0),
    status: text("status").notNull().default("in_progress"),
    order: jsonb("order").notNull().default([]),
    flags: jsonb("flags").notNull().default([]),
    mode: text("mode").notNull().default("exam"),
  },
  (t) => [
    index("attempts_quiz_idx").on(t.quizId),
    index("attempts_user_idx").on(t.userId),
  ],
);

export const examAnswers = pgTable(
  "exam_answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id").notNull(),
    questionId: integer("question_id").notNull(),
    answer: jsonb("answer"),
    correct: boolean("correct").notNull().default(false),
    points: real("points").notNull().default(0),
    marked: boolean("marked").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("exam_answer_unique").on(t.attemptId, t.questionId)],
);

/* ------------------------------------------------------------------ */
/* Gamification                                                        */
/* ------------------------------------------------------------------ */

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameBn: text("name_bn"),
  description: text("description"),
  icon: text("icon").notNull().default("🏆"),
  xp: integer("xp").notNull().default(50),
  rule: jsonb("rule").notNull().default({}),
  active: boolean("active").notNull().default(true),
});

export const studentAchievements = pgTable(
  "student_achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    achievementId: integer("achievement_id").notNull(),
    earnedAt: timestamp("earned_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("student_achievement_unique").on(t.userId, t.achievementId)],
);

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stage: text("stage").notNull().default("class_round"),
  status: text("status").notNull().default("open"),
  createdBy: integer("created_by"),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentEntries = pgTable(
  "tournament_entries",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    userId: integer("user_id"),
    playerName: text("player_name").notNull(),
    stage: text("stage").notNull().default("class_round"),
    score: real("score").notNull().default(0),
    qualified: boolean("qualified").notNull().default(false),
  },
  (t) => [index("tournament_entries_idx").on(t.tournamentId)],
);

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  metric: text("metric").notNull().default("accuracy"),
  classId: integer("class_id"),
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at"),
  createdBy: integer("created_by"),
});

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  quizIds: jsonb("quiz_ids").notNull().default([]),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlistProgress = pgTable(
  "playlist_progress",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlist_id").notNull(),
    userId: integer("user_id").notNull(),
    completedQuizIds: jsonb("completed_quiz_ids").notNull().default([]),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("playlist_progress_unique").on(t.playlistId, t.userId)],
);

/* ------------------------------------------------------------------ */
/* Feedback / reports / AI jobs / notifications / settings             */
/* ------------------------------------------------------------------ */

export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id").notNull(),
    sessionId: integer("session_id"),
    userId: integer("user_id"),
    playerName: text("player_name"),
    overall: integer("overall").notNull().default(5),
    difficulty: integer("difficulty").notNull().default(3),
    timerRating: integer("timer_rating").notNull().default(3),
    quality: integer("quality").notNull().default(5),
    engagement: integer("engagement").notNull().default(5),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("feedback_quiz_idx").on(t.quizId)],
);

export const questionReports = pgTable(
  "question_reports",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id").notNull(),
    quizId: integer("quiz_id"),
    reporterId: integer("reporter_id"),
    reporterName: text("reporter_name"),
    reason: text("reason").notNull(),
    detail: text("detail"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("question_reports_status_idx").on(t.status)],
);

export const aiJobs = pgTable(
  "ai_generation_jobs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    kind: text("kind").notNull().default("questions"),
    status: text("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    total: integer("total").notNull().default(0),
    completed: integer("completed").notNull().default(0),
    provider: text("provider").notNull().default("builtin"),
    params: jsonb("params").notNull().default({}),
    validation: jsonb("validation").default({}),
    error: text("error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("ai_jobs_user_idx").on(t.userId)],
);

export const aiResults = pgTable(
  "ai_generation_results",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull(),
    payload: jsonb("payload").notNull().default({}),
    flags: jsonb("flags").notNull().default([]),
    approved: boolean("approved").notNull().default(false),
    questionId: integer("question_id"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("ai_results_job_idx").on(t.jobId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    audience: text("audience").notNull().default("user"),
    title: text("title").notNull(),
    body: text("body"),
    kind: text("kind").notNull().default("info"),
    link: text("link"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read)],
);

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("pdf"),
    pageCount: integer("page_count").notNull().default(0),
    chars: integer("chars").notNull().default(0),
    method: text("method").notNull().default("pdfjs"),
    pages: jsonb("pages").notNull().default([]),
    outline: jsonb("outline").notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("documents_user_idx").on(t.userId)],
);

export const presentations = pgTable(
  "presentations",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    theme: text("theme").notNull().default("aurora"),
    slides: jsonb("slides").notNull().default([]),
    ownerId: integer("owner_id"),
    visibility: text("visibility").notNull().default("private"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("presentations_owner_idx").on(t.ownerId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
