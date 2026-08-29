import copy
import heapq
from collections import deque

# ----for FCFS scheduler----
def FCFS(processes):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0

    for proc in procs:
        if proc.arrival_time > current_time:
            current_time = proc.arrival_time
        start, end = current_time, current_time + proc.burst_time
        schedule.append((proc.pid, start, end))
        current_time = end

    return schedule

# ----for SJF (non-preemptive) scheduler----
def SJF(processes):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0
    ready_queue, i = [], 0

    while i < len(procs) or ready_queue:
        while i < len(procs) and procs[i].arrival_time <= current_time:
            heapq.heappush(ready_queue, (procs[i].burst_time, procs[i]))
            i += 1

        if not ready_queue:
            current_time = procs[i].arrival_time
            continue
        _, p = heapq.heappop(ready_queue)
        start, end = current_time, current_time + p.burst_time
        schedule.append((p.pid, start, end))
        current_time = end

    return schedule

# ----for SRTF (preemptive) scheduler----
def SRTF(processes):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0
    ready_queue, i = [], 0
    running = None
    start_time = 0

    while i < len(procs) or ready_queue or running:
        while i < len(procs) and procs[i].arrival_time <= current_time:
            heapq.heappush(ready_queue, (procs[i].remaining_time, procs[i]))
            i += 1

        if running:
            if ready_queue and ready_queue[0][0] < running.remaining_time:
                schedule.append((running.pid, start_time, current_time))
                heapq.heappush(ready_queue, (running.remaining_time, running))
                running = None

        if not running and ready_queue:
            _, running = heapq.heappop(ready_queue)
            start_time = current_time

        if not running and not ready_queue and i < len(procs):
            current_time = procs[i].arrival_time
            continue

        current_time += 1
        if running:
            running.remaining_time -= 1
            if running.remaining_time == 0:
                schedule.append((running.pid, start_time, current_time))
                running = None

    return schedule

# ----for Round Robin ----
def RoundRobin(processes, quantum):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0
    ready_queue, i = deque(), 0

    while i < len(procs) or ready_queue:
        while i < len(procs) and procs[i].arrival_time <= current_time:
            ready_queue.append(procs[i])
            i += 1
        if not ready_queue:
            current_time = procs[i].arrival_time
            continue

        p = ready_queue.popleft()
        exec_time = min(p.remaining_time, quantum)
        start, end = current_time, current_time + exec_time
        schedule.append((p.pid, start, end))
        p.remaining_time -= exec_time
        current_time = end

        while i < len(procs) and procs[i].arrival_time <= current_time:
            ready_queue.append(procs[i])
            i += 1

        if p.remaining_time > 0:
            ready_queue.append(p)

    return schedule

# --- for Priority Scheduling ---
def PriorityScheduling(processes):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0
    ready_queue, i = [], 0

    while i < len(procs) or ready_queue:
        while i < len(procs) and procs[i].arrival_time <= current_time:
            heapq.heappush(ready_queue, (procs[i].priority, procs[i]))
            i += 1
        if not ready_queue:
            current_time = procs[i].arrival_time
            continue
        _, p = heapq.heappop(ready_queue)
        start, end = current_time, current_time + p.burst_time
        schedule.append((p.pid, start, end))
        p.start_time, p.end_time, p.first_response_time = start, end, start
        current_time = end
    return schedule

# ---for HRRN(Higest Response Ratio Next) scheduler---
def HRRN(processes):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0
    ready_queue, i = [], 0

    while i < len(procs) or ready_queue:
        while i < len(procs) and procs[i].arrival_time <= current_time:
            ready_queue.append(procs[i])
            i += 1
        if not ready_queue:
            current_time = procs[i].arrival_time
            continue
        ratios = [((current_time - p.arrival_time) / p.burst_time, p) for p in ready_queue]
        ratios.sort(key=lambda x: (x[0], x[1].arrival_time))
        p = ratios[0][1]
        ready_queue.remove(p)
        start, end = current_time, current_time + p.burst_time
        schedule.append((p.pid, start, end))
        p.start_time, p.end_time, p.first_response_time = start, end, start
        current_time = end
    return schedule

# --- for MLQ(Multi Level Queue) scheduler ---
def MLQ(processes, queues=None):
    # High priority: priority <=2 runs FCFS, low priority runs RoundRobin
    high = [p for p in processes if getattr(p, 'priority', 0) <= 2]
    low = [p for p in processes if getattr(p, 'priority', 0) > 2]
    schedule = []
    schedule.extend(FCFS(high))
    schedule.extend(RoundRobin(low, quantum=2))
    return schedule

# --- for MLFQ(Multi Level Feedback Queue) scheduler ---
def MLFQ(processes, queues=None):
    procs = copy.deepcopy(processes)
    procs.sort(key=lambda x: x.arrival_time)
    schedule, current_time = [], 0
    queues = [deque(), deque(), deque()]
    quantums = [1, 2, 4]
    i = 0

    while i < len(procs) or any(queues):
        while i < len(procs) and procs[i].arrival_time <= current_time:
            queues[0].append(procs[i]); i += 1
        q_index = next((j for j, q in enumerate(queues) if q), None)
        if q_index is None:
            if i < len(procs):
                current_time = procs[i].arrival_time
            continue
        p = queues[q_index].popleft()
        if p.first_response_time is None:
            p.first_response_time = current_time
        run_time = min(p.remaining_time, quantums[q_index])
        start = current_time
        current_time += run_time
        p.remaining_time -= run_time
        end = current_time
        schedule.append((p.pid, start, end))
        while i < len(procs) and procs[i].arrival_time <= current_time:
            queues[0].append(procs[i]); i += 1
        if p.remaining_time > 0:
            if q_index < 2:
                queues[q_index + 1].append(p)
            else:
                queues[2].append(p)
        else:
            p.finish_time = current_time
    return schedule
