# POS Self Order - Payment Processing Fix

## Overview

This module extends the standard Odoo `pos_self_order` controller with a dedicated endpoint for marking orders as paid. It provides a clean 2-step workflow for mobile applications while maintaining full compatibility with the existing "Pay at Counter" workflow.

## Problem Statement

The default `pos_self_order` controller always creates orders in `draft` state (for Pay at Counter workflow). Mobile apps need a way to submit paid orders, but doing this in a single step can be problematic for validation and error handling.

## Solution

This module adds a new endpoint `/pos-self-order/mark-order-paid` that provides:

1. **2-Step Workflow** - Create draft order first, then mark as paid separately
2. **Full Validation** - Validates order state, payments, session, amounts (like Odoo's standard validation)
3. **Secure Access** - Uses both `access_token` (POS config) and `order_access_token` (order-specific)
4. **Clean Architecture** - No override of existing endpoints (better maintainability)
5. **Comprehensive Logging** - Detailed logs for debugging and troubleshooting

## How It Works

### 2-Step Workflow

#### Step 1: Create Draft Order
```dart
// Kiosk app creates order as draft via standard endpoint
final orderResult = await http.post(
  Uri.parse('$baseUrl/pos-self-order/process-order/$deviceType/'),
  body: jsonEncode({
    'order': orderData,
    'access_token': accessToken,
    'table_identifier': tableId,
  }),
);

int orderId = orderResult['pos.order'][0]['id'];
String orderAccessToken = orderResult['pos.order'][0]['access_token'];
```

#### Step 2: Attach Payments & Mark as Paid
```dart
// Attach payment via sync_from_ui
await http.post(
  Uri.parse('$baseUrl/web/dataset/call_kw/pos.order/sync_from_ui'),
  body: jsonEncode({
    'model': 'pos.order',
    'method': 'sync_from_ui',
    'args': [[{
      'id': orderId,
      'payment_ids': [[0, 0, {
        'payment_method_id': paymentMethodId,
        'amount': totalAmount,
      }]],
    }]],
  }),
);

// Mark order as paid
final paidResult = await http.post(
  Uri.parse('$baseUrl/pos-self-order/mark-order-paid'),
  body: jsonEncode({
    'order_id': orderId,
    'access_token': accessToken,
    'order_access_token': orderAccessToken,
  }),
);
```

### Validation Process

The `mark_order_paid` endpoint performs 11 validation steps:

1. **✓ POS Config Access** - Verifies `access_token` is valid
2. **✓ Active Session** - Ensures POS has an active session
3. **✓ Order Exists** - Confirms order ID exists in database
4. **✓ Order Access** - Validates `order_access_token` matches
5. **✓ Order State** - Ensures order is in `draft` state
6. **✓ Session Match** - Verifies order belongs to current session
7. **✓ Payment Records** - Checks that `payment_ids` exist
8. **✓ Payment Methods** - Validates methods are configured for POS
9. **✓ Payment Amounts** - Ensures payments cover order total
10. **✓ Mark as Paid** - Calls `action_pos_order_paid()`
11. **✓ Process Order** - Finalizes with `_process_saved_order()`

### Processing Flow

```
Step 1: Create Draft Order
├─ process_order endpoint
├─ Creates order in draft state
└─ Returns order_id + order_access_token

Step 2: Attach Payments
├─ sync_from_ui method
├─ Adds payment_ids to order
└─ Order still in draft state

Step 3: Mark as Paid
├─ mark_order_paid endpoint
├─ Validates 11 checkpoints
├─ Marks order as paid
├─ Processes order (picking, costs, invoice)
└─ Returns updated order data
```

## Installation

1. **Copy module to addons directory**
   ```bash
   cp -r pos_self_order_payment_fix /path/to/odoo/Custom-odoo-18/
   ```

2. **Update apps list**
   - Go to Apps menu
   - Click "Update Apps List"

3. **Install module**
   - Search for "POS Self Order - Payment Processing Fix"
   - Click "Install"

## Configuration

No configuration needed. The module works automatically once installed.

## New Endpoint

### `/pos-self-order/mark-order-paid`

**Method**: POST (JSON-RPC)

**Parameters**:
- `order_id` (int) - ID of the order to mark as paid
- `access_token` (str) - POS config access token
- `order_access_token` (str) - Order-specific access token

**Returns**:
```json
{
  "pos.order": [...],
  "pos.order.line": [...],
  "pos.payment": [...],
  "pos.payment.method": [...],
  "product.attribute.custom.value": [...]
}
```

**Errors**:
- `400 BadRequest` - Validation failed (see error message for details)
- `401 Unauthorized` - Invalid access tokens
- `404 MissingError` - Order not found

## Usage

### For Mobile App Developers (2-Step Process)

#### Step 1: Create Draft Order
```dart
final orderData = {
  'data': {
    'name': 'Order-${DateTime.now().millisecondsSinceEpoch}',
    'lines': [
      [0, 0, {
        'product_id': productId,
        'qty': quantity,
        'price_unit': price,
      }]
    ],
    'amount_total': totalAmount,
  }
};

final orderResult = await _callOdooEndpoint(
  url: '$baseUrl/pos-self-order/process-order/mobile/',
  params: {
    'order': orderData,
    'access_token': accessToken,
    'table_identifier': tableId,
    'device_type': 'mobile',
  }
);

// Extract order details
int orderId = orderResult['pos.order'][0]['id'];
String orderAccessToken = orderResult['pos.order'][0]['access_token'];
```

#### Step 2: Attach Payment & Mark as Paid
```dart
// First, attach payment via sync_from_ui
await _callOdooMethod(
  model: 'pos.order',
  method: 'sync_from_ui',
  args: [[{
    'id': orderId,
    'payment_ids': [[0, 0, {
      'payment_method_id': paymentMethodId,
      'amount': totalAmount,
    }]],
  }]],
);

// Then mark as paid
final paidResult = await _callOdooEndpoint(
  url: '$baseUrl/pos-self-order/mark-order-paid',
  params: {
    'order_id': orderId,
    'access_token': accessToken,
    'order_access_token': orderAccessToken,
  }
);

// Order is now paid and processed!
```

### For Pay at Counter Workflow

**Nothing changes!** Orders without payments remain in draft state:

```dart
// Just create the order - no payment step needed
final orderResult = await _callOdooEndpoint(
  url: '$baseUrl/pos-self-order/process-order/mobile/',
  params: {
    'order': orderData,
    'access_token': accessToken,
    'table_identifier': tableId,
    'device_type': 'mobile',
  }
);
// Order remains in draft state for payment at counter
```

## Testing

After installation, verify the following scenarios:

### Test 1: Draft Order Creation
```bash
# Create draft order via process_order endpoint
# Expected: Order created with state='draft'
curl -X POST "$BASE_URL/pos-self-order/process-order/mobile/" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","params":{"order":{...},"access_token":"..."}}'
```

### Test 2: Mark Order as Paid (Valid Payment)
```bash
# 1. Create draft order (get order_id and order_access_token)
# 2. Attach payment via sync_from_ui
# 3. Mark as paid
curl -X POST "$BASE_URL/pos-self-order/mark-order-paid" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","params":{"order_id":123,"access_token":"...","order_access_token":"..."}}'

# Expected: Order marked as paid, state='paid', response includes full order data
```

### Test 3: Validation - No Payments
```bash
# Try to mark order as paid without attaching payments
# Expected: 400 BadRequest - "Order has no payment records"
```

### Test 4: Validation - Insufficient Payment
```bash
# Attach payment for 30.00, but order total is 50.00
# Expected: 400 BadRequest - "Order is not fully paid. Total: 50.00, Payments: 30.00"
```

### Test 5: Validation - Invalid Access Token
```bash
# Use wrong order_access_token
# Expected: 401 Unauthorized - "Invalid order access token"
```

### Test 6: Validation - Wrong State
```bash
# Try to mark already paid order as paid again
# Expected: 400 BadRequest - "Order is not in draft state"
```

### Test 7: Cash Rounding
```bash
# Enable cash rounding in POS config
# Create order with total 50.03, payment 50.05
# Expected: Order marked as paid (within rounding tolerance)
```

### Test 8: Mobile App End-to-End
```dart
// 1. Create order
// 2. Attach payment
// 3. Mark as paid
// Expected: Order shows as paid in Odoo POS Orders list
```

## Technical Details

### Dependencies
- `pos_self_order` (Odoo standard module)

### Compatibility
- Odoo 18.0
- Python 3.10+

### Key Methods Added
- `mark_order_paid()` - New endpoint for marking orders as paid with full validation

### Logging
The module provides comprehensive logging for debugging:

```log
INFO: === Mark Order Paid Request: order_id=123 ===
INFO: POS Config verified: Main POS (Session: POS/2024/0001)
INFO: Order verified: Order-00001-001-0001 (state=draft)
INFO: Order Order-00001-001-0001 has 1 payment record(s)
INFO: Payment methods validated: Cash
INFO: Payment validation: amount_total=50.00, payment_total=50.00, currency=SAR
INFO: ✓ Payment validation passed: Order Order-00001-001-0001 is fully paid
INFO: ✓ Order Order-00001-001-0001 marked as paid
INFO: ✓ Order Order-00001-001-0001 processed successfully
INFO: === Mark Order Paid Complete: order=Order-00001-001-0001, state=paid ===
```

**Enable detailed logging:**
```bash
# Add to odoo.conf
log_level = info
log_handler = odoo.addons.pos_self_order_payment_fix.controllers.orders:INFO
```

Check logs at: Settings → Technical → Logging

## Architecture

```
pos_self_order_payment_fix/
├── __init__.py                      # Module initialization
├── __manifest__.py                  # Module metadata
├── controllers/
│   ├── __init__.py                  # Controllers initialization
│   └── orders.py                    # Inherited controller with payment logic
└── README.md                        # This file
```

## Troubleshooting

### Error: "Order has no payment records"

**Cause**: Trying to mark order as paid before attaching payments

**Solution**:
```dart
// Always attach payments BEFORE calling mark_order_paid
await _callOdooMethod(
  model: 'pos.order',
  method: 'sync_from_ui',
  args: [[{
    'id': orderId,
    'payment_ids': [[0, 0, {'payment_method_id': 1, 'amount': 50.00}]],
  }]],
);
```

### Error: "Order is not fully paid"

**Cause**: Payment amount doesn't match order total

**Solution**:
- Check logs for exact amounts: `amount_total=50.00, payment_total=49.50`
- Ensure payment amount >= order total
- Consider cash rounding if enabled

### Error: "Invalid order access token"

**Cause**: Wrong `order_access_token` provided

**Solution**:
```dart
// Always use the access_token returned from process_order
String orderAccessToken = orderResult['pos.order'][0]['access_token'];

// Use this exact token in mark_order_paid
await markOrderPaid(orderId, orderAccessToken);
```

### Error: "Order is not in draft state"

**Cause**: Trying to mark already paid/cancelled order as paid

**Solution**:
- Check order state before calling endpoint
- Only call `mark_order_paid` for orders in draft state
- Don't call endpoint twice for same order

### Error: "Invalid payment methods"

**Cause**: Payment method not configured for POS

**Solution**:
1. Go to: Point of Sale → Configuration → POS
2. Edit your POS config
3. Add payment method to "Payment Methods" field
4. Save and try again

### Endpoint Not Found (404)

**Cause**: Module not installed or Odoo not restarted

**Solution**:
```bash
# 1. Install module
./odoo-bin -d your_db -i pos_self_order_payment_fix --stop-after-init

# 2. Restart Odoo
sudo systemctl restart odoo

# 3. Verify endpoint exists (check logs for route registration)
```

### Module Not Loading

**Symptom**: Endpoint not available after installation

**Solution**:
1. Check if `pos_self_order` is installed (it's a dependency)
2. Restart Odoo server completely
3. Check server logs for import errors:
   ```bash
   tail -f /var/log/odoo/odoo.log | grep pos_self_order_payment_fix
   ```
4. Verify module is in addons path:
   ```bash
   # In odoo.conf
   addons_path = /path/to/odoo/addons,/path/to/Custom-odoo-18
   ```

## Kiosk App Integration Guide

### Complete Service Class

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class PosOrderService {
  final String baseUrl;
  final String accessToken;
  
  PosOrderService(this.baseUrl, this.accessToken);
  
  /// Step 1: Create draft order
  Future<Map<String, dynamic>> createOrder(
    Map<String, dynamic> orderData,
    String tableId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/pos-self-order/process-order/mobile/'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'jsonrpc': '2.0',
        'method': 'call',
        'params': {
          'order': orderData,
          'access_token': accessToken,
          'table_identifier': tableId,
          'device_type': 'mobile',
        }
      }),
    );
    
    final result = jsonDecode(response.body)['result'];
    return {
      'order_id': result['pos.order'][0]['id'],
      'order_access_token': result['pos.order'][0]['access_token'],
      'order': result,
    };
  }
  
  /// Step 2: Attach payment to order
  Future<void> attachPayment(
    int orderId,
    int paymentMethodId,
    double amount,
  ) async {
    await http.post(
      Uri.parse('$baseUrl/web/dataset/call_kw/pos.order/sync_from_ui'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'jsonrpc': '2.0',
        'method': 'call',
        'params': {
          'model': 'pos.order',
          'method': 'sync_from_ui',
          'args': [[{
            'id': orderId,
            'payment_ids': [[0, 0, {
              'payment_method_id': paymentMethodId,
              'amount': amount,
            }]],
          }]],
        }
      }),
    );
  }
  
  /// Step 3: Mark order as paid
  Future<Map<String, dynamic>> markOrderAsPaid(
    int orderId,
    String orderAccessToken,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/pos-self-order/mark-order-paid'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'jsonrpc': '2.0',
        'method': 'call',
        'params': {
          'order_id': orderId,
          'access_token': accessToken,
          'order_access_token': orderAccessToken,
        }
      }),
    );
    
    if (response.statusCode != 200) {
      throw Exception('Failed to mark order as paid: ${response.body}');
    }
    
    return jsonDecode(response.body)['result'];
  }
  
  /// Complete workflow: create order and mark as paid
  Future<Map<String, dynamic>> createPaidOrder({
    required List<dynamic> lines,
    required int paymentMethodId,
    required double totalAmount,
    String? tableId,
  }) async {
    // Step 1: Create draft order
    print('Creating draft order...');
    final orderData = {
      'data': {
        'name': 'Order-${DateTime.now().millisecondsSinceEpoch}',
        'lines': lines,
        'amount_total': totalAmount,
      }
    };
    
    final orderResult = await createOrder(orderData, tableId ?? '');
    final orderId = orderResult['order_id'];
    final orderAccessToken = orderResult['order_access_token'];
    print('✓ Order created: ID=$orderId');
    
    // Step 2: Attach payment
    print('Attaching payment...');
    await attachPayment(orderId, paymentMethodId, totalAmount);
    print('✓ Payment attached');
    
    // Step 3: Mark as paid
    print('Marking order as paid...');
    final paidResult = await markOrderAsPaid(orderId, orderAccessToken);
    print('✓ Order marked as paid');
    
    return paidResult;
  }
}
```

### Usage Example

```dart
void main() async {
  final posService = PosOrderService(
    'https://your-odoo-instance.com',
    'your_access_token_here',
  );
  
  try {
    // Create a paid order
    final result = await posService.createPaidOrder(
      lines: [
        [0, 0, {
          'product_id': 1,
          'qty': 2,
          'price_unit': 25.00,
        }],
      ],
      paymentMethodId: 1,  // Cash
      totalAmount: 50.00,
      tableId: 'table-001',
    );
    
    print('✅ Order created and paid successfully!');
    print('Order state: ${result['pos.order'][0]['state']}');  // 'paid'
    
  } catch (e) {
    print('❌ Error: $e');
  }
}
```

### Error Handling

```dart
Future<void> createOrderWithErrorHandling() async {
  try {
    await posService.createPaidOrder(
      lines: [...],
      paymentMethodId: 1,
      totalAmount: 50.00,
    );
  } on http.ClientException catch (e) {
    // Network error
    print('Network error: $e');
  } catch (e) {
    // Parse error message from Odoo
    final errorMsg = e.toString();
    
    if (errorMsg.contains('no payment records')) {
      print('Payment not attached properly');
    } else if (errorMsg.contains('not fully paid')) {
      print('Payment amount insufficient');
    } else if (errorMsg.contains('Invalid order access token')) {
      print('Security token mismatch');
    } else {
      print('Unknown error: $e');
    }
  }
}
```

## Support

For issues or questions:
- Check server logs for detailed error messages
- Review payment validation logic in `controllers/orders.py`
- Ensure `pos_self_order` module is installed and active

## License

LGPL-3

## Author

Your Company - https://www.yourcompany.com

## Version History

### 18.0.1.0.0 (2025-10-15)
- Initial release
- New `/pos-self-order/mark-order-paid` endpoint
- 2-step workflow: create order → mark as paid
- Full validation (11 checkpoint process)
- Security: dual token validation (access_token + order_access_token)
- Cash rounding support
- Comprehensive logging with detailed error messages
- Backward compatibility with Pay at Counter
- Complete Kiosk integration examples

