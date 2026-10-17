-- R3-C15 (§5.10): split the generic WALLET receipt/payment method into the two
-- electronic wallets named by the spec: فودافون كاش (VODAFONE_CASH) and إنستاباي (INSTAPAY).
-- WALLET is kept for backward compatibility with existing rows.
ALTER TYPE public."PaymentMethod" ADD VALUE IF NOT EXISTS 'VODAFONE_CASH';
ALTER TYPE public."PaymentMethod" ADD VALUE IF NOT EXISTS 'INSTAPAY';
