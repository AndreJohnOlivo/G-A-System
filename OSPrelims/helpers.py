from collections import defaultdict
def compute_metrics_from_records(schedule, processes=None):
    """Compute per-process and average metrics from a schedule.

    schedule: list of (pid, start, end)
    processes: optional list of Process objects with `pid`, `arrival_time`, `burst_time`
    """
    entries = defaultdict(list)
    for pid, start, end in schedule:
        entries[pid].append((start, end))

    proc_map = {}
    if processes:
        for p in processes:
            proc_map[p.pid] = p

    metrics = {}
    total_turnaround = total_waiting = total_response = 0
    n = len(entries)

    for pid, recs in entries.items():
        recs.sort()
        first_start = recs[0][0]
        finish_time = max(e for _, e in recs)
        burst = sum(e - s for s, e in recs)
        arrival = proc_map[pid].arrival_time if pid in proc_map else recs[0][0]
        response = first_start - arrival
        turnaround = finish_time - arrival
        waiting = turnaround - burst
        metrics[pid] = {
            'arrival': arrival,
            'burst': burst,
            'response': response,
            'turnaround': turnaround,
            'waiting': waiting,
            'finish': finish_time,
        }
        total_turnaround += turnaround
        total_waiting += waiting
        total_response += response

    averages = {
        'avg_turnaround': (total_turnaround / n) if n else 0,
        'avg_waiting': (total_waiting / n) if n else 0,
        'avg_response': (total_response / n) if n else 0,
    }
    return {'per_process': metrics, 'averages': averages}

def gantt_chart(schedule):
    """Print a simple ASCII Gantt chart from schedule list (pid, start, end)."""
    if not schedule:
        print("(empty schedule)")
        return
    # normalize and sort
    sched = sorted(schedule, key=lambda x: x[1])
    min_start = min(s for _, s, _ in sched)
    max_end = max(e for _, _, e in sched)
    # Build timeline per unit time
    timeline = []
    for t in range(min_start, max_end):
        # find pid running at time t (pick first matching interval)
        pid_at_t = '.'
        for pid, s, e in sched:
            if s <= t < e:
                pid_at_t = str(pid)
                break
        timeline.append(pid_at_t)

    # print header
    print("Gantt chart:")
    # time axis
    axis = ' '.join(str(t) for t in range(min_start, max_end))
    print('Time:   ', axis)
    print('PIDs:   ', ' '.join(timeline))
