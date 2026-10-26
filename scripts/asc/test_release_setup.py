"""Offline tests for optional release setup; no Apple credentials or requests are used."""
import contextlib
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("asc", Path(__file__).with_name("asc.py"))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)


class ReleaseSetupTests(unittest.TestCase):
    def test_existing_contact_is_preserved_without_source_lookup(self):
        current = dict.fromkeys(asc.CONTACT_FIELDS, "existing")
        with patch.object(asc, "get") as get:
            self.assertEqual(asc.review_contact(current, "linework"), current)
            get.assert_not_called()

    def test_source_only_fills_missing_contact_without_logging_values(self):
        source = {k: "private-" + k for k in asc.CONTACT_FIELDS}
        with patch.object(asc, "app_cfg", return_value=({"ascAppId": "source"}, {})), \
             patch.object(asc, "get", side_effect=[{"data": [{"id": "v"}]}, {"data": {"attributes": source}}]), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            result = asc.review_contact({"contactEmail": "existing@example.invalid"}, "linework")
        self.assertEqual(result["contactEmail"], "existing@example.invalid")
        self.assertEqual(result["contactPhone"], source["contactPhone"])
        self.assertNotIn("private-", output.getvalue())

    def test_incomplete_source_does_not_invent_contact(self):
        with patch.object(asc, "app_cfg", return_value=({"ascAppId": "source"}, {})), \
             patch.object(asc, "get", side_effect=[{"data": [{"id": "v"}]}, {"data": {"attributes": {"contactFirstName": "A"}}}]):
            self.assertEqual(asc.review_contact({}, "linework"), {})

    def test_availability_preserves_existing_selection(self):
        with patch.object(asc, "get", return_value={"data": {"id": "availability"}}), patch.object(asc, "call") as call:
            asc.ensure_iap_availability("product")
            call.assert_not_called()

    def test_missing_availability_is_created_with_returned_territories(self):
        with patch.object(asc, "get", side_effect=[RuntimeError("GET -> 404"), {"data": [{"id": "AUS"}, {"id": "NZL"}]}]), \
             patch.object(asc, "call") as call:
            asc.ensure_iap_availability("product")
        method, path, body = call.call_args.args
        self.assertEqual((method, path), ("POST", "/v1/inAppPurchaseAvailabilities"))
        relationships = body["data"]["relationships"]
        self.assertEqual(relationships["inAppPurchase"]["data"]["id"], "product")
        self.assertEqual([x["id"] for x in relationships["availableTerritories"]["data"]], ["AUS", "NZL"])

    def test_auth_failure_does_not_create_availability(self):
        with patch.object(asc, "get", side_effect=RuntimeError("GET -> 401")), patch.object(asc, "call") as call:
            with self.assertRaisesRegex(RuntimeError, "401"):
                asc.ensure_iap_availability("product")
            call.assert_not_called()

    def test_partial_territory_list_does_not_change_availability(self):
        with patch.object(asc, "get", side_effect=[{"data": None}, {"data": [{"id": "AUS"}], "links": {"next": "more"}}]), \
             patch.object(asc, "call") as call:
            with self.assertRaisesRegex(RuntimeError, "pagination"):
                asc.ensure_iap_availability("product")
            call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
