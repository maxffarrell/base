CREATE TABLE "stock_item" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'supplies' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit_cost" integer,
	"reorder_level" integer DEFAULT 10,
	"location" text,
	"supplier_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"item_id" text NOT NULL,
	"direction" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"moved_at" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_supplier_id_directory_company_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."directory_company"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_item_id_stock_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."stock_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_item_org_idx" ON "stock_item" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "stock_item_supplier_idx" ON "stock_item" USING btree ("organization_id","supplier_id");--> statement-breakpoint
CREATE INDEX "stock_movement_item_idx" ON "stock_movement" USING btree ("organization_id","item_id");