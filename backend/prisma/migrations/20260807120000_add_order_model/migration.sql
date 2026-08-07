-- TutorPlatform MVP V2: add the commercial Order record and optional
-- TrialLesson linkage. Historical monetary values and order links remain null.

BEGIN;

CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "demandId" INTEGER NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "totalAmount" INTEGER,
    "platformFee" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TrialLesson"
ADD COLUMN "orderId" INTEGER;

CREATE UNIQUE INDEX "Order_demandId_key"
ON "Order"("demandId");

CREATE UNIQUE INDEX "Order_applicationId_key"
ON "Order"("applicationId");

CREATE INDEX "Order_parentId_status_createdAt_idx"
ON "Order"("parentId", "status", "createdAt");

CREATE INDEX "Order_studentId_status_createdAt_idx"
ON "Order"("studentId", "status", "createdAt");

CREATE INDEX "Order_status_createdAt_idx"
ON "Order"("status", "createdAt");

CREATE INDEX "TrialLesson_orderId_status_idx"
ON "TrialLesson"("orderId", "status");

ALTER TABLE "Order"
ADD CONSTRAINT "Order_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_demandId_fkey"
FOREIGN KEY ("demandId") REFERENCES "Demand"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrialLesson"
ADD CONSTRAINT "TrialLesson_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
