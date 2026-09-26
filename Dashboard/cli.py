# cli.py snippet
import click
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax

console = Console()

@click.command()
@click.option('--file', '-f', default='solution.py', help='Python source file to generate tests for')
def main(file):
    console.print(Panel.fit(f"[bold blue]Reading target file:[/] {file}", border_style="blue"))
    
    # Read the target file content
    try:
        with open(file, 'r') as f:
            code_content = f.read()
    except FileNotFoundError:
        console.print(f"[bold red]Error:[/] File '{file}' not found. Please create it first.")
        return

    # Display target code preview
    syntax = Syntax(code_content, "python", theme="monokai", line_numbers=True)
    console.print(Panel(syntax, title=f"Source Code: {file}", border_style="cyan"))

    # Proceed with IBM Bob 2.0 subagent test generation...

if __name__ == "__main__":
    main()