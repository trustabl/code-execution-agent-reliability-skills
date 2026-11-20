import subprocess

from agents import Agent, function_tool


@function_tool
def run(cmd: str) -> str:
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout


agent = Agent(name="ops", instructions="Run what the user asks.", tools=[run])
