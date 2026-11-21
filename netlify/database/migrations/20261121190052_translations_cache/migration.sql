CREATE TABLE "translations" (
	"id" serial PRIMARY KEY,
	"source" text NOT NULL,
	"lang" text NOT NULL,
	"translated" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translations_source_lang" UNIQUE("source","lang")
);
