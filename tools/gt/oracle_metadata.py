"""Export metadata for named tables in the connected Oracle user's own schema."""
import argparse
import json
import os
import sys


def export(connection, tables, modules):
    names = sorted(set(tables))
    binds = {f"t{i}": name for i, name in enumerate(names)}
    placeholders = ",".join(":" + key for key in binds)
    columns = {name: [] for name in names}
    with connection.cursor() as cursor:
        cursor.execute(
            f"select table_name,column_name from user_tab_columns where table_name in ({placeholders}) order by table_name,column_id", binds)
        for table, column in cursor:
            columns[table].append(column)
        if any(not cols or len(cols) > 60 for cols in columns.values()):
            raise ValueError("Seçilen bir tablo bulunamadı veya 60 sütun sınırını aştı.")
        cursor.execute(f"""
            select c.table_name,a.column_name,p.table_name,b.column_name
            from user_constraints c
            join user_cons_columns a on a.constraint_name=c.constraint_name
            join user_constraints p on p.constraint_name=c.r_constraint_name
            join user_cons_columns b on b.constraint_name=p.constraint_name and b.position=a.position
            where c.constraint_type='R' and c.r_owner=user
              and c.table_name in ({placeholders}) and p.table_name in ({placeholders})
            order by c.constraint_name,a.position""", binds)
        links = [[f"{child}.{fk}", f"{parent}.{pk}"] for child, fk, parent, pk in cursor]
    if len(links) > 200:
        raise ValueError("İlişki sınırı aşıldı; daha küçük bir modül seçin.")
    return {"platform":"Oracle","modules":modules,"tables":[{"name":n,"columns":columns[n]} for n in names],"links":links,"signals":[]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tables", nargs="+", required=True)
    parser.add_argument("--modules", nargs="+", required=True)
    args = parser.parse_args()
    if len(args.tables) > 100 or len(args.modules) > 40:
        parser.error("En fazla 100 tablo ve 40 modül seçin.")
    import oracledb
    with oracledb.connect(user=os.environ["GT_DB_USER"], password=os.environ["GT_DB_PASSWORD"], dsn=os.environ["GT_DB_DSN"]) as db:
        result = json.dumps(export(db, args.tables, args.modules), ensure_ascii=False)
        if len(result.encode()) > 64000:
            sys.exit("Çıktı 64 KB sınırını aşıyor.")
        print(result)
