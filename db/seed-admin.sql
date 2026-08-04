-- Creating your first admin
--
-- Chicken-and-egg problem: only an admin can enrol people, but no admin
-- exists yet. Do this once, by hand.
--
-- STEP 1 — create the auth user through the dashboard.
--   Supabase → Authentication → Users → Add user → "Create new user"
--   Email:    your real email
--   Password: pick a strong one
--   Tick "Auto Confirm User" so it does not wait on an email link.
--
-- STEP 2 — copy the new user's UUID from that same Users list.
--
-- STEP 3 — run this in the SQL Editor, pasting the UUID and your name.

insert into profiles (id, role, full_name)
values (
  'f544b10f-ead5-4293-8a21-9a2ee5ef2a1d',
  'Laboratory Custodian',
  'Christian Henrich Garin'
);

-- Verify:
--   select p.id, p.role, p.full_name, u.email
--     from profiles p join auth.users u on u.id = p.id;
--
-- You should get exactly one row, role = admin.
--
-- After this, every other account is created through the app's admin importer.
-- Never hand-insert profiles again — the importer keeps auth.users and
-- profiles in step, and hand-editing is how you end up with orphaned rows.
