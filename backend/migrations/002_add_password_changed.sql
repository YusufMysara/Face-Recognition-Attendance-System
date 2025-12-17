-- Migration to add password_changed field to users table
ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0;