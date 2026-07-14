#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(ROOT_DIR, "genrative ai")

sys.path.insert(0, PROJECT_DIR)
os.chdir(PROJECT_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myproject.settings")

from django.core.management import execute_from_command_line


def main():
    """Run administrative tasks."""
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
