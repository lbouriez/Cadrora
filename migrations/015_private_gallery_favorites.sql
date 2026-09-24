-- One shared favorite state per photo. Public galleries never expose or mutate it.
ALTER TABLE photos ADD COLUMN liked INTEGER NOT NULL DEFAULT 0 CHECK (liked IN (0, 1));
