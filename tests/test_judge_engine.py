import json
import threading
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from src.core import judge_engine
from src.judge_server import GPP_CMD, PYTHON_CMD, JudgeHandler


class JudgeEngineTests(unittest.TestCase):
    def execute(self, code, inputs=None, language='python', limit=1):
        return judge_engine.execute_tests(language, code, inputs or [''], limit, GPP_CMD, PYTHON_CMD)

    @unittest.skipUnless(GPP_CMD, 'Local C++ compiler not available')
    def test_cpp_batch_compiles_once(self):
        with patch.object(judge_engine, '_run', wraps=judge_engine._run) as run:
            results = self.execute('#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}', ['1 2', '4 5', '10 -2'], 'cpp')
        self.assertEqual([r['stdout'] for r in results], ['3', '9', '8'])
        self.assertEqual(sum(call.args[0][0] == GPP_CMD for call in run.call_args_list), 1)

    def test_python_syntax_error_is_ce(self):
        self.assertEqual(self.execute('if True print(1)')[0]['status'], 'CE')

    def test_testcase_working_directories_are_independent(self):
        code = 'from pathlib import Path\np=Path("state.txt")\nprint(p.exists())\np.write_text("saved")'
        self.assertEqual([r['stdout'].strip() for r in self.execute(code, ['', ''])], ['False', 'False'])

    def test_python_timeout_multiplier_is_applied_once(self):
        with patch.object(judge_engine, '_run', return_value=judge_engine.result('OK')) as run:
            self.execute('print(1)', limit=2)
        self.assertEqual(run.call_args.args[2], 4)

    def test_timeout_stops_program(self):
        self.assertEqual(self.execute('while True: pass', limit=0.05)[0]['status'], 'TLE')

    def test_output_limit(self):
        self.assertEqual(self.execute('print("x" * 1100000)')[0]['status'], 'OLE')

    def test_invalid_limits(self):
        for value in ['nan', 'inf', -1, 'abc', 100]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.execute('print(1)', limit=value)

    def test_missing_compiler_is_service_error(self):
        data = judge_engine.execute_tests('cpp', 'code', [''], 1, '', PYTHON_CMD)
        self.assertEqual(data[0]['status'], 'SE')


class JudgeHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), JudgeHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def test_batch_endpoint(self):
        payload = {'lang': 'python', 'code': 'print(int(input())*2)', 'inputs': ['3', '7'], 'time_limit': '1s'}
        req = urllib.request.Request(self.url + '/judge-batch', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as response:
            results = json.load(response)['results']
        self.assertEqual([r['stdout'].strip() for r in results], ['6', '14'])

    def test_invalid_json_returns_400_and_health_stays_responsive(self):
        req = urllib.request.Request(self.url + '/judge', data=b'[]')
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(req, timeout=5)
        self.assertEqual(caught.exception.code, 400)
        caught.exception.close()
        with urllib.request.urlopen(self.url + '/health', timeout=5) as response:
            self.assertTrue(json.load(response)['batch'])
