PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

CREATE TABLE courses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    teacher_id INTEGER NULL REFERENCES users(id)
);

INSERT INTO courses_new (id, name, description, teacher_id)
SELECT id, name, description, teacher_id FROM courses;

DROP TABLE courses;
ALTER TABLE courses_new RENAME TO courses;

COMMIT;
PRAGMA foreign_keys=on;

