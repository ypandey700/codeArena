const mongoose = require('mongoose');
const Problem = require('../src/models/Problem');
const { starterCodeFor } = require('../src/services/starterCode');

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
    starterCode: starterCodeFor('two-sum'),
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
    starterCode: starterCodeFor('reverse-string'),
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
    starterCode: starterCodeFor('fizzbuzz'),
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
    starterCode: starterCodeFor('palindrome-check'),
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
    starterCode: starterCodeFor('valid-parentheses'),
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
    starterCode: starterCodeFor('maximum-subarray'),
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
    starterCode: starterCodeFor('merge-two-sorted-arrays'),
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
    starterCode: starterCodeFor('longest-substring-without-repeating-characters'),
  },
];

const seedDB = async () => {
  try {
    require('dotenv').config({ path: __dirname + '/../.env' });
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena';
    await mongoose.connect(mongoUri);

    const constantSpace = new Set(['fizzbuzz', 'palindrome-check', 'maximum-subarray']);
    for (const problem of problems) {
      problem.optimalTime = 'O(n)';
      problem.optimalSpace = constantSpace.has(problem.slug) ? 'O(1)' : 'O(n)';
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

if (require.main === module) seedDB();

module.exports = { problems };
