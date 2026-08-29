# College Scheduler (OS Prelims)

This folder contains a simple set of CPU scheduling algorithm implementations and a runner script.

Files:
- `process.py` - `Process` class definition
- `schedulers_template.py` - scheduler implementations (FCFS, SJF, SRTF, Round Robin, Priority, HRRN, MLQ, MLFQ)
- `helpers.py` - metric computation and ASCII Gantt chart
- `mainscheduler.py` - runner script that executes each scheduler and prints metrics

Build a standalone executable (optional):

1. Create and activate a virtual environment (recommended).

Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Build the executable with PyInstaller:
```powershell
pyinstaller --onefile --name CollegeScheduler mainscheduler.py
```

The generated executable will be placed under `dist/CollegeScheduler.exe` (Windows).

Run without building:
```powershell
python mainscheduler.py
```
