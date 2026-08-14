# Severity prediction — baseline experiments

Of the 314,068 interaction pairs, **130,470 carry a severity label** and
**183,598 do not**. The unlabelled ones currently surface in the UI as
`Unknown`, which tells a clinician nothing. Can they be predicted?

```
python 01_baseline.py     # how much is predictable, and from what
python 02_experiments.py  # is it real, and where does it stop working
python 03_apply.py        # how many gaps can responsibly be filled
python 04_export.py       # write the deployable predictions file
```

Scripts 01–03 read `../server/src/data/interactions.json` and write nothing.
Only `04_export.py` produces output.

### Environment

Results below were produced with:

| | Version |
|---|---|
| Python | 3.11.9 |
| scikit-learn | 1.9.0 |
| numpy | 2.3.4 |

`HistGradientBoostingClassifier` output can shift across scikit-learn releases
even with `SEED=42` fixed, so **`predictions.json` is committed as the artefact
of record** rather than regenerated on deploy. Re-run `04_export.py` only when
the interaction data changes, and note the versions if they differ from these.

### The web app does not need Python

`04_export.py` writes predictions as data, and no model is serialised. The
server reads that file at startup like any other; `npm install` remains the only
setup step. Delete `predictions.json` and the app runs exactly as it did before,
minus the predicted tier.

---

## 1. Where the signal is

Random 80/20 split of the labelled pairs. Accuracy is a poor guide on its own —
74% of pairs are `Moderate`, so guessing that every time already scores 0.74.
**Macro-F1 is the number to read.**

| Model | Accuracy | Macro-F1 |
|---|---|---|
| Always predict `Moderate` | 0.7411 | 0.2838 |
| Mechanism template only | 0.7449 | **0.3097** |
| Drug profile + graph, no text | 0.8541 | **0.7536** |
| Combined | **0.8610** | **0.7691** |

**The description text is nearly worthless.** It moves macro-F1 from 0.284 to
0.310 — barely off the floor. This is worth stating plainly rather than burying:
the source descriptions are templated (187 distinct forms cover the corpus, the
top 10 cover 71%), so once drug names are masked out they carry a mechanism
category and little else.

Almost all the signal is the **drug's own severity history** — how the rest of
that medicine's interactions were graded. Warfarin's interactions skew Major;
that tendency generalises to its unrated pairs. This is a real effect, but it is
a much weaker claim than "the model understands drug interactions", and the
write-up should say so.

Per-class, combined model:

| | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Major | 0.76 | 0.67 | 0.71 | 5,387 |
| Moderate | 0.89 | 0.93 | 0.91 | 19,338 |
| Minor | 0.79 | 0.60 | 0.69 | 1,369 |

Major recall of 0.67 is the clinically important weakness: **one in three
genuinely Major interactions is graded lower.** For a safety tool that is the
error that matters, and it argues for showing predictions as a supplement to the
curated tiers, never as a replacement.

## 2. Is it real, and where does it break?

### A. Leakage control

The same pipeline trained on randomly shuffled labels:

| | Accuracy | Macro-F1 |
|---|---|---|
| Majority baseline | 0.7411 | 0.2838 |
| **Trained on shuffled labels** | **0.6342** | **0.3220** |
| Trained on real labels | 0.8610 | 0.7691 |

Shuffling destroys the result — it lands *below* the majority baseline. Nothing
is leaking. Leave-one-out on the drug profiles is doing its job.

### B. Unseen drugs — the honest limitation

Holding out 289 of 1,927 drugs entirely, so no training pair touches them:

| Test slice | Accuracy | Macro-F1 |
|---|---|---|
| Majority baseline | 0.7343 | 0.2823 |
| At least one drug unseen | 0.7296 | 0.4973 |
| **Both drugs unseen** | **0.6218** | **0.3380** |
| Exactly one unseen | 0.7398 | 0.5123 |

**With both drugs unseen the model is barely above guessing.** It has learned
per-drug tendencies, not transferable pharmacology — it cannot reason about a
medicine it has no history for. A new drug entering the market gets nothing
useful from this model.

Experiment 1's random split could not have revealed this: it left only **23**
genuinely-unseen rows out of 26,094. Reporting only that split would have
overstated the result considerably.

### C. Confidence thresholds

The system does not have to answer every pair. Staying silent when unsure:

| Threshold | Coverage | Accuracy | Macro-F1 |
|---|---|---|---|
| none | 100.0% | 0.8610 | 0.7691 |
| 0.70 | 89.9% | 0.8959 | 0.8097 |
| 0.80 | 83.9% | 0.9147 | 0.8336 |
| **0.90** | **74.3%** | **0.9401** | **0.8707** |
| 0.95 | 64.9% | 0.9587 | 0.9007 |

A usable operating point: **answer 74% of pairs at 94% accuracy, decline the
rest.** Declining to answer is a legitimate output for a clinical tool, and it
fits the same "state the boundary of what was checked" principle the unrecognised-
drug handling already follows.

## 3. How many gaps can actually be filled?

Test accuracy only transfers if the unlabelled pairs resemble the test set — and
after §2B, that means both drugs need labelled history.

| Unlabelled pairs | Count | Share |
|---|---|---|
| **Warm** — both drugs well covered | 105,788 | 57.6% |
| **Cold** — a drug has no labelled history | 75,386 | 41.1% |
| Thin — a drug has fewer than 5 | 2,424 | 1.3% |

Applying both filters — warm drugs *and* confidence ≥ 0.90:

> **56,342 pairs — 30.7% of the gap — can be filled responsibly.**
> (1,802 Major · 54,132 Moderate · 408 Minor)

Not the 183,598 headline. Roughly **31%**, and the remaining 69% must keep
saying `Unknown`. That is the finding, and it is a more defensible one than a
single accuracy figure.

### Face validity

The highest-confidence `Major` predictions, as a clinical sanity check:

| Confidence | Pair | Plausible mechanism |
|---|---|---|
| 1.000 | Amisulpride + Pimozide | both QT-prolonging antipsychotics |
| 1.000 | Amisulpride + Clozapine | additive antipsychotic toxicity |
| 0.999 | Tryptophan + Zolmitriptan | serotonin syndrome |
| 0.999 | Frovatriptan + Tryptophan | serotonin syndrome |
| 0.999 | Ibutilide + Pimozide | both QT-prolonging |
| 0.999 | Almotriptan + Tryptophan | serotonin syndrome |

These are recognisable interaction classes rather than arbitrary pairs, which is
weak evidence the metrics reflect something real. It is **not** clinical
validation — see below.

---

## 4. What ships

`04_export.py` writes the 56,342 pairs above to
`../server/src/data/predictions.json` (4.7 MB) as newline-delimited JSON:

```json
{"pairKey": "clarithromycin||lumefantrine", "severity": "Major", "confidence": 0.9534}
```

Two thresholds gate it, and both are duplicated in `server/src/store.js` —
**they must be changed together**:

| Constant | Value | Why |
|---|---|---|
| `MIN_HISTORY` / `MIN_LABELLED_HISTORY` | 5 | below this a drug has no usable profile (§2B) |
| `MIN_CONFIDENCE` | 0.90 | 94% accuracy at 74% coverage (§2C) |

The server attaches these to records **already sitting at `Unknown`**, in
separate `predictedSeverity` / `confidence` / `source` fields. The `severity`
field is never written to, so an estimate cannot be mistaken for — or overwrite
— a graded interaction. In the UI they are hidden behind an explicit opt-in.

Pairs left without an estimate are reported with a reason rather than passed
over: `insufficient-data` when a drug falls below `MIN_HISTORY`, `low-confidence`
otherwise. Of the 127,256 unpredicted pairs, 77,810 are the former and 49,446
the latter.

## Limitations to state in the write-up

- **Accuracy is measured against DDInter's labels, not against clinical truth.**
  The correct claim is "86% agreement with the source dataset's severity
  grading", never "86% clinically correct". Establishing the latter needs
  clinician review of a sample, which this does not attempt.
- **No transfer to new drugs** (§2B). The model encodes per-drug tendencies.
- **Major recall is 0.67** — the least safe error is the commonest one.
- **Class imbalance** (74% Moderate) makes headline accuracy flattering;
  macro-F1 is reported alongside everywhere for that reason.
- **The mechanism text contributes almost nothing** (§1), so describing this as
  an NLP system would misrepresent it.
- The 183,598 `Unknown` pairs are unlabelled, **not** known-safe. Absence of a
  severity grade is absence of data.
