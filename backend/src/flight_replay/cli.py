import typer

app = typer.Typer(help="Flight telemetry tools")


@app.callback()
def main() -> None:
    """Flight replay CLI."""


if __name__ == "__main__":
    app()
