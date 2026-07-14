# Generated Content Evaluation

Word Quest uses a deterministic gate plus human educator/guardian review. A passing automated score means that a question meets the repository's structural and safety baseline; it does not mean the item is automatically classroom-ready.

## Run the Baseline

```bash
npm run test:eval
```

The baseline uses synthetic material only and makes no provider request. A pack must contain at least five questions and every automated axis must pass. The result always keeps `humanReviewRequired: true`.

The offline matrix adds ten labeled fixtures across three material forms and all three analyzed difficulty bands:

| Material | Form | Difficulty | Coverage |
| --- | --- | --- | --- |
| Kite story | Narrative | Easy | Passing item plus structure, distractor, and difficulty negatives |
| Seed-growing directions | Procedural | Medium | Passing inference item plus answer-integrity and support negatives |
| Ancient bridge passage | Informational | Hard | Passing contextual-meaning item plus grounding and safety negatives |

Each negative fixture declares which rubric axis must reject it. The benchmark measures agreement with those labels, not merely the share of questions that pass. This catches both unsafe false passes and overly strict false failures.

`GENERATED_CONTENT_OFFLINE_REFERENCE` stores the reference fixture/material counts and per-axis agreement rates. `evaluateGeneratedContentBenchmark` reports:

- overall and per-difficulty axis agreement rates
- per-axis `improved`, `stable`, or `regressed` trends against the stored reference
- exact case/axis mismatches and automated findings
- per-case evaluation results with all human-review prompts preserved

Any regression fails the focused test. Updating the reference requires reviewing the changed fixture labels and the rendered learner interaction; do not update it only to make CI green.

## Rubric

| Axis | Automated pass criteria | Human reviewer checks |
| --- | --- | --- |
| Structure | One visible task; supported mode; four options; visible blank for fill-blank | The learner can understand what to do without guessing the interface contract |
| Answer integrity | Valid answer index; `correctAnswer` matches the indexed option | The keyed answer is actually correct, unambiguous, and supported |
| Grounding | Source span is present in the supplied material; reading skill matches the stem; transfer retains one objective | The item tests language learning, not incidental memory or outside knowledge |
| Distractors | Four distinct, non-placeholder options | Wrong options are plausible, parallel, and reveal useful misconceptions |
| Support | Hint and explanation exist; explanation is substantive; hint does not repeat the answer | Hint scaffolds without giving away the answer; explanation teaches why |
| Difficulty | Declared difficulty and vocabulary stay within the analyzed material profile | Sentence length, abstraction, and reasoning load suit the intended learner |
| Safety | No internal/provider metadata, non-English payload leakage, or known unsuitable primary-learning patterns | Wording is age-appropriate, inclusive, non-stereotyping, and suitable in context |

## Synthetic Examples

Study text:

> Mia saw dark clouds, so she took an umbrella because it might rain.

Passing direction:

- Question: `Why did Mia take an umbrella?`
- Correct answer: `It might rain`
- Hint: `Look at the weather clue.`
- Explanation: `Dark clouds show that it might rain.`

Failing patterns:

- incorrect answer: `correctAnswer` points to a different option than `correct_index`
- weak distractors: `Option A`, duplicate choices, or choices with no grammatical parallel
- unsupported difficulty: vocabulary outside the material profile or reasoning beyond the declared level
- generic retrieval: a reading question asks for an isolated fact without testing detail, reference, inference, contextual meaning, discourse, or pragmatics
- weak support: the hint repeats the answer or the explanation only says `Yes.`
- unsuitable wording: explicit self-harm, sexual, illegal-drug, or graphic-violence instructions

## Review Workflow

1. Run the question through `evaluateGeneratedQuestion` or the full pack through `evaluateGeneratedContentPack`.
2. Reject or repair every automated finding; do not waive safety, answer-integrity, or grounding failures.
3. Have an educator/guardian answer the `humanReviewPrompt` for each axis.
4. Sample the rendered interaction, not only the JSON, because mode and hint behavior affect item quality.
5. Record only synthetic examples in tests, issues, pull requests, and public screenshots.
6. Compare `axisTrends` with the checked-in reference and investigate every regression by material and difficulty before changing a threshold.

When a prompt, sanitizer, or provider input changes, update the synthetic baseline and tests for malformed JSON, answer mismatch, unsuitable content, and fallback behavior.
