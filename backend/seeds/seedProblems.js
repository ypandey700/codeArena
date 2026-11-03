require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Problem = require('../src/models/Problem');

const problems = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'easy',
    category: 'dsa',
    tags: ['array', 'hash-table'],
    constraints: '2 <= n <= 10^5\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nExactly one valid answer exists.',
    description: `# Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice. Return the indices in increasing order separated by a space.

### Input Format
- Line 1: Two space-separated integers \`n\` and \`target\` (number of elements and target sum).
- Line 2: \`n\` space-separated integers representing the array.

### Output Format
- Print the two 0-based indices separated by a space (e.g. \`0 1\`).`,
    sampleTestCases: [
      {
        input: '4 9\n2 7 11 15\n',
        expectedOutput: '0 1',
      },
      {
        input: '3 6\n3 2 4\n',
        expectedOutput: '1 2',
      },
    ],
    hiddenTestCases: [
      {
        input: '2 6\n3 3\n',
        expectedOutput: '0 1',
      },
      {
        input: '5 10\n1 2 3 7 11\n',
        expectedOutput: '2 3',
      },
      {
        input: '4 0\n-3 4 3 90\n',
        expectedOutput: '0 2',
      },
      {
        input: '6 100\n10 20 30 40 50 60\n',
        expectedOutput: '3 5',
      },
      {
        input: '5 -8\n-1 -2 -3 -5 -8\n',
        expectedOutput: '2 3',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    target = int(tokens[1])
    nums = [int(x) for x in tokens[2:2 + n]]
    
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            print(f"{seen[diff]} {i}")
            return
        seen[num] = i

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
  if (!input || input.length < 2 || input[0] === '') return;
  const n = parseInt(input[0], 10);
  const target = parseInt(input[1], 10);
  const nums = input.slice(2, 2 + n).map(Number);

  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (seen.has(diff)) {
      console.log(\`\${seen.get(diff)} \${i}\`);
      return;
    }
    seen.set(nums[i], i);
  }
}

solve();
`,
      cpp: `#include <iostream>
#include <vector>
#include <unordered_map>

using namespace std;

int main() {
    int n;
    long long target;
    if (!(cin >> n >> target)) return 0;
    vector<long long> nums(n);
    unordered_map<long long, int> seen;
    for (int i = 0; i < n; i++) {
        cin >> nums[i];
        long long diff = target - nums[i];
        if (seen.count(diff)) {
            cout << seen[diff] << " " << i << endl;
            return 0;
        }
        seen[nums[i]] = i;
    }
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNextInt()) return;
        int n = scanner.nextInt();
        long target = scanner.nextLong();
        long[] nums = new long[n];
        Map<Long, Integer> seen = new HashMap<>();
        for (int i = 0; i < n; i++) {
            nums[i] = scanner.nextLong();
            long diff = target - nums[i];
            if (seen.containsKey(diff)) {
                System.out.println(seen.get(diff) + " " + i);
                return;
            }
            seen.put(nums[i], i);
        }
    }
}
`,
    },
  },
  {
    title: 'Reverse String',
    slug: 'reverse-string',
    difficulty: 'easy',
    category: 'dsa',
    tags: ['string', 'two-pointers'],
    constraints: '1 <= s.length <= 10^5\nString contains printable ASCII characters.',
    description: `# Reverse String

Write a program that takes a string \`s\` as input and prints the string in reverse order.

### Input Format
- A single line containing the string \`s\`.

### Output Format
- Print the reversed string on a single line.`,
    sampleTestCases: [
      {
        input: 'hello\n',
        expectedOutput: 'olleh',
      },
      {
        input: 'CodingArena\n',
        expectedOutput: 'anerAgnidoC',
      },
    ],
    hiddenTestCases: [
      {
        input: 'racecar\n',
        expectedOutput: 'racecar',
      },
      {
        input: 'a\n',
        expectedOutput: 'a',
      },
      {
        input: '1234567890\n',
        expectedOutput: '0987654321',
      },
      {
        input: 'algorithm\n',
        expectedOutput: 'mhtirogla',
      },
      {
        input: 'OpenAI Google Anthropic\n',
        expectedOutput: 'ciporhtnA elgooG IAnepO',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    s = sys.stdin.read().rstrip('\\r\\n')
    print(s[::-1])

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const input = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
  console.log(input.split('').reverse().join(''));
}

solve();
`,
      cpp: `#include <iostream>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    string s;
    if (!getline(cin, s)) return 0;
    reverse(s.begin(), s.end());
    cout << s << endl;
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNextLine()) return;
        String s = scanner.nextLine();
        StringBuilder sb = new StringBuilder(s);
        System.out.println(sb.reverse().toString());
    }
}
`,
    },
  },
  {
    title: 'FizzBuzz',
    slug: 'fizzbuzz',
    difficulty: 'easy',
    category: 'dsa',
    tags: ['math', 'simulation'],
    constraints: '1 <= n <= 10^4',
    description: `# FizzBuzz

Given an integer \`n\`, print the numbers from 1 to \`n\`, one per line, according to the following rules:
- For multiples of 3 and 5, print \`FizzBuzz\`
- For multiples of 3 (and not 5), print \`Fizz\`
- For multiples of 5 (and not 3), print \`Buzz\`
- For other numbers, print the number itself

### Input Format
- A single integer \`n\`.

### Output Format
- \`n\` lines with the corresponding outputs.`,
    sampleTestCases: [
      {
        input: '5\n',
        expectedOutput: '1\n2\nFizz\n4\nBuzz',
      },
      {
        input: '3\n',
        expectedOutput: '1\n2\nFizz',
      },
    ],
    hiddenTestCases: [
      {
        input: '1\n',
        expectedOutput: '1',
      },
      {
        input: '10\n',
        expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz',
      },
      {
        input: '15\n',
        expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz',
      },
      {
        input: '20\n',
        expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz',
      },
      {
        input: '6\n',
        expectedOutput: '1\n2\nFizz\n4\nBuzz\nFizz',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const input = fs.readFileSync(0, 'utf-8').trim();
  if (!input) return;
  const n = parseInt(input, 10);
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) {
      console.log('FizzBuzz');
    } else if (i % 3 === 0) {
      console.log('Fizz');
    } else if (i % 5 === 0) {
      console.log('Buzz');
    } else {
      console.log(i);
    }
  }
}

solve();
`,
      cpp: `#include <iostream>

using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    for (int i = 1; i <= n; i++) {
        if (i % 15 == 0) cout << "FizzBuzz\n";
        else if (i % 3 == 0) cout << "Fizz\n";
        else if (i % 5 == 0) cout << "Buzz\n";
        else cout << i << "\n";
    }
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNextInt()) return;
        int n = scanner.nextInt();
        for (int i = 1; i <= n; i++) {
            if (i % 15 == 0) System.out.println("FizzBuzz");
            else if (i % 3 == 0) System.out.println("Fizz");
            else if (i % 5 == 0) System.out.println("Buzz");
            else System.out.println(i);
        }
    }
}
`,
    },
  },
  {
    title: 'Palindrome Check',
    slug: 'palindrome-check',
    difficulty: 'easy',
    category: 'dsa',
    tags: ['string', 'two-pointers'],
    constraints: '1 <= s.length <= 2 * 10^5\ns consists only of printable ASCII characters.',
    description: `# Palindrome Check

A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers.

Given a string \`s\`, print \`true\` if it is a palindrome, or \`false\` otherwise.

### Input Format
- A single line containing the string \`s\`.

### Output Format
- Print \`true\` or \`false\`.`,
    sampleTestCases: [
      {
        input: 'A man, a plan, a canal: Panama\n',
        expectedOutput: 'true',
      },
      {
        input: 'race a car\n',
        expectedOutput: 'false',
      },
    ],
    hiddenTestCases: [
      {
        input: ' \n',
        expectedOutput: 'true',
      },
      {
        input: 'ab_a\n',
        expectedOutput: 'true',
      },
      {
        input: '0P\n',
        expectedOutput: 'false',
      },
      {
        input: 'Was it a car or a cat I saw?\n',
        expectedOutput: 'true',
      },
      {
        input: 'Madam, I\'m Adam\n',
        expectedOutput: 'true',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    s = sys.stdin.read().rstrip('\\r\\n')
    filtered = [ch.lower() for ch in s if ch.isalnum()]
    if filtered == filtered[::-1]:
        print("true")
    else:
        print("false")

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const input = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
  const clean = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rev = clean.split('').reverse().join('');
  console.log(clean === rev ? 'true' : 'false');
}

solve();
`,
      cpp: `#include <iostream>
#include <string>
#include <cctype>

using namespace std;

int main() {
    string s;
    if (!getline(cin, s)) return 0;
    string clean = "";
    for (char c : s) {
        if (isalnum(c)) {
            clean += tolower(c);
        }
    }
    int l = 0, r = clean.length() - 1;
    bool isPal = true;
    while (l < r) {
        if (clean[l] != clean[r]) {
            isPal = false;
            break;
        }
        l++;
        r--;
    }
    cout << (isPal ? "true" : "false") << endl;
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNextLine()) return;
        String s = scanner.nextLine();
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (Character.isLetterOrDigit(c)) {
                sb.append(Character.toLowerCase(c));
            }
        }
        String clean = sb.toString();
        String rev = sb.reverse().toString();
        System.out.println(clean.equals(rev) ? "true" : "false");
    }
}
`,
    },
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    difficulty: 'easy',
    category: 'dsa',
    tags: ['string', 'stack'],
    constraints: '1 <= s.length <= 10^5\ns consists of parentheses only \`()\`, \`{}\`, \`[]\`.',
    description: `# Valid Parentheses

Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

### Input Format
- A single line containing the string \`s\`.

### Output Format
- Print \`true\` if valid, or \`false\` otherwise.`,
    sampleTestCases: [
      {
        input: '()[]{}\n',
        expectedOutput: 'true',
      },
      {
        input: '(]\n',
        expectedOutput: 'false',
      },
    ],
    hiddenTestCases: [
      {
        input: '()\n',
        expectedOutput: 'true',
      },
      {
        input: '([)]\n',
        expectedOutput: 'false',
      },
      {
        input: '{[]}\n',
        expectedOutput: 'true',
      },
      {
        input: '(((((\n',
        expectedOutput: 'false',
      },
      {
        input: ']\n',
        expectedOutput: 'false',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    s = sys.stdin.read().strip()
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for ch in s:
        if ch in mapping:
            top = stack.pop() if stack else '#'
            if mapping[ch] != top:
                print("false")
                return
        else:
            stack.append(ch)
    print("true" if not stack else "false")

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const s = fs.readFileSync(0, 'utf-8').trim();
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (map[ch]) {
      const top = stack.length > 0 ? stack.pop() : '#';
      if (top !== map[ch]) {
        console.log('false');
        return;
      }
    } else {
      stack.push(ch);
    }
  }
  console.log(stack.length === 0 ? 'true' : 'false');
}

solve();
`,
      cpp: `#include <iostream>
#include <string>
#include <stack>
#include <unordered_map>

using namespace std;

int main() {
    string s;
    if (!(cin >> s)) return 0;
    stack<char> st;
    unordered_map<char, char> m = {{')', '('}, {'}', '{'}, {']', '['}};
    for (char c : s) {
        if (m.count(c)) {
            if (st.empty() || st.top() != m[c]) {
                cout << "false" << endl;
                return 0;
            }
            st.pop();
        } else {
            st.push(c);
        }
    }
    cout << (st.empty() ? "true" : "false") << endl;
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNext()) return;
        String s = scanner.next();
        Stack<Character> stack = new Stack<>();
        Map<Character, Character> map = new HashMap<>();
        map.put(')', '(');
        map.put('}', '{');
        map.put(']', '[');

        for (char c : s.toCharArray()) {
            if (map.containsKey(c)) {
                if (stack.isEmpty() || stack.pop() != map.get(c)) {
                    System.out.println("false");
                    return;
                }
            } else {
                stack.push(c);
            }
        }
        System.out.println(stack.isEmpty() ? "true" : "false");
    }
}
`,
    },
  },
  {
    title: 'Maximum Subarray',
    slug: 'maximum-subarray',
    difficulty: 'medium',
    category: 'dsa',
    tags: ['array', 'dynamic-programming', 'divide-and-conquer'],
    constraints: '1 <= n <= 10^5\n-10^4 <= nums[i] <= 10^4',
    description: `# Maximum Subarray

Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

A subarray is a contiguous non-empty sequence of elements within an array.

### Input Format
- Line 1: An integer \`n\` (number of elements).
- Line 2: \`n\` space-separated integers representing the array.

### Output Format
- Print the maximum subarray sum on a single line.`,
    sampleTestCases: [
      {
        input: '9\n-2 1 -3 4 -1 2 1 -5 4\n',
        expectedOutput: '6',
      },
      {
        input: '1\n1\n',
        expectedOutput: '1',
      },
    ],
    hiddenTestCases: [
      {
        input: '5\n5 4 -1 7 8\n',
        expectedOutput: '23',
      },
      {
        input: '4\n-1 -2 -3 -4\n',
        expectedOutput: '-1',
      },
      {
        input: '6\n-2 -1 -3 -4 -1 -2\n',
        expectedOutput: '-1',
      },
      {
        input: '5\n1 2 3 4 5\n',
        expectedOutput: '15',
      },
      {
        input: '8\n2 -1 2 3 4 -5 6 -2\n',
        expectedOutput: '11',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    nums = [int(x) for x in tokens[1:1 + n]]
    
    max_sum = nums[0]
    curr_sum = nums[0]
    for x in nums[1:]:
        curr_sum = max(x, curr_sum + x)
        max_sum = max(max_sum, curr_sum)
    print(max_sum)

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
  if (!tokens || tokens.length < 2 || tokens[0] === '') return;
  const n = parseInt(tokens[0], 10);
  const nums = tokens.slice(1, 1 + n).map(Number);

  let maxSum = nums[0];
  let currSum = nums[0];
  for (let i = 1; i < nums.length; i++) {
    currSum = Math.max(nums[i], currSum + nums[i]);
    maxSum = Math.max(maxSum, currSum);
  }
  console.log(maxSum);
}

solve();
`,
      cpp: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    int n;
    if (!(cin >> n)) return 0;
    vector<long long> nums(n);
    for (int i = 0; i < n; i++) {
        cin >> nums[i];
    }
    long long maxSum = nums[0];
    long long currSum = nums[0];
    for (int i = 1; i < n; i++) {
        currSum = max(nums[i], currSum + nums[i]);
        maxSum = max(maxSum, currSum);
    }
    cout << maxSum << endl;
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNextInt()) return;
        int n = scanner.nextInt();
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) {
            nums[i] = scanner.nextLong();
        }
        long maxSum = nums[0];
        long currSum = nums[0];
        for (int i = 1; i < n; i++) {
            currSum = Math.max(nums[i], currSum + nums[i]);
            maxSum = Math.max(maxSum, currSum);
        }
        System.out.println(maxSum);
    }
}
`,
    },
  },
  {
    title: 'Merge Two Sorted Arrays',
    slug: 'merge-two-sorted-arrays',
    difficulty: 'medium',
    category: 'dsa',
    tags: ['array', 'two-pointers', 'sorting'],
    constraints: '0 <= n, m <= 10^5\n1 <= n + m <= 2 * 10^5\n-10^9 <= A[i], B[j] <= 10^9',
    description: `# Merge Two Sorted Arrays

You are given two integer arrays \`nums1\` and \`nums2\`, sorted in non-decreasing order. Merge them into a single sorted array in non-decreasing order.

### Input Format
- Line 1: Two space-separated integers \`n\` and \`m\` (sizes of the two arrays).
- Line 2: \`n\` space-separated integers for \`nums1\` (if \`n\` > 0).
- Line 3: \`m\` space-separated integers for \`nums2\` (if \`m\` > 0).

### Output Format
- Print the merged sorted array on a single line separated by spaces.`,
    sampleTestCases: [
      {
        input: '3 3\n1 2 3\n2 5 6\n',
        expectedOutput: '1 2 2 3 5 6',
      },
      {
        input: '1 0\n1\n\n',
        expectedOutput: '1',
      },
    ],
    hiddenTestCases: [
      {
        input: '0 1\n\n1\n',
        expectedOutput: '1',
      },
      {
        input: '3 3\n1 3 5\n2 4 6\n',
        expectedOutput: '1 2 3 4 5 6',
      },
      {
        input: '4 2\n-5 -2 0 4\n-3 1\n',
        expectedOutput: '-5 -3 -2 0 1 4',
      },
      {
        input: '2 2\n2 2\n2 2\n',
        expectedOutput: '2 2 2 2',
      },
      {
        input: '5 3\n10 20 30 40 50\n5 25 35\n',
        expectedOutput: '5 10 20 25 30 35 40 50',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    m = int(tokens[1])
    a = [int(x) for x in tokens[2:2 + n]]
    b = [int(x) for x in tokens[2 + n:2 + n + m]]

    i, j = 0, 0
    res = []
    while i < n and j < m:
        if a[i] <= b[j]:
            res.append(str(a[i]))
            i += 1
        else:
            res.append(str(b[j]))
            j += 1
    while i < n:
        res.append(str(a[i]))
        i += 1
    while j < m:
        res.append(str(b[j]))
        j += 1
    print(' '.join(res))

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
  if (!tokens || tokens.length < 2 || tokens[0] === '') return;
  const n = parseInt(tokens[0], 10);
  const m = parseInt(tokens[1], 10);
  const a = tokens.slice(2, 2 + n).map(Number);
  const b = tokens.slice(2 + n, 2 + n + m).map(Number);

  let i = 0;
  let j = 0;
  const res = [];
  while (i < n && j < m) {
    if (a[i] <= b[j]) {
      res.push(a[i++]);
    } else {
      res.push(b[j++]);
    }
  }
  while (i < n) res.push(a[i++]);
  while (j < m) res.push(b[j++]);
  console.log(res.join(' '));
}

solve();
`,
      cpp: `#include <iostream>
#include <vector>

using namespace std;

int main() {
    int n, m;
    if (!(cin >> n >> m)) return 0;
    vector<long long> a(n), b(m);
    for (int i = 0; i < n; i++) cin >> a[i];
    for (int i = 0; i < m; i++) cin >> b[i];

    int i = 0, j = 0;
    bool first = true;
    while (i < n && j < m) {
        if (!first) cout << " ";
        if (a[i] <= b[j]) {
            cout << a[i++];
        } else {
            cout << b[j++];
        }
        first = false;
    }
    while (i < n) {
        if (!first) cout << " ";
        cout << a[i++];
        first = false;
    }
    while (j < m) {
        if (!first) cout << " ";
        cout << b[j++];
        first = false;
    }
    cout << endl;
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        if (!scanner.hasNextInt()) return;
        int n = scanner.nextInt();
        int m = scanner.nextInt();
        long[] a = new long[n];
        long[] b = new long[m];
        for (int i = 0; i < n; i++) a[i] = scanner.nextLong();
        for (int i = 0; i < m; i++) b[i] = scanner.nextLong();

        int i = 0, j = 0;
        StringBuilder sb = new StringBuilder();
        while (i < n && j < m) {
            if (a[i] <= b[j]) {
                sb.append(a[i++]).append(" ");
            } else {
                sb.append(b[j++]).append(" ");
            }
        }
        while (i < n) sb.append(a[i++]).append(" ");
        while (j < m) sb.append(b[j++]).append(" ");
        System.out.println(sb.toString().trim());
    }
}
`,
    },
  },
  {
    title: 'Longest Substring Without Repeating Characters',
    slug: 'longest-substring-without-repeating-characters',
    difficulty: 'medium',
    category: 'dsa',
    tags: ['string', 'sliding-window', 'hash-table'],
    constraints: '0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.',
    description: `# Longest Substring Without Repeating Characters

Given a string \`s\`, find the length of the **longest substring** without repeating characters.

### Input Format
- A single line containing the string \`s\`.

### Output Format
- Print an integer denoting the length of the longest substring without repeating characters.`,
    sampleTestCases: [
      {
        input: 'abcabcbb\n',
        expectedOutput: '3',
      },
      {
        input: 'bbbbb\n',
        expectedOutput: '1',
      },
    ],
    hiddenTestCases: [
      {
        input: 'pwwkew\n',
        expectedOutput: '3',
      },
      {
        input: '\n',
        expectedOutput: '0',
      },
      {
        input: 'abcdef\n',
        expectedOutput: '6',
      },
      {
        input: 'aab\n',
        expectedOutput: '2',
      },
      {
        input: 'dvdf\n',
        expectedOutput: '3',
      },
    ],
    starterCode: {
      python: `import sys

def solve():
    s = sys.stdin.read().rstrip('\\r\\n')
    last_idx = {}
    max_len = 0
    start = 0
    for i, ch in enumerate(s):
        if ch in last_idx and last_idx[ch] >= start:
            start = last_idx[ch] + 1
        last_idx[ch] = i
        max_len = max(max_len, i - start + 1)
    print(max_len)

if __name__ == '__main__':
    solve()
`,
      javascript: `const fs = require('fs');

function solve() {
  const s = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');
  const lastIdx = new Map();
  let maxLen = 0;
  let start = 0;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (lastIdx.has(ch) && lastIdx.get(ch) >= start) {
      start = lastIdx.get(ch) + 1;
    }
    lastIdx.set(ch, i);
    maxLen = Math.max(maxLen, i - start + 1);
  }
  console.log(maxLen);
}

solve();
`,
      cpp: `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    string s;
    if (!getline(cin, s)) {
        cout << 0 << endl;
        return 0;
    }
    vector<int> last(256, -1);
    int maxLen = 0, start = 0;
    for (int i = 0; i < (int)s.length(); i++) {
        unsigned char c = s[i];
        if (last[c] >= start) {
            start = last[c] + 1;
        }
        last[c] = i;
        maxLen = max(maxLen, i - start + 1);
    }
    cout << maxLen << endl;
    return 0;
}
`,
      java: `// Note: File must be Main.java with class Main
import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        String s = scanner.hasNextLine() ? scanner.nextLine() : "";
        Map<Character, Integer> lastIdx = new HashMap<>();
        int maxLen = 0;
        int start = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (lastIdx.containsKey(c) && lastIdx.get(c) >= start) {
                start = lastIdx.get(c) + 1;
            }
            lastIdx.put(c, i);
            maxLen = Math.max(maxLen, i - start + 1);
        }
        System.out.println(maxLen);
    }
}
`,
    },
  },
];

const seedDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena';
    await mongoose.connect(mongoUri);

    for (const problem of problems) {
      await Problem.findOneAndUpdate(
        { slug: problem.slug },
        problem,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log(`Seeded ${problems.length} problems successfully.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seedDB();
