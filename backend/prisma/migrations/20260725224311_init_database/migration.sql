-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "school" TEXT NOT NULL,
    "major" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "subjects" TEXT NOT NULL,
    "teachingExperience" TEXT,
    "bio" TEXT,
    "expectedPriceMin" INTEGER,
    "expectedPriceMax" INTEGER,
    "priceUnit" TEXT DEFAULT 'PER_HOUR',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "teachingRegions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "materialPath" TEXT NOT NULL,
    "materialType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" INTEGER,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Certification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certification_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Demand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parentId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "childGrade" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "addressDetail" TEXT,
    "scheduleDescription" TEXT NOT NULL,
    "budgetMin" INTEGER NOT NULL,
    "budgetMax" INTEGER NOT NULL,
    "priceUnit" TEXT NOT NULL DEFAULT 'PER_HOUR',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" DATETIME,
    "matchedAt" DATETIME,
    "completedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Demand_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Application" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "demandId" INTEGER NOT NULL,
    "coverMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "viewedAt" DATETIME,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Application_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicationId" INTEGER NOT NULL,
    "demandId" INTEGER NOT NULL,
    "parentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "conversationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "receiverId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrialLesson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "applicationId" INTEGER NOT NULL,
    "demandId" INTEGER NOT NULL,
    "parentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "proposedBy" INTEGER NOT NULL,
    "scheduledStartAt" DATETIME NOT NULL,
    "scheduledEndAt" DATETIME NOT NULL,
    "method" TEXT NOT NULL,
    "locationOrLink" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "cancellationReason" TEXT,
    "confirmedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrialLesson_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrialLesson_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrialLesson_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrialLesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrialLesson_proposedBy_fkey" FOREIGN KEY ("proposedBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "trialLessonId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "revieweeId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_trialLessonId_fkey" FOREIGN KEY ("trialLessonId") REFERENCES "TrialLesson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "Certification_studentId_status_idx" ON "Certification"("studentId", "status");

-- CreateIndex
CREATE INDEX "Certification_status_submittedAt_idx" ON "Certification"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Certification_reviewedBy_idx" ON "Certification"("reviewedBy");

-- CreateIndex
CREATE INDEX "Demand_parentId_status_idx" ON "Demand"("parentId", "status");

-- CreateIndex
CREATE INDEX "Demand_status_subject_region_publishedAt_idx" ON "Demand"("status", "subject", "region", "publishedAt");

-- CreateIndex
CREATE INDEX "Application_demandId_status_createdAt_idx" ON "Application"("demandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Application_studentId_status_createdAt_idx" ON "Application"("studentId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_studentId_demandId_key" ON "Application"("studentId", "demandId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_applicationId_key" ON "Conversation"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_demandId_key" ON "Conversation"("demandId");

-- CreateIndex
CREATE INDEX "Conversation_parentId_status_lastMessageAt_idx" ON "Conversation"("parentId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_studentId_status_lastMessageAt_idx" ON "Conversation"("studentId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_id_idx" ON "Message"("conversationId", "sentAt", "id");

-- CreateIndex
CREATE INDEX "Message_receiverId_readAt_idx" ON "Message"("receiverId", "readAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "TrialLesson_applicationId_status_idx" ON "TrialLesson"("applicationId", "status");

-- CreateIndex
CREATE INDEX "TrialLesson_demandId_idx" ON "TrialLesson"("demandId");

-- CreateIndex
CREATE INDEX "TrialLesson_parentId_status_scheduledStartAt_idx" ON "TrialLesson"("parentId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "TrialLesson_studentId_status_scheduledStartAt_idx" ON "TrialLesson"("studentId", "status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "TrialLesson_proposedBy_idx" ON "TrialLesson"("proposedBy");

-- CreateIndex
CREATE INDEX "Review_revieweeId_createdAt_idx" ON "Review"("revieweeId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_reviewerId_createdAt_idx" ON "Review"("reviewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_trialLessonId_reviewerId_key" ON "Review"("trialLessonId", "reviewerId");
