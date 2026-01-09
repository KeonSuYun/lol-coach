"""
Centralized logging configuration for HexCoach backend.
Provides a standardized logger instance for all modules.
"""

import sys
from loguru import logger
from pathlib import Path

# Remove default handler
logger.remove()

# Add colored console output
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO",
    colorize=True
)

# Determine log directory
current_dir = Path(__file__).resolve().parent.parent
log_dir = current_dir / "logs"
log_dir.mkdir(exist_ok=True)

# Add daily log file rotation (30-day retention)
logger.add(
    log_dir / "hexcoach_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="30 days",
    compression="zip",
    level="DEBUG",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    encoding="utf-8"
)

# Add separate error log file (90-day retention)
logger.add(
    log_dir / "errors_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="90 days",
    compression="zip",
    level="ERROR",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    encoding="utf-8"
)

__all__ = ["logger"]
