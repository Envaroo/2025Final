import sqlite3

print("init DB")

conn = sqlite3.connect('data.db')
c = conn.cursor()
try:
    c.execute('''
        CREATE TABLE IF NOT EXISTS sessionMeta(
            session_id INTEGER PRIMARY KEY,
            start_time TEXT,
            duration INTEGER,
            goal TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS event(
            event_id INTEGER PRIMARY KEY,
            session_id INTEGER,
            event_time TEXT,
            type INTEGER,
            url TEXT,
            score REAL,
            topic TEXT,
            FOREIGN KEY (session_id)
              REFERENCES sessionMeta (session_id)
              ON DELETE CASCADE
        )
    ''')

except sqlite3.Error as e:
    print(f"ERROR: DB/{e}")
    conn.rollback()

finally:
    conn.close()

print("init DB complete.")