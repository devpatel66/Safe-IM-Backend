CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"gst_number" text,
	"address" text,
	"phone" text,
	"email" text,
	"created_at" timestamp DEFAULT now()
);
