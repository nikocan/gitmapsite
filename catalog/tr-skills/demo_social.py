"""Yerel örnek sağlayıcı; platforma istek göndermez."""
import sqlite3
import unittest


def publish(db, tenant, platform, account, revision, approved):
    if not approved:
        raise ValueError("İçerik sürümü için onay gerekli")
    if not db.execute("SELECT 1 FROM accounts WHERE tenant=? AND platform=? AND account=?",
                      (tenant, platform, account)).fetchone():
        raise PermissionError("Hesap bu şirkete bağlı değil")
    key = (tenant, platform, account, revision)
    with db:
        db.execute("INSERT OR IGNORE INTO publications VALUES (?,?,?,?)", key)
        return db.execute("SELECT rowid FROM publications WHERE tenant=? AND platform=? AND account=? AND revision=?", key).fetchone()[0]


class SocialDemo(unittest.TestCase):
    def test_five_providers(self):
        with sqlite3.connect(":memory:") as db:
            db.executescript("CREATE TABLE accounts(tenant,platform,account); CREATE TABLE publications(tenant,platform,account,revision, UNIQUE(tenant,platform,account,revision));")
            for platform in ("instagram","facebook","tiktok","youtube","linkedin"):
                with self.subTest(platform=platform):
                    db.execute("INSERT INTO accounts VALUES(?,?,?)", ("A",platform,"hesap"))
                    args = (platform, "hesap", "taslak42-v1")
                    with self.assertRaises(ValueError):
                        publish(db, "A", *args, False)
                    with self.assertRaises(PermissionError):
                        publish(db, "B", *args, True)
                    self.assertEqual(publish(db, "A", *args, True), publish(db, "A", *args, True))
            self.assertEqual(db.execute("SELECT COUNT(*) FROM publications").fetchone()[0], 5)


if __name__ == "__main__":
    unittest.main()
