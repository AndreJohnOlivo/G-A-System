from process import Process
from schedulers_template import (
    FCFS,
    SJF,
    SRTF,
    RoundRobin,
    PriorityScheduling,
    HRRN,
    MLQ,
    MLFQ,
)
from helpers import compute_metrics_from_records, gantt_chart

def prompt_processes():
    use_preset = input("Use premade processes? (Y/n): ").strip().lower()
    if use_preset in ('', 'y', 'yes'):
        procs = [
            Process(1, 0, 5),
            Process(2, 1, 3),
            Process(3, 2, 1),
            Process(4, 4, 2)
        ]
        for p, pr in zip(procs, [2, 1, 3, 2]):
            p.priority = pr
        return procs

    # Interactive entry
    while True:
        try:
            n = int(input("How many processes do you want to enter? ").strip())
            if n <= 0:
                print("Enter a positive integer.")
                continue
            break
        except ValueError:
            print("Please enter a valid integer.")

    procs = []
    for i in range(1, n + 1):
        print(f"\nProcess #{i}")
        # PID
        while True:
            pid_input = input(f"  PID (press Enter to use {i}): ").strip()
            if pid_input == "":
                pid = i
                break
            try:
                pid = int(pid_input)
                break
            except ValueError:
                print("  PID must be an integer.")
        # arrival_time
        while True:
            at = input("  Arrival time (integer, default 0): ").strip()
            if at == "":
                arrival = 0
                break
            try:
                arrival = int(at)
                break
            except ValueError:
                print("  Please enter an integer.")
        # burst_time
        while True:
            bt = input("  Burst time (positive integer): ").strip()
            try:
                burst = int(bt)
                if burst <= 0:
                    print("  Burst must be positive.")
                    continue
                break
            except ValueError:
                print("  Please enter a positive integer.")
        # priority
        while True:
            pr = input("  Priority (integer, lower is higher priority) [default 1]: ").strip()
            if pr == "":
                priority = 1
                break
            try:
                priority = int(pr)
                break
            except ValueError:
                print("  Please enter an integer.")

        p = Process(pid, arrival, burst)
        p.priority = priority
        procs.append(p)

    return procs


procs = prompt_processes()

schedulers = {
    "FCFS": FCFS,
    "SJF": SJF,
    "SRTF": SRTF,
    "Round Robin": RoundRobin,
    "Priority Scheduling": PriorityScheduling,
    "HRRN": HRRN,
    "MLQ": MLQ
}

print("Process List:")
for proc in procs:
    print(proc)
# Run each scheduler and print its generated schedule.
for name, sched in schedulers.items():
    print(f"\nScheduler: {name}")
    try:
        if sched is RoundRobin:
            # ask for quantum
            while True:
                qin = input("Enter quantum for Round Robin (positive integer, default 2): ").strip()
                if qin == "":
                    quantum = 2
                    break
                try:
                    quantum = int(qin)
                    if quantum <= 0:
                        print("Quantum must be positive.")
                        continue
                    break
                except ValueError:
                    print("Please enter an integer.")
            schedule = sched(procs, quantum=quantum)
        elif sched is MLQ:
            schedule = sched(procs, queues=None)
        elif sched is MLFQ:
            schedule = sched(procs, queues=None)
        else:
            schedule = sched(procs)
    except TypeError:
        # Fallback call attempts (positional)
        try:
            schedule = sched(procs, 2)
        except Exception as e:
            schedule = f"Error running scheduler: {e}"
    print("Schedule:", schedule)
    if isinstance(schedule, list):
        metrics = compute_metrics_from_records(schedule, procs)
        print("Metrics:", metrics['averages'])
        gantt_chart(schedule)
    # pause before next scheduler output so user can read
    input("Press Enter to continue to next scheduler...\n")

print('\nAll schedulers complete.')
input('Press Enter to exit...')