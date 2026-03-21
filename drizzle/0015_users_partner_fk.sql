DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_partner_id_partners_id_fk'
      AND table_name = 'users'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_partners_id_fk"
      FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
