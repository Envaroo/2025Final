import sqlite3, datetime

def qToDict(crs):
    desc = crs.description
    column_names = [col[0] for col in desc]
    data = [dict(zip(column_names, row)) for row in crs.fetchall()]
    return data

class DBHandle:
    def __init__(self):
        print("DB Connection")
        self.conn = sqlite3.connect('data.db', detect_types=sqlite3.PARSE_DECLTYPES, check_same_thread=False)
        self.dbCursor = self.conn.cursor()

    def insertSessionMeta(self, duration, goal):
        start_time = datetime.datetime.now()
        self.dbCursor.execute("INSERT INTO sessionMeta (start_time, duration, goal) VALUES(?,?,?)", (start_time, duration, goal))
        self.conn.commit()
        print("SessionMeta Inserted")
        self.dbCursor.execute("SELECT session_id FROM sessionMeta ORDER BY session_id DESC LIMIT 1;")
        lastId = self.dbCursor.fetchone()
        return lastId[0]

    def maniSessionMeta(self, duration):
        self.dbCursor.execute("UPDATE sessionMeta SET duration = ? WHERE session_id = (SELECT MAX(session_id) FROM sessionMeta);", (duration,))

    def getSessionList(self):
        self.dbCursor.execute("SELECT * FROM sessionMeta")
        rows = self.dbCursor.fetchall()
        for row in rows:
            print(row)

    def get_sessions(self):
        self.dbCursor.execute("""
        SELECT session_id, start_time, goal, duration
        FROM sessionMeta
        ORDER BY session_id DESC
        """)

        return qToDict(self.dbCursor)

    def get_sid_session(self, sid):
        self.dbCursor.execute("""
        SELECT event_time, score, topic, url, type
        FROM event
        WHERE session_id = ?
        """, (sid,))
        data = qToDict(self.dbCursor)
        for r in data:
            if(r['type'] == 1): r['type'] = True
            else: r['type'] = False
        return data

    def insertEvent(self, session_id, t, url, score, topic):
        now = datetime.datetime.now()
        self.dbCursor.execute("INSERT INTO event (session_id, event_time, type, url, score, topic) VALUES(?,?,?,?,?,?)", (session_id, now, t, url, score, topic))
        self.conn.commit()
        print("event Inserted")

    def getEventList(self, session_id):
        self.dbCursor.execute("SELECT * FROM event WHERE session_id = ?", (session_id,))
        rows = self.dbCursor.fetchall()
        for row in rows:
            print(row)

    def closeConn(self):
        self.conn.close()
    
    def __del__(self):
        self.conn.close()
