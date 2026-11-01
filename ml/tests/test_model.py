"""Tests for the transformer. Run from the repo root:

    python -m unittest discover -s ml/tests -t ml
"""

from __future__ import annotations

import math
import unittest

try:
    import torch
except ImportError:  # the tokenizer tests still run without PyTorch
    raise unittest.SkipTest("PyTorch is not installed")

from askalfonso.data import collate, encode_example
from askalfonso.model import GPT, IGNORE_INDEX, GPTConfig
from askalfonso.prompt import SPECIAL_TOKENS
from askalfonso.tokenizer import BPETokenizer

SMALL = GPTConfig(vocab_size=300, block_size=32, n_layer=2, n_head=2, n_embd=32, dropout=0.0)


def small_model() -> GPT:
    torch.manual_seed(0)
    return GPT(SMALL).eval()


class ModelTests(unittest.TestCase):
    def test_output_shape(self):
        logits, loss = small_model()(torch.randint(0, 300, (3, 10)))
        self.assertEqual(logits.shape, (3, 10, 300))
        self.assertIsNone(loss)

    def test_initial_loss_is_near_uniform(self):
        # Targets must be unrelated to the inputs: with tied weights, "predict the
        # same token you're reading" is slightly easier than chance even untrained.
        x, y = torch.randint(0, 300, (4, 16)), torch.randint(0, 300, (4, 16))
        _, loss = small_model()(x, y)
        self.assertAlmostEqual(loss.item(), math.log(300), delta=0.3)

    def test_causal_mask_blocks_the_future(self):
        model = small_model()
        x = torch.randint(0, 300, (1, 12))
        changed = x.clone()
        changed[0, 7] = (changed[0, 7] + 1) % 300
        a, _ = model(x)
        b, _ = model(changed)
        self.assertTrue(torch.allclose(a[0, :7], b[0, :7], atol=1e-6))  # before position 7: identical
        self.assertFalse(torch.allclose(a[0, 7:], b[0, 7:]))  # from 7 on: affected

    def test_attention_rows_sum_to_one_and_are_lower_triangular(self):
        model = small_model()
        model(torch.randint(0, 300, (1, 9)), keep_attention=True)
        maps = model.attention_maps()
        self.assertEqual(len(maps), SMALL.n_layer)
        w = maps[0][0, 0]  # layer 0, batch 0, head 0: (T, T)
        self.assertTrue(torch.allclose(w.sum(-1), torch.ones(9), atol=1e-6))
        self.assertTrue(torch.all(w.triu(diagonal=1) == 0))

    def test_ignored_targets_do_not_count(self):
        model = small_model()
        x = torch.randint(0, 300, (1, 8))
        y = torch.randint(0, 300, (1, 8))
        y[0, :4] = IGNORE_INDEX  # grade only positions 4..7
        logits, loss = model(x, y)
        manual = torch.nn.functional.cross_entropy(logits[0, 4:], y[0, 4:])
        self.assertAlmostEqual(loss.item(), manual.item(), places=5)

    def test_weights_are_tied(self):
        model = small_model()
        self.assertIs(model.lm_head.weight, model.tok_emb.weight)

    def test_rejects_sequences_longer_than_block_size(self):
        with self.assertRaises(ValueError):
            small_model()(torch.zeros(1, SMALL.block_size + 1, dtype=torch.long))

    def test_generate_stops_at_stop_token(self):
        model = small_model()
        # Force the model to always predict token 5 by biasing the output layer.
        with torch.no_grad():
            model.lm_head.weight.zero_()
            model.lm_head.weight[5] = 1.0
            model.ln_f.weight.fill_(1.0)
        out = model.generate(torch.tensor([[1, 2, 3]]), max_new_tokens=10, temperature=0, stop_token=5)
        self.assertEqual(out[0].tolist()[-1], 5)
        self.assertLessEqual(out.shape[1], 3 + 10)

    def test_can_overfit_one_sequence(self):
        torch.manual_seed(0)
        model = GPT(SMALL)
        x = torch.randint(0, 300, (1, 16))
        opt = torch.optim.AdamW(model.parameters(), lr=3e-3)
        for _ in range(150):
            _, loss = model(x[:, :-1], x[:, 1:])
            opt.zero_grad()
            loss.backward()
            opt.step()
        self.assertLess(loss.item(), 0.1)


class DataTests(unittest.TestCase):
    def setUp(self):
        self.tok = BPETokenizer(special_tokens=SPECIAL_TOKENS)

    def test_only_answer_tokens_are_graded(self):
        e = encode_example(self.tok, "ctx", "q?", "yes", max_len=100)
        graded = [t for t in e.targets if t != IGNORE_INDEX]
        # "yes" is 3 byte tokens, plus <|end|>.
        self.assertEqual(self.tok.decode(graded), "yes<|end|>")
        self.assertEqual(len(e.input_ids), len(e.targets))

    def test_too_long_examples_are_rejected(self):
        self.assertIsNone(encode_example(self.tok, "x" * 200, "q?", "a", max_len=50))

    def test_collate_pads_inputs_and_ignores_padding(self):
        a = encode_example(self.tok, "c", "q", "a", 100)
        b = encode_example(self.tok, "longer context", "q", "a", 100)
        x, y = collate([a, b], pad_id=self.tok.token_id("<|pad|>"))
        self.assertEqual(x.shape, y.shape)
        pad_len = x.shape[1] - len(a.input_ids)
        self.assertTrue(torch.all(y[0, -pad_len:] == IGNORE_INDEX))


if __name__ == "__main__":
    unittest.main()
