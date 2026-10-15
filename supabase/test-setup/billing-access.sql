-- billing-access.sql — TEST PROJECT (aligned-test) ONLY. Run after 0014.
-- Lets the fictional test coach manage billing. (On the live site, the same
-- line with your own email is how you'd switch billing on for yourself.)
update public.profiles set can_manage_billing = true where email = 'coach.test@example.com';
select email, role, can_manage_billing from public.profiles where can_manage_billing;
