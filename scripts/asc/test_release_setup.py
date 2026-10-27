"""Offline tests for optional release setup; no Apple credentials or requests are used."""
import contextlib
import importlib.util
import io
import hashlib
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("asc", Path(__file__).with_name("asc.py"))
asc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(asc)


class ReleaseSetupTests(unittest.TestCase):
    def iap_fixture(self):
        item = {"productId": "cue.plus", "referenceName": "Cue Plus", "displayName": "Cue Plus",
                "description": "Voice tools", "reviewNote": "Manual trial", "type": "NON_CONSUMABLE"}
        product = {"id": "p", "attributes": {"productId": "cue.plus", "name": "Cue Plus", "reviewNote": "Old automatic trial"}}
        loc = {"id": "l", "attributes": {"locale": "en-AU", "name": "Cue Plus", "description": "Old"}}
        return item, product, loc

    def test_existing_iap_copy_is_updated_without_recreating_product_or_price(self):
        item, product, loc = self.iap_fixture()
        with patch.object(asc, "get", side_effect=[{"data": [product]}, {"data": [loc]}, {"data": [{"id": "price"}]}]), patch.object(asc, "call") as call:
            asc.ensure_iap("cue", item, "en-AU")
        self.assertEqual([(x.args[0], x.args[1]) for x in call.call_args_list], [("PATCH", "/v2/inAppPurchases/p"), ("PATCH", "/v1/inAppPurchaseLocalizations/l")])
        self.assertEqual(call.call_args_list[0].args[2]["data"]["attributes"], {"reviewNote": "Manual trial"})

    def test_matching_iap_metadata_and_screenshot_are_idempotent(self):
        item, product, loc = self.iap_fixture()
        product["attributes"]["reviewNote"] = item["reviewNote"]
        loc["attributes"]["description"] = item["description"]
        item.update(reviewScreenshot="shot.png", replaceReviewScreenshot=True)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / "shot.png").write_bytes(b"image")
            screenshot = {"id": "shot", "attributes": {"sourceFileChecksum": hashlib.md5(b"image").hexdigest()}}
            with patch.object(asc, "ROOT", root), patch.object(asc, "get", side_effect=[{"data": [product]}, {"data": [loc]}, {"data": screenshot}, {"data": [{"id": "price"}]}]), patch.object(asc, "call") as call, patch.object(asc, "upload_asset") as upload:
                asc.ensure_iap("cue", item, "en-AU")
            call.assert_not_called(); upload.assert_not_called()

    def test_changed_screenshot_is_replaced_only_with_explicit_flag(self):
        for replace in (False, True):
            item, product, loc = self.iap_fixture()
            item.update(reviewScreenshot="shot.png", replaceReviewScreenshot=replace)
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory); (root / "shot.png").write_bytes(b"new")
                with patch.object(asc, "ROOT", root), patch.object(asc, "get", side_effect=[{"data": [product]}, {"data": [loc]}, {"data": {"id": "shot", "attributes": {"sourceFileChecksum": "old"}}}, {"data": [{"id": "price"}]}]), patch.object(asc, "call") as call, patch.object(asc, "upload_asset") as upload:
                    asc.ensure_iap("cue", item, "en-AU")
                deletes = [x for x in call.call_args_list if x.args[0] == "DELETE"]
                self.assertEqual(len(deletes), int(replace)); self.assertEqual(upload.call_count, int(replace))

    def test_empty_manual_prices_creates_requested_free_trial_price(self):
        item, product, loc = self.iap_fixture(); item["price"] = {"territory": "AUS", "amount": "0.00"}
        with patch.object(asc, "get", side_effect=[{"data": [product]}, {"data": [loc]}, {"data": []}, {"data": [{"id": "free", "attributes": {"customerPrice": "0.0"}}]}]), patch.object(asc, "call") as call:
            asc.ensure_iap("cue", item, "en-AU")
        self.assertEqual(call.call_args.args[:2], ("POST", "/v1/inAppPurchasePriceSchedules"))
        self.assertEqual(call.call_args.args[2]["included"][0]["relationships"]["inAppPurchasePricePoint"]["data"]["id"], "free")
        self.assertEqual(call.call_args.args[2]["included"][0]["relationships"]["inAppPurchaseV2"]["data"]["id"], "p")

    def test_price_auth_error_does_not_create_price(self):
        item, product, loc = self.iap_fixture()
        with patch.object(asc, "get", side_effect=[{"data": [product]}, {"data": [loc]}, RuntimeError("GET -> 401")]), patch.object(asc, "call") as call:
            with self.assertRaisesRegex(RuntimeError, "401"):
                asc.ensure_iap("cue", item, "en-AU")
        self.assertFalse(any(x.args[0] == "POST" for x in call.call_args_list))

    def test_unexpected_price_response_does_not_write_a_schedule(self):
        item, product, loc = self.iap_fixture()
        with patch.object(asc, "get", side_effect=[{"data": [product]}, {"data": [loc]}, {"data": {"id": "placeholder"}}]), patch.object(asc, "call") as call:
            with self.assertRaisesRegex(RuntimeError, "Unexpected manual price response"):
                asc.ensure_iap("cue", item, "en-AU")
        self.assertFalse(any(x.args[0] == "POST" for x in call.call_args_list))

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
