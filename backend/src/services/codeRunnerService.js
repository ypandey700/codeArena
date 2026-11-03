const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec, execFile } = require('child_process');

const IMAGE_MAP = {
  python: 'python:3.12-slim',
  javascript: 'node:20-alpine',
  cpp: 'gcc:13',
  java: 'eclipse-temurin:21-jdk',
};

const FILE_NAME_MAP = {
  python: 'solution.py',
  javascript: 'solution.js',
  cpp: 'solution.cpp',
  java: 'Main.java',
};

class ExecutionQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  async processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      this.processNext();
    }
  }
}

const queue = new ExecutionQueue(3);

function truncate(str, maxBytes = 10240) {
  if (!str) return '';
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  return buf.subarray(0, maxBytes).toString('utf8');
}

function normalize(str) {
  if (!str) return '';
  return str.replace(/\r\n/g, '\n').trim();
}

function createRunnerScript() {
  return `#!/bin/sh
LANG=$1
TIME_LIMIT=$2
TEST_COUNT=$3

if [ "$LANG" = "cpp" ]; then
  g++ -O2 /app/solution.cpp -o /app/solution > /app/compile.log 2>&1
  if [ $? -ne 0 ]; then
    echo "COMPILE_ERROR" > /app/result.status
    exit 0
  fi
elif [ "$LANG" = "java" ]; then
  javac /app/Main.java > /app/compile.log 2>&1
  if [ $? -ne 0 ]; then
    echo "COMPILE_ERROR" > /app/result.status
    exit 0
  fi
elif [ "$LANG" = "python" ]; then
  python3 -m py_compile /app/solution.py > /app/compile.log 2>&1
  if [ $? -ne 0 ]; then
    echo "COMPILE_ERROR" > /app/result.status
    exit 0
  fi
elif [ "$LANG" = "javascript" ]; then
  node --check /app/solution.js > /app/compile.log 2>&1
  if [ $? -ne 0 ]; then
    echo "COMPILE_ERROR" > /app/result.status
    exit 0
  fi
fi

echo "COMPILED" > /app/result.status

i=0
while [ $i -lt $TEST_COUNT ]; do
  IN_FILE="/app/in_\${i}.txt"
  OUT_FILE="/app/out_\${i}.txt"
  ERR_FILE="/app/err_\${i}.txt"
  META_FILE="/app/meta_\${i}.txt"

  if [ "$LANG" = "javascript" ]; then
    START=$(node -e 'process.stdout.write(Date.now().toString())' 2>/dev/null || date +%s)
    timeout -s KILL $TIME_LIMIT node /app/solution.js < "$IN_FILE" > "$OUT_FILE" 2> "$ERR_FILE"
    EXIT_CODE=$?
    END=$(node -e 'process.stdout.write(Date.now().toString())' 2>/dev/null || date +%s)
    TIME_MS=$((END - START))
  elif [ "$LANG" = "python" ]; then
    START=$(date +%s%3N 2>/dev/null || date +%s)
    timeout -s KILL $TIME_LIMIT python3 /app/solution.py < "$IN_FILE" > "$OUT_FILE" 2> "$ERR_FILE"
    EXIT_CODE=$?
    END=$(date +%s%3N 2>/dev/null || date +%s)
    TIME_MS=$((END - START))
  elif [ "$LANG" = "cpp" ]; then
    START=$(date +%s%3N 2>/dev/null || date +%s)
    timeout -s KILL $TIME_LIMIT /app/solution < "$IN_FILE" > "$OUT_FILE" 2> "$ERR_FILE"
    EXIT_CODE=$?
    END=$(date +%s%3N 2>/dev/null || date +%s)
    TIME_MS=$((END - START))
  elif [ "$LANG" = "java" ]; then
    START=$(date +%s%3N 2>/dev/null || date +%s)
    timeout -s KILL $TIME_LIMIT java -cp /app Main < "$IN_FILE" > "$OUT_FILE" 2> "$ERR_FILE"
    EXIT_CODE=$?
    END=$(date +%s%3N 2>/dev/null || date +%s)
    TIME_MS=$((END - START))
  fi

  echo "$EXIT_CODE $TIME_MS" > "$META_FILE"
  if [ $EXIT_CODE -ne 0 ]; then
    break
  fi
  i=$((i + 1))
done
`;
}

function runContainerTask({ language, code, testCases, timeLimitMs = 2000, memoryLimitMb = 256 }) {
  return new Promise((resolve) => {
    const image = IMAGE_MAP[language];
    if (!image) {
      return resolve({
        status: 'runtime_error',
        error: `Unsupported language: ${language}`,
        testResults: [],
        passedCount: 0,
        totalCount: testCases ? testCases.length : 0,
        executionTimeMs: 0,
      });
    }

    const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const containerName = `code-runner-${uniqueId}`;
    const baseTmpDir = path.resolve(__dirname, '../../.tmp');

    if (!fs.existsSync(baseTmpDir)) {
      fs.mkdirSync(baseTmpDir, { recursive: true });
    }

    const tmpDir = path.join(baseTmpDir, uniqueId);
    fs.mkdirSync(tmpDir, { recursive: true });

    const sourceFileName = FILE_NAME_MAP[language];
    fs.writeFileSync(path.join(tmpDir, sourceFileName), code || '', 'utf8');

    const effectiveTests = Array.isArray(testCases) && testCases.length > 0 ? testCases : [{ input: '', expectedOutput: '' }];
    effectiveTests.forEach((tc, idx) => {
      fs.writeFileSync(path.join(tmpDir, `in_${idx}.txt`), tc.input || '', 'utf8');
    });

    const runnerScriptPath = path.join(tmpDir, 'runner.sh');
    fs.writeFileSync(runnerScriptPath, createRunnerScript(), { mode: 0o755 });

    const timeLimitSec = Math.max(1, Math.ceil(timeLimitMs / 1000));
    const totalTimeoutMs = Math.max(10000, timeLimitMs * effectiveTests.length + 10000);
    const userFlag = process.getuid ? `${process.getuid()}:${process.getgid()}` : '1000:1000';

    const dockerArgs = [
      'run',
      '--name',
      containerName,
      '--network',
      'none',
      '--memory',
      `${memoryLimitMb}m`,
      '--cpus',
      '1',
      '--pids-limit',
      '64',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,size=64m',
      '--user',
      userFlag,
      '-v',
      `${tmpDir}:/app:rw`,
      '-w',
      '/app',
      image,
      'sh',
      '/app/runner.sh',
      language,
      String(timeLimitSec),
      String(effectiveTests.length),
    ];

    let timedOut = false;
    const startWallTime = Date.now();

    const killTimer = setTimeout(() => {
      timedOut = true;
      exec(`docker kill ${containerName}`, () => {});
    }, totalTimeoutMs);

    execFile('docker', dockerArgs, (dockerErr) => {
      clearTimeout(killTimer);
      const executionTimeMs = Date.now() - startWallTime;

      try {
        if (timedOut) {
          return resolve({
            status: 'time_limit',
            error: 'Time Limit Exceeded',
            testResults: [],
            passedCount: 0,
            totalCount: effectiveTests.length,
            executionTimeMs,
          });
        }

        const statusFilePath = path.join(tmpDir, 'result.status');
        const compileLogPath = path.join(tmpDir, 'compile.log');

        let compileStatus = '';
        if (fs.existsSync(statusFilePath)) {
          compileStatus = fs.readFileSync(statusFilePath, 'utf8').trim();
        }

        if (compileStatus === 'COMPILE_ERROR') {
          const compileLog = fs.existsSync(compileLogPath)
            ? truncate(fs.readFileSync(compileLogPath, 'utf8'))
            : 'Compilation failed';

          return resolve({
            status: 'compile_error',
            error: compileLog,
            testResults: [],
            passedCount: 0,
            totalCount: effectiveTests.length,
            executionTimeMs,
          });
        }

        const testResults = [];
        let firstFailingStatus = null;
        let firstErrorMessage = '';

        for (let i = 0; i < effectiveTests.length; i++) {
          const metaPath = path.join(tmpDir, `meta_${i}.txt`);
          const outPath = path.join(tmpDir, `out_${i}.txt`);
          const errPath = path.join(tmpDir, `err_${i}.txt`);

          if (!fs.existsSync(metaPath)) {
            testResults.push({
              passed: false,
              output: '',
              expected: effectiveTests[i].expectedOutput || '',
              timeMs: 0,
            });
            continue;
          }

          const metaContent = fs.readFileSync(metaPath, 'utf8').trim();
          const [exitCodeStr, timeMsStr] = metaContent.split(/\s+/);
          const exitCode = parseInt(exitCodeStr, 10);
          const timeMs = parseInt(timeMsStr, 10) || 0;

          const output = fs.existsSync(outPath) ? truncate(fs.readFileSync(outPath, 'utf8')) : '';
          const err = fs.existsSync(errPath) ? truncate(fs.readFileSync(errPath, 'utf8')) : '';
          const expected = effectiveTests[i].expectedOutput || '';

          if (exitCode === 124 || exitCode === 137 || exitCode === 143) {
            testResults.push({
              passed: false,
              output,
              expected,
              timeMs,
            });
            if (!firstFailingStatus) {
              firstFailingStatus = 'time_limit';
              firstErrorMessage = 'Time Limit Exceeded';
            }
          } else if (exitCode !== 0) {
            testResults.push({
              passed: false,
              output: err || output,
              expected,
              timeMs,
            });
            if (!firstFailingStatus) {
              firstFailingStatus = 'runtime_error';
              firstErrorMessage = err || 'Runtime Error';
            }
          } else {
            const passed = normalize(output) === normalize(expected);
            testResults.push({
              passed,
              output,
              expected,
              timeMs,
            });
            if (!passed && !firstFailingStatus) {
              firstFailingStatus = 'wrong_answer';
              firstErrorMessage = 'Wrong Answer';
            }
          }
        }

        const passedCount = testResults.filter((t) => t.passed).length;
        const finalStatus =
          passedCount === effectiveTests.length
            ? 'accepted'
            : firstFailingStatus || 'wrong_answer';

        return resolve({
          status: finalStatus,
          error: firstErrorMessage,
          testResults,
          passedCount,
          totalCount: effectiveTests.length,
          executionTimeMs,
        });
      } finally {
        exec(`docker rm -f ${containerName}`, () => {});
        fs.rm(tmpDir, { recursive: true, force: true }, () => {});
      }
    });
  });
}

function runSubmission(params) {
  return queue.enqueue(() => runContainerTask(params));
}

module.exports = {
  runSubmission,
};
