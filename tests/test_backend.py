import ast
import json
import tempfile
import unittest
from pathlib import Path

from src.core.submission_store import save_local_submission
from src.judge_server import execute_test, GPP_CMD

ROOT = Path(__file__).resolve().parents[1]


class BackendTests(unittest.TestCase):
    def test_python_sources_parse(self):
        paths = [ROOT / 'main.py']
        for folder in ['config', 'src', 'scripts']:
            paths.extend((ROOT / folder).rglob('*.py'))
        for path in paths:
            with self.subTest(path=str(path.relative_to(ROOT))):
                ast.parse(path.read_text(encoding='utf-8-sig'))

    def test_private_submission_upsert_and_grade(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            save_local_submission(root, {'id': 'SUB-1', 'answer': 'print("Chào")'})
            save_local_submission(root, {'id': 'SUB-1', 'score': '10'})
            records = json.loads((root / 'data/private/submissions.json').read_text(encoding='utf-8'))
            self.assertEqual(len(records), 1)
            self.assertEqual(records['SUB-1']['answer'], 'print("Chào")')
            self.assertEqual(records['SUB-1']['score'], '10')
            self.assertFalse((root / 'docs').exists())

    def test_python_judge_utf8_and_isolated_working_directory(self):
        result = execute_test('python', 'from pathlib import Path\nPath("output.txt").write_text("temporary")\nprint(input())', 'Xin chào\n')
        self.assertEqual(result['status'], 'OK', result)
        self.assertEqual(result['stdout'].strip(), 'Xin chào')
        self.assertFalse((ROOT / 'output.txt').exists())

    def test_python_judge_runtime_error(self):
        result = execute_test('python', 'raise ValueError("test")', '')
        self.assertEqual(result['status'], 'RTE')

    def test_unsupported_language(self):
        self.assertEqual(execute_test('unknown', '', '')['status'], 'CE')

    @unittest.skipUnless(GPP_CMD, 'No local C++ compiler; cloud fallback is not called by offline tests')
    def test_cpp_judge(self):
        result = execute_test('cpp', '#include <iostream>\nint main(){ int a,b; std::cin>>a>>b; std::cout<<a+b; }', '15 27\n')
        self.assertEqual(result['status'], 'OK', result)
        self.assertEqual(result['stdout'].strip(), '42')


if __name__ == '__main__':
    unittest.main()
