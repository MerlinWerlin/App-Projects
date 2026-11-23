// LiquidlineStore (1.0.0): the 7-day free trial (com.jared797.liquidline.trial7, a A$0 non-consumable the person starts,
// Guideline 3.1.1) and the one-time unlock (com.jared797.liquidline.unlock), with StoreKit 2 only. No receipts, no
// server, no analytics: StoreKit verifies each signed transaction on the iPhone and keeps the entitlements.
// The trial's start is its transaction's purchaseDate, so deleting and reinstalling Liquidline never resets it.
// Product ids come from JS (src/core/access.ts). Pattern: apps/glaze/modules/glaze-store, with Transaction
// written as StoreKit.Transaction (ExpoModulesCore / SwiftUI also declare a Transaction type).
// JS side: src/native/store.ts -> NativeModule "LiquidlineStore".

import ExpoModulesCore
import Foundation
import StoreKit

public class LiquidlineStoreModule: Module {
  private var updatesTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("LiquidlineStore")

    Events("onEntitlementChange")

    OnCreate {
      self.startUpdatesListener()
    }

    OnDestroy {
      self.updatesTask?.cancel()
      self.updatesTask = nil
    }

    AsyncFunction("isAvailable") { () -> Bool in
      return AppStore.canMakePayments
    }

    AsyncFunction("getProducts") { (ids: [String], promise: Promise) in
      Task {
        do {
          let products = try await Product.products(for: ids)
          let list: [[String: Any]] = products.map { product in
            let row: [String: Any] = ["id": product.id, "displayPrice": product.displayPrice, "displayName": product.displayName]
            return row
          }
          promise.resolve(list)
        } catch {
          promise.resolve([[String: Any]]())
        }
      }
    }

    AsyncFunction("purchase") { (id: String, promise: Promise) in
      Task {
        let result = await LiquidlineStoreKit.purchase(id: id)
        promise.resolve(result)
      }
    }

    AsyncFunction("entitlements") { (ids: [String], promise: Promise) in
      Task {
        let list = await LiquidlineStoreKit.entitlements(ids: ids)
        promise.resolve(list)
      }
    }

    AsyncFunction("restore") { (ids: [String], promise: Promise) in
      Task {
        var syncError: Error? = nil
        do {
          try await AppStore.sync()
        } catch {
          syncError = error
        }
        let list = await LiquidlineStoreKit.entitlements(ids: ids)
        if list.isEmpty, let syncError {
          promise.reject("ERR_LIQUIDLINE_STORE_RESTORE", String(describing: syncError))
        } else {
          promise.resolve(list)
        }
      }
    }
  }

  private func startUpdatesListener() {
    updatesTask?.cancel()
    updatesTask = Task.detached { [weak self] in
      for await update in StoreKit.Transaction.updates {
        guard case .verified(let transaction) = update else { continue }
        await transaction.finish()
        let body: [String: Any] = ["productId": transaction.productID]
        self?.sendEvent("onEntitlementChange", body)
      }
    }
  }
}

@available(iOS 15.0, *)
enum LiquidlineStoreKit {
  static func failed(_ code: String, _ message: String) -> [String: Any] {
    let payload: [String: Any] = ["status": "failed", "code": code, "message": message]
    return payload
  }

  static func row(_ transaction: StoreKit.Transaction) -> [String: Any] {
    let payload: [String: Any] = [
      "productId": transaction.productID,
      "purchaseDate": transaction.purchaseDate.timeIntervalSince1970 * 1000,
      "revoked": transaction.revocationDate != nil,
    ]
    return payload
  }

  /// Verified transactions for ids: current entitlements first, then the full history for any id not found there
  /// (the trial's start date must survive even if StoreKit stops listing a free item as a current entitlement).
  static func entitlements(ids: [String]) async -> [[String: Any]] {
    var out: [[String: Any]] = []
    var found = Set<String>()
    for await entitlement in StoreKit.Transaction.currentEntitlements {
      guard case .verified(let transaction) = entitlement else { continue }
      if ids.contains(transaction.productID) && !found.contains(transaction.productID) {
        out.append(row(transaction))
        found.insert(transaction.productID)
      }
    }
    if found.count < ids.count {
      for await item in StoreKit.Transaction.all {
        guard case .verified(let transaction) = item else { continue }
        if ids.contains(transaction.productID) && !found.contains(transaction.productID) {
          out.append(row(transaction))
          found.insert(transaction.productID)
        }
      }
    }
    return out
  }

  static func purchase(id: String) async -> [String: Any] {
    let product: Product
    do {
      let products = try await Product.products(for: [id])
      guard let first = products.first else {
        return failed("product-not-found", "The App Store did not return \(id).")
      }
      product = first
    } catch {
      return failed("products-error", String(describing: error))
    }

    do {
      let result = try await product.purchase()
      switch result {
      case .success(let verification):
        switch verification {
        case .verified(let transaction):
          await transaction.finish()
          let payload: [String: Any] = ["status": "purchased"]
          return payload
        case .unverified(_, let error):
          return failed("unverified", String(describing: error))
        }
      case .userCancelled:
        let payload: [String: Any] = ["status": "cancelled"]
        return payload
      case .pending:
        let payload: [String: Any] = ["status": "pending"]
        return payload
      @unknown default:
        return failed("unknown-result", "StoreKit returned an unknown purchase result.")
      }
    } catch {
      if let storeError = error as? StoreKitError {
        switch storeError {
        case .userCancelled:
          let payload: [String: Any] = ["status": "cancelled"]
          return payload
        case .networkError:
          return failed("network", String(describing: error))
        default:
          return failed("storekit-error", String(describing: error))
        }
      }
      return failed("purchase-error", String(describing: error))
    }
  }
}
