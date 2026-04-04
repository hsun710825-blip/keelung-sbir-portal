-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "applicationId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_applicationId_committeeId_key" ON "Evaluation"("applicationId", "committeeId");

-- CreateIndex
CREATE INDEX "Evaluation_applicationId_idx" ON "Evaluation"("applicationId");

-- CreateIndex
CREATE INDEX "Evaluation_committeeId_idx" ON "Evaluation"("committeeId");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
