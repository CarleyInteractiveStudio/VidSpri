import asyncio
from database import get_next_job, update_job_status

async def async_queue_worker():
    """
    An async worker that runs in the main FastAPI event loop.
    Its sole responsibility is to move jobs from 'queued' to 'processing'
    when it's their turn.
    """
    print("Async worker starting up...")

    while True:
        try:
            # Check for the next job in the queue
            job = await get_next_job()

            if job:
                print(f"  [WORKER] Job {job['job_id']} is next. Marked as 'processing'.")
                # The frontend will be notified on its next poll and will then call /process/{job_id}
            else:
                # No jobs, wait a bit before checking again
                print("  [WORKER] No jobs in queue. Sleeping.")

            # Wait for a few seconds before the next check
            await asyncio.sleep(5)

        except Exception as e:
            print(f"  [WORKER] An error occurred: {e}. Retrying in 10 seconds.")
            await asyncio.sleep(10)
