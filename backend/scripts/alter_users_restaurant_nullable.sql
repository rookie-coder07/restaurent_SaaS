-- Make restaurant_id nullable to allow developer/global users
ALTER TABLE users
ALTER COLUMN restaurant_id DROP NOT NULL;
