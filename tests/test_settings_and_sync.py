import base64
import importlib
import json
import sys
import types
import unittest
from unittest.mock import patch

# These tests exercise parsing and HTTP payloads, not dotenv or live credentials.
try:
    import dotenv
except ImportError:
    dotenv = types.ModuleType('dotenv')
    dotenv.load_dotenv = lambda *args, **kwargs: None
with patch.dict(sys.modules, {'dotenv': dotenv}):
    from config.settings import Settings
    firebase = importlib.import_module('src.sync_firebase')


class SettingsAndSyncTests(unittest.TestCase):
    def setUp(self):
        dependency = patch.dict(sys.modules, {'dotenv': dotenv})
        dependency.start()
        self.addCleanup(dependency.stop)

    def test_credentials_raw_json_and_base64(self):
        settings = Settings.__new__(Settings)
        expected = {'type': 'service_account', 'project_id': 'test'}
        for raw in [json.dumps(expected), base64.b64encode(json.dumps(expected).encode()).decode()]:
            settings.sa_raw_json = raw
            self.assertEqual(settings.get_service_account_dict(), expected)

    def test_malformed_credentials_fail_clearly(self):
        settings = Settings.__new__(Settings)
        for raw in ['[]', 'broken', '{"type": "service_account"']:
            settings.sa_raw_json = raw
            with self.assertRaises(ValueError):
                settings.get_service_account_dict()

    def test_sync_preserves_metadata_and_submission_keys(self):
        calls = []

        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass

        def request(req, **kwargs):
            calls.append(req)
            return Response()

        with patch.object(firebase.urllib.request, 'urlopen', side_effect=request), patch('config.settings.get_settings', side_effect=ValueError('test only')):
            self.assertTrue(firebase.push_full_database_to_firebase({'students': [], 'submissions': [{'id': 'SUB-1', 'answer': 'x'}], 'metadata': {'last_updated': 'test'}}))
        payload = json.loads(calls[0].data)
        self.assertEqual(payload['submissions/SUB-1']['answer'], 'x')
        self.assertEqual(payload['metadata/last_updated'], 'test')
        self.assertNotIn('metadata', payload)
        self.assertNotIn('submissions', payload)

    def test_partial_sync_failure_returns_false(self):
        calls = []

        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass

        def request(req, **kwargs):
            calls.append(req)
            if '/.json' in req.full_url or '/submissions.json' in req.full_url:
                raise OSError('simulated offline endpoint')
            return Response()

        with patch.object(firebase.urllib.request, 'urlopen', side_effect=request), patch('config.settings.get_settings', side_effect=ValueError('test only')):
            self.assertFalse(firebase.push_full_database_to_firebase({'students': [], 'submissions': [{'id': 'SUB-1'}]}))
        self.assertEqual(calls[-1].method, 'PATCH')
