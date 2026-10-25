// GlazeStore (T152): buys and restores Glaze Plus, one non-consumable in-app purchase, with
// StoreKit 2 only. No receipts, no server, no analytics: StoreKit verifies the signed transaction
// on the iPhone (VerificationResult) and keeps the entitlement (Transaction.currentEntitlements).
//
// The product id is passed in from JS (src/core/iapFlow.ts PLUS_SKU), so it lives in one place.
// In TestFlight and development builds StoreKit uses the sandbox automatically: Apple's sheet says
// so and nothing is charged (docs/IAP_SANDBOX.md).
//
// Deployment target: the podspec sets iOS 15.1 (the app's target), and StoreKit 2 needs iOS 15.0,
// so the helper is also marked @available(iOS 15.0, *).
//
// NOT YET COMPILED OR TESTED ON A DEVICE. Only long-standing StoreKit 2 APIs from iOS 15.0 are used:
// Product.products(for:), product.purchase(), VerificationResult, transaction.finish(),
// Transaction.currentEntitlements, Transaction.updates, AppStore.sync().
//
// JS side: src/native/store.ts (adapter) -> NativeModule "GlazeStore".

import ExpoModulesCore
import Foundation
import StoreKit

public class GlazeStoreModule: Module {
  private var updatesTask: Task<Void, Never>?

  public func definition() -> ModuleDefinition {
    Name("GlazeStore")

    Events("onEntitlementChange")

    // Transactions that finish outside a purchase() call (Ask to Buy approved later, a purchase on
    // another device, a refund) arrive here. Finish verified ones and tell JS.
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

    /// { id, displayPrice, displayName } or nil when App Store Connect doesn't return the product
    /// (product not created yet, or the Paid Applications Agreement isn't active).
    AsyncFunction("getProduct") { (id: String, promise: Promise) in
      Task {
        do {
          let products = try await Product.products(for: [id])
          guard let product = products.first else {
            promise.resolve(nil)
            return
          }
          let payload: [String: Any] = [
            "id": product.id,
            "displayPrice": product.displayPrice,
            "displayName": product.displayName,
          ]
          promise.resolve(payload)
        } catch {
          promise.resolve(nil)
        }
      }
    }

    /// Always resolves with { status: "purchased" | "cancelled" | "pending" | "failed", code?, message? }.
    AsyncFunction("purchase") { (id: String, promise: Promise) in
      Task {
        let result = await GlazeStoreKit.purchase(id: id)
        promise.resolve(result)
      }
    }

    AsyncFunction("isOwned") { (id: String, promise: Promise) in
      Task {
        let owned = await GlazeStoreKit.isOwned(id: id)
        promise.resolve(owned)
      }
    }

    /// Restore purchases: AppStore.sync() (may ask the person to sign in), then the entitlement
    /// check. Resolves true/false; rejects only when the sync failed and nothing is owned.
    AsyncFunction("restore") { (id: String, promise: Promise) in
      Task {
        var syncError: Error? = nil
        do {
          try await AppStore.sync()
        } catch {
          syncError = error
        }
        let owned = await GlazeStoreKit.isOwned(id: id)
        if owned {
          promise.resolve(true)
        } else if let syncError {
          promise.reject("ERR_GLAZE_STORE_RESTORE", String(describing: syncError))
        } else {
          promise.resolve(false)
        }
      }
    }
  }

  private func startUpdatesListener() {
    updatesTask?.cancel()
    updatesTask = Task.detached { [weak self] in
      for await update in Transaction.updates {
        guard case .verified(let transaction) = update else { continue }
        await transaction.finish()
        let body: [String: Any] = [
          "productId": transaction.productID,
          "owned": transaction.revocationDate == nil,
        ]
        self?.sendEvent("onEntitlementChange", body)
      }
    }
  }
}

// MARK: - StoreKit 2 helpers

@available(iOS 15.0, *)
enum GlazeStoreKit {
  static func failed(_ code: String, _ message: String) -> [String: Any] {
    let payload: [String: Any] = ["status": "failed", "code": code, "message": message]
    return payload
  }

  static func purchase(id: String) async -> [String: Any] {
    let product: Product
    do {
      let products = try await Product.products(for: [id])
      guard let first = products.first else {
        // Most often: the product isn't set up in App Store Connect yet, or the Paid Applications
        // Agreement isn't active (docs/IAP_SANDBOX.md).
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
        // Ask to Buy or a bank check: the transaction arrives later on Transaction.updates.
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
      if let purchaseError = error as? Product.PurchaseError {
        return failed("purchase-error", String(describing: purchaseError))
      }
      return failed("purchase-error", String(describing: error))
    }
  }

  /// A verified, unrevoked transaction for id in the current entitlements.
  static func isOwned(id: String) async -> Bool {
    for await entitlement in Transaction.currentEntitlements {
      guard case .verified(let transaction) = entitlement else { continue }
      if transaction.productID == id && transaction.revocationDate == nil {
        return true
      }
    }
    return false
  }
}
