-- R4-B9: allow a "طلب استثناء" (exception-request) approval for credit-limit breaches.
-- When credit.limit.enforce = BLOCK and a new statement projects over the customer's
-- credit limit, the statement is parked as DRAFT with a CREDIT_LIMIT approval instead
-- of hard-failing; an approver holding `credit.exception.approve` may grant the exception.
ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'CREDIT_LIMIT';
