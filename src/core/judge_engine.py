"""Local compilation and bounded execution. This is not an OS security sandbox."""
import math
import os
import signal
import subprocess
import tempfile
import threading
import time
from pathlib import Path

MAX_OUTPUT = 1024 * 1024
MAX_TESTS = 100
_slots = threading.BoundedSemaphore(2)


def parse_time_limit(value):
    try:
        value = float(str(value).strip().lower().removesuffix('s').strip())
    except (TypeError, ValueError):
        raise ValueError('Giới hạn thời gian phải là số giây hợp lệ.')
    if not math.isfinite(value) or not 0.05 <= value <= 10:
        raise ValueError('Giới hạn thời gian phải từ 0.05 đến 10 giây.')
    return value


def result(status, stdout='', stderr='', duration=0):
    return {'status': status, 'stdout': stdout, 'output': stdout, 'stderr': stderr,
            'error': stderr, 'compile_error': stderr if status == 'CE' else '',
            'execution_time': round(duration, 3), 'time': round(duration, 3)}


def _terminate(process):
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                       timeout=5, creationflags=subprocess.CREATE_NO_WINDOW)
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    if process.poll() is None:
        process.kill()
    process.wait(timeout=5)


def _run(command, stdin, limit, directory, environment):
    """Use files instead of unbounded pipes, with an output cap and a wall clock deadline."""
    input_path, out_path, err_path = [directory / name for name in ('stdin.txt', 'stdout.txt', 'stderr.txt')]
    input_path.write_text(stdin, encoding='utf-8')
    started = time.perf_counter()
    status = 'OK'
    process = None
    with input_path.open('rb') as source, out_path.open('wb') as out, err_path.open('wb') as err:
        try:
            process = subprocess.Popen(command, stdin=source, stdout=out, stderr=err,
                                       cwd=directory, env=environment,
                                       start_new_session=os.name != 'nt',
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            while process.poll() is None:
                if out_path.stat().st_size + err_path.stat().st_size > MAX_OUTPUT:
                    status = 'OLE'
                    _terminate(process)
                    break
                if time.perf_counter() - started > limit:
                    status = 'TLE'
                    _terminate(process)
                    break
                time.sleep(0.02)
            if status == 'OK' and process.returncode:
                status = 'RTE'
        finally:
            if process is not None and process.poll() is None:
                _terminate(process)
    duration = time.perf_counter() - started
    if out_path.stat().st_size + err_path.stat().st_size > MAX_OUTPUT:
        status = 'OLE'
    with out_path.open('rb') as stream:
        stdout = stream.read(MAX_OUTPUT).decode('utf-8', errors='replace')
    with err_path.open('rb') as stream:
        stderr = stream.read(MAX_OUTPUT).decode('utf-8', errors='replace')
    if status == 'TLE': stderr = f'Quá thời gian cho phép ({limit:g}s).'
    elif status == 'OLE': stderr = 'Đầu ra vượt quá giới hạn 1 MiB.'
    elif status == 'RTE' and not stderr: stderr = f'Chương trình kết thúc với mã lỗi {process.returncode}.'
    return result(status, stdout, stderr, duration)


def execute_tests(language, code, inputs, time_limit, compiler, python):
    language = str(language or 'cpp').strip().lower()
    if language in ('cpp', 'c++', 'c++14', 'c++17', 'c++20'):
        language = 'cpp'
    elif language in ('python', 'python3', 'py', 'py3'):
        language = 'python'
    else:
        return [result('CE', stderr='Ngôn ngữ không được hỗ trợ.')]
    if not isinstance(code, str) or not code.strip() or len(code.encode('utf-8')) > 256 * 1024:
        raise ValueError('Mã nguồn phải có nội dung và không vượt quá 256 KiB.')
    if not isinstance(inputs, list) or not 1 <= len(inputs) <= MAX_TESTS:
        raise ValueError(f'Mỗi lượt chấm cần từ 1 đến {MAX_TESTS} test.')
    if any(not isinstance(item, str) or len(item.encode('utf-8')) > 2 * 1024 * 1024 for item in inputs):
        raise ValueError('Dữ liệu mỗi test phải là chuỗi, tối đa 2 MiB.')
    limit = parse_time_limit(time_limit)
    if language == 'python': limit = max(limit * 2, 2.5)
    if language == 'cpp' and not compiler:
        return [result('SE', stderr='Chưa tìm thấy g++. Cài compiler C++ hoặc chọn máy chấm cloud.')]
    if not _slots.acquire(blocking=False):
        return [result('SE', stderr='Máy chấm đang bận. Vui lòng thử lại sau.')]
    try:
        with tempfile.TemporaryDirectory(prefix='judge_') as temporary:
            directory = Path(temporary)
            # Do not pass application credentials to submitted programs.
            env = {key: value for key, value in os.environ.items()
                   if key.upper() in {'PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'PATHEXT'}}
            env.update(PYTHONIOENCODING='utf-8', PYTHONUNBUFFERED='1')
            if language == 'cpp':
                src, exe = directory / 'solution.cpp', directory / ('solution.exe' if os.name == 'nt' else 'solution')
                src.write_text(code, encoding='utf-8')
                env['PATH'] = str(Path(compiler).parent) + os.pathsep + env.get('PATH', '')
                compiled = _run([compiler, '-O2', '-std=c++20', str(src), '-o', str(exe)], '', 20, directory, env)
                if compiled['status'] != 'OK':
                    # Only retry an unsupported standard flag, not an invalid program.
                    if 'unrecognized command-line option' in compiled['stderr'] and 'c++20' in compiled['stderr']:
                        compiled = _run([compiler, '-O2', '-std=c++17', str(src), '-o', str(exe)], '', 20, directory, env)
                    if compiled['status'] != 'OK':
                        return [result('CE', stderr=compiled['stderr'] or 'Không biên dịch được chương trình.')]
                command = [str(exe)]
            else:
                src = directory / 'solution.py'
                src.write_text(code, encoding='utf-8')
                try:
                    compile(code, 'solution.py', 'exec')
                except (SyntaxError, ValueError) as error:
                    return [result('CE', stderr=str(error))]
                command = [python, '-I', '-u', str(src)]
            results = []
            for index, stdin in enumerate(inputs):
                test_dir = directory / f'test-{index}'
                test_dir.mkdir()
                results.append(_run(command, stdin, limit, test_dir, env))
            return results
    except (OSError, subprocess.SubprocessError) as error:
        return [result('SE', stderr=f'Không thực thi được máy chấm: {error}')]
    finally:
        _slots.release()
