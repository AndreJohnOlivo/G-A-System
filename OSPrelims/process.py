class Process:
    def __init__(self, pid, arrival_time, burst_time):
        self.pid = pid
        self.arrival_time = arrival_time
        self.burst_time = burst_time
        self.remaining_time = burst_time
        self.first_response_time = None
        self.finish_time = None

    # Fixes heapq crash by prioritizing PID if burst/remaining times are equal
    def __lt__(self, other):
        return self.pid < other.pid

    def __repr__(self):
        return f"Process(pid={self.pid}, arrival={self.arrival_time}, burst={self.burst_time})"
