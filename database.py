
import sqlite3
import string
import random

DATABASE_NAME = "database.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_database():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS priority_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            uses_remaining INTEGER NOT NULL,
            total_uses INTEGER NOT NULL
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processing_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            queue_position INTEGER NOT NULL,
            is_priority BOOLEAN DEFAULT FALSE,
            total_frames INTEGER NOT NULL,
            completed_frames INTEGER DEFAULT 0
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS job_frames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT NOT NULL,
            frame_order INTEGER NOT NULL,
            status TEXT NOT NULL,
            image_data BLOB NOT NULL,
            result_data BLOB,
            FOREIGN KEY (job_id) REFERENCES processing_jobs (job_id)
        )
    ''')
    conn.commit()
    conn.close()

# --- Code Management ---

def generate_code(length=8):
    characters = string.ascii_letters + string.digits
    while True:
        code = ''.join(random.choice(characters) for i in range(length))
        conn = get_db_connection()
        if conn.execute("SELECT code FROM priority_codes WHERE code = ?", (code,)).fetchone() is None:
            conn.close()
            return code
        conn.close()

def add_code(code, uses):
    conn = get_db_connection()
    conn.execute("INSERT INTO priority_codes (code, uses_remaining, total_uses) VALUES (?, ?, ?)", (code, uses, uses))
    conn.commit()
    conn.close()

def get_all_codes():
    """Retrieves all active priority codes."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT code, uses_remaining, total_uses FROM priority_codes ORDER BY id DESC")
    codes = cursor.fetchall()
    conn.close()
    return [dict(row) for row in codes]

def delete_code(code):
    """Deletes a priority code from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM priority_codes WHERE code = ?", (code,))
    conn.commit()
    conn.close()

def validate_code(code):
    conn = get_db_connection()
    result = conn.execute("SELECT uses_remaining FROM priority_codes WHERE code = ?", (code,)).fetchone()
    conn.close()
    return result and result['uses_remaining'] > 0

def use_code(code):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT uses_remaining FROM priority_codes WHERE code = ?", (code,))
    result = cursor.fetchone()
    if result:
        new_uses = result['uses_remaining'] - 1
        if new_uses > 0:
            cursor.execute("UPDATE priority_codes SET uses_remaining = ? WHERE code = ?", (new_uses, code))
        else:
            cursor.execute("DELETE FROM priority_codes WHERE code = ?", (code,))
        conn.commit()
    conn.close()

# --- Job and Frame Management ---
# ... (rest of the file is unchanged)
def add_job_and_frames(job_id, frames_data):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Calculate initial queue position
    queue_position = cursor.execute("SELECT COUNT(*) FROM processing_jobs WHERE status IN ('queued', 'processing')").fetchone()[0] + 1

    # Add the main job entry
    cursor.execute(
        "INSERT INTO processing_jobs (job_id, status, queue_position, total_frames) VALUES (?, ?, ?, ?)",
        (job_id, "queued", queue_position, len(frames_data))
    )

    # Add all the frames
    for i, frame_blob in enumerate(frames_data):
        cursor.execute(
            "INSERT INTO job_frames (job_id, frame_order, status, image_data) VALUES (?, ?, ?, ?)",
            (job_id, i, "queued", frame_blob)
        )

    conn.commit()
    conn.close()
    return queue_position

def get_job_status(job_id):
    conn = get_db_connection()
    job = conn.execute("SELECT * FROM processing_jobs WHERE job_id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return None

    if job['status'] == 'completed':
        frames = conn.execute("SELECT result_data FROM job_frames WHERE job_id = ? ORDER BY frame_order ASC", (job_id,)).fetchall()
        conn.close()
        return {'status': 'completed', 'frames': [f['result_data'] for f in frames]}

    conn.close()
    return dict(job)

def get_next_frame_to_process():
    conn = get_db_connection()
    # Find the job with the lowest queue position that is not yet completed
    cursor = conn.cursor()
    cursor.execute("""
        SELECT jf.*
        FROM job_frames jf
        JOIN processing_jobs pj ON jf.job_id = pj.job_id
        WHERE jf.status = 'queued' AND pj.queue_position > 0
        ORDER BY pj.queue_position ASC, jf.frame_order ASC
        LIMIT 1
    """)
    frame = cursor.fetchone()
    conn.close()
    return frame

def update_frame_as_completed(job_id, frame_order, result_data):
    conn = get_db_connection()
    cursor = conn.cursor()

    # Update the specific frame
    cursor.execute(
        "UPDATE job_frames SET status = 'completed', result_data = ? WHERE job_id = ? AND frame_order = ?",
        (result_data, job_id, frame_order)
    )

    # Increment the completed_frames count on the main job
    cursor.execute("UPDATE processing_jobs SET completed_frames = completed_frames + 1 WHERE job_id = ?", (job_id,))

    # Check if the entire job is now complete
    job = cursor.execute("SELECT total_frames, completed_frames FROM processing_jobs WHERE job_id = ?", (job_id,)).fetchone()
    if job['completed_frames'] >= job['total_frames']:
        cursor.execute("UPDATE processing_jobs SET status = 'completed', queue_position = 0 WHERE job_id = ?", (job_id,))
        # Reorder the queue
        cursor.execute("UPDATE processing_jobs SET queue_position = queue_position - 1 WHERE queue_position > (SELECT queue_position FROM processing_jobs WHERE job_id = ?)", (job_id,))

    conn.commit()
    conn.close()

def update_frame_status(job_id, frame_order, status):
    conn = get_db_connection()
    conn.execute("UPDATE job_frames SET status = ? WHERE job_id = ? AND frame_order = ?", (status, job_id, frame_order))
    conn.commit()
    conn.close()

def apply_priority_code_and_reorder(job_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT queue_position, is_priority FROM processing_jobs WHERE queue_position > 0 ORDER BY queue_position ASC")
    all_jobs = cursor.fetchall()

    last_priority_pos = 0
    for job in all_jobs:
        if job['is_priority']:
            last_priority_pos = job['queue_position']

    target_pos = max(1, last_priority_pos + 3)
    if target_pos > len(all_jobs):
        target_pos = len(all_jobs)

    cursor.execute("UPDATE processing_jobs SET queue_position = queue_position + 1 WHERE queue_position >= ?", (target_pos,))
    cursor.execute("UPDATE processing_jobs SET is_priority = TRUE, queue_position = ? WHERE job_id = ?", (target_pos, job_id))

    # Re-normalize queue positions
    cursor.execute("SELECT job_id FROM processing_jobs WHERE queue_position > 0 ORDER BY queue_position ASC")
    sorted_jobs = cursor.fetchall()
    for i, job in enumerate(sorted_jobs):
        cursor.execute("UPDATE processing_jobs SET queue_position = ? WHERE job_id = ?", (i + 1, job['job_id']))

    cursor.execute("SELECT queue_position FROM processing_jobs WHERE job_id = ?", (job_id,))
    final_position = cursor.fetchone()['queue_position']

    conn.commit()
    conn.close()
    return final_position

# Initialize DB on import
initialize_database()
