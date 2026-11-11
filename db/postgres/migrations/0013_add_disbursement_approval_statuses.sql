ALTER TABLE "disbursements" DROP CONSTRAINT IF EXISTS "disbursements_status_check";
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_status_check" CHECK ("status" in ('draft','pending_approval','confirmed','active_borrow','partially_returned','returned','reversed','cancelled','rejected'));
