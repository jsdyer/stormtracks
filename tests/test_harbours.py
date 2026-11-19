from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from harbours import residuals


class HarbourTests(unittest.TestCase):
    def test_quality_flags_and_missing_timestamps(self):
        observed = [{"eventDate": str(i), "qcFlagCode": quality, "value": value}
                    for i, quality, value in [(0, "1", 1.4), (1, "2", 0.7), (2, "1", 1.1), (3, 1, 2)]]
        predicted = [{"eventDate": str(i), "value": value} for i, value in [(0, 1.414), (1, 0.5), (3, 2)]]
        self.assertEqual(residuals(["0", "1", "2", "3"], observed, predicted), [-0.014, None, None, 0])

    def test_conflicting_good_readings_require_review(self):
        rows = [{"eventDate": "t", "value": value, "qcFlagCode": "1"} for value in [1, 2]]
        with self.assertRaises(ValueError):
            residuals(["t"], rows, [])
