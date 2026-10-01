CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'STARTING', 'IN_PROGRESS', 'FINISHED');

CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "category" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "question" VARCHAR(300) NOT NULL,
    "correctOptionId" TEXT NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" VARCHAR(100) NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "pin" CHAR(6) NOT NULL,
    "quizId" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomPlayer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "normalizedName" VARCHAR(24) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Question_quizId_position_key" ON "Question"("quizId", "position");
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");
CREATE UNIQUE INDEX "Option_questionId_position_key" ON "Option"("questionId", "position");
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId");
CREATE UNIQUE INDEX "Room_pin_key" ON "Room"("pin");
CREATE INDEX "Room_quizId_idx" ON "Room"("quizId");
CREATE UNIQUE INDEX "RoomPlayer_roomId_normalizedName_key" ON "RoomPlayer"("roomId", "normalizedName");
CREATE INDEX "RoomPlayer_roomId_idx" ON "RoomPlayer"("roomId");

ALTER TABLE "Question" ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
