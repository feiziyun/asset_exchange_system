import io
import tarfile
import unittest
import zipfile

from scripts.pre_publish_helper import _normalize_entries


class PreArchiveTest(unittest.TestCase):
    def test_zip_and_tar_sources(self):
        content = b"asset-data"
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as archive:
            archive.writestr("nested/data.csv", content)

        for mode in ("w", "w:gz"):
            tar_buffer = io.BytesIO()
            with tarfile.open(fileobj=tar_buffer, mode=mode) as archive:
                info = tarfile.TarInfo("nested/data.csv")
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
            self.assertEqual(_normalize_entries(tar_buffer.getvalue(), "source"), {"nested/data.csv": content})

        self.assertEqual(_normalize_entries(zip_buffer.getvalue(), "source"), {"nested/data.csv": content})

    def test_rejects_parent_directory(self):
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as archive:
            archive.writestr("../data.csv", b"unsafe")

        with self.assertRaises(SystemExit):
            _normalize_entries(zip_buffer.getvalue(), "source")


if __name__ == "__main__":
    unittest.main()
