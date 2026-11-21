CREATE TABLE "pantry_items" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"category" text,
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"servings" integer,
	"total_minutes" integer,
	"ingredients" jsonb DEFAULT '[]' NOT NULL,
	"steps" jsonb DEFAULT '[]' NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"category" text,
	"checked" boolean DEFAULT false NOT NULL,
	"recipe_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_recipe_id_recipes_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE SET NULL;