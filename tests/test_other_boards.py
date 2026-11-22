import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('packager',ROOT/'scripts/package_firmware.py')
pkg=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pkg)

class NonEspArtifactTests(unittest.TestCase):
    def package(self,board,ext):
        with tempfile.TemporaryDirectory() as name:
            folder=pathlib.Path(name)
            (folder/('AppDockSketch.ino'+ext)).write_bytes(b'valid firmware bytes'*7)
            return pkg.build_manifest({'board':board},folder.iterdir())

    def test_board_catalog(self):
        data=json.loads((ROOT/'boards/boards.json').read_text('utf-8'))
        self.assertEqual(len(data),31)
        self.assertEqual(len({x['id'] for x in data}),31)
        for b in data:
            self.assertTrue(b['fqbn'].startswith(b['core']+':'))

    def test_new_output_formats(self):
        profiles=[('leonardo','.hex','avr109'),('nano_every','.hex','jtag2updi'),
                  ('uno_r4_minima','.bin','dfu'),('due_programming','.bin','sam-ba'),
                  ('pico2','.uf2','uf2'),('pico2_w','.uf2','uf2'),
                  ('nano_33_iot','.bin','bossac'),('nano_33_ble','.bin','mbed')]
        for board,extension,method in profiles:
            with self.subTest(board=board):
                result=self.package(board,extension)
                self.assertEqual(result['protocol'],method)
                self.assertTrue(result['preferred'].endswith(extension))

    def test_missing_uf2_is_not_false_success(self):
        with self.assertRaises(ValueError): self.package('pico2','.bin')

    def test_missing_due_bin_is_not_false_success(self):
        with self.assertRaises(ValueError): self.package('due_native','.hex')

if __name__=='__main__':
    unittest.main()
