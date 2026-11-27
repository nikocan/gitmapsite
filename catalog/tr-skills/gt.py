"""GT meslek kataloğu. Python 3, harici paket gerektirmez."""
import argparse
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def catalogue():
    with (ROOT / "meslekler.csv").open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def brief(row):
    skill = ROOT / "packs" / row["paket"] / "SKILL.md"
    return f"# {row['uygulama']}\n\nMeslek kodu {row['kod']}\n\n" + skill.read_text(encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("hedef", help="Meslek kodu veya Türkçe unvan parçası")
    args = parser.parse_args()
    rows = catalogue()
    exact = next((r for r in rows if r["kod"] == args.hedef), None)
    if exact:
        print(brief(exact))
        return
    def normalize(value):
        return value.casefold().replace("i\u0307", "i")
    matches = [r for r in rows if normalize(args.hedef) in normalize(r["meslek"])]
    if not matches:
        parser.exit(1, "Eşleşme bulunamadı.\n")
    for row in matches:
        print(row["kod"], row["uygulama"])


if __name__ == "__main__":
    main()
